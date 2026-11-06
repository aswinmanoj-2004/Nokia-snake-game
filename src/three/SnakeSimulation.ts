import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { soundEngine } from '../audio/soundEngine';
import type {
  CameraPreset,
  DifficultyMode,
  FoodKind,
  GameStatus,
  HudSnapshot,
} from '../types/game';
import {
  createArenaDioramaGroup,
  createFoodGroup,
  createGravityBlockGroup,
  createKineticBumperGroup,
  createSharedSnakeAssets,
  createSlidingBarrierGroup,
  createSnakeHeadGroup,
  createSnakeSegmentGroup,
  createWrapPortalGroup,
  type ArenaDioramaRig,
  type BumperRig,
  type FoodRig,
  type GravityRig,
  type PortalRig,
  type SharedSnakeAssets,
  type SliderRig,
  type SnakeHeadRig,
  type SnakeSegmentRig,
} from './compositeModels';
import { createDioramaTextures, type DioramaTextureSet } from './proceduralTextures';

const ARENA_HALF_SIZE = 14.0;
const WALL_LIMIT = ARENA_HALF_SIZE - 0.58;
const SEGMENT_SPACING = 0.72;
const MAX_SNAKE_SEGMENTS = 180;
const PARTICLE_POOL_SIZE = 96;

interface PathNode {
  x: number;
  z: number;
  jumpBreak: boolean;
}

interface DigestivePulse {
  progress: number; // 0 (head) -> 1 (tail)
  speed: number;
}

interface ActiveFood {
  id: number;
  kind: FoodKind;
  x: number;
  z: number;
  vx: number;
  vz: number;
  ttl: number; // -1 for permanent berry, >0 for timed bonus items
  age: number;
  rig: FoodRig;
}

interface BumperObstacle {
  kind: 'bumper';
  x: number;
  z: number;
  radius: number;
  compression: number;
  compressionVel: number;
  spawnScale: number;
  rig: BumperRig;
}

interface SliderObstacle {
  kind: 'slider';
  baseX: number;
  baseZ: number;
  x: number;
  z: number;
  axis: 'x' | 'z';
  travelSpan: number;
  speed: number;
  phase: number;
  halfW: number;
  halfD: number;
  spawnScale: number;
  rig: SliderRig;
}

interface GravityObstacle {
  kind: 'gravity';
  x: number;
  z: number;
  coreRadius: number;
  fieldRadius: number;
  strength: number;
  spawnScale: number;
  rig: GravityRig;
}

interface PortalObstacle {
  kind: 'portal';
  pairIndex: number;
  x: number;
  z: number;
  partnerIndex: number;
  radius: number;
  spawnScale: number;
  rig: PortalRig;
}

type ArenaObstacle =
  | BumperObstacle
  | SliderObstacle
  | GravityObstacle
  | PortalObstacle;

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
}

// Pre-allocated scratch math helpers (Zero GC in requestAnimationFrame loop)
const _v3A = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _camCurrentPos = new THREE.Vector3(0, 22, 21);
const _camCurrentLook = new THREE.Vector3(0, 0, 0);
const _dummyObj = new THREE.Object3D();
const _tmpColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class SnakeSimulation {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private textures: DioramaTextureSet;
  private arenaRig: ArenaDioramaRig;
  private snakeAssets: SharedSnakeAssets;
  private headRig: SnakeHeadRig;
  private segmentPool: SnakeSegmentRig[] = [];
  private tailTipRig: SnakeSegmentRig;
  private obstacleGroup = new THREE.Group();
  private foodGroup = new THREE.Group();
  private particleMesh: THREE.InstancedMesh;
  private particles: PooledParticle[] = [];

  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onRunFinished: (summary: {
    score: number;
    length: number;
    obstaclesCleared: number;
    difficulty: DifficultyMode;
  }) => void;
  private onContextLostChange?: (lost: boolean) => void;

  // Game & Physics State
  private status: GameStatus = 'TITLE';
  private difficulty: DifficultyMode = 'classic';
  private cameraPreset: CameraPreset = 'diorama';
  private score = 0;
  private highScore = 0;
  private isNewBest = false;
  private length = 5;
  private segmentGrowScales: number[] = [];
  private combo = 1;
  private comboTimer = 0;
  private readonly comboDuration = 5.2;
  private shields = 3;
  private maxShields = 3;
  private obstaclesCleared = 0;
  private deathReason = '';
  private foodsEatenCount = 0;

  // Serpent Kinematics
  private headX = 0;
  private headZ = 5;
  private heading = 0; // 0 = -Z (North), +PI/2 = -X (West), -PI/2 = +X (East)
  private angularVel = 0;
  private speed = 6.8;
  private surgeTimer = 0;
  private invulnTimer = 0;
  private portalCooldown = 0;
  private boostEnergy = 1.0;
  private magnetTimer = 0;
  private pathNodes: PathNode[] = [];
  private pulses: DigestivePulse[] = [];

  // Entities
  private foods: ActiveFood[] = [];
  private nextFoodId = 1;
  private obstacles: ArenaObstacle[] = [];

  // Juice, Hitstop & Camera Shake
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private chaseBank = 0;
  private wallFlash = { north: 0, south: 0, east: 0, west: 0 };
  private elapsed = 0;
  private lastHudSync = 0;

  // Input State
  private heldKeys = new Set<string>();
  private virtualInput = { x: 0, y: 0, boost: false };
  private pointerParallax = { x: 0, y: 0 };
  private touchStartPos: { x: number; y: number } | null = null;
  private touchVector = { x: 0, y: 0 };

  // Loop Handle
  private frameId = 0;
  private lastTimestamp = 0;
  private disposed = false;

  constructor(options: {
    container: HTMLElement;
    initialHighScore: number;
    onHudUpdate: (snapshot: HudSnapshot) => void;
    onRunFinished: (summary: {
      score: number;
      length: number;
      obstaclesCleared: number;
      difficulty: DifficultyMode;
    }) => void;
    onContextLostChange?: (lost: boolean) => void;
  }) {
    this.container = options.container;
    this.highScore = options.initialHighScore;
    this.onHudUpdate = options.onHudUpdate;
    this.onRunFinished = options.onRunFinished;
    this.onContextLostChange = options.onContextLostChange;

    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x162019);
    this.scene.fog = new THREE.FogExp2(0x162019, 0.0115);

    const aspect =
      (this.container.clientWidth || window.innerWidth) /
      Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.25, 160);
    _camCurrentPos.set(0, 23, 21);
    _camCurrentLook.set(0, 0, 0);
    this.camera.position.copy(_camCurrentPos);
    this.camera.lookAt(_camCurrentLook);

    // Mandatory Studio Environment Reflections on EVERY device
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.setupLighting();

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createDioramaTextures(maxAniso);

    this.arenaRig = createArenaDioramaGroup(ARENA_HALF_SIZE, this.textures);
    this.scene.add(this.arenaRig.root);

    this.scene.add(this.obstacleGroup);
    this.scene.add(this.foodGroup);

    // Pre-build articulated serpent head, segment pool, and tapered tail tip
    this.snakeAssets = createSharedSnakeAssets(this.textures);
    this.headRig = createSnakeHeadGroup(this.textures);
    this.scene.add(this.headRig.root);

    for (let i = 0; i < MAX_SNAKE_SEGMENTS; i++) {
      const seg = createSnakeSegmentGroup(this.snakeAssets, false);
      seg.root.visible = false;
      this.scene.add(seg.root);
      this.segmentPool.push(seg);
    }

    this.tailTipRig = createSnakeSegmentGroup(this.snakeAssets, true);
    this.scene.add(this.tailTipRig.root);

    // Pre-build pooled InstancedMesh particles
    const partGeo = new THREE.IcosahedronGeometry(0.13, 0);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(partGeo, partMat, PARTICLE_POOL_SIZE);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(0x9bbc0f),
      });
      _dummyObj.position.set(0, -10, 0);
      _dummyObj.scale.setScalar(0.001);
      _dummyObj.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummyObj.matrix);
      this.particleMesh.setColorAt(i, _tmpColor.setHex(0x9bbc0f));
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    // Initialize live Title Screen demo diorama
    this.resetWorldState('TITLE', 'classic');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitHud(true);

    this.lastTimestamp = performance.now();
    this.scheduleNextFrame();
  }

  private setupLighting(): void {
    // 1. Warm Directional Key Light (single shadow caster with tight frustum)
    const keyLight = new THREE.DirectionalLight(0xfff1db, 2.15);
    keyLight.position.set(16, 26, 14);
    if (!this.isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.near = 4;
      keyLight.shadow.camera.far = 65;
      const d = 20;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    // 2. Cool Sky/Ground Hemisphere Fill
    const hemiLight = new THREE.HemisphereLight(0xa5d8ff, 0x1a261c, 0.85);
    this.scene.add(hemiLight);

    // 3. Back/Rim Directional Light for metallic titanium & serpent scale edge highlights
    const rimLight = new THREE.DirectionalLight(0x9bbc0f, 0.95);
    rimLight.position.set(-18, 12, -16);
    this.scene.add(rimLight);

    // 4. Studio Softbox RectAreaLight on hardware GPUs
    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xeef7e6, 2.2, 22, 8);
      softbox.position.set(0, 18, -14);
      softbox.lookAt(0, 0, 0);
      this.scene.add(softbox);
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('pointermove', this.handlePointerMove);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.onContextLostChange?.(true);
  };

  private handleContextRestored = (): void => {
    this.onContextLostChange?.(false);
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.pointerParallax.x = (e.clientX / w - 0.5) * 2;
    this.pointerParallax.y = (e.clientY / h - 0.5) * 2;
  };

  private handleTouchStart = (e: TouchEvent): void => {
    soundEngine.unlock();
    if (e.touches.length > 0) {
      this.touchStartPos = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.touchStartPos || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - this.touchStartPos.x;
    const dy = e.touches[0].clientY - this.touchStartPos.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 14) {
      this.touchVector.x = dx / dist;
      this.touchVector.y = dy / dist;
    }
  };

  private handleTouchEnd = (): void => {
    this.touchStartPos = null;
    this.touchVector.x = 0;
    this.touchVector.y = 0;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    // Do not intercept typing when user is entering their arcade tag in an input field
    const tagName = (e.target as HTMLElement | null)?.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
      return;
    }

    soundEngine.unlock();
    const code = e.code;

    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    const wasDown = this.heldKeys.has(code);
    this.heldKeys.add(code);

    if (!wasDown) {
      if (code === 'KeyC') {
        this.toggleCameraPreset();
      } else if (code === 'KeyM') {
        this.toggleMute();
      } else if (code === 'Escape' || code === 'KeyP') {
        if (this.status === 'PLAYING') {
          this.setPaused(true);
        } else if (this.status === 'PAUSED') {
          this.setPaused(false);
        }
      } else if (code === 'Enter' || code === 'Space') {
        if (this.status === 'TITLE') {
          this.startNewGame(this.difficulty);
        }
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = (): void => {
    this.heldKeys.clear();
    this.virtualInput.x = 0;
    this.virtualInput.y = 0;
    this.virtualInput.boost = false;
  };

  // Public UI Controls
  public setExternalHighScore(score: number): void {
    if (score > this.highScore) {
      this.highScore = score;
      this.emitHud(true);
    }
  }

  public setDifficulty(diff: DifficultyMode): void {
    this.difficulty = diff;
    if (this.status === 'TITLE') {
      this.resetWorldState('TITLE', diff);
    }
    this.emitHud(true);
  }

  public startNewGame(diff?: DifficultyMode): void {
    soundEngine.unlock();
    const chosen = diff || this.difficulty;
    this.difficulty = chosen;
    this.resetWorldState('PLAYING', chosen);
    soundEngine.playStart();
    this.emitHud(true);
  }

  public returnToTitle(): void {
    this.resetWorldState('TITLE', this.difficulty);
    this.emitHud(true);
  }

  public setPaused(paused: boolean): void {
    if (paused && this.status === 'PLAYING') {
      this.status = 'PAUSED';
      this.emitHud(true);
    } else if (!paused && this.status === 'PAUSED') {
      this.status = 'PLAYING';
      this.emitHud(true);
    }
  }

  public toggleCameraPreset(): CameraPreset {
    this.cameraPreset = this.cameraPreset === 'diorama' ? 'chase' : 'diorama';
    this.emitHud(true);
    return this.cameraPreset;
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    this.emitHud(true);
  }

  public toggleMute(): boolean {
    const muted = soundEngine.toggleMute();
    this.emitHud(true);
    return muted;
  }

  public setVirtualInput(x: number, y: number, boost: boolean): void {
    soundEngine.unlock();
    this.virtualInput.x = x;
    this.virtualInput.y = y;
    this.virtualInput.boost = boost;
  }

  private resetWorldState(nextStatus: GameStatus, diff: DifficultyMode): void {
    this.status = nextStatus;
    this.difficulty = diff;
    this.score = 0;
    this.isNewBest = false;
    this.length = 6;
    this.combo = 1;
    this.comboTimer = 0;
    this.obstaclesCleared = 0;
    this.deathReason = '';
    this.foodsEatenCount = 0;

    this.maxShields = diff === 'classic' ? 3 : diff === 'chaos' ? 2 : 1;
    this.shields = this.maxShields;

    this.headX = 0;
    this.headZ = 6.5;
    this.heading = 0; // Facing North (-Z)
    this.angularVel = 0;
    this.speed = diff === 'classic' ? 6.6 : diff === 'chaos' ? 7.4 : 8.4;
    this.surgeTimer = 0;
    this.invulnTimer = 0;
    this.portalCooldown = 0;
    this.boostEnergy = 1.0;
    this.magnetTimer = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.chaseBank = 0;
    this.pulses = [];
    this.wallFlash = { north: 0, south: 0, east: 0, west: 0 };

    // Initialize continuous spine breadcrumb trail behind starting head
    this.pathNodes = [];
    const totalTrailPts = 120;
    for (let i = 0; i < totalTrailPts; i++) {
      this.pathNodes.push({
        x: this.headX,
        z: this.headZ + i * 0.14,
        jumpBreak: false,
      });
    }

    this.segmentGrowScales = new Array(MAX_SNAKE_SEGMENTS).fill(1);

    // Clear existing obstacles & foods
    this.clearObstacles();
    this.clearFoods();

    // Populate randomized obstacles with guaranteed clearance around snake start (0, 6.5)
    this.populateInitialObstacles(diff);

    // Spawn 2 initial energy berries + 1 bonus item
    this.spawnFood('berry');
    this.spawnFood('berry');
    if (diff !== 'classic') {
      this.spawnFood('amber_crystal');
    }

    this.syncSnakeMeshes();
  }

  private clearObstacles(): void {
    while (this.obstacleGroup.children.length > 0) {
      this.obstacleGroup.remove(this.obstacleGroup.children[0]);
    }
    this.obstacles = [];
  }

  private clearFoods(): void {
    while (this.foodGroup.children.length > 0) {
      this.foodGroup.remove(this.foodGroup.children[0]);
    }
    this.foods = [];
  }

  private isPositionClear(x: number, z: number, minClearance: number): boolean {
    // Keep clear of snake starting corridor
    if (Math.hypot(x - this.headX, z - this.headZ) < minClearance + 2.8) {
      return false;
    }
    if (Math.abs(x) > ARENA_HALF_SIZE - 2.3 || Math.abs(z) > ARENA_HALF_SIZE - 2.3) {
      return false;
    }
    for (const obs of this.obstacles) {
      if (obs.kind === 'bumper') {
        if (Math.hypot(x - obs.x, z - obs.z) < minClearance + obs.radius) return false;
      } else if (obs.kind === 'gravity') {
        if (Math.hypot(x - obs.x, z - obs.z) < minClearance + 2.2) return false;
      } else if (obs.kind === 'portal') {
        if (Math.hypot(x - obs.x, z - obs.z) < minClearance + 1.8) return false;
      } else if (obs.kind === 'slider') {
        const dx = Math.abs(x - obs.baseX);
        const dz = Math.abs(z - obs.baseZ);
        const spanX = obs.axis === 'x' ? obs.travelSpan * 0.5 + 1.6 : 1.2;
        const spanZ = obs.axis === 'z' ? obs.travelSpan * 0.5 + 1.6 : 1.2;
        if (dx < spanX + minClearance && dz < spanZ + minClearance) return false;
      }
    }
    return true;
  }

  private findSafeCoordinates(minClearance: number): { x: number; z: number } | null {
    for (let attempt = 0; attempt < 48; attempt++) {
      const x = THREE.MathUtils.randFloat(-ARENA_HALF_SIZE + 2.6, ARENA_HALF_SIZE - 2.6);
      const z = THREE.MathUtils.randFloat(-ARENA_HALF_SIZE + 2.6, ARENA_HALF_SIZE - 2.6);
      if (this.isPositionClear(x, z, minClearance)) {
        return { x, z };
      }
    }
    return null;
  }

  private populateInitialObstacles(diff: DifficultyMode): void {
    const bumperCount = diff === 'classic' ? 4 : diff === 'chaos' ? 6 : 7;
    const sliderCount = diff === 'classic' ? 2 : diff === 'chaos' ? 3 : 4;
    const gravityCount = diff === 'classic' ? 1 : diff === 'chaos' ? 2 : 3;
    const portalPairs = diff === 'classic' ? 1 : 2;

    for (let i = 0; i < portalPairs; i++) {
      this.spawnPortalPair(i, true);
    }
    for (let i = 0; i < gravityCount; i++) {
      this.spawnGravityBlock(true);
    }
    for (let i = 0; i < sliderCount; i++) {
      this.spawnSlidingBarrier(true);
    }
    for (let i = 0; i < bumperCount; i++) {
      this.spawnKineticBumper(true);
    }
  }

  private spawnKineticBumper(instant = false): void {
    const pos = this.findSafeCoordinates(2.2);
    if (!pos) return;
    const rig = createKineticBumperGroup(this.textures);
    rig.root.position.set(pos.x, 0, pos.z);
    const scale = instant ? 1 : 0.05;
    rig.root.scale.set(1, scale, 1);
    this.obstacleGroup.add(rig.root);

    this.obstacles.push({
      kind: 'bumper',
      x: pos.x,
      z: pos.z,
      radius: 1.06,
      compression: 0,
      compressionVel: 0,
      spawnScale: scale,
      rig,
    });
  }

  private spawnSlidingBarrier(instant = false): void {
    const pos = this.findSafeCoordinates(3.0);
    if (!pos) return;
    const axis: 'x' | 'z' = Math.random() > 0.5 ? 'x' : 'z';
    const travelSpan = THREE.MathUtils.randFloat(4.2, 5.8);
    const rig = createSlidingBarrierGroup(travelSpan, this.textures);
    rig.root.position.set(pos.x, 0, pos.z);
    if (axis === 'z') {
      rig.root.rotation.y = Math.PI / 2;
    }
    const scale = instant ? 1 : 0.05;
    rig.root.scale.set(1, scale, 1);
    this.obstacleGroup.add(rig.root);

    this.obstacles.push({
      kind: 'slider',
      baseX: pos.x,
      baseZ: pos.z,
      x: pos.x,
      z: pos.z,
      axis,
      travelSpan,
      speed: THREE.MathUtils.randFloat(1.25, 1.95),
      phase: THREE.MathUtils.randFloat(0, Math.PI * 2),
      halfW: 1.35,
      halfD: 0.44,
      spawnScale: scale,
      rig,
    });
  }

  private spawnGravityBlock(instant = false): void {
    const pos = this.findSafeCoordinates(2.8);
    if (!pos) return;
    const fieldRadius = 4.4;
    const rig = createGravityBlockGroup(fieldRadius, this.textures);
    rig.root.position.set(pos.x, 0, pos.z);
    const scale = instant ? 1 : 0.05;
    rig.root.scale.set(1, scale, 1);
    this.obstacleGroup.add(rig.root);

    this.obstacles.push({
      kind: 'gravity',
      x: pos.x,
      z: pos.z,
      coreRadius: 0.72,
      fieldRadius,
      strength: this.difficulty === 'overdrive' ? 10.5 : 8.2,
      spawnScale: scale,
      rig,
    });
  }

  private spawnPortalPair(pairIndex: number, instant = false): void {
    const posA = this.findSafeCoordinates(2.5);
    if (!posA) return;
    // Place partner on opposite quadrant with minimum 9-unit separation
    let posB: { x: number; z: number } | null = null;
    for (let attempt = 0; attempt < 36; attempt++) {
      const candidate = this.findSafeCoordinates(2.5);
      if (candidate && Math.hypot(candidate.x - posA.x, candidate.z - posA.z) > 9.0) {
        posB = candidate;
        break;
      }
    }
    if (!posB) return;

    const scale = instant ? 1 : 0.05;
    const rigA = createWrapPortalGroup(pairIndex, this.textures);
    rigA.root.position.set(posA.x, 0, posA.z);
    rigA.root.scale.set(1, scale, 1);
    this.obstacleGroup.add(rigA.root);

    const rigB = createWrapPortalGroup(pairIndex, this.textures);
    rigB.root.position.set(posB.x, 0, posB.z);
    rigB.root.scale.set(1, scale, 1);
    this.obstacleGroup.add(rigB.root);

    const idxA = this.obstacles.length;
    const idxB = idxA + 1;

    this.obstacles.push({
      kind: 'portal',
      pairIndex,
      x: posA.x,
      z: posA.z,
      partnerIndex: idxB,
      radius: 1.05,
      spawnScale: scale,
      rig: rigA,
    });

    this.obstacles.push({
      kind: 'portal',
      pairIndex,
      x: posB.x,
      z: posB.z,
      partnerIndex: idxA,
      radius: 1.05,
      spawnScale: scale,
      rig: rigB,
    });
  }

  private spawnFood(kind: FoodKind): void {
    const pos = this.findSafeCoordinates(1.35) || {
      x: THREE.MathUtils.randFloat(-10, 10),
      z: THREE.MathUtils.randFloat(-10, 10),
    };
    const rig = createFoodGroup(kind, this.textures);
    rig.root.position.set(pos.x, 0, pos.z);
    rig.root.scale.setScalar(0.05);
    this.foodGroup.add(rig.root);

    this.foods.push({
      id: this.nextFoodId++,
      kind,
      x: pos.x,
      z: pos.z,
      vx: 0,
      vz: 0,
      ttl: kind === 'berry' ? -1 : 14.0,
      age: 0,
      rig,
    });
  }

  private emitBurst(x: number, y: number, z: number, hexColor: number, count = 18): void {
    let spawned = 0;
    for (let i = 0; i < PARTICLE_POOL_SIZE && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        const theta = Math.random() * Math.PI * 2;
        const spd = THREE.MathUtils.randFloat(2.2, 7.5);
        p.vx = Math.cos(theta) * spd;
        p.vy = THREE.MathUtils.randFloat(2.4, 6.2);
        p.vz = Math.sin(theta) * spd;
        p.life = 0;
        p.maxLife = THREE.MathUtils.randFloat(0.32, 0.65);
        p.size = THREE.MathUtils.randFloat(0.75, 1.45);
        p.color.setHex(hexColor);
        this.particleMesh.setColorAt(i, p.color);
        spawned++;
      }
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.elapsed += dt;

    if (this.status === 'PLAYING' || this.status === 'TITLE') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      } else {
        this.stepSimulation(dt);
      }
    }

    this.stepParticlesAndVisuals(dt);
    this.stepCamera(dt);

    this.renderer.render(this.scene, this.camera);

    if (now - this.lastHudSync > 90) {
      this.emitHud(false);
      this.lastHudSync = now;
    }

    this.scheduleNextFrame();
  };

  private computeSteeringAndBoost(dt: number): { turnInput: number; boosting: boolean } {
    if (this.status === 'TITLE') {
      // Autonomous demo serpent autopilot
      let targetFood = this.foods[0];
      let bestDist = Infinity;
      for (const f of this.foods) {
        const d = Math.hypot(f.x - this.headX, f.z - this.headZ);
        if (d < bestDist) {
          bestDist = d;
          targetFood = f;
        }
      }

      let desiredHeading = this.heading;
      if (targetFood) {
        const dx = targetFood.x - this.headX;
        const dz = targetFood.z - this.headZ;
        desiredHeading = Math.atan2(-dx, -dz);
      }

      // Avoid walls & obstacles ahead
      const lookAhead = 3.4;
      const fwdX = -Math.sin(this.heading);
      const fwdZ = -Math.cos(this.heading);
      const probeX = this.headX + fwdX * lookAhead;
      const probeZ = this.headZ + fwdZ * lookAhead;

      if (Math.abs(probeX) > WALL_LIMIT - 1.6 || Math.abs(probeZ) > WALL_LIMIT - 1.6) {
        desiredHeading = Math.atan2(this.headX, this.headZ);
      }

      for (const obs of this.obstacles) {
        if (obs.kind === 'slider' || obs.kind === 'gravity') {
          const d = Math.hypot(probeX - obs.x, probeZ - obs.z);
          if (d < 2.6) {
            desiredHeading = normalizeAngle(this.heading + 1.35);
          }
        }
      }

      const diff = normalizeAngle(desiredHeading - this.heading);
      const turnInput = THREE.MathUtils.clamp(diff * 2.2, -1, 1);
      return { turnInput, boosting: false };
    }

    // Human Player Input
    const leftHeld =
      this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft');
    const rightHeld =
      this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight');
    const upHeld =
      this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp');
    const downHeld =
      this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown');
    const boostKey =
      this.heldKeys.has('Space') ||
      this.heldKeys.has('ShiftLeft') ||
      this.heldKeys.has('ShiftRight') ||
      this.virtualInput.boost;

    if (this.cameraPreset === 'chase') {
      // Relative serpent-head steering in 3rd-person Chase Cam
      let turn = 0;
      if (leftHeld) turn += 1;
      if (rightHeld) turn -= 1;
      if (Math.abs(this.virtualInput.x) > 0.15) {
        turn = -this.virtualInput.x;
      } else if (Math.abs(this.touchVector.x) > 0.15) {
        turn = -this.touchVector.x;
      }
      if (Math.abs(turn) > 0.2) {
        soundEngine.playTurnMicroClick();
      }
      const boosting = (boostKey || upHeld) && this.boostEnergy > 0.08;
      return { turnInput: turn, boosting };
    }

    // Camera-aware directional steering in Angled Diorama view
    let dirX = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
    let dirZ = (downHeld ? 1 : 0) - (upHeld ? 1 : 0);

    if (Math.hypot(this.virtualInput.x, this.virtualInput.y) > 0.15) {
      dirX = this.virtualInput.x;
      dirZ = this.virtualInput.y;
    } else if (Math.hypot(this.touchVector.x, this.touchVector.y) > 0.15) {
      dirX = this.touchVector.x;
      dirZ = this.touchVector.y;
    }

    let turnInput = 0;
    if (dirX !== 0 || dirZ !== 0) {
      const targetHeading = Math.atan2(-dirX, -dirZ);
      let diff = normalizeAngle(targetHeading - this.heading);
      // Prevent 180-degree instant self-neck reversal; smoothly carve around U-turn
      if (Math.abs(diff) > 2.65) {
        diff = diff >= 0 ? 2.65 : -2.65;
      }
      turnInput = THREE.MathUtils.clamp(diff * 3.4, -1, 1);
      if (Math.abs(diff) > 0.35) {
        soundEngine.playTurnMicroClick();
      }
    }

    const boosting = boostKey && this.boostEnergy > 0.08;
    void dt;
    return { turnInput, boosting };
  }

  private stepSimulation(dt: number): void {
    // Update timers
    if (this.combo > 1) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboTimer = 0;
      }
    }
    if (this.surgeTimer > 0) this.surgeTimer = Math.max(0, this.surgeTimer - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.portalCooldown > 0) this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);

    // Steering & Momentum Physics
    const { turnInput, boosting } = this.computeSteeringAndBoost(dt);
    const maxTurnRate = 4.35;
    const targetAngVel = turnInput * maxTurnRate;
    this.angularVel = THREE.MathUtils.damp(this.angularVel, targetAngVel, 14, dt);
    this.heading = normalizeAngle(this.heading + this.angularVel * dt);

    if (boosting) {
      this.boostEnergy = Math.max(0, this.boostEnergy - dt * 0.42);
    } else {
      this.boostEnergy = Math.min(1, this.boostEnergy + dt * 0.24);
    }

    // Progressive speed scaling with snake length + boost + bumper surge
    const baseSpeed =
      (this.difficulty === 'classic' ? 6.6 : this.difficulty === 'chaos' ? 7.4 : 8.4) +
      Math.min(3.8, (this.length - 6) * 0.075);
    const boostMult = boosting ? 1.48 : 1.0;
    const surgeMult = this.surgeTimer > 0 ? 1.24 : 1.0;
    const currentSpeed = baseSpeed * boostMult * surgeMult;

    let vx = -Math.sin(this.heading) * currentSpeed;
    let vz = -Math.cos(this.heading) * currentSpeed;

    // Step Obstacles & Gravitational Pull
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.spawnScale < 1) {
        obs.spawnScale = THREE.MathUtils.damp(obs.spawnScale, 1, 8, dt);
        if (obs.spawnScale > 0.99) obs.spawnScale = 1;
        obs.rig.root.scale.set(1, obs.spawnScale, 1);
      }

      if (obs.kind === 'bumper') {
        // Second-order spring rebound on elastomer ring
        const springForce = -190 * obs.compression - 15 * obs.compressionVel;
        obs.compressionVel += springForce * dt;
        obs.compression += obs.compressionVel * dt;
        const c = THREE.MathUtils.clamp(obs.compression, -0.35, 1.15);
        obs.rig.elastomerRing.scale.set(1 + c * 0.28, 1 - c * 0.34, 1 + c * 0.28);
        obs.rig.pistonCap.position.y = 0.84 - c * 0.16;
        obs.rig.ringMat.emissiveIntensity = 0.42 + Math.max(0, c) * 1.8;
      } else if (obs.kind === 'slider') {
        obs.phase += obs.speed * dt;
        const offset = Math.sin(obs.phase) * (obs.travelSpan * 0.5);
        if (obs.axis === 'x') {
          obs.x = obs.baseX + offset;
          obs.z = obs.baseZ;
        } else {
          obs.x = obs.baseX;
          obs.z = obs.baseZ + offset;
        }
        obs.rig.carriage.position.x = offset;
        // Pre-reversal amber/crimson windup telegraph near track ends
        const nearEnd = 1 - Math.abs(Math.cos(obs.phase));
        obs.rig.telegraphMat.emissiveIntensity = 0.65 + nearEnd * 1.9;
      } else if (obs.kind === 'gravity') {
        obs.rig.coreGroup.rotation.y += dt * 1.8;
        obs.rig.coreGroup.rotation.x = Math.sin(this.elapsed * 2.2) * 0.25;
        const pulseCycle = 1 - ((this.elapsed * 0.75) % 1);
        const s = 0.85 + pulseCycle * (obs.fieldRadius - 0.85);
        obs.rig.pulseRing.scale.setScalar(s);
        obs.rig.pulseMat.opacity = (1 - pulseCycle) * 0.38;

        // Apply radial gravitational deflection to snake within fieldRadius
        if (obs.spawnScale > 0.85) {
          const dx = obs.x - this.headX;
          const dz = obs.z - this.headZ;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.2 && dist < obs.fieldRadius) {
            const falloff = 1 - dist / obs.fieldRadius;
            const pull = obs.strength * falloff;
            vx += (dx / dist) * pull * dt * 4.5;
            vz += (dz / dist) * pull * dt * 4.5;
            this.heading = Math.atan2(-vx, -vz);
          }
        }
      } else if (obs.kind === 'portal') {
        obs.rig.vortexMat.uniforms.uTime.value = this.elapsed;
        obs.rig.haloRing.position.y = 0.48 + Math.sin(this.elapsed * 3.5 + obs.pairIndex) * 0.08;
        obs.rig.haloRing.rotation.z = this.elapsed * 1.4;
      }
    }

    // Advance Snake Head Position
    this.headX += vx * dt;
    this.headZ += vz * dt;

    // Check Perimeter Titanium Wall Collisions (Glancing deflection vs Head-on impact)
    if (this.handlePerimeterCollisions(vx, vz)) return;

    // Check Obstacle Collisions
    if (this.handleObstacleCollisions(vx, vz)) return;

    // Check Self-Segment Collisions
    if (this.handleSelfCollision()) return;

    // Record Path Breadcrumb for Articulated Spine Following
    const firstNode = this.pathNodes[0];
    if (!firstNode || Math.hypot(this.headX - firstNode.x, this.headZ - firstNode.z) >= 0.14) {
      this.pathNodes.unshift({ x: this.headX, z: this.headZ, jumpBreak: false });
      const maxNodes = Math.ceil((MAX_SNAKE_SEGMENTS * SEGMENT_SPACING) / 0.14) + 30;
      if (this.pathNodes.length > maxNodes) {
        this.pathNodes.length = maxNodes;
      }
    }

    // Step Peristalsis Digestive Waves & Segment Growth Unfurling
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      this.pulses[i].progress += this.pulses[i].speed * dt;
      if (this.pulses[i].progress >= 1.12) {
        soundEngine.playGrowLock();
        this.pulses.splice(i, 1);
      }
    }

    for (let i = 0; i < this.length; i++) {
      if (this.segmentGrowScales[i] < 1) {
        this.segmentGrowScales[i] = Math.min(1, this.segmentGrowScales[i] + dt * 4.5);
      }
    }

    // Step Food Physics (Gravity Orbit Pull + Magnet Pull + Consumption)
    this.stepFoods(dt);

    // Sync 3D Serpent Meshes
    this.syncSnakeMeshes();
  }

  private handlePerimeterCollisions(vx: number, vz: number): boolean {
    const spd = Math.max(0.01, Math.hypot(vx, vz));
    const dirX = vx / spd;
    const dirZ = vz / spd;

    let hitWall: 'north' | 'south' | 'east' | 'west' | null = null;
    let nx = 0;
    let nz = 0;

    if (this.headZ < -WALL_LIMIT) {
      this.headZ = -WALL_LIMIT;
      hitWall = 'north';
      nx = 0;
      nz = 1;
    } else if (this.headZ > WALL_LIMIT) {
      this.headZ = WALL_LIMIT;
      hitWall = 'south';
      nx = 0;
      nz = -1;
    } else if (this.headX > WALL_LIMIT) {
      this.headX = WALL_LIMIT;
      hitWall = 'east';
      nx = -1;
      nz = 0;
    } else if (this.headX < -WALL_LIMIT) {
      this.headX = -WALL_LIMIT;
      hitWall = 'west';
      nx = 1;
      nz = 0;
    }

    if (!hitWall) return false;

    this.wallFlash[hitWall] = 1.0;
    const impactDot = Math.abs(dirX * nx + dirZ * nz);

    // Shallow glancing scrape deflects smoothly off titanium rail
    if (impactDot < 0.62 || this.status === 'TITLE') {
      const dot = dirX * nx + dirZ * nz;
      const rx = dirX - 1.85 * dot * nx;
      const rz = dirZ - 1.85 * dot * nz;
      this.heading = Math.atan2(-rx, -rz);
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.16);
      this.emitBurst(this.headX, 0.35, this.headZ, 0x9bbc0f, 10);
      soundEngine.playBumperBounce();
      return false;
    }

    // Head-on wall slam
    return this.applyHazardDamage(nx, nz, 'Perimeter Titanium Rail Impact');
  }

  private handleObstacleCollisions(vx: number, vz: number): boolean {
    const spd = Math.max(0.01, Math.hypot(vx, vz));
    const dirX = vx / spd;
    const dirZ = vz / spd;

    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      if (obs.spawnScale < 0.85) continue;

      if (obs.kind === 'bumper') {
        const dx = this.headX - obs.x;
        const dz = this.headZ - obs.z;
        const dist = Math.hypot(dx, dz);
        const minDist = obs.radius + 0.45;
        if (dist < minDist && dist > 0.0001) {
          const nx = dx / dist;
          const nz = dz / dist;
          this.headX = obs.x + nx * (minDist + 0.06);
          this.headZ = obs.z + nz * (minDist + 0.06);

          const dot = dirX * nx + dirZ * nz;
          const rx = dirX - 2.0 * dot * nx;
          const rz = dirZ - 2.0 * dot * nz;
          this.heading = Math.atan2(-rx, -rz);

          obs.compression = 1.0;
          obs.compressionVel = 6.5;
          this.surgeTimer = 0.48;
          this.shakeIntensity = Math.max(this.shakeIntensity, 0.24);
          this.emitBurst(obs.x + nx * obs.radius, 0.45, obs.z + nz * obs.radius, 0xf59e0b, 16);

          if (this.status === 'PLAYING') {
            this.obstaclesCleared++;
            this.addScore(50 * this.combo);
            soundEngine.playBumperBounce();
          }
        }
      } else if (obs.kind === 'portal') {
        if (this.portalCooldown <= 0) {
          const dist = Math.hypot(this.headX - obs.x, this.headZ - obs.z);
          if (dist < obs.radius) {
            const partner = this.obstacles[obs.partnerIndex];
            if (partner && partner.kind === 'portal') {
              const burstColor = obs.pairIndex === 0 ? 0x9bbc0f : 0xf59e0b;
              this.emitBurst(obs.x, 0.45, obs.z, burstColor, 20);

              this.headX = partner.x + dirX * 1.45;
              this.headZ = partner.z + dirZ * 1.45;
              this.portalCooldown = 0.88;
              this.pathNodes.unshift({ x: this.headX, z: this.headZ, jumpBreak: true });

              this.emitBurst(partner.x, 0.45, partner.z, burstColor, 20);
              this.shakeIntensity = Math.max(this.shakeIntensity, 0.18);

              if (this.status === 'PLAYING') {
                this.obstaclesCleared++;
                this.addScore(75 * this.combo);
                soundEngine.playPortalWarp();
              }
              break;
            }
          }
        }
      } else if (obs.kind === 'gravity') {
        const dx = this.headX - obs.x;
        const dz = this.headZ - obs.z;
        const dist = Math.hypot(dx, dz);
        const minDist = obs.coreRadius + 0.44;
        if (dist < minDist && dist > 0.0001) {
          const nx = dx / dist;
          const nz = dz / dist;
          this.headX = obs.x + nx * (minDist + 0.1);
          this.headZ = obs.z + nz * (minDist + 0.1);
          if (this.status === 'TITLE') {
            this.heading = Math.atan2(-nx, -nz);
          } else {
            if (this.applyHazardDamage(nx, nz, 'Gravity Core Monolith Impact')) return true;
          }
        }
      } else if (obs.kind === 'slider') {
        // Transform head into slider local frame
        const relX = this.headX - obs.x;
        const relZ = this.headZ - obs.z;
        const localX = obs.axis === 'x' ? relX : relZ;
        const localZ = obs.axis === 'x' ? relZ : -relX;

        const padX = obs.halfW + 0.42;
        const padZ = obs.halfD + 0.42;

        if (Math.abs(localX) < padX && Math.abs(localZ) < padZ) {
          const overlapX = padX - Math.abs(localX);
          const overlapZ = padZ - Math.abs(localZ);
          let lnx = 0;
          let lnz = 0;
          if (overlapX < overlapZ) {
            lnx = localX >= 0 ? 1 : -1;
          } else {
            lnz = localZ >= 0 ? 1 : -1;
          }

          // Transform normal back to world space
          const wnx = obs.axis === 'x' ? lnx : -lnz;
          const wnz = obs.axis === 'x' ? lnz : lnx;

          this.headX += wnx * (Math.min(overlapX, overlapZ) + 0.08);
          this.headZ += wnz * (Math.min(overlapX, overlapZ) + 0.08);

          const impactDot = Math.abs(dirX * wnx + dirZ * wnz);
          if (impactDot < 0.56 || this.status === 'TITLE') {
            const dot = dirX * wnx + dirZ * wnz;
            const rx = dirX - 1.85 * dot * wnx;
            const rz = dirZ - 1.85 * dot * wnz;
            this.heading = Math.atan2(-rx, -rz);
            this.shakeIntensity = Math.max(this.shakeIntensity, 0.16);
            this.emitBurst(this.headX, 0.4, this.headZ, 0xef4444, 12);
            if (this.status === 'PLAYING') {
              this.obstaclesCleared++;
              this.addScore(30 * this.combo);
              soundEngine.playBumperBounce();
            }
          } else {
            if (this.applyHazardDamage(wnx, wnz, 'Sliding Titanium Barrier Collision')) return true;
          }
        }
      }
    }
    return false;
  }

  private handleSelfCollision(): boolean {
    if (this.status !== 'PLAYING' || this.invulnTimer > 0) return false;

    // Check head against segments i >= 5 (skip immediate neck segments)
    for (let i = 5; i < this.length; i++) {
      const segRig = this.segmentPool[i];
      if (!segRig || !segRig.root.visible) continue;
      const dx = this.headX - segRig.root.position.x;
      const dz = this.headZ - segRig.root.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.66) {
        const nx = dist > 0.001 ? dx / dist : 0;
        const nz = dist > 0.001 ? dz / dist : 1;
        return this.applyHazardDamage(nx, nz, 'Self-Loop Collision');
      }
    }
    return false;
  }

  private applyHazardDamage(nx: number, nz: number, reason: string): boolean {
    if (this.invulnTimer > 0) {
      this.heading = Math.atan2(-nx, -nz);
      return false;
    }

    if (this.shields > 0) {
      this.shields--;
      this.invulnTimer = 1.25;
      this.hitstopTimer = 0.048; // 48ms crisp simulation hitstop
      this.shakeIntensity = 0.46;
      this.heading = Math.atan2(-nx, -nz);
      this.headX += nx * 0.45;
      this.headZ += nz * 0.45;
      this.emitBurst(this.headX, 0.45, this.headZ, 0xef4444, 24);
      soundEngine.playShieldImpact();
      this.emitHud(true);
      return false;
    }

    // Fatal Game Over
    this.deathReason = reason;
    this.status = 'GAME_OVER';
    this.hitstopTimer = 0.065;
    this.shakeIntensity = 0.68;
    this.emitBurst(this.headX, 0.5, this.headZ, 0xef4444, 36);
    soundEngine.playGameOver();
    this.emitHud(true);

    this.onRunFinished({
      score: this.score,
      length: this.length,
      obstaclesCleared: this.obstaclesCleared,
      difficulty: this.difficulty,
    });
    return true;
  }

  private stepFoods(dt: number): void {
    let nearestFoodDist = Infinity;

    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      f.age += dt;
      if (f.ttl > 0) {
        f.ttl -= dt;
        if (f.ttl <= 0) {
          this.foodGroup.remove(f.rig.root);
          this.foods.splice(i, 1);
          continue;
        }
      }

      // Gravity wells gently pull nearby food into orbital drift
      for (const obs of this.obstacles) {
        if (obs.kind === 'gravity' && obs.spawnScale > 0.85) {
          const dx = obs.x - f.x;
          const dz = obs.z - f.z;
          const dist = Math.hypot(dx, dz);
          if (dist < obs.fieldRadius && dist > obs.coreRadius + 0.72) {
            const pull = (1 - dist / obs.fieldRadius) * 1.4;
            // Tangential + slight inward swirl
            f.vx += ((-dz / dist) * 1.2 + (dx / dist) * 0.35) * pull * dt;
            f.vz += ((dx / dist) * 1.2 + (dz / dist) * 0.35) * pull * dt;
          }
        }
      }

      // Active Magnet Orb pulls food toward snake head
      const hdx = this.headX - f.x;
      const hdz = this.headZ - f.z;
      const headDist = Math.hypot(hdx, hdz);
      if (this.magnetTimer > 0 && headDist < 7.5 && headDist > 0.1) {
        const magPull = (1 - headDist / 7.5) * 12.0;
        f.vx += (hdx / headDist) * magPull * dt;
        f.vz += (hdz / headDist) * magPull * dt;
      }

      f.vx *= Math.exp(-3.5 * dt);
      f.vz *= Math.exp(-3.5 * dt);
      f.x = THREE.MathUtils.clamp(f.x + f.vx * dt, -WALL_LIMIT + 0.8, WALL_LIMIT - 0.8);
      f.z = THREE.MathUtils.clamp(f.z + f.vz * dt, -WALL_LIMIT + 0.8, WALL_LIMIT - 0.8);

      // Animate food bobbing, gyro rings & spawn scale
      const spawnS = Math.min(1, f.age * 4.5);
      const ttlBlink = f.ttl > 0 && f.ttl < 3.0 ? 0.8 + Math.sin(this.elapsed * 18) * 0.2 : 1;
      f.rig.root.position.set(f.x, 0, f.z);
      f.rig.root.scale.setScalar(spawnS * ttlBlink);
      f.rig.visualPivot.position.y = 0.58 + Math.sin(this.elapsed * 3.4 + f.id) * 0.11;
      f.rig.visualPivot.rotation.y += dt * 1.65;
      f.rig.outerRing.rotation.z += dt * 2.4;
      if (f.rig.innerRing) {
        f.rig.innerRing.rotation.x -= dt * 2.8;
      }

      if (headDist < nearestFoodDist) {
        nearestFoodDist = headDist;
      }

      // Check Consumption
      if (headDist < 1.08) {
        this.consumeFood(i);
      }
    }

    // Animate snake head jaw opening & tongue flicking near food!
    const proximity = THREE.MathUtils.clamp(1 - (nearestFoodDist - 1.1) / 3.4, 0, 1);
    const targetJaw = proximity * 0.44;
    this.headRig.jawPivot.rotation.x = THREE.MathUtils.damp(
      this.headRig.jawPivot.rotation.x,
      targetJaw,
      14,
      dt
    );
    const tongueFlick =
      proximity > 0.15
        ? Math.sin(this.elapsed * 26) * 0.14
        : Math.sin(this.elapsed * 5.5) * 0.04;
    this.headRig.tonguePivot.position.z = -0.66 - Math.max(0, tongueFlick);
    this.headRig.tonguePivot.rotation.y = Math.sin(this.elapsed * 32) * 0.22 * proximity;
  }

  private consumeFood(index: number): void {
    const f = this.foods[index];
    this.foodGroup.remove(f.rig.root);
    this.foods.splice(index, 1);

    const growthAmount = f.kind === 'amber_crystal' ? 2 : 1;
    const prevLength = this.length;
    const nextLength = Math.min(MAX_SNAKE_SEGMENTS, this.length + growthAmount);

    for (let s = prevLength; s < nextLength; s++) {
      this.segmentGrowScales[s] = 0.12;
    }
    this.length = nextLength;

    // Trigger visible peristalsis digestive wave down the spine
    this.pulses.push({ progress: 0, speed: 1.75 });

    const burstHex =
      f.kind === 'berry' ? 0x9bbc0f : f.kind === 'amber_crystal' ? 0xf59e0b : 0x38bdf8;
    this.emitBurst(f.x, 0.55, f.z, burstHex, 22);

    if (this.status === 'PLAYING') {
      const diffMult =
        this.difficulty === 'classic' ? 1 : this.difficulty === 'chaos' ? 1.25 : 1.5;
      const basePts =
        f.kind === 'berry' ? 100 : f.kind === 'amber_crystal' ? 300 : 200;

      this.addScore(Math.round(basePts * this.combo * diffMult));

      this.combo = Math.min(8, this.combo + 1);
      this.comboTimer = this.comboDuration;
      this.foodsEatenCount++;

      if (f.kind === 'amber_crystal' && this.shields < this.maxShields) {
        this.shields++;
      }
      if (f.kind === 'hyper_orb') {
        this.magnetTimer = 9.0;
      }

      soundEngine.playEat(this.combo, f.kind);

      // Progressive randomized obstacle spawning every 4 foods eaten!
      if (this.foodsEatenCount % 4 === 0 && this.obstacles.length < 18) {
        const roll = Math.random();
        if (roll < 0.45) {
          this.spawnKineticBumper(false);
        } else if (roll < 0.78) {
          this.spawnSlidingBarrier(false);
        } else {
          this.spawnGravityBlock(false);
        }
      }

      // Chance to spawn bonus timed crystal or magnet orb
      if (this.foods.length < 3 && Math.random() < 0.34) {
        this.spawnFood(Math.random() < 0.65 ? 'amber_crystal' : 'hyper_orb');
      }

      this.emitHud(true);
    }

    // Ensure at least 2 standard berries remain active
    const berryCount = this.foods.filter((item) => item.kind === 'berry').length;
    for (let b = berryCount; b < 2; b++) {
      this.spawnFood('berry');
    }
  }

  private addScore(points: number): void {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewBest = true;
    }
  }

  private syncSnakeMeshes(): void {
    // Invulnerability blink visibility on head/body
    const invulnBlink =
      this.invulnTimer > 0 ? Math.sin(this.elapsed * 34) > -0.35 : true;

    this.headRig.root.visible = invulnBlink;
    this.headRig.root.position.set(this.headX, 0, this.headZ);
    this.headRig.root.rotation.y = this.heading;
    this.headRig.root.rotation.z = THREE.MathUtils.clamp(-this.angularVel * 0.055, -0.24, 0.24);

    // Sample arc-length path breadcrumbs for each body segment
    let nodeIdx = 0;
    let accumDist = 0;

    for (let segIdx = 1; segIdx <= MAX_SNAKE_SEGMENTS; segIdx++) {
      const segRig = this.segmentPool[segIdx - 1];
      if (!segRig) continue;

      if (segIdx >= this.length) {
        segRig.root.visible = false;
        continue;
      }

      const targetDist = segIdx * SEGMENT_SPACING;
      while (nodeIdx < this.pathNodes.length - 1) {
        const curr = this.pathNodes[nodeIdx];
        const next = this.pathNodes[nodeIdx + 1];
        const stepLen = curr.jumpBreak
          ? 0
          : Math.hypot(next.x - curr.x, next.z - curr.z);
        if (accumDist + stepLen >= targetDist) {
          const frac = stepLen > 0.0001 ? (targetDist - accumDist) / stepLen : 0;
          const sx = THREE.MathUtils.lerp(curr.x, next.x, frac);
          const sz = THREE.MathUtils.lerp(curr.z, next.z, frac);
          const tx = curr.x - next.x;
          const tz = curr.z - next.z;
          const segAngle =
            Math.hypot(tx, tz) > 0.001 ? Math.atan2(-tx, -tz) : this.heading;

          // Subtle organic lateral slither wave
          const slither =
            Math.sin(this.elapsed * 7.2 - segIdx * 0.65) *
            0.055 *
            Math.min(1, segIdx / 3);
          const perpX = Math.cos(segAngle);
          const perpZ = -Math.sin(segAngle);

          segRig.root.visible = invulnBlink;
          segRig.root.position.set(sx + perpX * slither, 0, sz + perpZ * slither);
          segRig.root.rotation.y = segAngle;

          // Taper last 2 segments + peristalsis digestive bulge wave
          const tailTaper =
            segIdx === this.length - 1
              ? 0.72
              : segIdx === this.length - 2
              ? 0.86
              : 1.0;
          const growScale = this.segmentGrowScales[segIdx] ?? 1.0;

          let bulge = 0;
          const normPos = segIdx / Math.max(1, this.length);
          for (const pulse of this.pulses) {
            const d = Math.abs(normPos - pulse.progress);
            if (d < 0.16) {
              const bell = Math.cos((d / 0.16) * (Math.PI * 0.5));
              bulge = Math.max(bulge, bell * bell);
            }
          }

          const sXZ = tailTaper * growScale * (1 + bulge * 0.42);
          const sY = tailTaper * growScale * (1 + bulge * 0.32);
          segRig.bodyPivot.scale.set(sXZ, sY, growScale);
          segRig.nodeMat.emissiveIntensity = 0.55 + bulge * 2.1;

          // Position tapered tail tip right after final segment
          if (segIdx === this.length - 1) {
            this.tailTipRig.root.visible = invulnBlink;
            this.tailTipRig.root.position.set(
              sx - Math.sin(segAngle) * -0.45,
              0,
              sz - Math.cos(segAngle) * -0.45
            );
            this.tailTipRig.root.rotation.y = segAngle;
            this.tailTipRig.bodyPivot.scale.setScalar(growScale);
          }
          break;
        }
        accumDist += stepLen;
        nodeIdx++;
      }
    }
  }

  private stepParticlesAndVisuals(dt: number): void {
    // Decay wall impact flashes
    const sides = ['north', 'south', 'east', 'west'] as const;
    for (const side of sides) {
      if (this.wallFlash[side] > 0) {
        this.wallFlash[side] = Math.max(0, this.wallFlash[side] - dt * 3.8);
      }
      this.arenaRig.wallFlashMats[side].emissiveIntensity =
        0.24 + this.wallFlash[side] * 2.2;
    }

    // Update pooled particles
    let anyActive = false;
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummyObj.position.set(0, -10, 0);
        _dummyObj.scale.setScalar(0.001);
        _dummyObj.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummyObj.matrix);
        continue;
      }

      p.vy -= 14.0 * dt;
      p.x += p.vx * dt;
      p.y = Math.max(0.06, p.y + p.vy * dt);
      p.z += p.vz * dt;

      const t = 1 - p.life / p.maxLife;
      _dummyObj.position.set(p.x, p.y, p.z);
      _dummyObj.rotation.set(p.life * 6, p.life * 4, 0);
      _dummyObj.scale.setScalar(p.size * t);
      _dummyObj.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummyObj.matrix);
    }

    if (anyActive) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private stepCamera(dt: number): void {
    let targetFov = 48;

    if (this.status === 'TITLE') {
      // Atmospheric slow orbit over live Nokia diorama
      const orbitAngle = this.elapsed * 0.22;
      _camTargetPos.set(
        Math.sin(orbitAngle) * 24.5,
        18.5 + Math.sin(this.elapsed * 0.35) * 1.6,
        Math.cos(orbitAngle) * 24.5
      );
      _camTargetLook.set(0, 0.3, 0);
      targetFov = 45;
    } else if (this.cameraPreset === 'diorama') {
      // Elevated angled diorama view with subtle snake & cursor parallax
      _camTargetPos.set(
        this.headX * 0.22 + this.pointerParallax.x * 1.1,
        24.5,
        22.5 + this.headZ * 0.18 + this.pointerParallax.y * 0.9
      );
      _camTargetLook.set(this.headX * 0.28, 0.2, this.headZ * 0.28);
      targetFov = 46;
    } else {
      // Dynamic Third-Person Chase Camera with turn banking & speed FOV
      const fwdX = -Math.sin(this.heading);
      const fwdZ = -Math.cos(this.heading);
      const chaseDist = 6.4;
      const chaseHeight = 3.85;

      _camTargetPos.set(
        this.headX - fwdX * chaseDist,
        chaseHeight,
        this.headZ - fwdZ * chaseDist
      );
      _camTargetLook.set(
        this.headX + fwdX * 5.6,
        0.55,
        this.headZ + fwdZ * 5.6
      );
      const boosting =
        this.heldKeys.has('Space') ||
        this.heldKeys.has('ShiftLeft') ||
        this.virtualInput.boost;
      targetFov = boosting && this.boostEnergy > 0.08 ? 64 : 56;
    }

    // Smooth exponential damping
    const posLambda = this.cameraPreset === 'chase' && this.status === 'PLAYING' ? 12.0 : 6.5;
    _camCurrentPos.x = THREE.MathUtils.damp(_camCurrentPos.x, _camTargetPos.x, posLambda, dt);
    _camCurrentPos.y = THREE.MathUtils.damp(_camCurrentPos.y, _camTargetPos.y, posLambda, dt);
    _camCurrentPos.z = THREE.MathUtils.damp(_camCurrentPos.z, _camTargetPos.z, posLambda, dt);

    _camCurrentLook.x = THREE.MathUtils.damp(_camCurrentLook.x, _camTargetLook.x, posLambda + 2, dt);
    _camCurrentLook.y = THREE.MathUtils.damp(_camCurrentLook.y, _camTargetLook.y, posLambda + 2, dt);
    _camCurrentLook.z = THREE.MathUtils.damp(_camCurrentLook.z, _camTargetLook.z, posLambda + 2, dt);

    // Apply decaying impact camera shake
    if (this.shakeIntensity > 0.002) {
      _v3A.set(
        (Math.random() - 0.5) * this.shakeIntensity,
        (Math.random() - 0.5) * this.shakeIntensity * 0.7,
        (Math.random() - 0.5) * this.shakeIntensity
      );
      this.camera.position.copy(_camCurrentPos).add(_v3A);
      this.shakeIntensity *= Math.exp(-13 * dt);
    } else {
      this.shakeIntensity = 0;
      this.camera.position.copy(_camCurrentPos);
    }

    this.camera.lookAt(_camCurrentLook);

    // Subtle banking roll in Chase Cam
    const targetBank =
      this.cameraPreset === 'chase' && this.status === 'PLAYING'
        ? THREE.MathUtils.clamp(-this.angularVel * 0.032, -0.14, 0.14)
        : 0;
    this.chaseBank = THREE.MathUtils.damp(this.chaseBank, targetBank, 10, dt);
    if (Math.abs(this.chaseBank) > 0.0005) {
      this.camera.rotateZ(this.chaseBank);
    }

    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHud(force: boolean): void {
    void force;
    this.onHudUpdate({
      status: this.status,
      score: this.score,
      highScore: this.highScore,
      length: this.length,
      combo: this.combo,
      comboProgress: this.combo > 1 ? THREE.MathUtils.clamp(this.comboTimer / this.comboDuration, 0, 1) : 0,
      shields: this.shields,
      maxShields: this.maxShields,
      obstaclesCleared: this.obstaclesCleared,
      difficulty: this.difficulty,
      cameraPreset: this.cameraPreset,
      muted: soundEngine.isMuted(),
      deathReason: this.deathReason,
      isNewBest: this.isNewBest,
      boostEnergy: this.boostEnergy,
      magnetTimer: this.magnetTimer,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('pointermove', this.handlePointerMove);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener('touchstart', this.handleTouchStart);
    canvas.removeEventListener('touchmove', this.handleTouchMove);
    canvas.removeEventListener('touchend', this.handleTouchEnd);
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.textures.dispose();
    this.snakeAssets.dispose();
    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}

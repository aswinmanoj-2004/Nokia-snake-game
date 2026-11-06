import * as THREE from 'three';
import type { FoodKind } from '../types/game';
import type { DioramaTextureSet } from './proceduralTextures';

export interface SnakeHeadRig {
  root: THREE.Group;
  jawPivot: THREE.Group;
  tonguePivot: THREE.Group;
  leftEyeMat: THREE.MeshStandardMaterial;
  rightEyeMat: THREE.MeshStandardMaterial;
}

export interface SnakeSegmentRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  nodeMat: THREE.MeshStandardMaterial;
}

export interface FoodRig {
  root: THREE.Group;
  visualPivot: THREE.Group;
  outerRing: THREE.Mesh;
  innerRing?: THREE.Mesh;
}

export interface BumperRig {
  root: THREE.Group;
  elastomerRing: THREE.Mesh;
  pistonCap: THREE.Group;
  ringMat: THREE.MeshStandardMaterial;
}

export interface SliderRig {
  root: THREE.Group;
  carriage: THREE.Group;
  telegraphMat: THREE.MeshStandardMaterial;
}

export interface GravityRig {
  root: THREE.Group;
  coreGroup: THREE.Group;
  pulseRing: THREE.Mesh;
  pulseMat: THREE.MeshBasicMaterial;
}

export interface PortalRig {
  root: THREE.Group;
  haloRing: THREE.Mesh;
  vortexMat: THREE.ShaderMaterial;
}

export interface ArenaDioramaRig {
  root: THREE.Group;
  wallFlashMats: {
    north: THREE.MeshStandardMaterial;
    south: THREE.MeshStandardMaterial;
    east: THREE.MeshStandardMaterial;
    west: THREE.MeshStandardMaterial;
  };
}

function createContactShadowMesh(
  shadowTex: THREE.CanvasTexture,
  radius: number,
  opacity = 0.45
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.018;
  return mesh;
}

/**
 * 9-part composite biomechanical Nokia serpent head pivoted at bottom-center (y = 0),
 * facing -Z locally.
 */
export function createSnakeHeadGroup(textures: DioramaTextureSet): SnakeHeadRig {
  const root = new THREE.Group();

  const armorMat = new THREE.MeshStandardMaterial({
    map: textures.scaleAlbedo,
    bumpMap: textures.scaleBump,
    bumpScale: 0.025,
    roughness: 0.36,
    metalness: 0.22,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    map: textures.titaniumAlbedo,
    bumpMap: textures.titaniumBump,
    bumpScale: 0.012,
    color: 0xbac6d4,
    roughness: 0.2,
    metalness: 0.88,
  });

  const darkGunmetalMat = new THREE.MeshStandardMaterial({
    color: 0x1a241e,
    roughness: 0.48,
    metalness: 0.72,
  });

  const leftEyeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.5,
    roughness: 0.15,
    metalness: 0.1,
  });
  const rightEyeMat = leftEyeMat.clone();

  const tongueMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0x9f1239,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.05,
  });

  // 1. Primary Silhouette: Chamfered aerodynamic cranial shell
  const headShape = new THREE.Shape();
  headShape.moveTo(0, -0.78);
  headShape.quadraticCurveTo(0.54, -0.68, 0.62, -0.1);
  headShape.quadraticCurveTo(0.64, 0.46, 0.38, 0.66);
  headShape.lineTo(-0.38, 0.66);
  headShape.quadraticCurveTo(-0.64, 0.46, -0.62, -0.1);
  headShape.quadraticCurveTo(-0.54, -0.68, 0, -0.78);

  const craniumGeo = new THREE.ExtrudeGeometry(headShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 3,
  });
  craniumGeo.rotateX(Math.PI / 2);
  const craniumMesh = new THREE.Mesh(craniumGeo, armorMat);
  craniumMesh.position.y = 0.56;
  craniumMesh.castShadow = true;
  craniumMesh.receiveShadow = true;
  root.add(craniumMesh);

  // 2. Secondary Read: Brushed titanium nasal & brow crest plate
  const crestShape = new THREE.Shape();
  crestShape.moveTo(0, -0.72);
  crestShape.lineTo(0.24, -0.15);
  crestShape.lineTo(0.18, 0.58);
  crestShape.lineTo(-0.18, 0.58);
  crestShape.lineTo(-0.24, -0.15);
  crestShape.closePath();

  const crestGeo = new THREE.ExtrudeGeometry(crestShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  crestGeo.rotateX(Math.PI / 2);
  const crestMesh = new THREE.Mesh(crestGeo, titaniumMat);
  crestMesh.position.y = 0.68;
  crestMesh.castShadow = true;
  root.add(crestMesh);

  // 3 & 4. Secondary Read: Lateral sensory cheek pods
  const cheekGeo = new THREE.BoxGeometry(0.16, 0.24, 0.68);
  const leftCheek = new THREE.Mesh(cheekGeo, titaniumMat);
  leftCheek.position.set(-0.62, 0.36, 0.12);
  leftCheek.rotation.y = 0.12;
  leftCheek.castShadow = true;
  root.add(leftCheek);

  const rightCheek = new THREE.Mesh(cheekGeo, titaniumMat);
  rightCheek.position.set(0.62, 0.36, 0.12);
  rightCheek.rotation.y = -0.12;
  rightCheek.castShadow = true;
  root.add(rightCheek);

  // 5. Secondary Read: Articulated Lower Jaw Pivot
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, 0.22, 0.38);
  const jawGeo = new THREE.BoxGeometry(0.84, 0.14, 0.92);
  const jawMesh = new THREE.Mesh(jawGeo, darkGunmetalMat);
  jawMesh.position.set(0, -0.05, -0.44);
  jawMesh.castShadow = true;
  jawPivot.add(jawMesh);
  root.add(jawPivot);

  // 6 & 7. Accents: Twin recessed optical ruby sensor eyes with gunmetal bezels & brow horns
  const bezelGeo = new THREE.CylinderGeometry(0.19, 0.21, 0.14, 16);
  bezelGeo.rotateZ(Math.PI / 2);
  const eyeGeo = new THREE.SphereGeometry(0.155, 16, 12);

  const leftBezel = new THREE.Mesh(bezelGeo, darkGunmetalMat);
  leftBezel.position.set(-0.56, 0.5, -0.22);
  leftBezel.rotation.y = -0.28;
  root.add(leftBezel);

  const leftEye = new THREE.Mesh(eyeGeo, leftEyeMat);
  leftEye.position.set(-0.62, 0.5, -0.24);
  root.add(leftEye);

  const rightBezel = new THREE.Mesh(bezelGeo, darkGunmetalMat);
  rightBezel.position.set(0.56, 0.5, -0.22);
  rightBezel.rotation.y = 0.28;
  root.add(rightBezel);

  const rightEye = new THREE.Mesh(eyeGeo, rightEyeMat);
  rightEye.position.set(0.62, 0.5, -0.24);
  root.add(rightEye);

  // Swept titanium supraorbital brow horns
  const hornGeo = new THREE.BoxGeometry(0.11, 0.1, 0.52);
  const leftHorn = new THREE.Mesh(hornGeo, titaniumMat);
  leftHorn.position.set(-0.44, 0.66, 0.08);
  leftHorn.rotation.set(0.16, 0.18, 0.2);
  leftHorn.castShadow = true;
  root.add(leftHorn);

  const rightHorn = new THREE.Mesh(hornGeo, titaniumMat);
  rightHorn.position.set(0.44, 0.66, 0.08);
  rightHorn.rotation.set(0.16, -0.18, -0.2);
  rightHorn.castShadow = true;
  root.add(rightHorn);

  // 8. Accent: Articulated forked tongue
  const tonguePivot = new THREE.Group();
  tonguePivot.position.set(0, 0.22, -0.68);
  const stemGeo = new THREE.BoxGeometry(0.06, 0.025, 0.36);
  const stemMesh = new THREE.Mesh(stemGeo, tongueMat);
  stemMesh.position.z = -0.18;
  tonguePivot.add(stemMesh);

  const forkGeo = new THREE.BoxGeometry(0.045, 0.022, 0.2);
  const forkL = new THREE.Mesh(forkGeo, tongueMat);
  forkL.position.set(-0.06, 0, -0.42);
  forkL.rotation.y = 0.42;
  tonguePivot.add(forkL);

  const forkR = new THREE.Mesh(forkGeo, tongueMat);
  forkR.position.set(0.06, 0, -0.42);
  forkR.rotation.y = -0.42;
  tonguePivot.add(forkR);
  root.add(tonguePivot);

  // 9. Grounded Contact Shadow
  root.add(createContactShadowMesh(textures.contactShadow, 0.92, 0.48));

  return {
    root,
    jawPivot,
    tonguePivot,
    leftEyeMat,
    rightEyeMat,
  };
}

export interface SharedSnakeAssets {
  carapaceGeo: THREE.BufferGeometry;
  vertebraGeo: THREE.BufferGeometry;
  bellyGeo: THREE.BufferGeometry;
  nodeGeo: THREE.BufferGeometry;
  tailConeGeo: THREE.BufferGeometry;
  tailFinGeo: THREE.BufferGeometry;
  armorMat: THREE.MeshStandardMaterial;
  titaniumMat: THREE.MeshStandardMaterial;
  bellyMat: THREE.MeshStandardMaterial;
  contactShadowTex: THREE.CanvasTexture;
  dispose: () => void;
}

export function createSharedSnakeAssets(textures: DioramaTextureSet): SharedSnakeAssets {
  const segShape = new THREE.Shape();
  segShape.moveTo(0, -0.44);
  segShape.quadraticCurveTo(0.48, -0.36, 0.48, 0.04);
  segShape.quadraticCurveTo(0.44, 0.42, 0, 0.45);
  segShape.quadraticCurveTo(-0.44, 0.42, -0.48, 0.04);
  segShape.quadraticCurveTo(-0.48, -0.36, 0, -0.44);

  const carapaceGeo = new THREE.ExtrudeGeometry(segShape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  carapaceGeo.rotateX(Math.PI / 2);

  const vertebraGeo = new THREE.BoxGeometry(0.26, 0.14, 0.56);
  const bellyGeo = new THREE.CylinderGeometry(0.36, 0.32, 0.54, 10);
  bellyGeo.rotateX(Math.PI / 2);

  const nodeGeo = new THREE.BoxGeometry(0.1, 0.12, 0.34);

  const tailConeGeo = new THREE.ConeGeometry(0.42, 1.05, 12);
  tailConeGeo.rotateX(Math.PI / 2);

  const tailFinGeo = new THREE.BoxGeometry(0.08, 0.32, 0.65);

  const armorMat = new THREE.MeshStandardMaterial({
    map: textures.scaleAlbedo,
    bumpMap: textures.scaleBump,
    bumpScale: 0.025,
    roughness: 0.38,
    metalness: 0.2,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    map: textures.titaniumAlbedo,
    bumpMap: textures.titaniumBump,
    bumpScale: 0.01,
    color: 0xb2c0ce,
    roughness: 0.22,
    metalness: 0.86,
  });

  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0x1b2919,
    roughness: 0.72,
    metalness: 0.08,
  });

  return {
    carapaceGeo,
    vertebraGeo,
    bellyGeo,
    nodeGeo,
    tailConeGeo,
    tailFinGeo,
    armorMat,
    titaniumMat,
    bellyMat,
    contactShadowTex: textures.contactShadow,
    dispose: () => {
      carapaceGeo.dispose();
      vertebraGeo.dispose();
      bellyGeo.dispose();
      nodeGeo.dispose();
      tailConeGeo.dispose();
      tailFinGeo.dispose();
      armorMat.dispose();
      titaniumMat.dispose();
      bellyMat.dispose();
    },
  };
}

/**
 * 5-part articulated serpent vertebra segment pivoted at bottom-center (y = 0).
 */
export function createSnakeSegmentGroup(
  assets: SharedSnakeAssets,
  isTailTip = false
): SnakeSegmentRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const nodeMat = new THREE.MeshStandardMaterial({
    color: 0x9bbc0f,
    emissive: 0x9bbc0f,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.2,
  });

  if (!isTailTip) {
    // 1. Primary dorsal carapace
    const carapace = new THREE.Mesh(assets.carapaceGeo, assets.armorMat);
    carapace.position.y = 0.46;
    carapace.castShadow = true;
    carapace.receiveShadow = true;
    bodyPivot.add(carapace);

    // 2. Brushed titanium vertebra link
    const vertebra = new THREE.Mesh(assets.vertebraGeo, assets.titaniumMat);
    vertebra.position.set(0, 0.55, 0);
    vertebra.castShadow = true;
    bodyPivot.add(vertebra);

    // 3. Matte ventral belly skid plate
    const belly = new THREE.Mesh(assets.bellyGeo, assets.bellyMat);
    belly.position.set(0, 0.22, 0);
    bodyPivot.add(belly);

    // 4. Twin lateral backlit Nokia energy nodes
    const leftNode = new THREE.Mesh(assets.nodeGeo, nodeMat);
    leftNode.position.set(-0.5, 0.34, 0);
    bodyPivot.add(leftNode);

    const rightNode = new THREE.Mesh(assets.nodeGeo, nodeMat);
    rightNode.position.set(0.5, 0.34, 0);
    bodyPivot.add(rightNode);
  } else {
    // Tapered biomechanical tail tip with dorsal titanium fin
    const cone = new THREE.Mesh(assets.tailConeGeo, assets.armorMat);
    cone.position.set(0, 0.34, 0.14);
    cone.castShadow = true;
    bodyPivot.add(cone);

    const fin = new THREE.Mesh(assets.tailFinGeo, assets.titaniumMat);
    fin.position.set(0, 0.48, 0.12);
    fin.rotation.x = -0.22;
    fin.castShadow = true;
    bodyPivot.add(fin);

    const tipBeacon = new THREE.Mesh(assets.nodeGeo, nodeMat);
    tipBeacon.scale.set(0.8, 0.8, 0.9);
    tipBeacon.position.set(0, 0.36, 0.32);
    bodyPivot.add(tipBeacon);
  }

  // 5. Grounded Contact Shadow
  root.add(createContactShadowMesh(assets.contactShadowTex, isTailTip ? 0.56 : 0.72, 0.4));

  return {
    root,
    bodyPivot,
    nodeMat,
  };
}

/**
 * 5–6 part composite collectible food item pivoted at y = 0.
 */
export function createFoodGroup(kind: FoodKind, textures: DioramaTextureSet): FoodRig {
  const root = new THREE.Group();
  const visualPivot = new THREE.Group();
  visualPivot.position.y = 0.58;
  root.add(visualPivot);

  const titaniumMat = new THREE.MeshStandardMaterial({
    map: textures.titaniumAlbedo,
    color: 0xcbd5e1,
    roughness: 0.18,
    metalness: 0.9,
  });

  if (kind === 'berry') {
    // Lathe berry silhouette
    const points = [
      new THREE.Vector2(0.0, -0.34),
      new THREE.Vector2(0.24, -0.3),
      new THREE.Vector2(0.38, -0.1),
      new THREE.Vector2(0.36, 0.14),
      new THREE.Vector2(0.2, 0.3),
      new THREE.Vector2(0.0, 0.34),
    ];
    const berryGeo = new THREE.LatheGeometry(points, 16);
    const berryMat = new THREE.MeshStandardMaterial({
      color: 0x9bbc0f,
      emissive: 0x4d7c0f,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.1,
    });
    const berryMesh = new THREE.Mesh(berryGeo, berryMat);
    berryMesh.castShadow = true;
    visualPivot.add(berryMesh);

    // Calyx crown & curved stem
    const calyx = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.08, 0.1, 6), titaniumMat);
    calyx.position.y = 0.35;
    visualPivot.add(calyx);

    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.36, 0),
      new THREE.Vector3(0.06, 0.52, 0.04),
      new THREE.Vector3(0.16, 0.58, 0.08),
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 8, 0.035, 6, false), titaniumMat);
    visualPivot.add(stem);

    // Orbiting copper-jade ring
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.85,
    });
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.035, 10, 28), ringMat);
    outerRing.rotation.x = Math.PI / 3;
    visualPivot.add(outerRing);

    root.add(createContactShadowMesh(textures.contactShadow, 0.65, 0.42));
    return { root, visualPivot, outerRing };
  }

  if (kind === 'amber_crystal') {
    const crystalGeo = new THREE.OctahedronGeometry(0.42, 0);
    crystalGeo.scale(0.85, 1.32, 0.85);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      roughness: 0.12,
      metalness: 0.15,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.castShadow = true;
    visualPivot.add(crystal);

    const capGeo = new THREE.ConeGeometry(0.24, 0.18, 6);
    const topCap = new THREE.Mesh(capGeo, titaniumMat);
    topCap.position.y = 0.56;
    visualPivot.add(topCap);

    const botCap = new THREE.Mesh(capGeo, titaniumMat);
    botCap.rotation.x = Math.PI;
    botCap.position.y = -0.56;
    visualPivot.add(botCap);

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 10, 32), titaniumMat);
    outerRing.rotation.x = Math.PI / 3;
    visualPivot.add(outerRing);

    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.028, 8, 28), crystalMat);
    innerRing.rotation.y = Math.PI / 3;
    visualPivot.add(innerRing);

    root.add(createContactShadowMesh(textures.contactShadow, 0.72, 0.46));
    return { root, visualPivot, outerRing, innerRing };
  }

  // hyper_orb (Magnet / Overcharge Orb)
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.25,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), coreMat);
  core.castShadow = true;
  visualPivot.add(core);

  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 10, 32), titaniumMat);
  outerRing.rotation.x = Math.PI / 4;
  visualPivot.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 8, 28), coreMat);
  innerRing.rotation.z = Math.PI / 4;
  visualPivot.add(innerRing);

  const pinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.92, 8);
  const pin = new THREE.Mesh(pinGeo, titaniumMat);
  visualPivot.add(pin);

  root.add(createContactShadowMesh(textures.contactShadow, 0.68, 0.44));
  return { root, visualPivot, outerRing, innerRing };
}

/**
 * 6-part composite Kinetic Bumper Tower with compressible elastomer ring.
 */
export function createKineticBumperGroup(textures: DioramaTextureSet): BumperRig {
  const root = new THREE.Group();

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e2923,
    roughness: 0.58,
    metalness: 0.62,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    map: textures.titaniumAlbedo,
    bumpMap: textures.titaniumBump,
    bumpScale: 0.01,
    color: 0xbac6d4,
    roughness: 0.2,
    metalness: 0.9,
  });

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xb45309,
    emissiveIntensity: 0.42,
    roughness: 0.32,
    metalness: 0.22,
  });

  // 1. Octagonal base flange flush with y = 0
  const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.14, 0.14, 8), baseMat);
  baseMesh.position.y = 0.07;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  root.add(baseMesh);

  // 2. Central brushed titanium piston shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.74, 20), titaniumMat);
  shaft.position.y = 0.44;
  shaft.castShadow = true;
  root.add(shaft);

  // 3. Compressible copper-amber elastomer bumper ring
  const elastomerGeo = new THREE.TorusGeometry(0.82, 0.22, 16, 32);
  elastomerGeo.rotateX(Math.PI / 2);
  const elastomerRing = new THREE.Mesh(elastomerGeo, ringMat);
  elastomerRing.position.y = 0.42;
  elastomerRing.castShadow = true;
  root.add(elastomerRing);

  // 4. Top piston cap & glowing ring
  const pistonCap = new THREE.Group();
  pistonCap.position.y = 0.84;
  const capDome = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.62, 0.12, 16), titaniumMat);
  capDome.castShadow = true;
  pistonCap.add(capDome);

  const beaconGeo = new THREE.TorusGeometry(0.36, 0.04, 8, 24);
  beaconGeo.rotateX(Math.PI / 2);
  const beacon = new THREE.Mesh(beaconGeo, ringMat);
  beacon.position.y = 0.07;
  pistonCap.add(beacon);
  root.add(pistonCap);

  // 5. 4 Corner hex anchor bolts
  const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 6);
  const offsets = [
    [0.74, 0.74],
    [-0.74, 0.74],
    [0.74, -0.74],
    [-0.74, -0.74],
  ];
  for (const [bx, bz] of offsets) {
    const bolt = new THREE.Mesh(boltGeo, titaniumMat);
    bolt.position.set(bx, 0.09, bz);
    root.add(bolt);
  }

  // 6. Contact shadow
  root.add(createContactShadowMesh(textures.contactShadow, 1.32, 0.46));

  return {
    root,
    elastomerRing,
    pistonCap,
    ringMat,
  };
}

/**
 * 7-part composite Sliding Titanium Barrier on recessed guide rails.
 */
export function createSlidingBarrierGroup(
  travelSpan: number,
  textures: DioramaTextureSet
): SliderRig {
  const root = new THREE.Group();

  const railBedMat = new THREE.MeshStandardMaterial({
    color: 0x16201a,
    roughness: 0.7,
    metalness: 0.4,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    map: textures.titaniumAlbedo,
    bumpMap: textures.titaniumBump,
    bumpScale: 0.012,
    color: 0xaab7c4,
    roughness: 0.22,
    metalness: 0.88,
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x1f2924,
    roughness: 0.82,
    metalness: 0.05,
  });

  const telegraphMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.75,
    roughness: 0.25,
    metalness: 0.15,
  });

  const totalTrackLen = travelSpan + 2.8;

  // 1. Recessed track bed (y = 0.025 offset above floor)
  const bed = new THREE.Mesh(new THREE.BoxGeometry(totalTrackLen, 0.05, 0.76), railBedMat);
  bed.position.y = 0.025;
  bed.receiveShadow = true;
  root.add(bed);

  // 2 & 3. Twin brushed titanium guide rods
  const rodGeo = new THREE.CylinderGeometry(0.045, 0.045, totalTrackLen - 0.2, 10);
  rodGeo.rotateZ(Math.PI / 2);
  const frontRod = new THREE.Mesh(rodGeo, titaniumMat);
  frontRod.position.set(0, 0.09, 0.24);
  root.add(frontRod);

  const backRod = new THREE.Mesh(rodGeo, titaniumMat);
  backRod.position.set(0, 0.09, -0.24);
  root.add(backRod);

  // 4. End-stop buffers at both ends of the rail
  const stopGeo = new THREE.BoxGeometry(0.22, 0.22, 0.84);
  const leftStop = new THREE.Mesh(stopGeo, titaniumMat);
  leftStop.position.set(-totalTrackLen / 2 + 0.11, 0.11, 0);
  root.add(leftStop);

  const rightStop = new THREE.Mesh(stopGeo, titaniumMat);
  rightStop.position.set(totalTrackLen / 2 - 0.11, 0.11, 0);
  root.add(rightStop);

  // 5, 6, 7. Moving carriage assembly
  const carriage = new THREE.Group();
  const blockShape = new THREE.Shape();
  const bw = 1.25;
  const bd = 0.42;
  blockShape.moveTo(-bw, -bd);
  blockShape.lineTo(bw, -bd);
  blockShape.lineTo(bw, bd);
  blockShape.lineTo(-bw, bd);
  blockShape.closePath();

  const blockGeo = new THREE.ExtrudeGeometry(blockShape, {
    depth: 0.56,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  blockGeo.rotateX(Math.PI / 2);
  const blockMesh = new THREE.Mesh(blockGeo, titaniumMat);
  blockMesh.position.y = 0.68;
  blockMesh.castShadow = true;
  blockMesh.receiveShadow = true;
  carriage.add(blockMesh);

  // Rubberized impact bumpers on carriage ends
  const padGeo = new THREE.BoxGeometry(0.14, 0.46, 0.86);
  const leftPad = new THREE.Mesh(padGeo, rubberMat);
  leftPad.position.set(-1.31, 0.36, 0);
  carriage.add(leftPad);

  const rightPad = new THREE.Mesh(padGeo, rubberMat);
  rightPad.position.set(1.31, 0.36, 0);
  carriage.add(rightPad);

  // Top hazard warning bar (pulses brighter on reversal windup)
  const hazardBar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.26), telegraphMat);
  hazardBar.position.set(0, 0.76, 0);
  carriage.add(hazardBar);

  carriage.add(createContactShadowMesh(textures.contactShadow, 1.45, 0.44));
  root.add(carriage);

  return {
    root,
    carriage,
    telegraphMat,
  };
}

/**
 * 6-part composite Gravity Well Monolith with levitating core & field boundary ring.
 */
export function createGravityBlockGroup(
  fieldRadius: number,
  textures: DioramaTextureSet
): GravityRig {
  const root = new THREE.Group();

  const pedestalMat = new THREE.MeshStandardMaterial({
    color: 0x1b2620,
    roughness: 0.64,
    metalness: 0.38,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    map: textures.titaniumAlbedo,
    color: 0x9fb0c2,
    roughness: 0.22,
    metalness: 0.88,
  });

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.9,
    roughness: 0.14,
    metalness: 0.65,
  });

  // 1. Stepped octagonal base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.82, 0.18, 8), pedestalMat);
  base.position.y = 0.09;
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  // 2. 4 Angled containment pylons
  const pylonGeo = new THREE.BoxGeometry(0.14, 0.86, 0.2);
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const pylon = new THREE.Mesh(pylonGeo, titaniumMat);
    pylon.position.set(Math.cos(angle) * 0.56, 0.5, Math.sin(angle) * 0.56);
    pylon.rotation.y = -angle;
    pylon.rotation.z = 0.18;
    pylon.castShadow = true;
    root.add(pylon);
  }

  // 3. Levitating rotating core + orbital ring
  const coreGroup = new THREE.Group();
  coreGroup.position.y = 0.86;
  const coreSphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), coreMat);
  coreSphere.castShadow = true;
  coreGroup.add(coreSphere);

  const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.032, 8, 28), titaniumMat);
  orbitRing.rotation.x = Math.PI / 3;
  coreGroup.add(orbitRing);
  root.add(coreGroup);

  // 4. Outer static gravity boundary ring on floor
  const boundaryGeo = new THREE.RingGeometry(fieldRadius - 0.11, fieldRadius, 56);
  boundaryGeo.rotateX(-Math.PI / 2);
  const boundaryMat = new THREE.MeshBasicMaterial({
    color: 0x6ee7b7,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const boundaryMesh = new THREE.Mesh(boundaryGeo, boundaryMat);
  boundaryMesh.position.y = 0.025;
  root.add(boundaryMesh);

  // 5. Animated inward-contracting gravity pulse ring
  const pulseGeo = new THREE.RingGeometry(0.88, 1.0, 48);
  pulseGeo.rotateX(-Math.PI / 2);
  const pulseMat = new THREE.MeshBasicMaterial({
    color: 0x6ee7b7,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
  pulseRing.position.y = 0.028;
  root.add(pulseRing);

  // 6. Contact shadow
  root.add(createContactShadowMesh(textures.contactShadow, 0.96, 0.46));

  return {
    root,
    coreGroup,
    pulseRing,
    pulseMat,
  };
}

/**
 * 6-part composite Quantum Wrap Portal gate with custom animated vortex shader.
 */
export function createWrapPortalGroup(
  pairIndex: number,
  textures: DioramaTextureSet
): PortalRig {
  const root = new THREE.Group();
  const primaryHex = pairIndex === 0 ? 0x9bbc0f : 0xf59e0b;
  const secondaryHex = pairIndex === 0 ? 0x10b981 : 0xf97316;

  const titaniumMat = new THREE.MeshStandardMaterial({
    map: textures.titaniumAlbedo,
    color: 0xbac6d4,
    roughness: 0.2,
    metalness: 0.88,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: primaryHex,
    emissive: primaryHex,
    emissiveIntensity: 0.9,
    roughness: 0.22,
    metalness: 0.2,
  });

  // 1. Heavy floor titanium bezel ring
  const floorRingGeo = new THREE.TorusGeometry(1.04, 0.11, 14, 36);
  floorRingGeo.rotateX(Math.PI / 2);
  const floorRing = new THREE.Mesh(floorRingGeo, titaniumMat);
  floorRing.position.y = 0.08;
  floorRing.castShadow = true;
  floorRing.receiveShadow = true;
  root.add(floorRing);

  // 2. 3 Sculpted stabilizer fins around perimeter
  const finGeo = new THREE.BoxGeometry(0.14, 0.44, 0.26);
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3;
    const fin = new THREE.Mesh(finGeo, titaniumMat);
    fin.position.set(Math.cos(angle) * 1.06, 0.24, Math.sin(angle) * 1.06);
    fin.rotation.y = -angle;
    fin.castShadow = true;
    root.add(fin);
  }

  // 3. Inner animated swirl vortex disc (custom ShaderMaterial)
  const vortexMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(primaryHex) },
      uColorB: { value: new THREE.Color(secondaryHex) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColorA;
      uniform vec3 uColorB;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.y, p.x);
        float spiral = sin(r * 14.0 - uTime * 5.0 + a * 3.0) * 0.5 + 0.5;
        float core = smoothstep(1.0, 0.08, r);
        vec3 col = mix(uColorB, uColorA, spiral) * (0.95 + 0.95 * core);
        float alpha = smoothstep(1.0, 0.65, r) * (0.72 + 0.28 * spiral);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const vortexGeo = new THREE.CircleGeometry(0.96, 36);
  vortexGeo.rotateX(-Math.PI / 2);
  const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
  vortexMesh.position.y = 0.032;
  root.add(vortexMesh);

  // 4. Hovering holographic beacon ring
  const haloGeo = new THREE.TorusGeometry(0.86, 0.038, 10, 36);
  haloGeo.rotateX(Math.PI / 2);
  const haloRing = new THREE.Mesh(haloGeo, accentMat);
  haloRing.position.y = 0.48;
  root.add(haloRing);

  return {
    root,
    haloRing,
    vortexMat,
  };
}

/**
 * Tactile Nokia 3310-inspired olive-jade LCD & brushed titanium hardware diorama arena.
 */
export function createArenaDioramaGroup(
  halfSize: number,
  textures: DioramaTextureSet
): ArenaDioramaRig {
  const root = new THREE.Group();
  const fullSize = halfSize * 2;

  // 1. Studio ground table extending into exponential fog (prevents floating box in void)
  const studioTableMat = new THREE.MeshStandardMaterial({
    color: 0x162019,
    roughness: 0.88,
    metalness: 0.12,
  });
  const studioTable = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), studioTableMat);
  studioTable.rotation.x = -Math.PI / 2;
  studioTable.position.y = -0.72;
  studioTable.receiveShadow = true;
  root.add(studioTable);

  // 2. Outer Nokia hardware sculpted chassis plinth
  const chassisShape = new THREE.Shape();
  const outerW = halfSize + 2.6;
  const outerD = halfSize + 3.4;
  const r = 1.6;
  chassisShape.moveTo(-outerW + r, -outerD);
  chassisShape.lineTo(outerW - r, -outerD);
  chassisShape.quadraticCurveTo(outerW, -outerD, outerW, -outerD + r);
  chassisShape.lineTo(outerW, outerD - r);
  chassisShape.quadraticCurveTo(outerW, outerD, outerW - r, outerD);
  chassisShape.lineTo(-outerW + r, outerD);
  chassisShape.quadraticCurveTo(-outerW, outerD, -outerW, outerD - r);
  chassisShape.lineTo(-outerW, -outerD + r);
  chassisShape.quadraticCurveTo(-outerW, -outerD, -outerW + r, -outerD);

  const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, {
    depth: 0.68,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.16,
    bevelSegments: 3,
  });
  chassisGeo.rotateX(Math.PI / 2);

  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1d2822,
    roughness: 0.46,
    metalness: 0.58,
  });
  const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
  chassisMesh.position.y = -0.02;
  chassisMesh.receiveShadow = true;
  root.add(chassisMesh);

  // 3. Brushed titanium top bezel surround around the LCD playfield
  const bezelShape = new THREE.Shape();
  const bw = halfSize + 1.45;
  const bd = halfSize + 1.65;
  const br = 0.9;
  bezelShape.moveTo(-bw + br, -bd);
  bezelShape.lineTo(bw - br, -bd);
  bezelShape.quadraticCurveTo(bw, -bd, bw, -bd + br);
  bezelShape.lineTo(bw, bd - br);
  bezelShape.quadraticCurveTo(bw, bd, bw - br, bd);
  bezelShape.lineTo(-bw + br, bd);
  bezelShape.quadraticCurveTo(-bw, bd, -bw, bd - br);
  bezelShape.lineTo(-bw, -bd + br);
  bezelShape.quadraticCurveTo(-bw, -bd, -bw + br, -bd);

  const holePath = new THREE.Path();
  holePath.moveTo(-halfSize, -halfSize);
  holePath.lineTo(halfSize, -halfSize);
  holePath.lineTo(halfSize, halfSize);
  holePath.lineTo(-halfSize, halfSize);
  holePath.closePath();
  bezelShape.holes.push(holePath);

  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  bezelGeo.rotateX(Math.PI / 2);

  const bezelTiMat = new THREE.MeshStandardMaterial({
    map: textures.titaniumAlbedo,
    bumpMap: textures.titaniumBump,
    bumpScale: 0.015,
    color: 0xaab7c4,
    roughness: 0.24,
    metalness: 0.86,
  });
  const bezelMesh = new THREE.Mesh(bezelGeo, bezelTiMat);
  bezelMesh.position.y = 0.36;
  bezelMesh.castShadow = true;
  bezelMesh.receiveShadow = true;
  root.add(bezelMesh);

  // 4. Backlit Nokia Olive-Jade LCD Playfield Floor (y = 0)
  const floorGeo = new THREE.PlaneGeometry(fullSize, fullSize);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.lcdAlbedo,
    bumpMap: textures.lcdBump,
    bumpScale: 0.022,
    emissive: new THREE.Color(0x7ca256),
    emissiveMap: textures.lcdAlbedo,
    emissiveIntensity: 0.24,
    roughness: 0.4,
    metalness: 0.08,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  // 5. Inner Perimeter Impact Flash Rails (North, South, East, West)
  const makeWallFlashMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0x9bbc0f,
      emissive: 0x65a30d,
      emissiveIntensity: 0.25,
      roughness: 0.25,
      metalness: 0.5,
    });

  const wallFlashMats = {
    north: makeWallFlashMat(),
    south: makeWallFlashMat(),
    east: makeWallFlashMat(),
    west: makeWallFlashMat(),
  };

  const horizRailGeo = new THREE.BoxGeometry(fullSize + 0.16, 0.12, 0.14);
  const vertRailGeo = new THREE.BoxGeometry(0.14, 0.12, fullSize + 0.16);

  const northRail = new THREE.Mesh(horizRailGeo, wallFlashMats.north);
  northRail.position.set(0, 0.36, -halfSize - 0.06);
  root.add(northRail);

  const southRail = new THREE.Mesh(horizRailGeo, wallFlashMats.south);
  southRail.position.set(0, 0.36, halfSize + 0.06);
  root.add(southRail);

  const eastRail = new THREE.Mesh(vertRailGeo, wallFlashMats.east);
  eastRail.position.set(halfSize + 0.06, 0.36, 0);
  root.add(eastRail);

  const westRail = new THREE.Mesh(vertRailGeo, wallFlashMats.west);
  westRail.position.set(-halfSize - 0.06, 0.36, 0);
  root.add(westRail);

  // 6. Nokia Earpiece Acoustic Grille Slots at North Bezel
  const slotGeo = new THREE.BoxGeometry(0.85, 0.06, 0.18);
  const slotMat = new THREE.MeshStandardMaterial({
    color: 0x0f1712,
    roughness: 0.85,
    metalness: 0.2,
  });
  for (let i = -2; i <= 2; i++) {
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(i * 1.35, 0.44, -halfSize - 0.85);
    root.add(slot);
  }

  // 7. Instanced Corner & Perimeter Torx Chassis Screws (24 instances -> InstancedMesh)
  const screwGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.08, 8);
  const screwPositions: [number, number][] = [];
  for (let i = -3; i <= 3; i++) {
    screwPositions.push([i * 4.5, -halfSize - 2.35]);
    screwPositions.push([i * 4.5, halfSize + 2.35]);
  }
  for (let i = -2; i <= 2; i++) {
    screwPositions.push([-halfSize - 1.95, i * 5.0]);
    screwPositions.push([halfSize + 1.95, i * 5.0]);
  }

  const screwInstanced = new THREE.InstancedMesh(screwGeo, bezelTiMat, screwPositions.length);
  const dummy = new THREE.Object3D();
  screwPositions.forEach(([sx, sz], idx) => {
    dummy.position.set(sx, 0.12, sz);
    dummy.rotation.y = idx * 0.4;
    dummy.updateMatrix();
    screwInstanced.setMatrixAt(idx, dummy.matrix);
  });
  screwInstanced.instanceMatrix.needsUpdate = true;
  screwInstanced.computeBoundingSphere();
  root.add(screwInstanced);

  return {
    root,
    wallFlashMats,
  };
}

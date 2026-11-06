import * as THREE from 'three';

export interface DioramaTextureSet {
  lcdAlbedo: THREE.CanvasTexture;
  lcdBump: THREE.CanvasTexture;
  titaniumAlbedo: THREE.CanvasTexture;
  titaniumBump: THREE.CanvasTexture;
  scaleAlbedo: THREE.CanvasTexture;
  scaleBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createDioramaTextures(maxAnisotropy: number): DioramaTextureSet {
  const aniso = Math.max(1, Math.min(16, maxAnisotropy));

  // 1. Backlit Nokia Olive-Jade LCD Pixel Matrix (Albedo + Micro-Bevel Bump)
  const lcdSize = 1024;
  const lcdCanvas = document.createElement('canvas');
  lcdCanvas.width = lcdSize;
  lcdCanvas.height = lcdSize;
  const lcdCtx = lcdCanvas.getContext('2d')!;

  const lcdBumpCanvas = document.createElement('canvas');
  lcdBumpCanvas.width = lcdSize;
  lcdBumpCanvas.height = lcdSize;
  const lcdBumpCtx = lcdBumpCanvas.getContext('2d')!;

  // Radial olive-jade backlight base (classic backlit Nokia 3310 olive-jade)
  const bgGrad = lcdCtx.createRadialGradient(
    lcdSize * 0.5,
    lcdSize * 0.5,
    lcdSize * 0.05,
    lcdSize * 0.5,
    lcdSize * 0.5,
    lcdSize * 0.75
  );
  bgGrad.addColorStop(0, '#63854B');
  bgGrad.addColorStop(0.62, '#4E6D3B');
  bgGrad.addColorStop(1, '#38512A');
  lcdCtx.fillStyle = bgGrad;
  lcdCtx.fillRect(0, 0, lcdSize, lcdSize);

  lcdBumpCtx.fillStyle = '#e0e0e0';
  lcdBumpCtx.fillRect(0, 0, lcdSize, lcdSize);

  // Crisp LCD pixel-matrix grid lines (7x7 primary cells tiled 4x4 = 28x28 arena cells)
  const cells = 7;
  const cellPx = lcdSize / cells;
  const subDiv = 2;
  const subPx = cellPx / subDiv;

  for (let gx = 0; gx < cells * subDiv; gx++) {
    for (let gy = 0; gy < cells * subDiv; gy++) {
      const x = gx * subPx;
      const y = gy * subPx;
      const isMajor = gx % subDiv === 0 || gy % subDiv === 0;

      // Sub-pixel subtle luminance jitter for organic LCD crystal depth
      const jitter = ((Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) % 1 + 1) % 1;
      if (jitter > 0.52) {
        lcdCtx.fillStyle = 'rgba(155, 188, 15, 0.12)';
        lcdCtx.fillRect(x + 4, y + 4, subPx - 8, subPx - 8);
      }

      // Inter-pixel recessed grooves
      lcdCtx.strokeStyle = isMajor ? 'rgba(14, 30, 12, 0.48)' : 'rgba(14, 30, 12, 0.2)';
      lcdCtx.lineWidth = isMajor ? 4.0 : 2.0;
      lcdCtx.strokeRect(x + 1, y + 1, subPx - 2, subPx - 2);

      lcdBumpCtx.strokeStyle = isMajor ? '#484848' : '#969696';
      lcdBumpCtx.lineWidth = isMajor ? 4.5 : 2.2;
      lcdBumpCtx.strokeRect(x + 1, y + 1, subPx - 2, subPx - 2);
    }
  }

  // Precision calibration crosshairs at cell intersections
  lcdCtx.strokeStyle = 'rgba(155, 188, 15, 0.34)';
  lcdCtx.lineWidth = 3;
  const cx = Math.floor(cells / 2) * cellPx;
  const cy = Math.floor(cells / 2) * cellPx;
  lcdCtx.beginPath();
  lcdCtx.moveTo(cx - 16, cy);
  lcdCtx.lineTo(cx + 16, cy);
  lcdCtx.moveTo(cx, cy - 16);
  lcdCtx.lineTo(cx, cy + 16);
  lcdCtx.stroke();

  const lcdAlbedo = new THREE.CanvasTexture(lcdCanvas);
  lcdAlbedo.colorSpace = THREE.SRGBColorSpace;
  lcdAlbedo.wrapS = THREE.RepeatWrapping;
  lcdAlbedo.wrapT = THREE.RepeatWrapping;
  lcdAlbedo.repeat.set(4, 4);
  lcdAlbedo.anisotropy = aniso;

  const lcdBump = new THREE.CanvasTexture(lcdBumpCanvas);
  lcdBump.wrapS = THREE.RepeatWrapping;
  lcdBump.wrapT = THREE.RepeatWrapping;
  lcdBump.repeat.set(4, 4);
  lcdBump.anisotropy = aniso;

  // 2. Brushed Titanium Chassis Texture (Albedo + Directional Grain Bump)
  const tiSize = 512;
  const tiCanvas = document.createElement('canvas');
  tiCanvas.width = tiSize;
  tiCanvas.height = tiSize;
  const tiCtx = tiCanvas.getContext('2d')!;

  const tiBumpCanvas = document.createElement('canvas');
  tiBumpCanvas.width = tiSize;
  tiBumpCanvas.height = tiSize;
  const tiBumpCtx = tiBumpCanvas.getContext('2d')!;

  tiCtx.fillStyle = '#8B96A3';
  tiCtx.fillRect(0, 0, tiSize, tiSize);
  tiBumpCtx.fillStyle = '#808080';
  tiBumpCtx.fillRect(0, 0, tiSize, tiSize);

  for (let y = 0; y < tiSize; y++) {
    const n = ((Math.sin(y * 19.31) * 9173.13) % 1 + 1) % 1;
    const shade = Math.floor(126 + (n - 0.5) * 34);
    tiCtx.fillStyle = `rgb(${shade}, ${shade + 7}, ${shade + 14})`;
    tiCtx.fillRect(0, y, tiSize, 1);

    const bShade = Math.floor(128 + (n - 0.5) * 70);
    tiBumpCtx.fillStyle = `rgb(${bShade}, ${bShade}, ${bShade})`;
    tiBumpCtx.fillRect(0, y, tiSize, 1);
  }

  const titaniumAlbedo = new THREE.CanvasTexture(tiCanvas);
  titaniumAlbedo.colorSpace = THREE.SRGBColorSpace;
  titaniumAlbedo.wrapS = THREE.RepeatWrapping;
  titaniumAlbedo.wrapT = THREE.RepeatWrapping;
  titaniumAlbedo.anisotropy = aniso;

  const titaniumBump = new THREE.CanvasTexture(tiBumpCanvas);
  titaniumBump.wrapS = THREE.RepeatWrapping;
  titaniumBump.wrapT = THREE.RepeatWrapping;
  titaniumBump.anisotropy = aniso;

  // 3. Biomechanical Serpent Scale Texture (Albedo + Hexagonal Scale Relief)
  const scSize = 512;
  const scCanvas = document.createElement('canvas');
  scCanvas.width = scSize;
  scCanvas.height = scSize;
  const scCtx = scCanvas.getContext('2d')!;

  const scBumpCanvas = document.createElement('canvas');
  scBumpCanvas.width = scSize;
  scBumpCanvas.height = scSize;
  const scBumpCtx = scBumpCanvas.getContext('2d')!;

  scCtx.fillStyle = '#4B6E28';
  scCtx.fillRect(0, 0, scSize, scSize);
  scBumpCtx.fillStyle = '#404040';
  scBumpCtx.fillRect(0, 0, scSize, scSize);

  const rows = 12;
  const cols = 12;
  const rW = scSize / cols;
  const rH = scSize / rows;

  for (let row = -1; row <= rows + 1; row++) {
    for (let col = -1; col <= cols + 1; col++) {
      const cx = (col + (row % 2 === 0 ? 0 : 0.5)) * rW;
      const cy = row * rH;

      const grad = scCtx.createRadialGradient(cx, cy - rH * 0.15, 2, cx, cy, rW * 0.62);
      grad.addColorStop(0, '#9BBC0F');
      grad.addColorStop(0.55, '#628B2A');
      grad.addColorStop(1, '#263B16');

      scCtx.beginPath();
      scCtx.arc(cx, cy, rW * 0.56, 0, Math.PI * 2);
      scCtx.fillStyle = grad;
      scCtx.fill();

      const bGrad = scBumpCtx.createRadialGradient(cx, cy - rH * 0.1, 1, cx, cy, rW * 0.58);
      bGrad.addColorStop(0, '#FFFFFF');
      bGrad.addColorStop(0.7, '#A6A6A6');
      bGrad.addColorStop(1, '#222222');

      scBumpCtx.beginPath();
      scBumpCtx.arc(cx, cy, rW * 0.54, 0, Math.PI * 2);
      scBumpCtx.fillStyle = bGrad;
      scBumpCtx.fill();
    }
  }

  const scaleAlbedo = new THREE.CanvasTexture(scCanvas);
  scaleAlbedo.colorSpace = THREE.SRGBColorSpace;
  scaleAlbedo.wrapS = THREE.RepeatWrapping;
  scaleAlbedo.wrapT = THREE.RepeatWrapping;
  scaleAlbedo.anisotropy = aniso;

  const scaleBump = new THREE.CanvasTexture(scBumpCanvas);
  scaleBump.wrapS = THREE.RepeatWrapping;
  scaleBump.wrapT = THREE.RepeatWrapping;
  scaleBump.anisotropy = aniso;

  // 4. Soft Radial Contact Shadow Texture
  const shSize = 128;
  const shCanvas = document.createElement('canvas');
  shCanvas.width = shSize;
  shCanvas.height = shSize;
  const shCtx = shCanvas.getContext('2d')!;
  const shGrad = shCtx.createRadialGradient(
    shSize / 2,
    shSize / 2,
    shSize * 0.06,
    shSize / 2,
    shSize / 2,
    shSize * 0.5
  );
  shGrad.addColorStop(0, 'rgba(5, 12, 7, 0.85)');
  shGrad.addColorStop(0.55, 'rgba(5, 12, 7, 0.36)');
  shGrad.addColorStop(1, 'rgba(5, 12, 7, 0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, shSize, shSize);

  const contactShadow = new THREE.CanvasTexture(shCanvas);

  return {
    lcdAlbedo,
    lcdBump,
    titaniumAlbedo,
    titaniumBump,
    scaleAlbedo,
    scaleBump,
    contactShadow,
    dispose: () => {
      lcdAlbedo.dispose();
      lcdBump.dispose();
      titaniumAlbedo.dispose();
      titaniumBump.dispose();
      scaleAlbedo.dispose();
      scaleBump.dispose();
      contactShadow.dispose();
    },
  };
}

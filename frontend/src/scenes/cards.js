import * as THREE from 'three';

const RED_SUITS = ['♥', '♦'];

function renderCardFace(rank, suit) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  // White background with rounded corners
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(0, 0, 256, 384, 16);
  ctx.fill();

  const color = RED_SUITS.includes(suit) ? '#cc0000' : '#111111';
  ctx.fillStyle = color;

  // Rank top-left
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(rank, 12, 36);

  // Rank bottom-right (rotated 180°)
  ctx.save();
  ctx.translate(256, 384);
  ctx.rotate(Math.PI);
  ctx.fillText(rank, 12, 36);
  ctx.restore();

  // Large suit symbol centered
  ctx.font = 'bold 96px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(suit, 128, 192);

  return new THREE.CanvasTexture(canvas);
}

function createBackMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0x1a3a6e });
}

export function createCard(rank, suit, faceUp = true) {
  const geom = new THREE.BoxGeometry(0.7, 1.0, 0.02);

  const faceTex = renderCardFace(rank, suit);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex });
  const backMat = createBackMaterial();

  // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back of box)
  const materials = [
    backMat, backMat, backMat, backMat,
    faceUp ? faceMat : backMat, // front face slot
    backMat,
  ];

  const mesh = new THREE.Mesh(geom, materials);

  let isFlipping = false;
  let isFaceUp = faceUp;

  mesh.flip = function () {
    if (isFlipping || isFaceUp) return;
    isFlipping = true;
    const startTime = performance.now();
    const duration = 300; // 0.3s

    function animate(now) {
      const t = Math.min((now - startTime) / duration, 1);
      mesh.rotation.y = t * Math.PI;
      if (t < 0.5) {
        mesh.material[4] = backMat;
      } else {
        isFaceUp = true;
        mesh.material[4] = faceMat;
      }
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        mesh.rotation.y = 0;
        isFlipping = false;
      }
    }
    requestAnimationFrame(animate);
  };

  return mesh;
}

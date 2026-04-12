import * as THREE from 'three';

const RED_SUITS = ['♥', '♦'];

function renderCardFace(rank, suit) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 384);

  const color = RED_SUITS.includes(suit) ? '#cc0000' : '#111111';
  ctx.fillStyle = color;

  // Large rank + suit centered
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 100px sans-serif';
  ctx.fillText(rank, 128, 150);
  ctx.font = 'bold 100px sans-serif';
  ctx.fillText(suit, 128, 270);

  // Thin border
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 380);

  return new THREE.CanvasTexture(canvas);
}

export function createCard(rank, suit, faceUp = true) {
  // PlaneGeometry has simple, reliable UV mapping (U→X, V→Y)
  const geom = new THREE.PlaneGeometry(0.45, 0.65);

  let mat;
  if (faceUp) {
    const faceTex = renderCardFace(rank, suit);
    mat = new THREE.MeshLambertMaterial({ map: faceTex });
  } else {
    mat = new THREE.MeshBasicMaterial({ color: 0x1a3a6e });
  }

  const mesh = new THREE.Mesh(geom, mat);
  // PlaneGeometry faces +Z; rotate so it faces +Y (upward, visible from camera)
  mesh.rotation.x = -Math.PI / 2;

  mesh.flip = function () {};
  mesh.cancelFlip = function () {};

  return mesh;
}

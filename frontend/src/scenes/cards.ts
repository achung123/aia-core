import * as THREE from 'three';

const RED_SUITS: string[] = ['♥', '♦'];

function renderCardFace(rank: string, suit: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext('2d')!;

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

export function createCard(rank: string, suit: string, faceUp: boolean = true): CardMesh {
  // PlaneGeometry has simple, reliable UV mapping (U→X, V→Y)
  const geom = new THREE.PlaneGeometry(0.45, 0.65);

  let mat: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
  if (faceUp) {
    const faceTex = renderCardFace(rank, suit);
    mat = new THREE.MeshLambertMaterial({ map: faceTex });
  } else {
    mat = new THREE.MeshBasicMaterial({ color: 0x1a3a6e });
  }

  const mesh = new THREE.Mesh(geom, mat);
  // PlaneGeometry faces +Z; rotate so it faces +Y (upward, visible from camera)
  mesh.rotation.x = -Math.PI / 2;

  let flipRafId: number | null = null;

  const cardMesh = mesh as unknown as CardMesh;

  cardMesh.flip = function (): void {
    if (flipRafId !== null) return; // already flipping

    const duration = 300;
    const startTime = performance.now();
    let swapped = false;

    function animate(now: number): void {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Rotate around local z-axis for a card-flip visual
      cardMesh.rotation.z = progress * Math.PI;

      // Swap material at midpoint
      if (!swapped && progress >= 0.5) {
        swapped = true;
        const faceTex = renderCardFace(rank, suit);
        const oldMat = cardMesh.material as THREE.Material;
        cardMesh.material = new THREE.MeshLambertMaterial({ map: faceTex });
        oldMat.dispose();
      }

      if (progress < 1) {
        flipRafId = requestAnimationFrame(animate);
      } else {
        cardMesh.rotation.z = 0;
        flipRafId = null;
      }
    }

    flipRafId = requestAnimationFrame(animate);
  };

  cardMesh.cancelFlip = function (): void {
    if (flipRafId !== null) {
      cancelAnimationFrame(flipRafId);
      flipRafId = null;
    }
  };

  return cardMesh;
}

/** Extended Mesh with flip/cancelFlip helpers attached at runtime. */
export interface CardMesh extends THREE.Mesh {
  flip: () => void;
  cancelFlip: () => void;
}

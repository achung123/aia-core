import * as THREE from 'three';

const DEFAULT_SEAT_COUNT = 10;
const TABLE_RADIUS_X = 3.5;
const TABLE_RADIUS_Z = 2.0;

export function addPokerTable(scene) {
  const tableGeom = new THREE.CylinderGeometry(1, 1, 0.1, 64);
  tableGeom.scale(TABLE_RADIUS_X, 1, TABLE_RADIUS_Z);
  const tableMat = new THREE.MeshLambertMaterial({ color: 0x1a7a1a });
  const tableMesh = new THREE.Mesh(tableGeom, tableMat);
  tableMesh.position.y = -0.05;
  scene.add(tableMesh);
  return tableMesh;
}

export function computeSeatPositions(seatCount = DEFAULT_SEAT_COUNT) {
  const positions = [];
  for (let i = 0; i < seatCount; i++) {
    const angle = (i / seatCount) * Math.PI * 2;
    const x = Math.cos(angle) * (TABLE_RADIUS_X + 0.8);
    const z = Math.sin(angle) * (TABLE_RADIUS_Z + 0.8);
    positions.push(new THREE.Vector3(x, 0, z));
  }
  return positions;
}

export function createSeatLabels(container, seatCount = DEFAULT_SEAT_COUNT) {
  const labels = [];
  for (let i = 0; i < seatCount; i++) {
    const div = document.createElement('div');
    div.className = 'seat-label';
    div.style.cssText = 'position:absolute;pointer-events:none;color:#fff;font-size:12px;white-space:nowrap;opacity:0.3;';
    div.textContent = `Seat ${i + 1}`;
    container.appendChild(div);
    labels.push(div);
  }
  return labels;
}

export function updateSeatLabelPositions(labels, seatPositions, camera, renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  seatPositions.forEach((pos, i) => {
    const projected = pos.clone().project(camera);
    if (projected.z > 1) {
      labels[i].style.display = 'none';
      return;
    }
    labels[i].style.display = '';
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (1 - (projected.y * 0.5 + 0.5)) * height;
    labels[i].style.left = `${x}px`;
    labels[i].style.top = `${y}px`;
    labels[i].style.transform = 'translate(-50%, -50%)';
  });
}

export function loadSession(labels, playerNames) {
  labels.forEach((label, i) => {
    if (playerNames[i]) {
      label.textContent = playerNames[i];
      label.style.opacity = '1';
    } else {
      label.textContent = `Seat ${i + 1}`;
      label.style.opacity = '0.3';
    }
  });
}

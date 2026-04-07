/**
 * Positioned equity badges that sit below each player's seat label.
 */
export function createEquityOverlay(container, seatCount) {
  const badges = [];
  for (let i = 0; i < seatCount; i++) {
    const div = document.createElement('div');
    div.className = 'equity-badge';
    div.style.cssText = [
      'position:absolute',
      'pointer-events:none',
      'font:bold 12px monospace',
      'white-space:nowrap',
      'text-align:center',
      'display:none',
      'padding:2px 8px',
      'border-radius:4px',
      'color:#fff',
      'transition:background .25s,opacity .25s',
    ].join(';');
    container.appendChild(div);
    badges.push(div);
  }

  /**
   * @param {Object} equityMap  — { playerName: 0-1 }
   * @param {Object} seatPlayerMap — { seatIndex: playerName }
   */
  function update(equityMap, seatPlayerMap) {
    for (let i = 0; i < seatCount; i++) {
      const name = seatPlayerMap[i];
      const eq = name !== undefined ? equityMap[name] : undefined;
      if (eq !== undefined && eq !== null) {
        const pct = (eq * 100).toFixed(1);
        const hue = Math.round(eq * 120); // 0°=red → 120°=green
        badges[i].textContent = `${pct}%`;
        badges[i].style.background = `hsla(${hue},70%,28%,0.88)`;
        badges[i].style.display = '';
      } else {
        badges[i].style.display = 'none';
      }
    }
  }

  /** Re-project badge positions to match seat labels (call on resize & session load) */
  function updatePositions(seatPositions, camera, renderer) {
    const canvas = renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    seatPositions.forEach((pos, i) => {
      const p = pos.clone().project(camera);
      if (p.z > 1) { badges[i].style.display = 'none'; return; }
      const x = (p.x * 0.5 + 0.5) * w;
      const y = (1 - (p.y * 0.5 + 0.5)) * h + 20; // 20px below seat label
      badges[i].style.left = `${x}px`;
      badges[i].style.top = `${y}px`;
      badges[i].style.transform = 'translate(-50%,0)';
    });
  }

  function hide() { badges.forEach(b => b.style.display = 'none'); }

  function dispose() { badges.forEach(b => b.remove()); badges.length = 0; }

  return { update, updatePositions, hide, dispose };
}

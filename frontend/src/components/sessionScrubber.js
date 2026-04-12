export function createSessionScrubber(container, handCount, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'session-scrubber';
  wrapper.style.cssText = 'padding:8px 12px;background:#111;display:flex;align-items:center;gap:8px;';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '◀';
  prevBtn.style.cssText = 'background:none;border:1px solid #555;color:#fff;padding:4px 8px;cursor:pointer;';

  const rangeWrapper = document.createElement('div');
  rangeWrapper.style.cssText = 'flex:1;position:relative;';

  // SVG ticks above the range
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '12');
  svg.style.cssText = 'display:block;margin-bottom:2px;';
  for (let i = 0; i < handCount; i++) {
    const pct = handCount > 1 ? i / (handCount - 1) : 0;
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', `${pct * 100}%`);
    tick.setAttribute('y1', '0');
    tick.setAttribute('x2', `${pct * 100}%`);
    tick.setAttribute('y2', '10');
    tick.setAttribute('stroke', '#555');
    tick.setAttribute('stroke-width', '1');
    svg.appendChild(tick);
  }

  const range = document.createElement('input');
  range.type = 'range';
  range.min = 1;
  range.max = handCount;
  range.step = 1;
  range.value = 1;
  range.style.cssText = 'width:100%;';

  rangeWrapper.appendChild(svg);
  rangeWrapper.appendChild(range);

  const label = document.createElement('span');
  label.style.cssText = 'color:#ccc;font-size:13px;min-width:72px;text-align:right;';
  label.textContent = `Hand 1 / ${handCount}`;

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '▶';
  nextBtn.style.cssText = 'background:none;border:1px solid #555;color:#fff;padding:4px 8px;cursor:pointer;';

  wrapper.appendChild(prevBtn);
  wrapper.appendChild(rangeWrapper);
  wrapper.appendChild(label);
  wrapper.appendChild(nextBtn);
  container.appendChild(wrapper);

  function updateLabel() {
    label.textContent = `Hand ${range.value} / ${handCount}`;
    onChange(parseInt(range.value, 10));
  }

  range.addEventListener('input', updateLabel);

  prevBtn.addEventListener('click', () => {
    if (parseInt(range.value, 10) > 1) {
      range.value = parseInt(range.value, 10) - 1;
      updateLabel();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (parseInt(range.value, 10) < handCount) {
      range.value = parseInt(range.value, 10) + 1;
      updateLabel();
    }
  });

  // Fire onChange with initial state
  updateLabel();

  return {
    getIndex: () => parseInt(range.value, 10),
    setIndex: (i) => { range.value = Math.max(1, Math.min(handCount, i)); updateLabel(); },
    dispose: () => wrapper.remove(),
  };
}

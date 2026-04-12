const STREETS = ['Pre-Flop', 'Flop', 'Turn', 'River', 'Showdown'];

export function createStreetScrubber(container, handData, onStreetChange) {
  let currentIndex = 0;

  const wrapper = document.createElement('div');
  wrapper.className = 'street-scrubber';
  wrapper.style.cssText = 'padding:6px 12px;background:#0d0d1a;display:flex;align-items:center;gap:6px;';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '◀';
  prevBtn.style.cssText = 'background:none;border:1px solid #555;color:#fff;padding:3px 7px;cursor:pointer;';

  const segments = STREETS.map((name, i) => {
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.dataset.index = i;
    btn.style.cssText = 'padding:4px 10px;border:1px solid #444;background:#222;color:#aaa;cursor:pointer;flex:1;';
    return btn;
  });

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '▶';
  nextBtn.style.cssText = 'background:none;border:1px solid #555;color:#fff;padding:3px 7px;cursor:pointer;';

  wrapper.appendChild(prevBtn);
  segments.forEach(btn => wrapper.appendChild(btn));
  wrapper.appendChild(nextBtn);
  container.appendChild(wrapper);

  function isDisabled(index) {
    if (index === 2) return !handData.turn; // Turn
    if (index === 3) return !handData.river; // River
    return false;
  }

  function updateUI() {
    segments.forEach((btn, i) => {
      const disabled = isDisabled(i);
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.35' : '1';
      btn.style.background = i === currentIndex ? '#3a3a6e' : '#222';
      btn.style.color = i === currentIndex ? '#fff' : '#aaa';
      btn.style.borderColor = i === currentIndex ? '#6666cc' : '#444';
    });
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === STREETS.length - 1;
  }

  function goToStreet(index) {
    if (isDisabled(index)) return;
    currentIndex = index;
    updateUI();
    onStreetChange(STREETS[currentIndex], handData);
  }

  segments.forEach((btn, i) => {
    btn.addEventListener('click', () => goToStreet(i));
  });

  prevBtn.addEventListener('click', () => {
    let idx = currentIndex - 1;
    while (idx >= 0 && isDisabled(idx)) idx--;
    if (idx >= 0) goToStreet(idx);
  });

  nextBtn.addEventListener('click', () => {
    let idx = currentIndex + 1;
    while (idx < STREETS.length && isDisabled(idx)) idx++;
    if (idx < STREETS.length) goToStreet(idx);
  });

  // Fire initial state
  updateUI();
  onStreetChange(STREETS[currentIndex], handData);

  return {
    getCurrentStreet: () => STREETS[currentIndex],
    goTo: (street) => {
      const idx = STREETS.indexOf(street);
      if (idx !== -1) goToStreet(idx);
    },
    updateHandData: (newHandData) => {
      handData = { ...handData, ...newHandData };
      updateUI();
      if (isDisabled(currentIndex)) {
        let fallback = currentIndex - 1;
        while (fallback >= 0 && isDisabled(fallback)) fallback--;
        if (fallback < 0) fallback = 0; // Pre-Flop is never disabled
        currentIndex = fallback;
        updateUI(); // re-run to apply active highlight on fallback
        onStreetChange(STREETS[currentIndex], handData);
      }
    },
    dispose: () => wrapper.remove(),
  };
}

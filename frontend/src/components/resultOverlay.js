const SUIT_SYMBOLS = { H: '♥', D: '♦', C: '♣', S: '♠' };

function formatCard(card) {
  const symbol = SUIT_SYMBOLS[card.suit] || card.suit;
  return `${card.rank}${symbol}`;
}

function formatPL(value) {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value).toFixed(2);
  return value >= 0 ? `+$${abs}` : `-$${abs}`;
}

function buildRow(player, isWinner) {
  const row = document.createElement('tr');
  if (isWinner) {
    row.style.cssText = 'background:#b8860b;font-weight:bold;';
  }

  // Name cell
  const nameCell = document.createElement('td');
  nameCell.style.cssText = 'padding:6px 10px;';
  nameCell.textContent = player.player_name;

  // Hole cards cell
  const cardsCell = document.createElement('td');
  cardsCell.style.cssText = 'padding:6px 10px;';
  if (player.hole_cards && player.hole_cards.length > 0) {
    player.hole_cards.forEach((card, i) => {
      if (i > 0) {
        const space = document.createTextNode(' ');
        cardsCell.appendChild(space);
      }
      const span = document.createElement('span');
      const isRed = card.suit === 'H' || card.suit === 'D';
      span.style.color = isRed ? '#ff6666' : '#f0f0f0';
      span.textContent = formatCard(card);
      cardsCell.appendChild(span);
    });
  } else {
    cardsCell.textContent = '—';
  }

  // Result cell
  const resultCell = document.createElement('td');
  resultCell.style.cssText = 'padding:6px 10px;text-transform:capitalize;';
  resultCell.textContent = player.result || '—';

  // P/L cell
  const plCell = document.createElement('td');
  plCell.style.cssText = 'padding:6px 10px;';
  const plText = formatPL(player.profit_loss);
  plCell.textContent = plText;
  if (player.profit_loss !== null && player.profit_loss !== undefined) {
    plCell.style.color = player.profit_loss >= 0 ? '#66ff99' : '#ff6666';
  }

  row.appendChild(nameCell);
  row.appendChild(cardsCell);
  row.appendChild(resultCell);
  row.appendChild(plCell);
  return row;
}

export function createResultOverlay(container) {
  container.style.position = 'relative';

  const overlay = document.createElement('div');
  overlay.className = 'result-overlay';
  overlay.style.cssText = [
    'position:absolute',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'background:rgba(0,0,0,0.85)',
    'color:#fff',
    'border-radius:8px',
    'padding:20px',
    'min-width:320px',
    'z-index:100',
    'display:none',
  ].join(';');

  container.appendChild(overlay);

  function show(handData) {
    // Clear previous content safely
    while (overlay.firstChild) {
      overlay.removeChild(overlay.firstChild);
    }

    // Header row with title and dismiss button
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;';

    const title = document.createElement('span');
    title.style.cssText = 'font-size:1.1em;font-weight:bold;letter-spacing:0.04em;';
    title.textContent = 'Showdown Results';

    const dismissBtn = document.createElement('button');
    dismissBtn.style.cssText = [
      'background:none',
      'border:1px solid #888',
      'color:#ccc',
      'padding:3px 10px',
      'cursor:pointer',
      'border-radius:4px',
      'font-size:0.9em',
    ].join(';');
    dismissBtn.textContent = '✕ Dismiss';
    dismissBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
    });

    header.appendChild(title);
    header.appendChild(dismissBtn);
    overlay.appendChild(header);

    // Table
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;';

    // Table head
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.style.cssText = 'border-bottom:1px solid #555;color:#aaa;font-size:0.85em;';
    ['Player', 'Cards', 'Result', 'P/L'].forEach(label => {
      const th = document.createElement('th');
      th.style.cssText = 'padding:4px 10px;text-align:left;font-weight:normal;';
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    const players = (handData && handData.player_hands) ? handData.player_hands : [];
    players.forEach(player => {
      const isWinner = player.result === 'win';
      tbody.appendChild(buildRow(player, isWinner));
    });
    table.appendChild(tbody);
    overlay.appendChild(table);

    overlay.style.display = 'block';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  function dispose() {
    overlay.remove();
  }

  return { show, hide, dispose };
}

export function createStatsSidebar(container, hands) {
  const sidebar = document.createElement('div');
  sidebar.className = 'stats-sidebar';
  sidebar.style.cssText = 'padding:12px;background:#1a1a1a;min-width:200px;color:#ccc;font-size:13px;';

  const header = document.createElement('h3');
  header.textContent = 'Stats';
  header.style.cssText = 'margin:0 0 8px 0;color:#fff;font-size:15px;';
  sidebar.appendChild(header);

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;';
  sidebar.appendChild(table);

  container.appendChild(sidebar);

  function formatPL(value) {
    if (value === null) return '\u2014';
    const abs = Math.abs(value).toFixed(2);
    return value >= 0 ? '+$' + abs : '-$' + abs;
  }

  function update(handIndex) {
    // handIndex is 1-based (matches scrubber value), convert to 0-based inclusive slice
    const sliceEnd = handIndex; // hands[0..handIndex-1] inclusive = hands.slice(0, handIndex)

    const playerTotals = {};
    const playerAllNull = {};
    let totalPot = 0;
    let handsCompleted = 0;

    for (let i = 0; i < sliceEnd && i < hands.length; i++) {
      const hand = hands[i];
      handsCompleted += 1;
      totalPot += (hand.pot != null ? hand.pot : 0);

      if (hand.player_hands) {
        for (const ph of hand.player_hands) {
          const name = ph.player_name;
          if (!(name in playerTotals)) {
            playerTotals[name] = 0;
            playerAllNull[name] = true;
          }
          if (ph.profit_loss != null) {
            playerTotals[name] += ph.profit_loss;
            playerAllNull[name] = false;
          }
        }
      }
    }

    // Build sorted player list: non-null sorted descending, null players last
    const players = Object.keys(playerTotals);
    players.sort((a, b) => {
      const aNull = playerAllNull[a];
      const bNull = playerAllNull[b];
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return playerTotals[b] - playerTotals[a];
    });

    // Clear and rebuild table content
    while (table.firstChild) {
      table.removeChild(table.firstChild);
    }

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const thPlayer = document.createElement('th');
    thPlayer.textContent = 'Player';
    thPlayer.style.cssText = 'text-align:left;padding:4px 6px;border-bottom:1px solid #333;color:#fff;';

    const thPL = document.createElement('th');
    thPL.textContent = 'P/L';
    thPL.style.cssText = 'text-align:right;padding:4px 6px;border-bottom:1px solid #333;color:#fff;';

    headerRow.appendChild(thPlayer);
    headerRow.appendChild(thPL);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    for (const name of players) {
      const row = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = name;
      tdName.style.cssText = 'padding:4px 6px;border-bottom:1px solid #222;';

      const tdPL = document.createElement('td');
      const plText = playerAllNull[name] ? '\u2014' : formatPL(playerTotals[name]);
      tdPL.textContent = plText;
      tdPL.style.cssText = 'text-align:right;padding:4px 6px;border-bottom:1px solid #222;';
      if (!playerAllNull[name]) {
        tdPL.style.color = playerTotals[name] >= 0 ? '#4caf50' : '#f44336';
      }

      row.appendChild(tdName);
      row.appendChild(tdPL);
      tbody.appendChild(row);
    }

    // Summary row
    const summaryRow = document.createElement('tr');

    const tdSummary = document.createElement('td');
    tdSummary.textContent = 'Hands: ' + handsCompleted;
    tdSummary.style.cssText = 'padding:6px 6px 2px 6px;color:#aaa;font-style:italic;';

    const tdPot = document.createElement('td');
    tdPot.textContent = 'Total pot: $' + totalPot.toFixed(2);
    tdPot.style.cssText = 'text-align:right;padding:6px 6px 2px 6px;color:#aaa;font-style:italic;';

    summaryRow.appendChild(tdSummary);
    summaryRow.appendChild(tdPot);
    tbody.appendChild(summaryRow);

    table.appendChild(tbody);
  }

  function dispose() {
    container.removeChild(sidebar);
  }

  return { update, dispose };
}

import { fetchSessions, fetchHands } from '../api/client.js';

const SUIT_MAP = { H: '♥', D: '♦', C: '♣', S: '♠' };

let sortCol = 'date';
let sortAsc = true;
let sessions = [];
let expandedSessionId = null;

function formatCard(card) {
  if (!card) return '—';
  const suit = card.slice(-1).toUpperCase();
  const rank = card.slice(0, -1);
  return rank + (SUIT_MAP[suit] || suit);
}

function formatCards(cards) {
  if (!cards || cards.length === 0) return '—';
  return cards.map(formatCard).join(' ');
}

function sortSessions(data) {
  return [...data].sort((a, b) => {
    let av, bv;
    if (sortCol === 'date') {
      av = a.game_date || a.date || '';
      bv = b.game_date || b.date || '';
    } else if (sortCol === 'status') {
      av = a.status || 'active';
      bv = b.status || 'active';
    } else if (sortCol === 'hands') {
      av = a.hand_count ?? -1;
      bv = b.hand_count ?? -1;
    } else if (sortCol === 'players') {
      av = a.player_count ?? -1;
      bv = b.player_count ?? -1;
    } else {
      av = '';
      bv = '';
    }
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });
}

function updateHeaders(headerRow, columns) {
  headerRow.querySelectorAll('th').forEach((th, i) => {
    const col = columns[i];
    th.textContent =
      col.label + (sortCol === col.key ? (sortAsc ? ' ↑' : ' ↓') : '');
  });
}

async function handleRowClick(session, tr, tbody, columns) {
  const existing = tbody.querySelector('.hand-details-row');
  if (existing) {
    existing.remove();
    if (expandedSessionId === session.id) {
      expandedSessionId = null;
      return;
    }
  }

  expandedSessionId = session.id;

  const loadingRow = document.createElement('tr');
  loadingRow.className = 'hand-details-row';
  const loadingTd = document.createElement('td');
  loadingTd.colSpan = columns.length;
  loadingTd.textContent = 'Loading hands…';
  loadingRow.appendChild(loadingTd);
  tr.insertAdjacentElement('afterend', loadingRow);

  try {
    const hands = await fetchHands(session.id);
    loadingRow.remove();

    const detailsRow = document.createElement('tr');
    detailsRow.className = 'hand-details-row';
    const detailsTd = document.createElement('td');
    detailsTd.colSpan = columns.length;

    if (!hands || hands.length === 0) {
      detailsTd.textContent = 'No hands recorded.';
    } else {
      const handTable = document.createElement('table');
      handTable.className = 'hand-table';

      const handThead = document.createElement('thead');
      const handHeaderRow = document.createElement('tr');
      ['#', 'Flop', 'Turn', 'River', 'Players'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        handHeaderRow.appendChild(th);
      });
      handThead.appendChild(handHeaderRow);
      handTable.appendChild(handThead);

      const handTbody = document.createElement('tbody');
      hands.forEach(h => {
        const htr = document.createElement('tr');

        const tdNum = document.createElement('td');
        tdNum.textContent = h.hand_number ?? '—';

        const tdFlop = document.createElement('td');
        const flopCards = [h.flop_1, h.flop_2, h.flop_3].filter(Boolean);
        tdFlop.textContent = flopCards.length ? formatCards(flopCards) : '—';

        const tdTurn = document.createElement('td');
        tdTurn.textContent = h.turn ? formatCard(h.turn) : '—';

        const tdRiver = document.createElement('td');
        tdRiver.textContent = h.river ? formatCard(h.river) : '—';

        const tdPlayers = document.createElement('td');
        if (h.player_hands && h.player_hands.length) {
          tdPlayers.textContent = h.player_hands
            .map(p => `${p.player_name}: ${p.result || '?'}`)
            .join(', ');
        } else {
          tdPlayers.textContent = '—';
        }

        htr.appendChild(tdNum);
        htr.appendChild(tdFlop);
        htr.appendChild(tdTurn);
        htr.appendChild(tdRiver);
        htr.appendChild(tdPlayers);
        handTbody.appendChild(htr);
      });

      handTable.appendChild(handTbody);
      detailsTd.appendChild(handTable);
    }

    detailsRow.appendChild(detailsTd);
    tr.insertAdjacentElement('afterend', detailsRow);
  } catch (err) {
    loadingRow.remove();

    const errorRow = document.createElement('tr');
    errorRow.className = 'hand-details-row';
    const errorTd = document.createElement('td');
    errorTd.colSpan = columns.length;
    errorTd.textContent = `Error loading hands: ${err.message}`;
    errorTd.style.color = 'red';
    errorRow.appendChild(errorTd);
    tr.insertAdjacentElement('afterend', errorRow);
    expandedSessionId = null;
  }
}

function buildTableBody(tbody, sorted, columns) {
  tbody.textContent = '';
  sorted.forEach(s => {
    const tr = document.createElement('tr');
    tr.className = 'session-row';
    tr.style.cursor = 'pointer';

    const tdDate = document.createElement('td');
    tdDate.textContent = s.game_date || s.date || '—';

    const tdStatus = document.createElement('td');
    tdStatus.textContent = s.status || 'active';

    const tdHands = document.createElement('td');
    tdHands.textContent = s.hand_count ?? '?';

    const tdPlayers = document.createElement('td');
    tdPlayers.textContent = s.player_count ?? '?';

    tr.appendChild(tdDate);
    tr.appendChild(tdStatus);
    tr.appendChild(tdHands);
    tr.appendChild(tdPlayers);

    tr.addEventListener('click', () => handleRowClick(s, tr, tbody, columns));
    tbody.appendChild(tr);
  });
}

export function renderDataView(container) {
  sortCol = 'date';
  sortAsc = true;
  sessions = [];
  expandedSessionId = null;

  const wrapper = document.createElement('div');
  wrapper.className = 'data-view';

  const loadingEl = document.createElement('p');
  loadingEl.textContent = 'Loading sessions…';
  wrapper.appendChild(loadingEl);
  container.appendChild(wrapper);

  fetchSessions()
    .then(data => {
      sessions = data;
      loadingEl.remove();

      const columns = [
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status' },
        { key: 'hands', label: 'Hands' },
        { key: 'players', label: 'Players' },
      ];

      const table = document.createElement('table');
      table.className = 'session-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');

      columns.forEach(col => {
        const th = document.createElement('th');
        th.style.cursor = 'pointer';
        th.textContent = col.label + (sortCol === col.key ? ' ↑' : '');
        th.addEventListener('click', () => {
          if (sortCol === col.key) {
            sortAsc = !sortAsc;
          } else {
            sortCol = col.key;
            sortAsc = true;
          }
          updateHeaders(headerRow, columns);
          buildTableBody(tbody, sortSessions(sessions), columns);
        });
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      tbody.id = 'session-tbody';
      table.appendChild(tbody);

      wrapper.appendChild(table);
      buildTableBody(tbody, sortSessions(sessions), columns);
    })
    .catch(err => {
      loadingEl.remove();
      const errorBanner = document.createElement('div');
      errorBanner.className = 'error-banner';
      errorBanner.style.cssText = 'background:#c00;color:#fff;padding:8px;';
      errorBanner.textContent = `Error loading sessions: ${err.message}`;
      wrapper.appendChild(errorBanner);
    });
}

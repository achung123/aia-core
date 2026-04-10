import {
  fetchSessions,
  fetchHands,
  createSession,
  createHand,
  fetchPlayers,
  uploadCsvValidate,
  uploadCsvCommit,
  updateCommunityCards,
  updateHolecards,
  exportGameCsvUrl,
} from '../api/client.js';

const SUIT_MAP = { H: '♥', D: '♦', C: '♣', S: '♠', h: '♥', d: '♦', c: '♣', s: '♠' };

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
    if (sortCol === 'date') { av = a.game_date || ''; bv = b.game_date || ''; }
    else if (sortCol === 'status') { av = a.status || ''; bv = b.status || ''; }
    else if (sortCol === 'hands') { av = a.hand_count ?? -1; bv = b.hand_count ?? -1; }
    else if (sortCol === 'players') { av = a.player_count ?? -1; bv = b.player_count ?? -1; }
    else { av = ''; bv = ''; }
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ? 1 : -1;
    return 0;
  });
}

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else e[k] = v;
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

// ==========================================================================
// Create Game modal
// ==========================================================================
function showCreateGameModal(wrapper, onCreated) {
  const existing = wrapper.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = el('div', { className: 'modal-overlay' });

  const modal = el('div', { className: 'modal' });

  modal.appendChild(el('h2', {}, 'New Game Session'));

  const dateInput = el('input', { type: 'date', style: { width: '100%', boxSizing: 'border-box' } });
  dateInput.value = new Date().toISOString().slice(0, 10);
  modal.appendChild(el('label', {}, 'Date'));
  modal.appendChild(dateInput);

  const playerSelect = el('select', { multiple: true, style: { width: '100%', height: '120px', marginTop: '0.5rem' } });
  modal.appendChild(el('label', {}, 'Players (select multiple)'));
  modal.appendChild(playerSelect);

  const newPlayerRow = el('div', { style: { display: 'flex', gap: '0.4rem', marginTop: '0.5rem' } });
  const newPlayerInput = el('input', { type: 'text', placeholder: 'New player name', style: { flex: '1' } });
  const addPlayerBtn = el('button', { type: 'button', className: 'dv-btn dv-btn-sm' }, '+ Add');
  newPlayerRow.appendChild(newPlayerInput);
  newPlayerRow.appendChild(addPlayerBtn);
  modal.appendChild(newPlayerRow);

  addPlayerBtn.addEventListener('click', () => {
    const name = newPlayerInput.value.trim();
    if (!name) return;
    playerSelect.appendChild(el('option', { value: name, selected: true }, name));
    newPlayerInput.value = '';
  });

  const errEl = el('p', { className: 'error-msg' });
  errEl.hidden = true;
  modal.appendChild(errEl);

  const btnRow = el('div', { className: 'btn-row' });
  const cancelBtn = el('button', { type: 'button', className: 'dv-btn' }, 'Cancel');
  const submitBtn = el('button', { type: 'button', className: 'dv-btn dv-btn-primary' }, 'Create');
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(submitBtn);
  modal.appendChild(btnRow);

  cancelBtn.addEventListener('click', () => overlay.remove());

  submitBtn.addEventListener('click', async () => {
    errEl.hidden = true;
    const names = Array.from(playerSelect.selectedOptions).map(o => o.value);
    if (!names.length) { errEl.textContent = 'Select at least one player'; errEl.hidden = false; return; }
    submitBtn.disabled = true;
    try {
      await createSession({ game_date: dateInput.value, player_names: names });
      overlay.remove();
      onCreated();
    } catch (e) {
      errEl.textContent = e.message; errEl.hidden = false;
    } finally { submitBtn.disabled = false; }
  });

  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  wrapper.appendChild(overlay);

  fetchPlayers().then(players => {
    players.forEach(p => {
      playerSelect.appendChild(el('option', { value: p.name }, p.name));
    });
  }).catch(() => {});
}

// ==========================================================================
// CSV Upload modal
// ==========================================================================
function showCsvUploadModal(wrapper, onDone) {
  const existing = wrapper.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = el('div', { className: 'modal-overlay' });

  const modal = el('div', { className: 'modal' });

  modal.appendChild(el('h2', {}, 'Import Game from CSV'));
  modal.appendChild(el('p', { className: 'helper-text' },
    'Columns: game_date, hand_number, player_name, hole_card_1, hole_card_2, flop_1, flop_2, flop_3, turn, river, result, profit_loss'));

  const fileInput = el('input', { type: 'file', accept: '.csv', style: { width: '100%' } });
  modal.appendChild(el('label', {}, 'CSV File'));
  modal.appendChild(fileInput);

  const statusEl = el('div', { className: 'status-msg' });
  modal.appendChild(statusEl);

  const btnRow = el('div', { className: 'btn-row' });
  const cancelBtn = el('button', { type: 'button', className: 'dv-btn' }, 'Cancel');
  const validateBtn = el('button', { type: 'button', className: 'dv-btn', disabled: true }, 'Validate');
  const commitBtn = el('button', { type: 'button', className: 'dv-btn dv-btn-success', disabled: true }, 'Commit');
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(validateBtn);
  btnRow.appendChild(commitBtn);
  modal.appendChild(btnRow);

  fileInput.addEventListener('change', () => {
    validateBtn.disabled = !fileInput.files.length;
    commitBtn.disabled = true;
    statusEl.textContent = '';
  });

  cancelBtn.addEventListener('click', () => overlay.remove());

  validateBtn.addEventListener('click', async () => {
    validateBtn.disabled = true;
    statusEl.textContent = 'Validating…';
    statusEl.style.color = '#94a3b8';
    try {
      const result = await uploadCsvValidate(fileInput.files[0]);
      if (result.valid) {
        statusEl.textContent = `✓ Valid — ${result.total_rows} rows`;
        statusEl.style.color = '#34d399';
        commitBtn.disabled = false;
      } else {
        statusEl.innerHTML = '';
        statusEl.appendChild(document.createTextNode(`✗ ${result.error_count} errors:`));
        (result.errors || []).slice(0, 5).forEach(err => {
          statusEl.appendChild(document.createElement('br'));
          statusEl.appendChild(document.createTextNode('  ' + err));
        });
        statusEl.style.color = '#f87171';
      }
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
      statusEl.style.color = '#f87171';
    } finally { validateBtn.disabled = false; }
  });

  commitBtn.addEventListener('click', async () => {
    commitBtn.disabled = true;
    statusEl.textContent = 'Committing…';
    statusEl.style.color = '#94a3b8';
    try {
      const result = await uploadCsvCommit(fileInput.files[0]);
      statusEl.textContent = `✓ Committed — ${result.games_created} games, ${result.hands_created} hands, ${result.players_created} new players`;
      statusEl.style.color = '#34d399';
      setTimeout(() => { overlay.remove(); onDone(); }, 1500);
    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
      statusEl.style.color = '#f87171';
      commitBtn.disabled = false;
    }
  });

  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  wrapper.appendChild(overlay);
}

// ==========================================================================
// Add Hand modal
// ==========================================================================
function showAddHandModal(wrapper, session, onDone) {
  const existing = wrapper.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = el('div', { className: 'modal-overlay' });

  const modal = el('div', { className: 'modal' });

  modal.appendChild(el('h2', {}, `Add Hand — Game ${session.game_date}`));

  const form = el('form');

  // Community cards
  const communityFields = {};
  const communitySection = el('fieldset');
  communitySection.appendChild(el('legend', {}, 'Community Cards'));
  for (const [key, label] of [['flop_1','Flop 1'],['flop_2','Flop 2'],['flop_3','Flop 3'],['turn','Turn'],['river','River']]) {
    const inp = el('input', { type: 'text', placeholder: 'e.g. AH', style: { width: '60px', margin: '0 0.25rem' } });
    communityFields[key] = inp;
    communitySection.appendChild(el('label', { style: { marginRight: '0.5rem', display: 'inline', marginTop: '0' } }, `${label}: `));
    communitySection.appendChild(inp);
  }
  form.appendChild(communitySection);

  // Player entries
  const playerSection = el('fieldset');
  playerSection.appendChild(el('legend', {}, 'Player Hands'));
  const playerInputs = [];
  const loadingP = el('p', { className: 'loading' }, 'Loading players…');
  playerSection.appendChild(loadingP);
  form.appendChild(playerSection);

  fetchHands(session.game_id).then(hands => {
    loadingP.remove();
    const playerNames = new Set();
    hands.forEach(h => (h.player_hands || []).forEach(ph => playerNames.add(ph.player_name)));
    if (playerNames.size === 0) {
      playerSection.appendChild(el('p', { className: 'empty-msg' }, 'No players found in existing hands.'));
      return;
    }
    for (const name of playerNames) {
      const row = el('div', { className: 'player-row' });
      const c1 = el('input', { type: 'text', placeholder: 'e.g. AH', style: { width: '60px' } });
      const c2 = el('input', { type: 'text', placeholder: 'e.g. KD', style: { width: '60px' } });
      const resSelect = el('select');
      for (const [v, t] of [['','--'],['win','Win'],['loss','Loss'],['fold','Fold']]) {
        resSelect.appendChild(el('option', { value: v }, t));
      }
      const plInp = el('input', { type: 'number', step: '0.01', placeholder: '0', style: { width: '70px' } });
      row.appendChild(el('strong', {}, name));
      row.appendChild(c1); row.appendChild(c2); row.appendChild(resSelect); row.appendChild(plInp);
      playerSection.appendChild(row);
      playerInputs.push({ name, c1, c2, resSelect, plInp });
    }
  }).catch(err => { loadingP.textContent = `Error: ${err.message}`; });

  const errEl = el('p', { className: 'error-msg' });
  errEl.hidden = true;
  form.appendChild(errEl);

  const btnRow = el('div', { className: 'btn-row' });
  const cancelBtn = el('button', { type: 'button', className: 'dv-btn' }, 'Cancel');
  const submitBtn = el('button', { type: 'submit', className: 'dv-btn dv-btn-primary' }, 'Record Hand');
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(submitBtn);
  form.appendChild(btnRow);

  cancelBtn.addEventListener('click', () => overlay.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    submitBtn.disabled = true;

    const payload = {
      flop_1: communityFields.flop_1.value.trim().toUpperCase(),
      flop_2: communityFields.flop_2.value.trim().toUpperCase(),
      flop_3: communityFields.flop_3.value.trim().toUpperCase(),
      turn: communityFields.turn.value.trim().toUpperCase() || null,
      river: communityFields.river.value.trim().toUpperCase() || null,
      player_entries: playerInputs.filter(p => p.c1.value.trim() && p.c2.value.trim()).map(p => ({
        player_name: p.name,
        card_1: p.c1.value.trim().toUpperCase(),
        card_2: p.c2.value.trim().toUpperCase(),
        result: p.resSelect.value || null,
        profit_loss: p.plInp.value ? parseFloat(p.plInp.value) : null,
      })),
    };

    if (!payload.player_entries.length) {
      errEl.textContent = 'At least one player must have cards'; errEl.hidden = false; submitBtn.disabled = false; return;
    }

    try {
      await createHand(session.game_id, payload);
      overlay.remove();
      onDone();
    } catch (err) {
      errEl.textContent = err.message; errEl.hidden = false;
    } finally { submitBtn.disabled = false; }
  });

  modal.appendChild(form);
  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  wrapper.appendChild(overlay);
}

// ==========================================================================
// Edit Hand modal
// ==========================================================================
function showEditHandModal(wrapper, gameId, hand, onDone) {
  const existing = wrapper.querySelector('.modal-overlay');
  if (existing) existing.remove();

  const overlay = el('div', { className: 'modal-overlay' });

  const modal = el('div', { className: 'modal' });

  modal.appendChild(el('h2', {}, `Edit Hand #${hand.hand_number}`));

  const form = el('form');

  // Community cards
  const communityFields = {};
  const communitySection = el('fieldset');
  communitySection.appendChild(el('legend', {}, 'Community Cards'));
  for (const [key, label] of [['flop_1','Flop 1'],['flop_2','Flop 2'],['flop_3','Flop 3'],['turn','Turn'],['river','River']]) {
    const inp = el('input', { type: 'text', value: hand[key] || '', style: { width: '60px', margin: '0 0.25rem' } });
    communityFields[key] = inp;
    communitySection.appendChild(el('label', { style: { marginRight: '0.5rem', display: 'inline', marginTop: '0' } }, `${label}: `));
    communitySection.appendChild(inp);
  }
  form.appendChild(communitySection);

  // Player hole cards
  const playerSection = el('fieldset');
  playerSection.appendChild(el('legend', {}, 'Player Hole Cards'));
  const playerEdits = [];
  for (const ph of (hand.player_hands || [])) {
    const row = el('div', { className: 'player-row' });
    const c1 = el('input', { type: 'text', value: ph.card_1 || '', style: { width: '60px' } });
    const c2 = el('input', { type: 'text', value: ph.card_2 || '', style: { width: '60px' } });
    row.appendChild(el('strong', {}, ph.player_name));
    row.appendChild(c1); row.appendChild(c2);
    row.appendChild(el('span', { style: { color: '#64748b', marginLeft: '0.5rem', fontSize: '0.82rem' } }, `${ph.result || ''} ${ph.profit_loss ?? ''}`));
    playerSection.appendChild(row);
    playerEdits.push({ playerName: ph.player_name, origC1: ph.card_1, origC2: ph.card_2, c1, c2 });
  }
  form.appendChild(playerSection);

  const errEl = el('p', { className: 'error-msg' });
  errEl.hidden = true;
  form.appendChild(errEl);

  const btnRow = el('div', { className: 'btn-row' });
  const cancelBtn = el('button', { type: 'button', className: 'dv-btn' }, 'Cancel');
  const saveBtn = el('button', { type: 'submit', className: 'dv-btn dv-btn-primary' }, 'Save');
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  form.appendChild(btnRow);

  cancelBtn.addEventListener('click', () => overlay.remove());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    saveBtn.disabled = true;

    try {
      const commChanged =
        communityFields.flop_1.value.trim() !== (hand.flop_1 || '') ||
        communityFields.flop_2.value.trim() !== (hand.flop_2 || '') ||
        communityFields.flop_3.value.trim() !== (hand.flop_3 || '') ||
        communityFields.turn.value.trim() !== (hand.turn || '') ||
        communityFields.river.value.trim() !== (hand.river || '');

      if (commChanged) {
        await updateCommunityCards(gameId, hand.hand_number, {
          flop_1: communityFields.flop_1.value.trim().toUpperCase(),
          flop_2: communityFields.flop_2.value.trim().toUpperCase(),
          flop_3: communityFields.flop_3.value.trim().toUpperCase(),
          turn: communityFields.turn.value.trim().toUpperCase() || null,
          river: communityFields.river.value.trim().toUpperCase() || null,
        });
      }

      for (const pe of playerEdits) {
        const newC1 = pe.c1.value.trim().toUpperCase();
        const newC2 = pe.c2.value.trim().toUpperCase();
        if (newC1 !== (pe.origC1 || '').toUpperCase() || newC2 !== (pe.origC2 || '').toUpperCase()) {
          await updateHolecards(gameId, hand.hand_number, pe.playerName, {
            card_1: newC1,
            card_2: newC2,
          });
        }
      }

      overlay.remove();
      onDone();
    } catch (err) {
      errEl.textContent = err.message; errEl.hidden = false;
    } finally { saveBtn.disabled = false; }
  });

  modal.appendChild(form);
  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  wrapper.appendChild(overlay);
}

// ==========================================================================
// Expanded session row — hands table + action buttons
// ==========================================================================
async function handleRowClick(session, tr, tbody, columns, wrapper) {
  const existing = tbody.querySelector('.hand-details-row');
  if (existing) {
    existing.remove();
    if (expandedSessionId === session.game_id) { expandedSessionId = null; return; }
  }

  expandedSessionId = session.game_id;

  const loadingRow = el('tr', { className: 'hand-details-row' });
  loadingRow.appendChild(el('td', { colSpan: columns.length }, 'Loading hands…'));
  tr.insertAdjacentElement('afterend', loadingRow);

  try {
    const hands = await fetchHands(session.game_id);
    loadingRow.remove();
    if (expandedSessionId !== session.game_id) return;

    const detailsRow = el('tr', { className: 'hand-details-row' });
    const detailsTd = el('td', { colSpan: columns.length });

    // Action bar
    const actionBar = el('div', { className: 'action-bar' });

    const addHandBtn = el('button', { type: 'button', className: 'dv-btn dv-btn-sm' }, '+ Add Hand');
    addHandBtn.addEventListener('click', () => showAddHandModal(wrapper, session, () => refreshAndExpand(session, tbody, columns, wrapper)));

    const loadVizBtn = el('button', { type: 'button', className: 'dv-btn dv-btn-sm dv-btn-success' }, '▶ Load in Visualizer');
    loadVizBtn.addEventListener('click', () => {
      window.location.hash = '#/playback';
      setTimeout(() => {
        if (window.__loadSessionById) window.__loadSessionById(session.game_id);
      }, 300);
    });

    actionBar.appendChild(addHandBtn);
    actionBar.appendChild(loadVizBtn);

    const exportCsvBtn = el('button', { type: 'button', className: 'dv-btn dv-btn-sm' }, '📥 Export CSV');
    exportCsvBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = exportGameCsvUrl(session.game_id);
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    actionBar.appendChild(exportCsvBtn);

    detailsTd.appendChild(actionBar);

    if (!hands || hands.length === 0) {
      detailsTd.appendChild(el('p', { className: 'empty-msg' }, 'No hands recorded.'));
    } else {
      const handTable = el('table', { className: 'hand-table' });
      const thead = el('thead');
      const hRow = el('tr');
      ['#', 'Flop', 'Turn', 'River', 'Players', ''].forEach(t => hRow.appendChild(el('th', {}, t)));
      thead.appendChild(hRow);
      handTable.appendChild(thead);

      const handTbody = el('tbody');
      hands.forEach(h => {
        const htr = el('tr');
        htr.appendChild(el('td', {}, String(h.hand_number ?? '—')));

        const flopCards = [h.flop_1, h.flop_2, h.flop_3].filter(Boolean);
        htr.appendChild(el('td', {}, flopCards.length ? formatCards(flopCards) : '—'));
        htr.appendChild(el('td', {}, h.turn ? formatCard(h.turn) : '—'));
        htr.appendChild(el('td', {}, h.river ? formatCard(h.river) : '—'));

        const playerText = (h.player_hands || []).map(p => {
          const cards = [p.card_1, p.card_2].filter(Boolean);
          const hand = cards.length ? formatCards(cards) : '??';
          return `${p.player_name} [${hand}] ${p.result || '?'}`;
        }).join(', ');
        htr.appendChild(el('td', {}, playerText || '—'));

        const editBtn = el('button', { type: 'button', className: 'dv-btn dv-btn-sm' }, 'Edit');
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showEditHandModal(wrapper, session.game_id, h, () => refreshAndExpand(session, tbody, columns, wrapper));
        });
        const tdAction = el('td');
        tdAction.appendChild(editBtn);
        htr.appendChild(tdAction);

        handTbody.appendChild(htr);
      });
      handTable.appendChild(handTbody);
      detailsTd.appendChild(handTable);
    }

    detailsRow.appendChild(detailsTd);
    tr.insertAdjacentElement('afterend', detailsRow);
  } catch (err) {
    loadingRow.remove();
    if (expandedSessionId !== session.game_id) return;
    const errorRow = el('tr', { className: 'hand-details-row' });
    errorRow.appendChild(el('td', { colSpan: columns.length, style: { color: 'red' } }, `Error: ${err.message}`));
    tr.insertAdjacentElement('afterend', errorRow);
    expandedSessionId = null;
  }
}

function refreshAndExpand(session, tbody, columns, wrapper) {
  fetchSessions().then(data => {
    sessions = data;
    buildTableBody(tbody, sortSessions(sessions), columns, wrapper);
    const row = [...tbody.querySelectorAll('.session-row')].find(tr => tr.dataset.gameId === String(session.game_id));
    if (row) {
      const updated = sessions.find(s => s.game_id === session.game_id);
      if (updated) {
        expandedSessionId = null;
        handleRowClick(updated, row, tbody, columns, wrapper);
      }
    }
  });
}

// ==========================================================================
// Main table
// ==========================================================================
function buildTableBody(tbody, sorted, columns, wrapper) {
  tbody.textContent = '';
  sorted.forEach(s => {
    const tr = el('tr', { className: 'session-row' });
    tr.dataset.gameId = String(s.game_id);
    tr.appendChild(el('td', {}, s.game_date || s.date || '—'));

    const statusTd = el('td');
    const statusText = s.status || 'active';
    const badge = el('span', {
      className: `dv-status dv-status-${statusText}`,
    }, statusText);
    statusTd.appendChild(badge);
    tr.appendChild(statusTd);

    tr.appendChild(el('td', {}, String(s.hand_count ?? '?')));
    tr.appendChild(el('td', {}, String(s.player_count ?? '?')));
    tr.addEventListener('click', () => handleRowClick(s, tr, tbody, columns, wrapper));
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// Entry point
// ==========================================================================
export function renderDataView(container) {
  sortCol = 'date';
  sortAsc = true;
  sessions = [];
  expandedSessionId = null;

  const wrapper = el('div', { className: 'data-view' });

  wrapper.appendChild(el('h1', { className: 'dv-title' }, '📊 Game Sessions'));

  // Toolbar
  const toolbar = el('div', { className: 'toolbar' });
  const newGameBtn = el('button', { type: 'button', className: 'dv-btn dv-btn-primary' }, '+ New Game');
  const csvBtn = el('button', { type: 'button', className: 'dv-btn' }, 'Import CSV');
  toolbar.appendChild(newGameBtn);
  toolbar.appendChild(csvBtn);
  wrapper.appendChild(toolbar);

  const loadingEl = el('p', { className: 'loading' }, 'Loading sessions…');
  wrapper.appendChild(loadingEl);
  container.appendChild(wrapper);

  function reload() {
    fetchSessions().then(data => {
      sessions = data;
      loadingEl.remove();
      const oldTable = wrapper.querySelector('.session-table');
      if (oldTable) oldTable.remove();
      renderTable();
    }).catch(err => {
      loadingEl.textContent = `Error: ${err.message}`;
    });
  }

  newGameBtn.addEventListener('click', () => showCreateGameModal(wrapper, reload));
  csvBtn.addEventListener('click', () => showCsvUploadModal(wrapper, reload));

  function renderTable() {
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status' },
      { key: 'hands', label: 'Hands' },
      { key: 'players', label: 'Players' },
    ];

    const table = el('table', { className: 'session-table' });
    const thead = el('thead');
    const headerRow = el('tr');

    columns.forEach(col => {
      const th = el('th', { style: { cursor: 'pointer' } }, col.label + (sortCol === col.key ? (sortAsc ? ' ↑' : ' ↓') : ''));
      th.addEventListener('click', () => {
        if (sortCol === col.key) sortAsc = !sortAsc;
        else { sortCol = col.key; sortAsc = true; }
        headerRow.querySelectorAll('th').forEach((h, i) => {
          h.textContent = columns[i].label + (sortCol === columns[i].key ? (sortAsc ? ' ↑' : ' ↓') : '');
        });
        buildTableBody(tbody, sortSessions(sessions), columns, wrapper);
      });
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = el('tbody', { id: 'session-tbody' });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    buildTableBody(tbody, sortSessions(sessions), columns, wrapper);
  }

  reload();
}

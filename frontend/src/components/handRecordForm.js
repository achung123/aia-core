import { createHand, updateHolecards } from '../api/client.js';

const VALID_RANKS = new Set(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']);
const VALID_SUITS = new Set(['H', 'D', 'C', 'S']);

function parseCard(str) {
  if (!str || !str.trim()) return null;
  const s = str.trim().toUpperCase();
  const suit = s.slice(-1);
  const rank = s.slice(0, -1);
  if (!VALID_RANKS.has(rank) || !VALID_SUITS.has(suit)) return null;
  return { rank, suit };
}

function cardKey(cardObj) {
  return `${cardObj.rank}${cardObj.suit}`;
}

function toFieldId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

// Error display helpers — track fmt errors and dup errors separately so
// clearing one kind doesn't accidentally clear the other.

function showError(input, msg) {
  input.style.borderColor = 'red';
  const span = input.parentElement.querySelector('.card-field-error');
  if (span) {
    span.textContent = msg;
    span.hidden = false;
  }
}

function clearError(input) {
  input.style.borderColor = '';
  const span = input.parentElement.querySelector('.card-field-error');
  if (span) {
    span.textContent = '';
    span.hidden = true;
  }
}

function setFmtError(input, msg) {
  input.dataset.fmtError = 'true';
  showError(input, msg);
}

function clearFmtError(input) {
  delete input.dataset.fmtError;
  if (input.dataset.dupError !== 'true') {
    clearError(input);
  }
}

function setDupError(input) {
  input.dataset.dupError = 'true';
  showError(input, 'Duplicate card');
}

function clearDupError(input) {
  delete input.dataset.dupError;
  if (input.dataset.fmtError !== 'true') {
    clearError(input);
  }
}

function hasAnyError(input) {
  return input.dataset.fmtError === 'true' || input.dataset.dupError === 'true';
}

// ── Sub-component builders ───────────────────────────────────────────────────

function createCardField(labelText, idSuffix, required) {
  const fieldContainer = document.createElement('div');
  fieldContainer.className = 'card-field';

  const label = document.createElement('label');
  label.textContent = required ? `${labelText} *` : labelText;
  label.htmlFor = `card-input-${idSuffix}`;
  fieldContainer.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = `card-input-${idSuffix}`;
  input.name = idSuffix;
  input.placeholder = required ? 'e.g. AS' : 'e.g. JH (optional)';
  input.dataset.required = String(required);
  fieldContainer.appendChild(input);

  const errorSpan = document.createElement('span');
  errorSpan.className = 'card-field-error';
  errorSpan.style.color = 'red';
  errorSpan.style.fontSize = '0.85em';
  errorSpan.hidden = true;
  fieldContainer.appendChild(errorSpan);

  return { container: fieldContainer, input };
}

function createPlayerRow(playerName) {
  const slug = toFieldId(playerName);
  const rowContainer = document.createElement('div');
  rowContainer.className = 'player-row';

  const nameEl = document.createElement('strong');
  nameEl.textContent = playerName;
  rowContainer.appendChild(nameEl);

  const card1Field = createCardField('Card 1', `${slug}-card1`, true);
  const card2Field = createCardField('Card 2', `${slug}-card2`, true);
  rowContainer.appendChild(card1Field.container);
  rowContainer.appendChild(card2Field.container);

  // Result dropdown
  const resultLabel = document.createElement('label');
  resultLabel.textContent = 'Result';
  resultLabel.htmlFor = `result-${slug}`;
  rowContainer.appendChild(resultLabel);

  const resultSelect = document.createElement('select');
  resultSelect.id = `result-${slug}`;
  resultSelect.name = `result-${slug}`;
  for (const [val, text] of [
    ['', '-- select --'],
    ['win', 'Win'],
    ['loss', 'Loss'],
    ['fold', 'Fold'],
  ]) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    resultSelect.appendChild(opt);
  }
  rowContainer.appendChild(resultSelect);

  // Profit/Loss input
  const profitLabel = document.createElement('label');
  profitLabel.textContent = 'Profit/Loss';
  profitLabel.htmlFor = `profit-${slug}`;
  rowContainer.appendChild(profitLabel);

  const profitInput = document.createElement('input');
  profitInput.type = 'number';
  profitInput.id = `profit-${slug}`;
  profitInput.name = `profit-${slug}`;
  profitInput.step = '0.01';
  profitInput.placeholder = '0.00';
  rowContainer.appendChild(profitInput);

  return {
    name: playerName,
    container: rowContainer,
    card1Input: card1Field.input,
    card2Input: card2Field.input,
    resultSelect,
    profitInput,
  };
}

// ── Public export ────────────────────────────────────────────────────────────

export function createHandRecordForm(container, sessionId, playerNames, onSuccess) {
  const wrapper = document.createElement('div');
  wrapper.className = 'hand-record-form';

  const heading = document.createElement('h2');
  heading.textContent = 'Record Hand';
  wrapper.appendChild(heading);

  const form = document.createElement('form');

  // ── Community Cards ────────────────────────────────────────────────────────
  const communitySection = document.createElement('fieldset');
  const communityLegend = document.createElement('legend');
  communityLegend.textContent = 'Community Cards';
  communitySection.appendChild(communityLegend);

  const communityDefs = [
    { key: 'flop1', label: 'Flop 1', required: true },
    { key: 'flop2', label: 'Flop 2', required: true },
    { key: 'flop3', label: 'Flop 3', required: true },
    { key: 'turn',  label: 'Turn',   required: false },
    { key: 'river', label: 'River',  required: false },
  ];

  const communityInputs = {};
  for (const def of communityDefs) {
    const field = createCardField(def.label, `community-${def.key}`, def.required);
    communityInputs[def.key] = field.input;
    communitySection.appendChild(field.container);
  }
  form.appendChild(communitySection);

  // ── Player Rows ────────────────────────────────────────────────────────────
  const playersSection = document.createElement('fieldset');
  const playersLegend = document.createElement('legend');
  playersLegend.textContent = 'Players';
  playersSection.appendChild(playersLegend);

  const playerRows = [];
  for (const name of playerNames) {
    const row = createPlayerRow(name);
    playerRows.push(row);
    playersSection.appendChild(row.container);
  }
  form.appendChild(playersSection);

  // ── Form-level error ───────────────────────────────────────────────────────
  const formError = document.createElement('p');
  formError.className = 'form-error';
  formError.style.color = 'red';
  formError.hidden = true;
  form.appendChild(formError);

  // ── Submit button ──────────────────────────────────────────────────────────
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.textContent = 'Submit Hand';
  form.appendChild(submitBtn);

  wrapper.appendChild(form);
  container.appendChild(wrapper);

  // ── Helpers to gather all card inputs ─────────────────────────────────────
  function getAllCardInputs() {
    const inputs = Object.values(communityInputs);
    for (const row of playerRows) {
      inputs.push(row.card1Input, row.card2Input);
    }
    return inputs;
  }

  // ── Single-field format validation ────────────────────────────────────────
  function validateSingleCard(input) {
    const val = input.value.trim();
    if (!val) {
      clearFmtError(input);
      if (input.dataset.required === 'true') {
        setFmtError(input, 'Required');
      }
      return;
    }
    if (!parseCard(val)) {
      setFmtError(input, 'Invalid format (e.g. AS, 10H, KD)');
    } else {
      clearFmtError(input);
    }
  }

  // ── Duplicate detection across all card fields ─────────────────────────────
  function runDuplicateCheck() {
    // Clear all existing dup errors
    for (const input of getAllCardInputs()) {
      if (input.dataset.dupError === 'true') {
        clearDupError(input);
      }
    }

    // Map canonical card key → inputs that hold that card
    const cardMap = new Map();
    for (const input of getAllCardInputs()) {
      const card = parseCard(input.value);
      if (!card) continue;
      const key = cardKey(card);
      if (!cardMap.has(key)) cardMap.set(key, []);
      cardMap.get(key).push(input);
    }

    // Mark any group with more than one input as duplicates
    for (const inputs of cardMap.values()) {
      if (inputs.length > 1) {
        for (const input of inputs) {
          setDupError(input);
        }
      }
    }
  }

  // ── Attach blur listeners ──────────────────────────────────────────────────
  for (const input of getAllCardInputs()) {
    input.addEventListener('blur', () => {
      validateSingleCard(input);
      runDuplicateCheck();
    });
  }

  // ── Submit handler ─────────────────────────────────────────────────────────
  form.addEventListener('submit', async event => {
    event.preventDefault();

    formError.hidden = true;
    formError.textContent = '';

    // Run full validation pass
    for (const input of getAllCardInputs()) {
      validateSingleCard(input);
    }
    runDuplicateCheck();

    // Check for any remaining errors
    const anyError = getAllCardInputs().some(input => hasAnyError(input));
    if (anyError) {
      formError.textContent = 'Please fix card errors before submitting.';
      formError.hidden = false;
      return;
    }

    // Build player_entries — include result + profit_loss in POST since
    // PATCH /players/{name} (HoleCardsUpdate) only accepts card fields.
    const playerEntries = playerRows.map(row => {
      const entry = {
        player_name: row.name,
        card_1: parseCard(row.card1Input.value),
        card_2: parseCard(row.card2Input.value),
      };
      if (row.resultSelect.value) {
        entry.result = row.resultSelect.value;
      }
      const profit = parseFloat(row.profitInput.value);
      if (!Number.isNaN(profit)) {
        entry.profit_loss = profit;
      }
      return entry;
    });

    const postBody = {
      flop_1: parseCard(communityInputs.flop1.value),
      flop_2: parseCard(communityInputs.flop2.value),
      flop_3: parseCard(communityInputs.flop3.value),
      player_entries: playerEntries,
    };

    const turnCard = parseCard(communityInputs.turn.value);
    if (turnCard) postBody.turn = turnCard;

    const riverCard = parseCard(communityInputs.river.value);
    if (riverCard) postBody.river = riverCard;

    submitBtn.disabled = true;

    try {
      const handResp = await createHand(sessionId, postBody);
      const handNumber = handResp.hand_number;
      try { onSuccess(); } catch (cbErr) { console.warn('onSuccess callback error:', cbErr); }

      // Best-effort PATCH hole cards (non-fatal — hand already saved via POST)
      try {
        await Promise.all(
          playerRows.map(row =>
            updateHolecards(sessionId, handNumber, row.name, {
              card_1: parseCard(row.card1Input.value),
              card_2: parseCard(row.card2Input.value),
            })
          )
        );
      } catch (patchErr) {
        console.warn('Supplementary PATCH failed (hand already saved):', patchErr);
      }
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
    } finally {
      submitBtn.disabled = false;
    }
  });

  return {
    dispose() {
      container.removeChild(wrapper);
    },
  };
}

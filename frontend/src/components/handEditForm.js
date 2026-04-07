import { updateCommunityCards, updateHolecards } from '../api/client.js';

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

function createCardField(labelText, idSuffix, required, initialValue) {
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
  if (initialValue) input.value = initialValue;
  fieldContainer.appendChild(input);

  const errorSpan = document.createElement('span');
  errorSpan.className = 'card-field-error';
  errorSpan.style.color = 'red';
  errorSpan.style.fontSize = '0.85em';
  errorSpan.hidden = true;
  fieldContainer.appendChild(errorSpan);

  return { container: fieldContainer, input };
}

function createPlayerEditRow(playerHand, handNumber) {
  const slug = toFieldId(playerHand.player_name);
  const idBase = `edit-h${handNumber}-${slug}`;

  const rowContainer = document.createElement('div');
  rowContainer.className = 'player-row';

  const nameEl = document.createElement('strong');
  nameEl.textContent = playerHand.player_name;
  rowContainer.appendChild(nameEl);

  const card1Field = createCardField('Card 1', `${idBase}-card1`, true, playerHand.card_1 || '');
  const card2Field = createCardField('Card 2', `${idBase}-card2`, true, playerHand.card_2 || '');
  rowContainer.appendChild(card1Field.container);
  rowContainer.appendChild(card2Field.container);

  const resultLabel = document.createElement('label');
  resultLabel.textContent = 'Result';
  resultLabel.htmlFor = `edit-result-${idBase}`;
  rowContainer.appendChild(resultLabel);

  const resultSelect = document.createElement('select');
  resultSelect.id = `edit-result-${idBase}`;
  resultSelect.name = `edit-result-${idBase}`;
  for (const [val, text] of [
    ['', '-- select --'],
    ['win', 'Win'],
    ['loss', 'Loss'],
    ['fold', 'Fold'],
  ]) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = text;
    if ((playerHand.result || '') === val) opt.selected = true;
    resultSelect.appendChild(opt);
  }
  rowContainer.appendChild(resultSelect);

  const profitLabel = document.createElement('label');
  profitLabel.textContent = 'Profit/Loss';
  profitLabel.htmlFor = `edit-profit-${idBase}`;
  rowContainer.appendChild(profitLabel);

  const profitInput = document.createElement('input');
  profitInput.type = 'number';
  profitInput.id = `edit-profit-${idBase}`;
  profitInput.name = `edit-profit-${idBase}`;
  profitInput.step = '0.01';
  profitInput.placeholder = '0.00';
  if (playerHand.profit_loss != null) profitInput.value = String(playerHand.profit_loss);
  rowContainer.appendChild(profitInput);

  return {
    playerHand,
    container: rowContainer,
    card1Input: card1Field.input,
    card2Input: card2Field.input,
    resultSelect,
    profitInput,
  };
}

export function createHandEditForm(container, sessionId, handData, onSave, onCancel) {
  const wrapper = document.createElement('div');
  wrapper.className = 'hand-edit-form';

  const heading = document.createElement('h3');
  heading.textContent = `Edit Hand #${handData.hand_number}`;
  wrapper.appendChild(heading);

  const form = document.createElement('form');

  // ── Community Cards ──────────────────────────────────────────────────────
  const communitySection = document.createElement('fieldset');
  const communityLegend = document.createElement('legend');
  communityLegend.textContent = 'Community Cards';
  communitySection.appendChild(communityLegend);

  const handBase = `h${handData.hand_number}`;
  const communityDefs = [
    { key: 'flop_1', label: 'Flop 1', required: true },
    { key: 'flop_2', label: 'Flop 2', required: true },
    { key: 'flop_3', label: 'Flop 3', required: true },
    { key: 'turn',   label: 'Turn',   required: false },
    { key: 'river',  label: 'River',  required: false },
  ];

  const communityInputs = {};
  for (const def of communityDefs) {
    const initial = handData[def.key] || '';
    const field = createCardField(def.label, `edit-${handBase}-community-${def.key}`, def.required, initial);
    communityInputs[def.key] = field.input;
    communitySection.appendChild(field.container);
  }
  form.appendChild(communitySection);

  // ── Player Rows ──────────────────────────────────────────────────────────
  const playersSection = document.createElement('fieldset');
  const playersLegend = document.createElement('legend');
  playersLegend.textContent = 'Players';
  playersSection.appendChild(playersLegend);

  const playerRows = [];
  for (const ph of handData.player_hands || []) {
    const row = createPlayerEditRow(ph, handData.hand_number);
    playerRows.push(row);
    playersSection.appendChild(row.container);
  }
  form.appendChild(playersSection);

  // ── Form-level error ─────────────────────────────────────────────────────
  const formError = document.createElement('p');
  formError.className = 'form-error';
  formError.style.color = 'red';
  formError.hidden = true;
  form.appendChild(formError);

  // ── Buttons ──────────────────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.className = 'form-btn-row';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.textContent = 'Save';
  btnRow.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  btnRow.appendChild(cancelBtn);

  form.appendChild(btnRow);
  wrapper.appendChild(form);
  container.appendChild(wrapper);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getAllCardInputs() {
    const inputs = Object.values(communityInputs);
    for (const row of playerRows) {
      inputs.push(row.card1Input, row.card2Input);
    }
    return inputs;
  }

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

  function runDuplicateCheck() {
    for (const input of getAllCardInputs()) {
      if (input.dataset.dupError === 'true') {
        clearDupError(input);
      }
    }

    const cardMap = new Map();
    for (const input of getAllCardInputs()) {
      const card = parseCard(input.value);
      if (!card) continue;
      const key = cardKey(card);
      if (!cardMap.has(key)) cardMap.set(key, []);
      cardMap.get(key).push(input);
    }

    for (const inputs of cardMap.values()) {
      if (inputs.length > 1) {
        for (const input of inputs) {
          setDupError(input);
        }
      }
    }
  }

  // ── Blur listeners ───────────────────────────────────────────────────────
  for (const input of getAllCardInputs()) {
    input.addEventListener('blur', () => {
      validateSingleCard(input);
      runDuplicateCheck();
    });
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  cancelBtn.addEventListener('click', () => {
    try { onCancel(); } catch (cbErr) { console.warn('onCancel callback error:', cbErr); }
  });

  // ── Submit ───────────────────────────────────────────────────────────────
  form.addEventListener('submit', async event => {
    event.preventDefault();

    formError.hidden = true;
    formError.textContent = '';

    for (const input of getAllCardInputs()) {
      validateSingleCard(input);
    }
    runDuplicateCheck();

    const anyError = getAllCardInputs().some(input => hasAnyError(input));
    if (anyError) {
      formError.textContent = 'Please fix card errors before saving.';
      formError.hidden = false;
      return;
    }

    function cardChanged(input, original) {
      const current = input.value.trim().toUpperCase();
      const orig = (original || '').toUpperCase();
      return current !== orig;
    }

    const communityChanged =
      cardChanged(communityInputs.flop_1, handData.flop_1) ||
      cardChanged(communityInputs.flop_2, handData.flop_2) ||
      cardChanged(communityInputs.flop_3, handData.flop_3) ||
      cardChanged(communityInputs.turn,   handData.turn)   ||
      cardChanged(communityInputs.river,  handData.river);

    saveBtn.disabled = true;
    cancelBtn.disabled = true;

    try {
      let updatedCommunity = {
        flop_1: handData.flop_1,
        flop_2: handData.flop_2,
        flop_3: handData.flop_3,
        turn:   handData.turn,
        river:  handData.river,
      };

      if (communityChanged) {
        const patchBody = {
          flop_1: parseCard(communityInputs.flop_1.value),
          flop_2: parseCard(communityInputs.flop_2.value),
          flop_3: parseCard(communityInputs.flop_3.value),
        };
        const turnCard = parseCard(communityInputs.turn.value);
        if (turnCard) patchBody.turn = turnCard;
        const riverCard = parseCard(communityInputs.river.value);
        if (riverCard) patchBody.river = riverCard;

        const communityResp = await updateCommunityCards(sessionId, handData.hand_number, patchBody);
        updatedCommunity = {
          flop_1: communityResp.flop_1,
          flop_2: communityResp.flop_2,
          flop_3: communityResp.flop_3,
          turn:   communityResp.turn,
          river:  communityResp.river,
        };
      }

      const updatedPlayerHands = await Promise.all(
        playerRows.map(async row => {
          const orig = row.playerHand;
          const card1Changed = cardChanged(row.card1Input, orig.card_1);
          const card2Changed = cardChanged(row.card2Input, orig.card_2);

          let card1 = orig.card_1;
          let card2 = orig.card_2;

          if (card1Changed || card2Changed) {
            const resp = await updateHolecards(sessionId, handData.hand_number, orig.player_name, {
              card_1: parseCard(row.card1Input.value),
              card_2: parseCard(row.card2Input.value),
            });
            card1 = resp.card_1;
            card2 = resp.card_2;
          }

          const result = row.resultSelect.value || null;
          const profitRaw = parseFloat(row.profitInput.value);
          const profitLoss = Number.isNaN(profitRaw) ? orig.profit_loss : profitRaw;

          return { ...orig, card_1: card1, card_2: card2, result, profit_loss: profitLoss };
        })
      );

      const updatedHandData = {
        ...handData,
        ...updatedCommunity,
        player_hands: updatedPlayerHands,
      };

      try { onSave(updatedHandData); } catch (cbErr) { console.warn('onSave callback error:', cbErr); }
    } catch (err) {
      formError.textContent = err.message;
      formError.hidden = false;
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  });

  return {
    dispose() {
      if (wrapper.parentElement) {
        wrapper.parentElement.removeChild(wrapper);
      }
    },
  };
}

import { useState, useCallback } from 'react';
import { updateCommunityCards, updateHolecards } from '../api/client.ts';
import type { HandResponse } from '../api/types';
import { isValidCard, normalizeCard, findDuplicateCards } from './cardUtils.ts';

export interface HandEditFormProps {
  sessionId: number;
  handData: HandResponse;
  onSave: (data: HandResponse) => void;
  onCancel: () => void;
}

interface CardFieldState {
  value: string;
  fmtError: string | null;
  dupError: boolean;
}

interface PlayerEditRow {
  playerName: string;
  originalCard1: string;
  originalCard2: string;
  card1: CardFieldState;
  card2: CardFieldState;
  result: string;
  profitLoss: string;
}

function mkField(value: string): CardFieldState {
  return { value, fmtError: null, dupError: false };
}

function toFieldId(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

function validateCardField(field: CardFieldState, required: boolean): CardFieldState {
  const val = field.value.trim();
  if (!val) {
    return { ...field, fmtError: required ? 'Required' : null };
  }
  if (!isValidCard(val)) {
    return { ...field, fmtError: 'Invalid format (e.g. AS, 10H, KD)' };
  }
  return { ...field, fmtError: null };
}

function hasAnyError(field: CardFieldState): boolean {
  return field.fmtError !== null || field.dupError;
}

export function HandEditForm({ sessionId, handData, onSave, onCancel }: HandEditFormProps) {
  const [community, setCommunity] = useState({
    flop_1: mkField(handData.flop_1 || ''),
    flop_2: mkField(handData.flop_2 || ''),
    flop_3: mkField(handData.flop_3 || ''),
    turn: mkField(handData.turn || ''),
    river: mkField(handData.river || ''),
  });

  const [playerRows, setPlayerRows] = useState<PlayerEditRow[]>(() =>
    (handData.player_hands || []).map(playerHand => ({
      playerName: playerHand.player_name,
      originalCard1: playerHand.card_1 || '',
      originalCard2: playerHand.card_2 || '',
      card1: mkField(playerHand.card_1 || ''),
      card2: mkField(playerHand.card_2 || ''),
      result: playerHand.result || '',
      profitLoss: playerHand.profit_loss != null ? String(playerHand.profit_loss) : '',
    }))
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const runDuplicateCheck = useCallback(
    (
      comm: typeof community,
      rows: PlayerEditRow[]
    ): { comm: typeof community; rows: PlayerEditRow[] } => {
      const allVals = [
        comm.flop_1.value,
        comm.flop_2.value,
        comm.flop_3.value,
        comm.turn.value,
        comm.river.value,
        ...rows.flatMap(row => [row.card1.value, row.card2.value]),
      ].filter(v => v.trim());

      const dupes = findDuplicateCards(allVals);

      function markDup(field: CardFieldState): CardFieldState {
        const norm = normalizeCard(field.value);
        return { ...field, dupError: norm !== '' && dupes.has(norm) };
      }

      return {
        comm: {
          flop_1: markDup(comm.flop_1),
          flop_2: markDup(comm.flop_2),
          flop_3: markDup(comm.flop_3),
          turn: markDup(comm.turn),
          river: markDup(comm.river),
        },
        rows: rows.map(row => ({
          ...row,
          card1: markDup(row.card1),
          card2: markDup(row.card2),
        })),
      };
    },
    []
  );

  function handleCommunityChange(key: keyof typeof community, value: string) {
    setCommunity(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  }

  function handleCommunityBlur(key: keyof typeof community, required: boolean) {
    setCommunity(prev => {
      const validated = validateCardField(prev[key], required);
      const next = { ...prev, [key]: validated };
      const { comm, rows } = runDuplicateCheck(next, playerRows);
      setPlayerRows(rows);
      return comm;
    });
  }

  function handlePlayerCardChange(idx: number, field: 'card1' | 'card2', value: string) {
    setPlayerRows(prev =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: { ...row[field], value } } : row))
    );
  }

  function handlePlayerCardBlur(idx: number, field: 'card1' | 'card2') {
    setPlayerRows(prev => {
      const rows = prev.map((row, i) => {
        if (i !== idx) return row;
        return { ...row, [field]: validateCardField(row[field], true) };
      });
      const { comm, rows: dupRows } = runDuplicateCheck(community, rows);
      setCommunity(comm);
      return dupRows;
    });
  }

  function cardChanged(current: string, original: string): boolean {
    return current.trim().toUpperCase() !== (original || '').toUpperCase();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validate all
    let validatedComm = {
      flop_1: validateCardField(community.flop_1, true),
      flop_2: validateCardField(community.flop_2, true),
      flop_3: validateCardField(community.flop_3, true),
      turn: validateCardField(community.turn, false),
      river: validateCardField(community.river, false),
    };

    let validatedRows = playerRows.map(row => ({
      ...row,
      card1: validateCardField(row.card1, true),
      card2: validateCardField(row.card2, true),
    }));

    const dupResult = runDuplicateCheck(validatedComm, validatedRows);
    validatedComm = dupResult.comm;
    validatedRows = dupResult.rows;

    setCommunity(validatedComm);
    setPlayerRows(validatedRows);

    const allFields = [
      validatedComm.flop_1,
      validatedComm.flop_2,
      validatedComm.flop_3,
      validatedComm.turn,
      validatedComm.river,
      ...validatedRows.flatMap(row => [row.card1, row.card2]),
    ];

    if (allFields.some(hasAnyError)) {
      setFormError('Please fix card errors before saving.');
      return;
    }

    const communityChanged =
      cardChanged(validatedComm.flop_1.value, handData.flop_1 || '') ||
      cardChanged(validatedComm.flop_2.value, handData.flop_2 || '') ||
      cardChanged(validatedComm.flop_3.value, handData.flop_3 || '') ||
      cardChanged(validatedComm.turn.value, handData.turn || '') ||
      cardChanged(validatedComm.river.value, handData.river || '');

    setSubmitting(true);

    try {
      let updatedCommunity = {
        flop_1: handData.flop_1,
        flop_2: handData.flop_2,
        flop_3: handData.flop_3,
        turn: handData.turn,
        river: handData.river,
      };

      if (communityChanged) {
        const patchBody: Record<string, string | null> = {
          flop_1: normalizeCard(validatedComm.flop_1.value),
          flop_2: normalizeCard(validatedComm.flop_2.value),
          flop_3: normalizeCard(validatedComm.flop_3.value),
        };
        const turnVal = normalizeCard(validatedComm.turn.value);
        if (turnVal) patchBody.turn = turnVal;
        const riverVal = normalizeCard(validatedComm.river.value);
        if (riverVal) patchBody.river = riverVal;

        const resp = await updateCommunityCards(
          sessionId,
          handData.hand_number,
          patchBody as unknown as Parameters<typeof updateCommunityCards>[2]
        );
        updatedCommunity = {
          flop_1: resp.flop_1,
          flop_2: resp.flop_2,
          flop_3: resp.flop_3,
          turn: resp.turn,
          river: resp.river,
        };
      }

      const updatedPlayerHands = await Promise.all(
        validatedRows.map(async row => {
          const origHand = handData.player_hands.find(playerHand => playerHand.player_name === row.playerName);
          if (!origHand) return null;

          const c1Changed = cardChanged(row.card1.value, row.originalCard1);
          const c2Changed = cardChanged(row.card2.value, row.originalCard2);

          let card1 = origHand.card_1;
          let card2 = origHand.card_2;

          if (c1Changed || c2Changed) {
            const resp = await updateHolecards(
              sessionId,
              handData.hand_number,
              origHand.player_name,
              {
                card_1: normalizeCard(row.card1.value),
                card_2: normalizeCard(row.card2.value),
              }
            );
            // updateHolecards returns HandResponse, extract player hand
            const updatedPlayerHand = (resp as HandResponse).player_hands?.find(
              playerHand => playerHand.player_name === origHand.player_name
            );
            if (updatedPlayerHand) {
              card1 = updatedPlayerHand.card_1;
              card2 = updatedPlayerHand.card_2;
            } else {
              card1 = normalizeCard(row.card1.value);
              card2 = normalizeCard(row.card2.value);
            }
          }

          return { ...origHand, card_1: card1, card_2: card2 };
        })
      );

      const updatedHandData: HandResponse = {
        ...handData,
        ...updatedCommunity,
        player_hands: updatedPlayerHands.filter(Boolean) as HandResponse['player_hands'],
      };

      try {
        onSave(updatedHandData);
      } catch (cbErr) {
        console.warn('onSave callback error:', cbErr);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  function renderCardField(
    label: string,
    idSuffix: string,
    field: CardFieldState,
    required: boolean,
    onChange: (value: string) => void,
    onBlur: () => void
  ) {
    return (
      <div className="card-field" key={idSuffix}>
        <label htmlFor={`card-input-${idSuffix}`}>
          {required ? `${label} *` : label}
        </label>
        <input
          type="text"
          id={`card-input-${idSuffix}`}
          name={idSuffix}
          placeholder={required ? 'e.g. AS' : 'e.g. JH (optional)'}
          value={field.value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          style={hasAnyError(field) ? { borderColor: 'red' } : undefined}
        />
        {(field.fmtError || field.dupError) && (
          <span className="card-field-error" style={{ color: 'red', fontSize: '0.85em' }}>
            {field.dupError ? 'Duplicate card' : field.fmtError}
          </span>
        )}
      </div>
    );
  }

  const handBase = `h${handData.hand_number}`;

  return (
    <div className="hand-edit-form">
      <h3>Edit Hand #{handData.hand_number}</h3>
      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Community Cards</legend>
          {renderCardField('Flop 1', `edit-${handBase}-community-flop_1`, community.flop_1, true,
            value => handleCommunityChange('flop_1', value),
            () => handleCommunityBlur('flop_1', true))}
          {renderCardField('Flop 2', `edit-${handBase}-community-flop_2`, community.flop_2, true,
            value => handleCommunityChange('flop_2', value),
            () => handleCommunityBlur('flop_2', true))}
          {renderCardField('Flop 3', `edit-${handBase}-community-flop_3`, community.flop_3, true,
            value => handleCommunityChange('flop_3', value),
            () => handleCommunityBlur('flop_3', true))}
          {renderCardField('Turn', `edit-${handBase}-community-turn`, community.turn, false,
            value => handleCommunityChange('turn', value),
            () => handleCommunityBlur('turn', false))}
          {renderCardField('River', `edit-${handBase}-community-river`, community.river, false,
            value => handleCommunityChange('river', value),
            () => handleCommunityBlur('river', false))}
        </fieldset>

        <fieldset>
          <legend>Players</legend>
          {playerRows.map((row, idx) => {
            const slug = toFieldId(row.playerName);
            const idBase = `edit-h${handData.hand_number}-${slug}`;
            return (
              <div className="player-row" key={row.playerName}>
                <strong>{row.playerName}</strong>
                {renderCardField('Card 1', `${idBase}-card1`, row.card1, true,
                  value => handlePlayerCardChange(idx, 'card1', value),
                  () => handlePlayerCardBlur(idx, 'card1'))}
                {renderCardField('Card 2', `${idBase}-card2`, row.card2, true,
                  value => handlePlayerCardChange(idx, 'card2', value),
                  () => handlePlayerCardBlur(idx, 'card2'))}

                <label htmlFor={`edit-result-${idBase}`}>Result</label>
                <select
                  id={`edit-result-${idBase}`}
                  name={`edit-result-${idBase}`}
                  disabled
                  value={row.result}
                >
                  <option value="">-- select --</option>
                  <option value="win">Win</option>
                  <option value="loss">Loss</option>
                  <option value="fold">Fold</option>
                </select>

                <label htmlFor={`edit-profit-${idBase}`}>Profit/Loss</label>
                <input
                  type="number"
                  id={`edit-profit-${idBase}`}
                  name={`edit-profit-${idBase}`}
                  step="0.01"
                  placeholder="0.00"
                  readOnly
                  value={row.profitLoss}
                />
              </div>
            );
          })}
        </fieldset>

        {formError && (
          <p className="form-error" style={{ color: 'red' }}>
            {formError}
          </p>
        )}

        <div className="form-btn-row">
          <button type="submit" disabled={submitting}>
            Save
          </button>
          <button type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

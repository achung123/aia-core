import { useState, useCallback } from 'react';
import { createHand, updateHolecards } from '../api/client.ts';
import { isValidCard, normalizeCard, findDuplicateCards } from './cardUtils.ts';

export interface HandRecordFormProps {
  sessionId: number;
  playerNames: string[];
  onSuccess: () => void;
}

interface CardFieldState {
  value: string;
  fmtError: string | null;
  dupError: boolean;
  touched: boolean;
}

interface PlayerRowState {
  name: string;
  card1: CardFieldState;
  card2: CardFieldState;
  result: string;
  profitLoss: string;
}

const RESULT_OPTIONS = [
  { value: '', label: '-- select --' },
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'fold', label: 'Fold' },
];

function emptyCard(): CardFieldState {
  return { value: '', fmtError: null, dupError: false, touched: false };
}

function toFieldId(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

function validateCardField(field: CardFieldState, required: boolean): CardFieldState {
  const val = field.value.trim();
  if (!val) {
    return {
      ...field,
      fmtError: required ? 'Required' : null,
    };
  }
  if (!isValidCard(val)) {
    return { ...field, fmtError: 'Invalid format (e.g. AS, 10H, KD)' };
  }
  return { ...field, fmtError: null };
}

export function HandRecordForm({ sessionId, playerNames, onSuccess }: HandRecordFormProps) {
  const [community, setCommunity] = useState({
    flop1: emptyCard(),
    flop2: emptyCard(),
    flop3: emptyCard(),
    turn: emptyCard(),
    river: emptyCard(),
  });

  const [playerRows, setPlayerRows] = useState<PlayerRowState[]>(() =>
    playerNames.map(name => ({
      name,
      card1: emptyCard(),
      card2: emptyCard(),
      result: '',
      profitLoss: '',
    }))
  );

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const runDuplicateCheck = useCallback(
    (
      comm: typeof community,
      rows: PlayerRowState[]
    ): { comm: typeof community; rows: PlayerRowState[] } => {
      const allVals = [
        comm.flop1.value,
        comm.flop2.value,
        comm.flop3.value,
        comm.turn.value,
        comm.river.value,
        ...rows.flatMap(r => [r.card1.value, r.card2.value]),
      ].filter(v => v.trim());

      const dupes = findDuplicateCards(allVals);

      function markDup(field: CardFieldState): CardFieldState {
        const norm = normalizeCard(field.value);
        return { ...field, dupError: norm !== '' && dupes.has(norm) };
      }

      return {
        comm: {
          flop1: markDup(comm.flop1),
          flop2: markDup(comm.flop2),
          flop3: markDup(comm.flop3),
          turn: markDup(comm.turn),
          river: markDup(comm.river),
        },
        rows: rows.map(r => ({
          ...r,
          card1: markDup(r.card1),
          card2: markDup(r.card2),
        })),
      };
    },
    []
  );

  function handleCommunityBlur(key: keyof typeof community, required: boolean) {
    setCommunity(prev => {
      const validated = validateCardField(prev[key], required);
      const next = { ...prev, [key]: validated };
      const { comm, rows } = runDuplicateCheck(next, playerRows);
      setPlayerRows(rows);
      return comm;
    });
  }

  function handleCommunityChange(key: keyof typeof community, value: string) {
    setCommunity(prev => ({ ...prev, [key]: { ...prev[key], value } }));
  }

  function handlePlayerCardBlur(playerIdx: number, field: 'card1' | 'card2') {
    setPlayerRows(prev => {
      const rows = prev.map((r, i) => {
        if (i !== playerIdx) return r;
        return { ...r, [field]: validateCardField(r[field], true) };
      });
      const { comm, rows: dupRows } = runDuplicateCheck(community, rows);
      setCommunity(comm);
      return dupRows;
    });
  }

  function handlePlayerCardChange(playerIdx: number, field: 'card1' | 'card2', value: string) {
    setPlayerRows(prev =>
      prev.map((r, i) => (i === playerIdx ? { ...r, [field]: { ...r[field], value } } : r))
    );
  }

  function handlePlayerFieldChange(playerIdx: number, field: 'result' | 'profitLoss', value: string) {
    setPlayerRows(prev =>
      prev.map((r, i) => (i === playerIdx ? { ...r, [field]: value } : r))
    );
  }

  function hasAnyError(field: CardFieldState): boolean {
    return field.fmtError !== null || field.dupError;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validate all fields
    let validatedComm = {
      flop1: validateCardField(community.flop1, true),
      flop2: validateCardField(community.flop2, true),
      flop3: validateCardField(community.flop3, true),
      turn: validateCardField(community.turn, false),
      river: validateCardField(community.river, false),
    };

    let validatedRows = playerRows.map(r => ({
      ...r,
      card1: validateCardField(r.card1, true),
      card2: validateCardField(r.card2, true),
    }));

    const dupResult = runDuplicateCheck(validatedComm, validatedRows);
    validatedComm = dupResult.comm;
    validatedRows = dupResult.rows;

    setCommunity(validatedComm);
    setPlayerRows(validatedRows);

    // Check for errors
    const allFields = [
      validatedComm.flop1,
      validatedComm.flop2,
      validatedComm.flop3,
      validatedComm.turn,
      validatedComm.river,
      ...validatedRows.flatMap(r => [r.card1, r.card2]),
    ];

    if (allFields.some(hasAnyError)) {
      setFormError('Please fix card errors before submitting.');
      return;
    }

    const playerEntries = validatedRows.map(row => {
      const entry: Record<string, unknown> = {
        player_name: row.name,
        card_1: normalizeCard(row.card1.value),
        card_2: normalizeCard(row.card2.value),
      };
      if (row.result) {
        entry.result = row.result;
      }
      const profit = parseFloat(row.profitLoss);
      if (!Number.isNaN(profit)) {
        entry.profit_loss = profit;
      }
      return entry;
    });

    const postBody: Record<string, unknown> = {
      flop_1: normalizeCard(validatedComm.flop1.value),
      flop_2: normalizeCard(validatedComm.flop2.value),
      flop_3: normalizeCard(validatedComm.flop3.value),
      player_entries: playerEntries,
    };

    const turnVal = normalizeCard(validatedComm.turn.value);
    if (turnVal) postBody.turn = turnVal;

    const riverVal = normalizeCard(validatedComm.river.value);
    if (riverVal) postBody.river = riverVal;

    setSubmitting(true);

    try {
      const handResp = await createHand(sessionId, postBody as Parameters<typeof createHand>[1]);
      const handNumber = handResp.hand_number;

      try {
        onSuccess();
      } catch (cbErr) {
        console.warn('onSuccess callback error:', cbErr);
      }

      // Best-effort PATCH hole cards
      try {
        await Promise.all(
          validatedRows.map(row =>
            updateHolecards(sessionId, handNumber, row.name, {
              card_1: normalizeCard(row.card1.value),
              card_2: normalizeCard(row.card2.value),
            })
          )
        );
      } catch (patchErr) {
        console.warn('Supplementary PATCH failed (hand already saved):', patchErr);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
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

  return (
    <div className="hand-record-form">
      <h2>Record Hand</h2>
      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Community Cards</legend>
          {renderCardField('Flop 1', 'community-flop1', community.flop1, true,
            v => handleCommunityChange('flop1', v),
            () => handleCommunityBlur('flop1', true))}
          {renderCardField('Flop 2', 'community-flop2', community.flop2, true,
            v => handleCommunityChange('flop2', v),
            () => handleCommunityBlur('flop2', true))}
          {renderCardField('Flop 3', 'community-flop3', community.flop3, true,
            v => handleCommunityChange('flop3', v),
            () => handleCommunityBlur('flop3', true))}
          {renderCardField('Turn', 'community-turn', community.turn, false,
            v => handleCommunityChange('turn', v),
            () => handleCommunityBlur('turn', false))}
          {renderCardField('River', 'community-river', community.river, false,
            v => handleCommunityChange('river', v),
            () => handleCommunityBlur('river', false))}
        </fieldset>

        <fieldset>
          <legend>Players</legend>
          {playerRows.map((row, idx) => {
            const slug = toFieldId(row.name);
            return (
              <div className="player-row" key={row.name}>
                <strong>{row.name}</strong>
                {renderCardField('Card 1', `${slug}-card1`, row.card1, true,
                  v => handlePlayerCardChange(idx, 'card1', v),
                  () => handlePlayerCardBlur(idx, 'card1'))}
                {renderCardField('Card 2', `${slug}-card2`, row.card2, true,
                  v => handlePlayerCardChange(idx, 'card2', v),
                  () => handlePlayerCardBlur(idx, 'card2'))}

                <label htmlFor={`result-${slug}`}>Result</label>
                <select
                  id={`result-${slug}`}
                  name={`result-${slug}`}
                  value={row.result}
                  onChange={e => handlePlayerFieldChange(idx, 'result', e.target.value)}
                >
                  {RESULT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <label htmlFor={`profit-${slug}`}>Profit/Loss</label>
                <input
                  type="number"
                  id={`profit-${slug}`}
                  name={`profit-${slug}`}
                  step="0.01"
                  placeholder="0.00"
                  value={row.profitLoss}
                  onChange={e => handlePlayerFieldChange(idx, 'profitLoss', e.target.value)}
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

        <button type="submit" disabled={submitting}>
          Submit Hand
        </button>
      </form>
    </div>
  );
}

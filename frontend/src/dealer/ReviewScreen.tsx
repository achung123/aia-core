import { useState, useEffect } from 'react';
import type React from 'react';
import { CardPicker } from './CardPicker.tsx';
import { patchPlayerResult, updateCommunityCards, updateHolecards, fetchEquity, fetchHand, fetchHandActions } from '../api/client.ts';
import type { Player, CommunityCards } from '../stores/dealerStore.ts';
import type { ResultEnum, StreetEnum, PlayerEquityEntry, HandActionResponse } from '../api/types';
import { inferOutcomeStreet, mapEquityToOutcomes } from './showdownHelpers.ts';
import { PlayingCard } from '../components/PlayingCard.tsx';

type CommunityField = 'flop1' | 'flop2' | 'flop3' | 'turn' | 'river';

interface CommunityCardEdit {
  type: 'community';
  field: CommunityField;
}

interface PlayerCardEdit {
  type: 'player';
  name: string;
  field: 'card1' | 'card2';
}

type CardEditTarget = CommunityCardEdit | PlayerCardEdit;

interface EditablePlayer {
  name: string;
  card1: string | null;
  card2: string | null;
  origCard1: string | null;
  origCard2: string | null;
  result: string;
  origResult: string;
  outcomeStreet: string | null;
  origOutcomeStreet: string | null;
}

interface EditableCommunity {
  flop1: string | null;
  flop2: string | null;
  flop3: string | null;
  turn: string | null;
  river: string | null;
}

export interface ReviewScreenProps {
  gameId: number;
  handId: number;
  players: Player[];
  community: CommunityCards;
  onSaved: () => void;
  onCancel: () => void;
}

const RESULT_OPTIONS: ResultEnum[] = ['won', 'lost', 'folded'];
const STREET_OPTIONS: StreetEnum[] = ['preflop', 'flop', 'turn', 'river'];
const TERMINAL_RESULTS = ['won', 'lost', 'folded'];

export function ReviewScreen({ gameId, handId, players, community, onSaved, onCancel }: ReviewScreenProps) {
  const participatingPlayers = players.filter(
    (player) => player.status !== 'not_playing',
  );

  const [editPlayers, setEditPlayers] = useState<EditablePlayer[]>(() =>
    participatingPlayers.map((player) => {
      const isAutoFold = !player.card1 && !player.card2 && !TERMINAL_RESULTS.includes(player.status);
      return {
        name: player.name,
        card1: player.card1,
        card2: player.card2,
        origCard1: player.card1,
        origCard2: player.card2,
        result: isAutoFold ? 'folded' : player.status,
        origResult: player.status,
        outcomeStreet: player.outcomeStreet,
        origOutcomeStreet: player.outcomeStreet,
      };
    }),
  );

  const [origCommunity] = useState<EditableCommunity>(() => ({
    flop1: community.flop1,
    flop2: community.flop2,
    flop3: community.flop3,
    turn: community.turn,
    river: community.river,
  }));

  const [editCommunity, setEditCommunity] = useState<EditableCommunity>(() => ({
    flop1: community.flop1,
    flop2: community.flop2,
    flop3: community.flop3,
    turn: community.turn,
    river: community.river,
  }));

  const [cardEditTarget, setCardEditTarget] = useState<CardEditTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [equityData, setEquityData] = useState<PlayerEquityEntry[]>([]);
  const [handPot, setHandPot] = useState<number>(0);
  const [playerContributions, setPlayerContributions] = useState<Record<string, number>>({});
  const [handDescriptions, setHandDescriptions] = useState<Record<string, string>>({});

  // Fetch hand data for pot, hand descriptions, and actions for contributions
  useEffect(() => {
    fetchHand(gameId, handId).then((hand) => {
      setHandPot(hand.pot ?? 0);
      // Store hand descriptions from the hand response (includes folded players)
      const descs: Record<string, string> = {};
      for (const playerHand of hand.player_hands) {
        if (playerHand.winning_hand_description) {
          descs[playerHand.player_name] = playerHand.winning_hand_description;
        }
      }
      setHandDescriptions(descs);
    }).catch(() => {});

    fetchHandActions(gameId, handId).then((actions: HandActionResponse[]) => {
      const contribs: Record<string, number> = {};
      for (const a of actions) {
        if (a.action in { call: 1, bet: 1, raise: 1, blind: 1 } && a.amount) {
          contribs[a.player_name] = (contribs[a.player_name] ?? 0) + a.amount;
        }
      }
      setPlayerContributions(contribs);
    }).catch(() => {});
  }, [gameId, handId]);

  useEffect(() => {
    fetchEquity(gameId, handId)
      .then((res) => {
        setEquityData(res.equities);
        // Auto-propose outcomes for non-folded players without terminal results
        const proposed = mapEquityToOutcomes(res.equities, players, community);
        if (proposed && proposed.length > 0) {
          setEditPlayers((prev) =>
            prev.map((editPlayer) => {
              if (TERMINAL_RESULTS.includes(editPlayer.result)) return editPlayer; // already decided
              const prop = proposed.find((result) => result.name === editPlayer.name);
              if (!prop) return editPlayer;
              return { ...editPlayer, result: prop.status, outcomeStreet: prop.outcomeStreet };
            }),
          );
        }
      })
      .catch(() => { /* graceful degradation — no hand descriptions */ });
  }, [gameId, handId]);

  const allTerminal = editPlayers.every((player) => TERMINAL_RESULTS.includes(player.result));
  const [savedResults, setSavedResults] = useState<Set<string>>(() => new Set());
  const [savedHolecards, setSavedHolecards] = useState<Set<string>>(() => new Set());
  const [communitySaved, setCommunitySaved] = useState(false);

  function handleFinishClick() {
    setShowFinishConfirm(true);
  }

  function handleConfirmFinish() {
    setShowFinishConfirm(false);
    handleSave();
  }

  function handleCancelFinish() {
    setShowFinishConfirm(false);
  }

  function handleCommunityCardClick(field: CommunityField) {
    setCardEditTarget({ type: 'community', field });
  }

  function handlePlayerCardClick(name: string, field: 'card1' | 'card2') {
    setCardEditTarget({ type: 'player', name, field });
  }

  function handleCardSelect(cardCode: string) {
    if (!cardEditTarget) return;

    if (cardEditTarget.type === 'community') {
      setEditCommunity((prev) => ({ ...prev, [cardEditTarget.field]: cardCode }));
    } else {
      setEditPlayers((prev) =>
        prev.map((player) =>
          player.name === cardEditTarget.name ? { ...player, [cardEditTarget.field]: cardCode } : player,
        ),
      );
    }
    setCardEditTarget(null);
  }

  function handleCardPickerClose() {
    setCardEditTarget(null);
  }

  function handleResultChange(name: string, result: string) {
    setEditPlayers((prev) =>
      prev.map((player) => (player.name === name ? { ...player, result } : player)),
    );
  }

  function handleStreetChange(name: string, street: string) {
    setEditPlayers((prev) =>
      prev.map((player) => (player.name === name ? { ...player, outcomeStreet: street } : player)),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    // Compute profit_loss for each player based on pot and contributions
    const winners = editPlayers.filter((player) => player.result === 'won');
    const numWinners = winners.length || 1;
    const pot = handPot;

    function computeProfitLoss(player: EditablePlayer): number | null {
      if (pot <= 0) return null; // no pot tracked — skip P&L
      const contribution = playerContributions[player.name] ?? 0;
      if (player.result === 'won') {
        return round2(pot / numWinners - contribution);
      }
      if (player.result === 'lost' || player.result === 'folded') {
        return round2(-contribution);
      }
      return null;
    }

    function round2(n: number): number {
      return Math.round(n * 100) / 100;
    }

    interface LabeledMutation {
      label: string;
      promise: Promise<unknown>;
      type: 'result' | 'holecards' | 'community';
      playerName?: string;
    }

    const mutations: LabeledMutation[] = [];

    // Patch only dirty player results not already saved
    for (const player of editPlayers) {
      const pl = computeProfitLoss(player);
      const isDirty = player.result !== player.origResult || player.outcomeStreet !== player.origOutcomeStreet || pl !== null;
      if (isDirty && !savedResults.has(player.name)) {
        mutations.push({
          label: `${player.name} result`,
          promise: patchPlayerResult(gameId, handId, player.name, {
            result: player.result as ResultEnum,
            profit_loss: pl,
            outcome_street: (player.outcomeStreet || null) as StreetEnum | null,
          }),
          type: 'result',
          playerName: player.name,
        });
      }
    }

    // Update hole cards for players whose cards changed (not already saved)
    for (const player of editPlayers) {
      const isDirty = player.card1 !== player.origCard1 || player.card2 !== player.origCard2;
      if (isDirty && !savedHolecards.has(player.name)) {
        mutations.push({
          label: `${player.name} cards`,
          promise: updateHolecards(gameId, handId, player.name, {
            card_1: player.card1,
            card_2: player.card2,
          }),
          type: 'holecards',
          playerName: player.name,
        });
      }
    }

    // Update community cards if dirty and not already saved
    const communityChanged =
      editCommunity.flop1 !== origCommunity.flop1 ||
      editCommunity.flop2 !== origCommunity.flop2 ||
      editCommunity.flop3 !== origCommunity.flop3 ||
      editCommunity.turn !== origCommunity.turn ||
      editCommunity.river !== origCommunity.river;

    if (communityChanged && !communitySaved) {
      mutations.push({
        label: 'community cards',
        promise: updateCommunityCards(gameId, handId, {
          flop_1: editCommunity.flop1 || '',
          flop_2: editCommunity.flop2 || '',
          flop_3: editCommunity.flop3 || '',
          turn: editCommunity.turn,
          river: editCommunity.river,
        }),
        type: 'community',
      });
    }

    if (mutations.length === 0) {
      setSaving(false);
      onSaved();
      return;
    }

    const results = await Promise.allSettled(mutations.map((mutation) => mutation.promise));

    const failed: string[] = [];
    const newSavedResults = new Set(savedResults);
    const newSavedHolecards = new Set(savedHolecards);
    let newCommunitySaved = communitySaved;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const m = mutations[i];
      if (r.status === 'fulfilled') {
        if (m.type === 'result' && m.playerName) newSavedResults.add(m.playerName);
        if (m.type === 'holecards' && m.playerName) newSavedHolecards.add(m.playerName);
        if (m.type === 'community') newCommunitySaved = true;
      } else {
        failed.push(m.label);
      }
    }

    setSavedResults(newSavedResults);
    setSavedHolecards(newSavedHolecards);
    setCommunitySaved(newCommunitySaved);
    setSaving(false);

    if (failed.length > 0) {
      setError(`Save failed for: ${failed.join(', ')}. Retry will only re-submit failed changes.`);
    } else {
      onSaved();
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Hand Review</h2>
      <p style={styles.subheading}>Hand #{handId}</p>

      {/* Community Cards */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Community Cards</h3>
        <div style={styles.cardRow}>
          {(['flop1', 'flop2', 'flop3', 'turn', 'river'] as CommunityField[]).map((field) => (
            <PlayingCard
              key={field}
              testId={`review-community-${field}`}
              code={editCommunity[field]}
              onClick={() => handleCommunityCardClick(field)}
            />
          ))}
        </div>
      </div>

      {/* Players */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Players</h3>
        {editPlayers.map((player) => (
          <div
            key={player.name}
            data-testid={`review-player-${player.name}`}
            style={styles.playerCard}
          >
            <div style={styles.playerName}>{player.name}</div>

            {/* Hole Cards */}
            <div style={styles.playerRow}>
              <span style={styles.label}>Cards:</span>
              <PlayingCard
                testId={`review-player-${player.name}-card1`}
                code={player.card1}
                onClick={() => handlePlayerCardClick(player.name, 'card1')}
              />
              <PlayingCard
                testId={`review-player-${player.name}-card2`}
                code={player.card2}
                onClick={() => handlePlayerCardClick(player.name, 'card2')}
              />
            </div>

            {/* Result Buttons */}
            <div style={styles.playerRow}>
              <span style={styles.label}>Result:</span>
              <div style={styles.resultGroup}>
                {RESULT_OPTIONS.map((resultOption) => (
                  <button
                    key={resultOption}
                    data-testid={`review-player-${player.name}-result-${resultOption}`}
                    style={{
                      ...styles.resultButton,
                      ...(player.result === resultOption ? styles.resultButtonActive : {}),
                    }}
                    aria-pressed={player.result === resultOption ? 'true' : 'false'}
                    onClick={() => handleResultChange(player.name, resultOption)}
                  >
                    {resultOption.charAt(0).toUpperCase() + resultOption.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Winning Hand Description */}
            {player.card1 && player.card2 && (() => {
              const entry = equityData.find((e) => e.player_name === player.name);
              const desc = entry?.winning_hand_description || handDescriptions[player.name];
              if (!desc) return null;
              const isWinner = player.result === 'won';
              const isFolded = player.result === 'folded';
              return (
                <div
                  data-testid={`review-player-${player.name}-hand-desc`}
                  style={{
                    ...styles.handDescBadge,
                    ...(isFolded ? { opacity: 0.7, fontStyle: 'italic' } : {}),
                  }}
                >
                  {isWinner ? `🏆 ${desc}` : isFolded ? `(Would have: ${desc})` : desc}
                </div>
              );
            })()}

            {/* Outcome Street Dropdown */}
            <div style={styles.playerRow}>
              <span style={styles.label}>Street:</span>
              <select
                data-testid={`review-player-${player.name}-street`}
                style={styles.streetSelect}
                value={player.outcomeStreet || ''}
                onChange={(e) => handleStreetChange(player.name, e.target.value)}
              >
                <option value="">—</option>
                {STREET_OPTIONS.map((street) => (
                  <option key={street} value={street}>
                    {street.charAt(0).toUpperCase() + street.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div data-testid="review-error" style={styles.error}>
          {error}
        </div>
      )}

      <button
        data-testid="review-confirm-btn"
        style={styles.confirmButton}
        onClick={handleFinishClick}
        disabled={!allTerminal || saving}
      >
        {saving ? 'Saving…' : 'Finish Hand'}
      </button>
      <button
        data-testid="review-cancel-btn"
        style={styles.cancelButton}
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </button>

      {cardEditTarget && (
        <CardPicker onSelect={handleCardSelect} onClose={handleCardPickerClose} />
      )}

      {showFinishConfirm && (
        <div data-testid="finish-confirm-dialog" style={styles.dialogOverlay}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogHeading}>Finish Hand?</h3>
            <ul style={styles.dialogList}>
              {editPlayers.map((player) => (
                <li key={player.name}>{player.name}: {player.result}</li>
              ))}
            </ul>
            <div style={styles.dialogButtons}>
              <button data-testid="finish-confirm-cancel" style={styles.cancelButton} onClick={handleCancelFinish}>Cancel</button>
              <button data-testid="finish-confirm-ok" style={styles.confirmButton} onClick={handleConfirmFinish}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1.5rem 1rem',
    width: '100%',
  },
  heading: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: '#e2e8f0',
    marginBottom: '0.25rem',
  },
  subheading: {
    color: '#94a3b8',
    marginBottom: '1rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#cbd5e1',
    marginBottom: '0.5rem',
  },
  cardRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  playerCard: {
    padding: '0.75rem',
    background: '#1e1f2b',
    borderRadius: '8px',
    border: '1px solid #2e303a',
    marginBottom: '0.75rem',
  },
  playerName: {
    fontWeight: 600,
    color: '#e2e8f0',
    marginBottom: '0.5rem',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.4rem',
  },
  label: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    minWidth: '50px',
  },
  resultGroup: {
    display: 'flex',
    gap: '0.35rem',
  },
  resultButton: {
    padding: '0.3rem 0.6rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    border: '1px solid #4b5563',
    borderRadius: '6px',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
  },
  resultButtonActive: {
    background: '#4f46e5',
    color: '#fff',
    borderColor: '#4f46e5',
  },
  handDescBadge: {
    padding: '0.2rem 0.5rem',
    fontSize: '0.8rem',
    color: '#a5b4fc',
    background: 'rgba(79, 70, 229, 0.1)',
    borderRadius: '4px',
    marginBottom: '0.4rem',
  },
  streetSelect: {
    padding: '0.3rem 0.5rem',
    fontSize: '0.85rem',
    borderRadius: '6px',
    border: '1px solid #4b5563',
    background: '#1e1f2b',
    color: '#e2e8f0',
  },
  error: {
    marginBottom: '1rem',
    padding: '0.75rem',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '0.9rem',
  },
  confirmButton: {
    width: '100%',
    padding: '0.75rem',
    minHeight: '48px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    marginBottom: '0.5rem',
  },
  cancelButton: {
    width: '100%',
    padding: '0.75rem',
    minHeight: '48px',
    fontSize: '1rem',
    fontWeight: 600,
    border: '1px solid #2e303a',
    borderRadius: '8px',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
  },
  dialogOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  dialog: {
    background: '#1e1f2b',
    borderRadius: '12px',
    padding: '1.5rem',
    maxWidth: '360px',
    width: '90%',
    border: '1px solid #2e303a',
  },
  dialogHeading: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#e2e8f0',
    marginBottom: '0.75rem',
  },
  dialogList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 1rem 0',
    color: '#cbd5e1',
    fontSize: '0.95rem',
  },
  dialogButtons: {
    display: 'flex',
    gap: '0.5rem',
  },
};

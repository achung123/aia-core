import { useState, useEffect, useLayoutEffect } from 'react';
import { useDealerStore, validateOutcomeStreets } from '../stores/dealerStore.ts';
import type { CardDetectionEntry, ResultEnum, StreetEnum } from '../api/types';
import type { OutcomeResult, OutcomeStreet } from './OutcomeButtons.tsx';
import type { DetectionMode } from './DetectionReview.tsx';
import { GameSelector } from './GameSelector.tsx';
import { GameCreateForm } from './GameCreateForm.tsx';
import { HandDashboard } from './HandDashboard.tsx';
import { ActiveHandDashboard } from './ActiveHandDashboard.tsx';
import { CameraCapture } from './CameraCapture.tsx';
import { DetectionReview } from './DetectionReview.tsx';
import { OutcomeButtons } from './OutcomeButtons.tsx';
import { ReviewScreen } from './ReviewScreen.tsx';
import { addPlayerToHand, updateHolecards, updateFlop, updateTurn, updateRiver, patchPlayerResult, fetchGame, fetchHand, fetchHandStatus } from '../api/client.ts';
import { inferOutcomeStreet } from './showdownHelpers.ts';
import { usePolling } from '../hooks/usePolling.ts';

interface ReviewData {
  targetName: string;
  detections: CardDetectionEntry[];
  imageUrl: string;
  mode: DetectionMode;
}

export function DealerApp() {
  // Zustand store — replaces useReducer + manual sessionStorage
  const {
    gameId, currentHandId, players, community, currentStep,
    sbPlayerName, bbPlayerName,
    setGame, setPlayerCards, setFlopCards, setTurnCard, setRiverCard,
    setHandId, setPlayerResult, finishHand, setStep,
    loadHand, updateParticipation,
  } = useDealerStore();

  // Local UI state (not persisted)
  const [captureTarget, setCaptureTarget] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [outcomeTarget, setOutcomeTarget] = useState<string | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishError] = useState<string | null>(null);
  const [finishing] = useState(false);

  // Betting state from hand status polling
  const [currentPlayerName, setCurrentPlayerName] = useState<string | null>(null);
  const [legalActions, setLegalActions] = useState<string[]>([]);
  const [amountToCall, setAmountToCall] = useState(0);
  const [minimumBet, setMinimumBet] = useState<number | null>(null);
  const [minimumRaise, setMinimumRaise] = useState<number | null>(null);
  const [pot, setPot] = useState(0);
  const [streetComplete, setStreetComplete] = useState(true);
  const [handPhase, setHandPhase] = useState<string>('preflop');
  const [potContributions, setPotContributions] = useState<Record<string, number>>({});

  // Guard: reset to gameSelector if persisted state is inconsistent
  useLayoutEffect(() => {
    const needsGame = currentStep === 'dashboard' || currentStep === 'activeHand' || currentStep === 'review';
    if (needsGame && !gameId) {
      setStep('gameSelector');
    }
  }, [currentStep, gameId, setStep]);

  // Emit legacy custom event for non-Zustand subscribers (e.g., LandingPage)
  useEffect(() => {
    return useDealerStore.subscribe(() => {
      window.dispatchEvent(new CustomEvent('dealer-state-change'));
    });
  }, []);

  // Polling for participation mode
  const { isReconnecting: dealerReconnecting, triggerNow: triggerDealerPoll } = usePolling({
    intervalMs: 3000,
    enabled: currentStep === 'activeHand' && !!gameId && !!currentHandId,
    fetchFn: (signal) =>
      fetchHandStatus(gameId!, currentHandId!, { signal })
        .then((data) => {
          if (signal.aborted) return;
          updateParticipation(data);

          // Update betting state for ActiveHandDashboard
          setCurrentPlayerName(data.current_player_name ?? null);
          setLegalActions(data.legal_actions ?? []);
          setAmountToCall(data.amount_to_call ?? 0);
          setMinimumBet(data.minimum_bet ?? null);
          setMinimumRaise(data.minimum_raise ?? null);
          setPot(data.pot ?? 0);
          setStreetComplete(data.street_complete ?? false);
          setHandPhase(data.phase ?? 'preflop');

          // Extract per-player pot contributions
          const contribs: Record<string, number> = {};
          for (const player of data.players || []) {
            if (player.pot_contribution > 0) {
              contribs[player.name] = player.pot_contribution;
            }
          }
          setPotContributions(contribs);

          const joinedPlayers = (data.players || []).filter(
            (player) => player.participation_status === 'joined' || player.participation_status === 'handed_back',
          );
          const needsCards = joinedPlayers.some((joinedPlayer) => {
            const localPlayer = players.find((existingPlayer) => existingPlayer.name === joinedPlayer.name);
            return localPlayer && !localPlayer.card1 && !localPlayer.card2;
          });

          if (needsCards) {
            fetchHand(gameId!, currentHandId!)
              .then((handData) => {
                if (signal.aborted) return;
                (handData.player_hands || []).forEach((playerHand) => {
                  const localPlayer = players.find((existingPlayer) => existingPlayer.name === playerHand.player_name);
                  if (localPlayer && !localPlayer.card1 && !localPlayer.card2 && playerHand.card_1 && playerHand.card_2) {
                    setPlayerCards({ name: playerHand.player_name, card1: playerHand.card_1, card2: playerHand.card_2 });
                  }
                });
              })
              .catch(() => { /* ignore card fetch errors */ });
          }
        }),
  });

  function handleNewGame() {
    setStep('create');
  }

  async function handleSelectGame(selectedGameId: number) {
    try {
      const game = await fetchGame(selectedGameId);
      setGame({ gameId: selectedGameId, players: game.player_names, gameDate: game.game_date });
    } catch {
      setGame({ gameId: selectedGameId, players: [], gameDate: '' });
    }
  }

  function handleGameCreated(createdGameId: number, createdPlayers: string[], createdGameDate: string) {
    setGame({ gameId: createdGameId, players: createdPlayers, gameDate: createdGameDate });
  }

  async function handleSelectHand(handNumber: number) {
    try {
      const handData = await fetchHand(gameId!, handNumber);
      loadHand(handData);
    } catch {
      setHandId(handNumber);
      setStep('activeHand');
    }
  }

  function handleStreetCapture(street: string) {
    setPatchError(null);
    setCaptureTarget(street);
  }

  async function handleTileSelect(name: string) {
    setPatchError(null);

    // Board card clicks: open manual card correction for recorded streets
    if (name === 'flop' || name === 'turn' || name === 'river') {
      const mode = name as DetectionMode;
      let fakeDetections: CardDetectionEntry[];
      if (name === 'flop') {
        fakeDetections = [
          { card_position: '0', detected_value: community.flop1 || '', confidence: 1, alternatives: [] },
          { card_position: '1', detected_value: community.flop2 || '', confidence: 1, alternatives: [] },
          { card_position: '2', detected_value: community.flop3 || '', confidence: 1, alternatives: [] },
        ];
      } else if (name === 'turn') {
        fakeDetections = [
          { card_position: '0', detected_value: community.turn || '', confidence: 1, alternatives: [] },
        ];
      } else {
        fakeDetections = [
          { card_position: '0', detected_value: community.river || '', confidence: 1, alternatives: [] },
        ];
      }
      setReviewData({ targetName: name, detections: fakeDetections, imageUrl: null, mode });
      return;
    }

    // Participation mode: tile click activates players or opens outcome
    const player = players.find((existingPlayer) => existingPlayer.name === name);
    if (!player) return;

    if (player.status === 'playing' || player.status === 'idle') {
      try {
        await addPlayerToHand(gameId!, currentHandId!, {
          player_name: name,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to activate player';
        setPatchError(message);
      }
      return;
    }

    if (player.status === 'handed_back') {
      handleDirectOutcome(name);
      return;
    }

    return;
  }

  function handleDirectOutcome(name: string) {
    setPatchError(null);
    setOutcomeError(null);
    setOutcomeTarget(name);
  }

  function handleMarkNotPlaying(name: string) {
    setPlayerResult({ name, status: 'not_playing', outcomeStreet: null });
  }

  function handleDetectionResult(targetName: string, detections: CardDetectionEntry[], file: File | Blob) {
    setCaptureTarget(null);
    const imageUrl = URL.createObjectURL(file);
    const streetTargets: DetectionMode[] = ['flop', 'turn', 'river'];
    const mode: DetectionMode = streetTargets.includes(targetName as DetectionMode) ? (targetName as DetectionMode) : 'player';
    setReviewData({
      targetName,
      detections,
      imageUrl,
      mode,
    });
  }

  function handleCaptureCancel() {
    setCaptureTarget(null);
  }

  async function handleReviewConfirm(targetName: string, cardValues: string[]) {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);

    if (reviewData?.mode === 'flop') {
      setReviewData(null);
      try {
        await updateFlop(gameId!, currentHandId!, {
          flop_1: cardValues[0] || '',
          flop_2: cardValues[1] || '',
          flop_3: cardValues[2] || '',
        });
        setFlopCards({
          flop1: cardValues[0] || '',
          flop2: cardValues[1] || '',
          flop3: cardValues[2] || '',
        });
        setPatchError(null);
      } catch (err: unknown) {
        setPatchError(err instanceof Error ? err.message : 'Failed to save flop cards');
      }
    } else if (reviewData?.mode === 'turn') {
      setReviewData(null);
      try {
        await updateTurn(gameId!, currentHandId!, {
          turn: cardValues[0] || '',
        });
        setTurnCard(cardValues[0] || '');
        setPatchError(null);
      } catch (err: unknown) {
        setPatchError(err instanceof Error ? err.message : 'Failed to save turn card');
      }
    } else if (reviewData?.mode === 'river') {
      setReviewData(null);
      try {
        await updateRiver(gameId!, currentHandId!, {
          river: cardValues[0] || '',
        });
        setRiverCard(cardValues[0] || '');
        setPatchError(null);
      } catch (err: unknown) {
        setPatchError(err instanceof Error ? err.message : 'Failed to save river card');
      }
    } else {
      const card1 = cardValues[0] || null;
      const card2 = cardValues[1] || null;
      const player = players.find((existing) => existing.name === targetName);
      const isRetake = player?.recorded;

      setReviewData(null);

      try {
        if (isRetake) {
          await updateHolecards(gameId!, currentHandId!, targetName, {
            card_1: card1,
            card_2: card2,
          });
        } else {
          await addPlayerToHand(gameId!, currentHandId!, {
            player_name: targetName,
            card_1: card1,
            card_2: card2,
          });
        }
        setPlayerCards({ name: targetName, card1: card1 || '', card2: card2 || '' });
        setPatchError(null);
        // Transition to outcome overlay
        setOutcomeTarget(targetName);
        setOutcomeError(null);
      } catch (err: unknown) {
        setPatchError(err instanceof Error ? err.message : 'Failed to save cards');
      }
    }
  }

  function handleReviewRetake() {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
    const target = reviewData?.targetName ?? null;
    setReviewData(null);
    // Only go back to camera if there was an actual camera capture (imageUrl present)
    if (reviewData?.imageUrl) {
      setCaptureTarget(target);
    }
  }

  async function handleOutcomeSelect(result: OutcomeResult, outcomeStreet: OutcomeStreet | null) {
    setOutcomeError(null);
    setOutcomeSubmitting(true);

    // "not_playing" is UI-only — skip the API call
    if (result === 'not_playing') {
      setPlayerResult({ name: outcomeTarget!, status: 'not_playing', outcomeStreet: null });
      setOutcomeTarget(null);
      setOutcomeSubmitting(false);
      return;
    }

    try {
      await patchPlayerResult(gameId!, currentHandId!, outcomeTarget!, { result: result as ResultEnum, outcome_street: (outcomeStreet || null) as StreetEnum | null });
      setPlayerResult({ name: outcomeTarget!, status: result, outcomeStreet: outcomeStreet || null });
      setOutcomeTarget(null);
    } catch (err: unknown) {
      setOutcomeError(err instanceof Error ? err.message : 'Failed to save result');
    } finally {
      setOutcomeSubmitting(false);
    }
  }

  function handleOutcomeCancel() {
    setOutcomeTarget(null);
    setOutcomeError(null);
  }

  function handleFinishHand() {
    // Validate outcome streets are consistent
    const validationError = validateOutcomeStreets(players);
    if (validationError) {
      setPatchError(validationError);
      return;
    }

    const uncaptured = players.filter((player) => player.status === 'playing');
    if (uncaptured.length === 0) {
      doFinishHand();
    } else {
      setShowFinishConfirm(true);
    }
  }

  function doFinishHand() {
    setShowFinishConfirm(false);

    // Auto-set lone remaining player as winner when all others folded
    const nonFolded = players.filter(
      (player) => player.status !== 'folded' && player.status !== 'not_playing',
    );
    if (nonFolded.length === 1) {
      const street = inferOutcomeStreet(community);
      setPlayerResult({ name: nonFolded[0].name, status: 'won', outcomeStreet: street });
    }

    setStep('review');
  }

  const activePlayers = players.filter((player) => player.status !== 'folded' && player.status !== 'not_playing');
  const canFinish =
    (activePlayers.length <= 1 && players.some((player) => player.status === 'folded')) ||
    (activePlayers.length > 1 && community.riverRecorded && (streetComplete || handPhase === 'showdown'));

  const isActiveHandOverlay = !!(captureTarget || reviewData || outcomeTarget);

  return (
    <div id="dealer-root" style={shellStyle}>
      {/* ── Step 1: Game Selection ── */}
      {currentStep === 'gameSelector' && (
        <GameSelector onSelectGame={handleSelectGame} onNewGame={handleNewGame} />
      )}

      {currentStep === 'create' && (
        <GameCreateForm onGameCreated={handleGameCreated} />
      )}

      {/* ── Step 2: Game Dashboard ── */}
      {currentStep === 'dashboard' && gameId && (
        <HandDashboard
          gameId={gameId}
          players={players.map((player) => player.name)}
          onSelectHand={handleSelectHand}
          onBack={() => setStep('gameSelector')}
        />
      )}

      {/* ── Step 3: Active Hand ── */}
      {currentStep === 'activeHand' && gameId && (
        <>
          {dealerReconnecting && (
            <div data-testid="dealer-reconnecting" style={{ color: '#ca8a04', fontSize: '0.8rem', textAlign: 'center', padding: '0.25rem' }}>
              Reconnecting…
            </div>
          )}
          {/* Base layer: active hand dashboard (hidden when overlay active) */}
          {!isActiveHandOverlay && (
            <ActiveHandDashboard
              gameId={gameId}
              handNumber={currentHandId ?? undefined}
              community={community}
              players={players}
              sbPlayerName={sbPlayerName}
              bbPlayerName={bbPlayerName}
              onTileSelect={handleTileSelect}
              onStreetCapture={handleStreetCapture}
              onDirectOutcome={handleDirectOutcome}
              onMarkNotPlaying={handleMarkNotPlaying}
              canFinish={canFinish}
              onFinishHand={handleFinishHand}
              onBack={() => setStep('dashboard')}
              patchError={patchError}
              currentPlayerName={currentPlayerName}
              legalActions={legalActions}
              amountToCall={amountToCall}
              minimumBet={minimumBet}
              minimumRaise={minimumRaise}
              pot={pot}
              streetComplete={streetComplete}
              handPhase={handPhase}
              potContributions={potContributions}
            />
          )}

          {/* Overlay: Camera capture */}
          {captureTarget && (
            <CameraCapture
              gameId={gameId}
              targetName={captureTarget}
              onDetectionResult={handleDetectionResult}
              onCancel={handleCaptureCancel}
            />
          )}

          {/* Overlay: Detection review */}
          {reviewData && (
            <DetectionReview
              detections={reviewData.detections}
              imageUrl={reviewData.imageUrl}
              mode={reviewData.mode as DetectionMode}
              targetName={reviewData.targetName}
              onConfirm={handleReviewConfirm}
              onRetake={handleReviewRetake}
            />
          )}

          {/* Overlay: Outcome selection */}
          {outcomeTarget && !reviewData && (
            <OutcomeButtons
              key={`${outcomeTarget}-${outcomeError ?? ''}`}
              playerName={outcomeTarget}
              onSelect={handleOutcomeSelect}
              onCancel={handleOutcomeCancel}
              error={outcomeError}
              submitting={outcomeSubmitting}
            />
          )}
        </>
      )}

      {/* ── Step 4: Hand Review ── */}
      {currentStep === 'review' && gameId && currentHandId && (
        <ReviewScreen
          gameId={gameId}
          handId={currentHandId}
          players={players}
          community={community}
          onSaved={() => finishHand()}
          onCancel={() => setStep('activeHand')}
        />
      )}

      {/* Finish Hand confirmation dialog */}
      {showFinishConfirm && (
        <div data-testid="finish-confirm-dialog" style={dialogOverlayStyle}>
          <div style={dialogStyle}>
            <p>The following players will not be recorded for this hand:</p>
            <ul>
              {players.filter((player) => player.status === 'playing').map((player) => (
                <li key={player.name}>{player.name}</li>
              ))}
            </ul>
            {finishError && <div style={{ color: '#991b1b', marginBottom: '0.5rem' }}>{finishError}</div>}
            <div style={dialogButtonRow}>
              <button onClick={() => setShowFinishConfirm(false)} disabled={finishing}>Cancel</button>
              <button
                onClick={() => doFinishHand()}
                disabled={finishing}
              >
                {finishing ? 'Finishing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation — mobile-first, one-thumb accessible */}
      <nav data-testid="bottom-nav" style={bottomNavStyle}>
        {(['gameSelector', 'dashboard', 'activeHand', 'review'] as const).map((step) => {
          const labels: Record<string, string> = { gameSelector: 'Games', dashboard: 'Dashboard', activeHand: 'Hand', review: 'Review' };
          const isActive = currentStep === step || (step === 'gameSelector' && currentStep === 'create');
          return (
            <button
              key={step}
              data-testid={`nav-${step}`}
              style={{ ...navItemStyle, ...(isActive ? navItemActiveStyle : {}) }}
              disabled={
                (step === 'dashboard' && !gameId) ||
                (step === 'activeHand' && !currentHandId) ||
                (step === 'review' && currentStep !== 'review')
              }
              onClick={() => {
                if (step === 'gameSelector') setStep('gameSelector');
                else if (step === 'dashboard' && gameId) setStep('dashboard');
                else if (step === 'activeHand' && currentHandId) setStep('activeHand');
              }}
            >
              {labels[step]}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  minHeight: '100dvh',
  paddingBottom: '72px',
  display: 'flex',
  flexDirection: 'column',
};

const bottomNavStyle: React.CSSProperties = {
  position: 'fixed',
  top: 'auto',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'space-around',
  background: '#0f1117',
  borderTop: '1px solid #2e303a',
  borderBottom: 'none',
  padding: '0.5rem 0',
  zIndex: 100,
};

const navItemStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem 0',
  minHeight: '44px',
  fontSize: '0.85rem',
  fontWeight: 600,
  border: 'none',
  background: 'transparent',
  color: '#64748b',
  cursor: 'pointer',
  textAlign: 'center',
};

const navItemActiveStyle: React.CSSProperties = {
  color: '#818cf8',
  borderTop: '2px solid #818cf8',
};

const dialogOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 300,
};

const dialogStyle: React.CSSProperties = {
  background: '#1e1f2b',
  borderRadius: '12px',
  padding: '1.5rem',
  maxWidth: '400px',
  width: '90%',
  color: '#e2e8f0',
  border: '1px solid #2e303a',
};

const dialogButtonRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '1rem',
  gap: '0.5rem',
};

import { useState, useEffect } from 'react';
import { useDealerStore, validateOutcomeStreets } from '../stores/dealerStore.ts';
import type { GameMode } from '../stores/dealerStore.ts';
import type { CardDetectionEntry, ResultEnum, StreetEnum } from '../api/types.ts';
import type { OutcomeResult, OutcomeStreet } from './OutcomeButtons.tsx';
import type { DetectionMode } from './DetectionReview.tsx';
import { GameSelector } from './GameSelector.tsx';
import { GameCreateForm } from './GameCreateForm.tsx';
import { HandDashboard } from './HandDashboard.tsx';
import { PlayerGrid } from './PlayerGrid.tsx';
import { CameraCapture } from './CameraCapture.tsx';
import { DetectionReview } from './DetectionReview.tsx';
import { OutcomeButtons } from './OutcomeButtons.tsx';
import { DealerPreview } from './DealerPreview.tsx';
import { QRCodeDisplay } from './QRCodeDisplay.tsx';
import { addPlayerToHand, updateHolecards, updateFlop, updateTurn, updateRiver, patchPlayerResult, fetchGame, fetchHand, fetchHandStatus } from '../api/client.ts';

interface ReviewData {
  targetName: string;
  detections: CardDetectionEntry[];
  imageUrl: string;
  mode: DetectionMode;
}

export function DealerApp() {
  // Zustand store — replaces useReducer + manual sessionStorage
  const {
    gameId, currentHandId, players, community, currentStep, gameMode,
    setGame, setPlayerCards, setFlopCards, setTurnCard, setRiverCard,
    setHandId, setPlayerResult, finishHand, setStep, setGameMode,
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
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  // Emit legacy custom event for non-Zustand subscribers (e.g., LandingPage)
  useEffect(() => {
    return useDealerStore.subscribe(() => {
      window.dispatchEvent(new CustomEvent('dealer-state-change'));
    });
  }, []);

  // Polling for participation mode
  useEffect(() => {
    if (currentStep !== 'playerGrid' || !gameId || !currentHandId || gameMode !== 'participation') return;

    const controller = new AbortController();
    const { signal } = controller;

    function poll() {
      fetchHandStatus(gameId!, currentHandId!, { signal })
        .then((data) => {
          if (signal.aborted) return;
          updateParticipation(data);

          const joinedPlayers = (data.players || []).filter(
            (p) => p.participation_status === 'joined' || p.participation_status === 'handed_back',
          );
          const needsCards = joinedPlayers.some((jp) => {
            const local = players.find((lp) => lp.name === jp.name);
            return local && !local.card1 && !local.card2;
          });

          if (needsCards) {
            fetchHand(gameId!, currentHandId!)
              .then((handData) => {
                if (signal.aborted) return;
                (handData.player_hands || []).forEach((ph) => {
                  const local = players.find((lp) => lp.name === ph.player_name);
                  if (local && !local.card1 && !local.card2 && ph.card_1 && ph.card_2) {
                    setPlayerCards({ name: ph.player_name, card1: ph.card_1, card2: ph.card_2 });
                  }
                });
              })
              .catch(() => { /* ignore card fetch errors */ });
          }
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          /* ignore polling errors */
        });
    }

    poll();
    const intervalId = setInterval(poll, 3000);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [currentStep, gameId, currentHandId, gameMode]);

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

  function handleGameCreated(createdGameId: number, createdPlayers: string[], createdGameDate: string, createdGameMode: GameMode) {
    setGame({ gameId: createdGameId, players: createdPlayers, gameDate: createdGameDate, gameMode: createdGameMode });
  }

  async function handleSelectHand(handNumber: number) {
    try {
      const handData = await fetchHand(gameId!, handNumber);
      loadHand(handData);
    } catch {
      setHandId(handNumber);
      setStep('playerGrid');
    }
  }

  async function handleTileSelect(name: string) {
    setPatchError(null);

    // Street tiles: dealer captures per-street community cards
    if (name === 'flop' || name === 'turn' || name === 'river') {
      setCaptureTarget(name);
      return;
    }

    // Participation mode: tile click activates players or opens outcome
    if (gameMode === 'participation') {
      const player = players.find((p) => p.name === name);
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

    // Dealer-centric: open camera
    setCaptureTarget(name);
  }

  function handleDirectOutcome(name: string) {
    setPatchError(null);
    setOutcomeError(null);
    setOutcomeTarget(name);
    setStep('outcome');
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
    setStep('review');
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
        setStep('playerGrid');
      } catch (err: unknown) {
        setStep('playerGrid');
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
        setStep('playerGrid');
      } catch (err: unknown) {
        setStep('playerGrid');
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
        setStep('playerGrid');
      } catch (err: unknown) {
        setStep('playerGrid');
        setPatchError(err instanceof Error ? err.message : 'Failed to save river card');
      }
    } else {
      const card1 = cardValues[0] || null;
      const card2 = cardValues[1] || null;
      const player = players.find((p) => p.name === targetName);
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
        // Transition to outcome step
        setOutcomeTarget(targetName);
        setOutcomeError(null);
        setStep('outcome');
      } catch (err: unknown) {
        setStep('playerGrid');
        setPatchError(err instanceof Error ? err.message : 'Failed to save cards');
      }
    }
  }

  function handleReviewRetake() {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
    const target = reviewData?.targetName ?? null;
    setReviewData(null);
    setStep('playerGrid');
    setCaptureTarget(target);
  }

  async function handleOutcomeSelect(result: OutcomeResult, outcomeStreet: OutcomeStreet | null) {
    setOutcomeError(null);
    setOutcomeSubmitting(true);

    // "not_playing" is UI-only — skip the API call
    if (result === 'not_playing') {
      setPlayerResult({ name: outcomeTarget!, status: 'not_playing', outcomeStreet: null });
      setOutcomeTarget(null);
      setStep('playerGrid');
      setOutcomeSubmitting(false);
      return;
    }

    try {
      await patchPlayerResult(gameId!, currentHandId!, outcomeTarget!, { result: result as ResultEnum, outcome_street: (outcomeStreet || null) as StreetEnum | null });
      setPlayerResult({ name: outcomeTarget!, status: result, outcomeStreet: outcomeStreet || null });
      setOutcomeTarget(null);
      setStep('playerGrid');
    } catch (err: unknown) {
      setOutcomeError(err instanceof Error ? err.message : 'Failed to save result');
    } finally {
      setOutcomeSubmitting(false);
    }
  }

  function handleOutcomeCancel() {
    setOutcomeTarget(null);
    setOutcomeError(null);
    setStep('playerGrid');
  }

  function handleFinishHand() {
    // Validate outcome streets are consistent
    const validationError = validateOutcomeStreets(players);
    if (validationError) {
      setPatchError(validationError);
      return;
    }

    const uncaptured = players.filter((p) => p.status === 'playing');
    if (uncaptured.length === 0) {
      doFinishHand();
    } else {
      setShowFinishConfirm(true);
    }
  }

  function doFinishHand() {
    setFinishing(true);
    setFinishError(null);
    try {
      finishHand();
      setShowFinishConfirm(false);
    } catch (err: unknown) {
      setFinishError(err instanceof Error ? err.message : 'Failed to finish hand');
    } finally {
      setFinishing(false);
    }
  }

  const canFinish =
    players.length > 0 &&
    players.some((p) => p.status !== 'playing');

  return (
    <div id="dealer-root">
      <h1>Dealer Interface</h1>

      {currentStep === 'gameSelector' && (
        <GameSelector onSelectGame={handleSelectGame} onNewGame={handleNewGame} />
      )}

      {currentStep === 'create' && (
        <GameCreateForm onGameCreated={handleGameCreated} />
      )}

      {currentStep === 'qrCodes' && gameId && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
          <h2 style={{ color: '#e2e8f0' }}>Share with Players</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Each player scans their QR code to join:</p>
          {players.map((p) => (
            <div key={p.name} style={{ marginBottom: '1.5rem', textAlign: 'center', border: '1px solid #2e303a', borderRadius: '12px', padding: '0.75rem', background: '#1e1f2b' }}>
              <h3 style={{ margin: '0 0 0.25rem', color: '#c084fc' }}>{p.name}</h3>
              <QRCodeDisplay gameId={gameId} playerName={p.name} visible={true} />
            </div>
          ))}
          <button
            data-testid="qr-continue-btn"
            style={{ width: '100%', padding: '0.75rem', minHeight: '48px', fontSize: '1.1rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', background: '#4f46e5', color: '#fff', cursor: 'pointer', marginTop: '1rem' }}
            onClick={() => setStep('dashboard')}
          >
            Continue
          </button>
        </div>
      )}

      {currentStep === 'dashboard' && gameId && (
        <HandDashboard
          gameId={gameId}
          players={players.map((p) => p.name)}
          gameMode={gameMode}
          onSelectHand={handleSelectHand}
          onBack={() => setStep('gameSelector')}
          onModeChange={(mode: GameMode) => setGameMode(mode)}
        />
      )}

      {currentStep === 'playerGrid' && gameId && (
        <>
          <DealerPreview community={community} players={players} gameId={gameId} handNumber={currentHandId ?? undefined} />
          <PlayerGrid
            players={players}
            community={community}
            onTileSelect={handleTileSelect}
            onDirectOutcome={handleDirectOutcome}
            onMarkNotPlaying={handleMarkNotPlaying}
            gameMode={gameMode}
            canFinish={canFinish}
            onFinishHand={handleFinishHand}
            onBack={() => setStep('dashboard')}
          />
          {patchError && (
            <div style={toastStyle}>{patchError}</div>
          )}
        </>
      )}

      {captureTarget && gameId && (
        <CameraCapture
          gameId={gameId}
          targetName={captureTarget}
          onDetectionResult={handleDetectionResult}
          onCancel={handleCaptureCancel}
        />
      )}

      {currentStep === 'review' && reviewData && (
        <DetectionReview
          detections={reviewData.detections}
          imageUrl={reviewData.imageUrl}
          mode={reviewData.mode as DetectionMode}
          targetName={reviewData.targetName}
          onConfirm={handleReviewConfirm}
          onRetake={handleReviewRetake}
        />
      )}

      {currentStep === 'outcome' && outcomeTarget && (
        <OutcomeButtons
          key={`${outcomeTarget}-${outcomeError ?? ''}`}
          playerName={outcomeTarget}
          onSelect={handleOutcomeSelect}
          onCancel={handleOutcomeCancel}
          error={outcomeError}
          submitting={outcomeSubmitting}
        />
      )}

      {showFinishConfirm && (
        <div data-testid="finish-confirm-dialog" style={dialogOverlayStyle}>
          <div style={dialogStyle}>
            <p>The following players will not be recorded for this hand:</p>
            <ul>
              {players.filter((p) => p.status === 'playing').map((p) => (
                <li key={p.name}>{p.name}</li>
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
    </div>
  );
}

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

const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '1rem',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#991b1b',
  color: '#fff',
  padding: '0.75rem 1.5rem',
  borderRadius: '8px',
  fontSize: '0.95rem',
  zIndex: 200,
  maxWidth: '90%',
  textAlign: 'center',
};

import { useReducer, useState, useEffect } from 'preact/hooks';
import { reducer, initialState, validateOutcomeStreets } from './dealerState.ts';
import { GameSelector } from './GameSelector.tsx';
import { GameCreateForm } from './GameCreateForm.tsx';
import { HandDashboard } from './HandDashboard.tsx';
import { PlayerGrid } from './PlayerGrid.tsx';
import { CameraCapture } from './CameraCapture.tsx';
import { DetectionReview } from './DetectionReview.tsx';
import { OutcomeButtons } from './OutcomeButtons.tsx';
import { DealerPreview } from './DealerPreview.tsx';
import { QRCodeDisplay } from './QRCodeDisplay.tsx';
import { addPlayerToHand, updateHolecards, updateFlop, updateTurn, updateRiver, patchPlayerResult, fetchGame, fetchHand, fetchHandStatus } from '../api/client.js';

const DEALER_STATE_KEY = 'aia_dealer_state';

function saveState(state) {
  try {
    const toSave = {
      gameId: state.gameId,
      currentHandId: state.currentHandId,
      players: state.players,
      community: state.community,
      currentStep: state.currentStep,
      handCount: state.handCount,
      gameDate: state.gameDate,
      gameMode: state.gameMode,
    };
    sessionStorage.setItem(DEALER_STATE_KEY, JSON.stringify(toSave));
  } catch { /* ignore quota errors */ }
}

function loadSavedState() {
  try {
    const raw = sessionStorage.getItem(DEALER_STATE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved && saved.gameId && saved.currentStep) return saved;
  } catch { /* ignore parse errors */ }
  return null;
}

export function DealerApp() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [captureTarget, setCaptureTarget] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [patchError, setPatchError] = useState(null);
  const [outcomeTarget, setOutcomeTarget] = useState(null);
  const [outcomeError, setOutcomeError] = useState(null);
  const [outcomeSubmitting, setOutcomeSubmitting] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishError, setFinishError] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [persistedPlayers, setPersistedPlayers] = useState(new Set());

  // Restore state from sessionStorage on mount (only if starting fresh)
  useEffect(() => {
    if (state.currentStep !== 'gameSelector') return;
    const saved = loadSavedState();
    if (saved) {
      dispatch({ type: 'RESTORE_STATE', payload: saved });
    }
  }, []);

  // Persist state to sessionStorage on every meaningful change
  useEffect(() => {
    if (state.gameId && state.currentStep !== 'gameSelector') {
      saveState(state);
    } else if (state.currentStep === 'gameSelector') {
      try { sessionStorage.removeItem(DEALER_STATE_KEY); } catch { /* ignore */ }
    }
    window.dispatchEvent(new CustomEvent('dealer-state-change'));
  }, [state]);

  useEffect(() => {
    if (state.currentStep !== 'playerGrid' || !state.gameId || !state.currentHandId || state.gameMode !== 'participation') return;

    const controller = new AbortController();
    const { signal } = controller;

    function poll() {
      fetchHandStatus(state.gameId, state.currentHandId, { signal })
        .then((data) => {
          if (signal.aborted) return;
          dispatch({ type: 'UPDATE_PARTICIPATION', payload: data });

          // If any player has joined/handed_back, fetch hand data to get their cards
          const joinedPlayers = (data.players || []).filter(
            (p) => p.participation_status === 'joined' || p.participation_status === 'handed_back',
          );
          const needsCards = joinedPlayers.some((jp) => {
            const local = state.players.find((lp) => lp.name === jp.name);
            return local && !local.card1 && !local.card2;
          });

          if (needsCards) {
            fetchHand(state.gameId, state.currentHandId)
              .then((handData) => {
                if (signal.aborted) return;
                (handData.player_hands || []).forEach((ph) => {
                  const local = state.players.find((lp) => lp.name === ph.player_name);
                  if (local && !local.card1 && !local.card2 && ph.card_1 && ph.card_2) {
                    dispatch({
                      type: 'SET_PLAYER_CARDS',
                      payload: { name: ph.player_name, card1: ph.card_1, card2: ph.card_2 },
                    });
                  }
                });
              })
              .catch(() => { /* ignore card fetch errors */ });
          }
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          /* ignore polling errors */
        });
    }

    poll();
    const intervalId = setInterval(poll, 3000);

    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [state.currentStep, state.gameId, state.currentHandId, state.gameMode]);

  function handleNewGame() {
    dispatch({ type: 'SET_STEP', payload: 'create' });
  }

  async function handleSelectGame(gameId) {
    try {
      const game = await fetchGame(gameId);
      dispatch({ type: 'SET_GAME', payload: { gameId, players: game.player_names, gameDate: game.game_date } });
    } catch {
      dispatch({ type: 'SET_GAME', payload: { gameId, players: [], gameDate: null } });
    }
  }

  function handleGameCreated(gameId, players, gameDate, gameMode) {
    dispatch({ type: 'SET_GAME', payload: { gameId, players, gameDate, gameMode } });
  }

  async function handleSelectHand(handNumber) {
    try {
      const handData = await fetchHand(state.gameId, handNumber);
      dispatch({ type: 'LOAD_HAND', payload: handData });
    } catch {
      dispatch({ type: 'SET_HAND_ID', payload: handNumber });
      dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
    }
  }

  async function handleTileSelect(name) {
    setPatchError(null);

    // Street tiles: dealer captures per-street community cards
    if (name === 'flop' || name === 'turn' || name === 'river') {
      setCaptureTarget(name);
      return;
    }

    // Participation mode: tile click activates players or opens outcome
    if (state.gameMode === 'participation') {
      const player = state.players.find((p) => p.name === name);
      if (!player) return;

      if (player.status === 'playing' || player.status === 'idle') {
        // Activate: create player_hand with null cards → poll will show "pending"
        try {
          await addPlayerToHand(state.gameId, state.currentHandId, {
            player_name: name,
          });
        } catch (err) {
          setPatchError(err.message || 'Failed to activate player');
        }
        return;
      }

      if (player.status === 'handed_back') {
        // Player has handed back cards — dealer sets outcome
        handleDirectOutcome(name);
        return;
      }

      // pending, joined, won, lost, folded — no action
      return;
    }

    // Dealer-centric: open camera
    setCaptureTarget(name);
  }

  function handleDirectOutcome(name) {
    setPatchError(null);
    setOutcomeError(null);
    setOutcomeTarget(name);
    dispatch({ type: 'SET_STEP', payload: 'outcome' });
  }

  function handleMarkNotPlaying(name) {
    dispatch({ type: 'SET_PLAYER_RESULT', payload: { name, status: 'not_playing', outcomeStreet: null } });
  }

  function handleDetectionResult(targetName, apiResponse, file) {
    setCaptureTarget(null);
    const imageUrl = URL.createObjectURL(file);
    const streetTargets = ['flop', 'turn', 'river'];
    const mode = streetTargets.includes(targetName) ? targetName : 'player';
    setReviewData({
      targetName,
      detections: apiResponse.detections,
      imageUrl,
      mode,
    });
    dispatch({ type: 'SET_STEP', payload: 'review' });
  }

  function handleCaptureCancel() {
    setCaptureTarget(null);
  }

  async function handleReviewConfirm(targetName, cardValues) {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);

    if (reviewData?.mode === 'flop') {
      setReviewData(null);
      try {
        await updateFlop(state.gameId, state.currentHandId, {
          flop_1: cardValues[0] || null,
          flop_2: cardValues[1] || null,
          flop_3: cardValues[2] || null,
        });
        dispatch({
          type: 'SET_FLOP_CARDS',
          payload: {
            flop1: cardValues[0] || null,
            flop2: cardValues[1] || null,
            flop3: cardValues[2] || null,
          },
        });
        setPatchError(null);
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
      } catch (err) {
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
        setPatchError(err.message || 'Failed to save flop cards');
      }
    } else if (reviewData?.mode === 'turn') {
      setReviewData(null);
      try {
        await updateTurn(state.gameId, state.currentHandId, {
          turn: cardValues[0] || null,
        });
        dispatch({
          type: 'SET_TURN_CARD',
          payload: cardValues[0] || null,
        });
        setPatchError(null);
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
      } catch (err) {
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
        setPatchError(err.message || 'Failed to save turn card');
      }
    } else if (reviewData?.mode === 'river') {
      setReviewData(null);
      try {
        await updateRiver(state.gameId, state.currentHandId, {
          river: cardValues[0] || null,
        });
        dispatch({
          type: 'SET_RIVER_CARD',
          payload: cardValues[0] || null,
        });
        setPatchError(null);
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
      } catch (err) {
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
        setPatchError(err.message || 'Failed to save river card');
      }
    } else {
      const card1 = cardValues[0] || null;
      const card2 = cardValues[1] || null;
      const player = state.players.find((p) => p.name === targetName);
      const isRetake = player?.recorded;

      setReviewData(null);

      try {
        if (isRetake) {
          await updateHolecards(state.gameId, state.currentHandId, targetName, {
            card_1: card1,
            card_2: card2,
          });
        } else {
          await addPlayerToHand(state.gameId, state.currentHandId, {
            player_name: targetName,
            card_1: card1,
            card_2: card2,
          });
        }
        dispatch({
          type: 'SET_PLAYER_CARDS',
          payload: { name: targetName, card1, card2 },
        });
        setPatchError(null);
        // Transition to outcome step
        setOutcomeTarget(targetName);
        setOutcomeError(null);
        dispatch({ type: 'SET_STEP', payload: 'outcome' });
      } catch (err) {
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
        setPatchError(err.message || 'Failed to save cards');
      }
    }
  }

  function handleReviewRetake() {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
    const target = reviewData?.targetName;
    setReviewData(null);
    dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
    setCaptureTarget(target);
  }

  async function handleOutcomeSelect(result, outcomeStreet) {
    setOutcomeError(null);
    setOutcomeSubmitting(true);

    // "not_playing" is UI-only — skip the API call
    if (result === 'not_playing') {
      dispatch({ type: 'SET_PLAYER_RESULT', payload: { name: outcomeTarget, status: 'not_playing', outcomeStreet: null } });
      setOutcomeTarget(null);
      dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
      setOutcomeSubmitting(false);
      return;
    }

    try {
      await patchPlayerResult(state.gameId, state.currentHandId, outcomeTarget, { result, outcome_street: outcomeStreet || null });
      dispatch({ type: 'SET_PLAYER_RESULT', payload: { name: outcomeTarget, status: result, outcomeStreet: outcomeStreet || null } });
      setOutcomeTarget(null);
      dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
    } catch (err) {
      setOutcomeError(err.message || 'Failed to save result');
    } finally {
      setOutcomeSubmitting(false);
    }
  }

  function handleOutcomeCancel() {
    setOutcomeTarget(null);
    setOutcomeError(null);
    dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
  }

  function handleFinishHand() {
    // Validate outcome streets are consistent
    const validationError = validateOutcomeStreets(state.players);
    if (validationError) {
      setPatchError(validationError);
      return;
    }

    const uncaptured = state.players.filter((p) => p.status === 'playing');
    if (uncaptured.length === 0) {
      doFinishHand();
    } else {
      setShowFinishConfirm(true);
    }
  }

  async function doFinishHand() {
    setFinishing(true);
    setFinishError(null);
    try {
      dispatch({ type: 'FINISH_HAND' });
      setShowFinishConfirm(false);
      setPersistedPlayers(new Set());
    } catch (err) {
      setFinishError(err.message || 'Failed to finish hand');
    } finally {
      setFinishing(false);
    }
  }

  const canFinish =
    state.players.length > 0 &&
    state.players.some((p) => p.status !== 'playing');

  return (
    <div id="dealer-root">
      <h1>Dealer Interface</h1>

      {state.currentStep === 'gameSelector' && (
        <GameSelector onSelectGame={handleSelectGame} onNewGame={handleNewGame} />
      )}

      {state.currentStep === 'create' && (
        <GameCreateForm onGameCreated={handleGameCreated} />
      )}

      {state.currentStep === 'qrCodes' && state.gameId && (
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
          <h2 style={{ color: '#e2e8f0' }}>Share with Players</h2>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Each player scans their QR code to join:</p>
          {state.players.map((p) => (
            <div key={p.name} style={{ marginBottom: '1.5rem', textAlign: 'center', border: '1px solid #2e303a', borderRadius: '12px', padding: '0.75rem', background: '#1e1f2b' }}>
              <h3 style={{ margin: '0 0 0.25rem', color: '#c084fc' }}>{p.name}</h3>
              <QRCodeDisplay gameId={state.gameId} playerName={p.name} visible={true} />
            </div>
          ))}
          <button
            data-testid="qr-continue-btn"
            style={{ width: '100%', padding: '0.75rem', minHeight: '48px', fontSize: '1.1rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', background: '#4f46e5', color: '#fff', cursor: 'pointer', marginTop: '1rem' }}
            onClick={() => dispatch({ type: 'SET_STEP', payload: 'dashboard' })}
          >
            Continue
          </button>
        </div>
      )}

      {state.currentStep === 'dashboard' && state.gameId && (
        <HandDashboard
          gameId={state.gameId}
          players={state.players.map((p) => p.name)}
          gameMode={state.gameMode}
          onSelectHand={handleSelectHand}
          onBack={() => dispatch({ type: 'SET_STEP', payload: 'gameSelector' })}
          onModeChange={(mode) => dispatch({ type: 'SET_GAME_MODE', payload: mode })}
        />
      )}

      {state.currentStep === 'playerGrid' && state.gameId && (
        <>
          <DealerPreview community={state.community} players={state.players} gameId={state.gameId} handNumber={state.currentHandId} />
          <PlayerGrid
            players={state.players}
            community={state.community}
            onTileSelect={handleTileSelect}
            onDirectOutcome={handleDirectOutcome}
            onMarkNotPlaying={handleMarkNotPlaying}
            gameMode={state.gameMode}
            canFinish={canFinish}
            onFinishHand={handleFinishHand}
            onBack={() => dispatch({ type: 'SET_STEP', payload: 'dashboard' })}
          />
          {patchError && (
            <div style={toastStyle}>{patchError}</div>
          )}
        </>
      )}

      {captureTarget && state.gameId && (
        <CameraCapture
          gameId={state.gameId}
          targetName={captureTarget}
          onDetectionResult={handleDetectionResult}
          onCancel={handleCaptureCancel}
        />
      )}

      {state.currentStep === 'review' && reviewData && (
        <DetectionReview
          detections={reviewData.detections}
          imageUrl={reviewData.imageUrl}
          mode={reviewData.mode}
          targetName={reviewData.targetName}
          onConfirm={handleReviewConfirm}
          onRetake={handleReviewRetake}
        />
      )}

      {state.currentStep === 'outcome' && outcomeTarget && (
        <OutcomeButtons
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
              {state.players.filter((p) => p.status === 'playing').map((p) => (
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

const dialogOverlayStyle = {
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

const dialogStyle = {
  background: '#1e1f2b',
  borderRadius: '12px',
  padding: '1.5rem',
  maxWidth: '400px',
  width: '90%',
  color: '#e2e8f0',
  border: '1px solid #2e303a',
};

const dialogButtonRow = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '1rem',
  gap: '0.5rem',
};

const toastStyle = {
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

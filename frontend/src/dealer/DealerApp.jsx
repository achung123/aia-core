import { useReducer, useState } from 'preact/hooks';
import { reducer, initialState, validateOutcomeStreets } from './dealerState.js';
import { GameSelector } from './GameSelector.jsx';
import { GameCreateForm } from './GameCreateForm.jsx';
import { HandDashboard } from './HandDashboard.jsx';
import { PlayerGrid } from './PlayerGrid.jsx';
import { CameraCapture } from './CameraCapture.jsx';
import { DetectionReview } from './DetectionReview.jsx';
import { OutcomeButtons } from './OutcomeButtons.jsx';
import { DealerPreview } from './DealerPreview.jsx';
import { addPlayerToHand, updateHolecards, updateCommunityCards, patchPlayerResult, fetchGame, fetchHand } from '../api/client.js';

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

  function handleGameCreated(gameId, players, gameDate) {
    dispatch({ type: 'SET_GAME', payload: { gameId, players, gameDate } });
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

  function handleTileSelect(name) {
    setPatchError(null);
    setCaptureTarget(name);
  }

  function handleDirectOutcome(name) {
    setPatchError(null);
    setOutcomeError(null);
    setOutcomeTarget(name);
    dispatch({ type: 'SET_STEP', payload: 'outcome' });
  }

  function handleDetectionResult(targetName, apiResponse, file) {
    setCaptureTarget(null);
    const imageUrl = URL.createObjectURL(file);
    const mode = targetName === 'community' ? 'community' : 'player';
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

    if (reviewData?.mode === 'community') {
      const communityPayload = {
        flop_1: cardValues[0] || null,
        flop_2: cardValues[1] || null,
        flop_3: cardValues[2] || null,
        turn: cardValues[3] || null,
        river: cardValues[4] || null,
      };
      setReviewData(null);
      try {
        await updateCommunityCards(state.gameId, state.currentHandId, communityPayload);
        dispatch({
          type: 'SET_COMMUNITY_CARDS',
          payload: {
            flop1: cardValues[0] || null,
            flop2: cardValues[1] || null,
            flop3: cardValues[2] || null,
            turn: cardValues[3] || null,
            river: cardValues[4] || null,
          },
        });
        setPatchError(null);
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
      } catch (err) {
        dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
        setPatchError(err.message || 'Failed to save community cards');
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
    if (!state.community.recorded) {
      alert('Community cards must be recorded before finishing the hand.');
      return;
    }

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
    state.community.recorded &&
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

      {state.currentStep === 'dashboard' && state.gameId && (
        <HandDashboard
          gameId={state.gameId}
          players={state.players.map((p) => p.name)}
          onSelectHand={handleSelectHand}
          onBack={() => dispatch({ type: 'SET_STEP', payload: 'gameSelector' })}
        />
      )}

      {state.currentStep === 'playerGrid' && state.gameId && (
        <>
          <DealerPreview community={state.community} players={state.players} gameId={state.gameId} handNumber={state.currentHandId} />
          <PlayerGrid
            players={state.players}
            communityRecorded={state.community.recorded}
            onTileSelect={handleTileSelect}
            onDirectOutcome={handleDirectOutcome}
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
  background: '#fff',
  borderRadius: '12px',
  padding: '1.5rem',
  maxWidth: '400px',
  width: '90%',
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

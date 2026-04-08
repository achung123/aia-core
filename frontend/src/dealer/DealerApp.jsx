import { useReducer, useState } from 'preact/hooks';
import { reducer, initialState } from './dealerState.js';
import { GameCreateForm } from './GameCreateForm.jsx';
import { HandDashboard } from './HandDashboard.jsx';
import { PlayerGrid } from './PlayerGrid.jsx';
import { CameraCapture } from './CameraCapture.jsx';
import { DetectionReview } from './DetectionReview.jsx';
import { createHand } from '../api/client.js';
import { assembleHandPayload, validateNoDuplicates } from './handPayload.js';

export function DealerApp() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [captureTarget, setCaptureTarget] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  function handleGameCreated(gameId, players, gameDate) {
    dispatch({ type: 'SET_GAME', payload: { gameId, players, gameDate } });
  }

  function handleStartHand() {
    dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
  }

  function handleTileSelect(name) {
    setCaptureTarget(name);
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

  function handleReviewConfirm(targetName, cardValues) {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);

    if (reviewData?.mode === 'community') {
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
    } else {
      dispatch({
        type: 'SET_PLAYER_CARDS',
        payload: {
          name: targetName,
          card1: cardValues[0] || null,
          card2: cardValues[1] || null,
        },
      });
    }

    setReviewData(null);
    dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
  }

  function handleReviewRetake() {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
    const target = reviewData?.targetName;
    setReviewData(null);
    dispatch({ type: 'SET_STEP', payload: 'playerGrid' });
    setCaptureTarget(target);
  }

  async function handleSubmitHand() {
    setSubmitError(null);
    const payload = assembleHandPayload(state);
    const dupeError = validateNoDuplicates(payload);
    if (dupeError) {
      setSubmitError(dupeError);
      return;
    }
    setSubmitting(true);
    try {
      await createHand(state.gameId, payload);
      dispatch({ type: 'RESET_HAND' });
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit hand');
    } finally {
      setSubmitting(false);
    }
  }

  const allRecorded =
    state.community.recorded && state.players.length > 0 && state.players.every((p) => p.recorded);

  return (
    <div id="dealer-root">
      <h1>Dealer Interface</h1>

      {state.currentStep === 'create' && (
        <GameCreateForm onGameCreated={handleGameCreated} />
      )}

      {state.currentStep === 'dashboard' && state.gameId && (
        <HandDashboard
          gameDate={state.gameDate}
          players={state.players.map((p) => p.name)}
          handCount={state.handCount}
          onStartHand={handleStartHand}
        />
      )}

      {state.currentStep === 'playerGrid' && state.gameId && (
        <PlayerGrid
          players={state.players}
          communityRecorded={state.community.recorded}
          onTileSelect={handleTileSelect}
          allRecorded={allRecorded}
          submitting={submitting}
          submitError={submitError}
          onSubmitHand={handleSubmitHand}
        />
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
    </div>
  );
}

import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { fetchSessions, fetchGame, fetchHands, fetchHandStatus, updateHolecards, patchPlayerResult } from '../api/client.js';
import { CameraCapture } from '../dealer/CameraCapture.jsx';
import { DetectionReview } from '../dealer/DetectionReview.jsx';

function parseGameIdFromHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]game=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function PlayerApp() {
  const [step, setStep] = useState('gameSelect');
  const [gameId, setGameId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playerName, setPlayerName] = useState(null);
  const [playerStatus, setPlayerStatus] = useState('idle');
  const [communityRecorded, setCommunityRecorded] = useState(false);
  const [handNumber, setHandNumber] = useState(null);
  const [captureStep, setCaptureStep] = useState(null); // null | 'camera' | 'review'
  const [reviewData, setReviewData] = useState(null);
  const [captureError, setCaptureError] = useState(null);
  const [foldError, setFoldError] = useState(null);
  const [folding, setFolding] = useState(false);
  const [handingBack, setHandingBack] = useState(false);
  const [handBackError, setHandBackError] = useState(null);
  const [noActiveHand, setNoActiveHand] = useState(false);
  const [pollError, setPollError] = useState(null);
  const handNumberRef = useRef(null);

  function loadPlayers(id) {
    setPlayersLoading(true);
    fetchGame(id)
      .then(data => setPlayers(data.player_names || []))
      .catch(err => setError(err.message))
      .finally(() => setPlayersLoading(false));
  }

  useEffect(() => {
    const urlGameId = parseGameIdFromHash();

    fetchSessions()
      .then(data => {
        const active = data.filter(s => s.status === 'active');
        const sorted = [...active].sort((a, b) => b.game_id - a.game_id);
        setSessions(sorted);

        if (urlGameId !== null) {
          const found = sorted.find(s => s.game_id === urlGameId);
          if (found) {
            setGameId(urlGameId);
            setStep('namePick');
            loadPlayers(urlGameId);
          } else {
            setError(`Game #${urlGameId} not found or not active`);
          }
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSelectGame(id) {
    setGameId(id);
    setStep('namePick');
    loadPlayers(id);
  }

  function handleSelectPlayer(name) {
    setPlayerName(name);
    setPlayerStatus('idle');
    setStep('playing');
  }

  function handleChangePlayer() {
    setPlayerName(null);
    setPlayerStatus('idle');
    setNoActiveHand(false);
    setPollError(null);
    handNumberRef.current = null;
    setCaptureStep(null);
    setReviewData(null);
    setCaptureError(null);
    setStep('namePick');
  }

  function handleStartCapture() {
    setCaptureStep('camera');
    setCaptureError(null);
  }

  function handleDetectionResult(targetName, apiResponse, file) {
    setCaptureStep('review');
    const imageUrl = URL.createObjectURL(file);
    setReviewData({
      targetName,
      detections: apiResponse.detections,
      imageUrl,
    });
  }

  function handleCaptureCancel() {
    setCaptureStep(null);
    setReviewData(null);
  }

  async function handleReviewConfirm(targetName, cardValues) {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
    const card1 = cardValues[0] || null;
    const card2 = cardValues[1] || null;
    try {
      await updateHolecards(gameId, handNumber, playerName, {
        card_1: card1,
        card_2: card2,
      });
      setCaptureStep(null);
      setReviewData(null);
      setCaptureError(null);
    } catch (err) {
      setCaptureStep(null);
      setReviewData(null);
      setCaptureError(err.message || 'Failed to submit cards');
    }
  }

  function handleReviewRetake() {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
    setReviewData(null);
    setCaptureStep('camera');
  }

  async function handleFold() {
    if (!window.confirm('Fold this hand?')) return;
    setFolding(true);
    setFoldError(null);
    try {
      await patchPlayerResult(gameId, handNumber, playerName, { result: 'folded' });
    } catch (err) {
      setFoldError(err.message || 'Failed to fold');
    } finally {
      setFolding(false);
    }
  }

  async function handleHandBack() {
    setHandingBack(true);
    setHandBackError(null);
    try {
      await patchPlayerResult(gameId, handNumber, playerName, { result: 'handed_back' });
    } catch (err) {
      setHandBackError(err.message || 'Failed to hand back cards');
    } finally {
      setHandingBack(false);
    }
  }

  useEffect(() => {
    if (step !== 'playing' || !gameId || !playerName) return;

    const controller = new AbortController();
    const { signal } = controller;
    let intervalId = null;

    function pollCycle() {
      fetchHands(gameId, { signal })
        .then(hands => {
          if (signal.aborted) return;
          if (!hands || hands.length === 0) {
            setNoActiveHand(true);
            setHandNumber(null);
            handNumberRef.current = null;
            setPlayerStatus('idle');
            return null;
          }
          setNoActiveHand(false);
          const latest = hands.reduce((max, h) =>
            h.hand_number > max.hand_number ? h : max, hands[0]);
          if (latest.hand_number !== handNumberRef.current) {
            setHandNumber(latest.hand_number);
            handNumberRef.current = latest.hand_number;
            setPlayerStatus('idle');
          }
          return fetchHandStatus(gameId, latest.hand_number, { signal });
        })
        .then(data => {
          if (!data || signal.aborted) return;
          setPollError(null);
          setCommunityRecorded(data.community_recorded);
          const me = data.players.find(p => p.name === playerName);
          if (me) {
            setPlayerStatus(me.participation_status);
          }
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
          setPollError('Connection issue — retrying…');
        });
    }

    pollCycle();
    intervalId = setInterval(pollCycle, 3000);

    return () => {
      controller.abort();
      if (intervalId) clearInterval(intervalId);
    };
  }, [step, gameId, playerName]);

  if (step === 'playing') {
    return (
      <div style={styles.container}>
        <h1>Player Mode</h1>
        <p>Game #{gameId}</p>
        <h2 style={styles.heading}>{playerName}</h2>

        {captureStep === 'camera' && gameId && (
          <CameraCapture
            gameId={gameId}
            targetName={playerName}
            onDetectionResult={handleDetectionResult}
            onCancel={handleCaptureCancel}
          />
        )}

        {captureStep === 'review' && reviewData && (
          <DetectionReview
            detections={reviewData.detections}
            imageUrl={reviewData.imageUrl}
            mode="player"
            targetName={reviewData.targetName}
            onConfirm={handleReviewConfirm}
            onRetake={handleReviewRetake}
          />
        )}

        {!captureStep && (
          <>
            {noActiveHand && (
              <p data-testid="no-active-hand" style={{ color: '#6b7280' }}>No hands yet — waiting for dealer</p>
            )}
            {pollError && (
              <p data-testid="poll-error" style={{ color: '#ca8a04', fontSize: '0.85rem' }}>{pollError}</p>
            )}
            {!noActiveHand && (
              <>
              <PlayerStatusView
              status={playerStatus}
              onCapture={handleStartCapture}
              onFold={handleFold}
              folding={folding}
              onHandBack={handleHandBack}
              handingBack={handingBack}
            />
            {captureError && (
              <div style={styles.error}>
                <p>{captureError}</p>
                <button
                  data-testid="capture-retry-btn"
                  style={styles.captureBtn}
                  onClick={handleStartCapture}
                >
                  Retry
                </button>
              </div>
            )}
            {foldError && (
              <div style={styles.error}>
                <p>{foldError}</p>
                <button
                  data-testid="fold-retry-btn"
                  style={styles.foldBtn}
                  onClick={handleFold}
                >
                  Retry Fold
                </button>
              </div>
            )}
            {handBackError && (
              <div style={styles.error}>
                <p>{handBackError}</p>
                <button
                  data-testid="hand-back-retry-btn"
                  style={styles.handBackBtn}
                  onClick={handleHandBack}
                >
                  Retry
                </button>
              </div>
            )}
              </>
            )}
          </>
        )}

        <button
          data-testid="change-player-btn"
          style={styles.changeBtn}
          onClick={handleChangePlayer}
        >
          Change Player
        </button>
      </div>
    );
  }

  if (step === 'namePick') {
    return (
      <div style={styles.container}>
        <h1>Player Mode</h1>
        <p>Game #{gameId}</p>
        <h2 style={styles.heading}>Select Your Name</h2>

        {playersLoading && <p>Loading players…</p>}
        {error && <p style={styles.error}>{error}</p>}

        {!playersLoading && !error && players.length === 0 && (
          <p>No players in this game.</p>
        )}

        <div style={styles.list}>
          {players.map(name => (
            <button
              key={name}
              data-testid="player-name-btn"
              style={styles.card}
              onClick={() => handleSelectPlayer(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1>Player Mode</h1>
      <h2 style={styles.heading}>Select a Game</h2>

      {loading && <p>Loading games…</p>}
      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && sessions.length === 0 && (
        <p>No active games available.</p>
      )}

      <div style={styles.list}>
        {sessions.map(s => (
          <button
            key={s.game_id}
            data-testid="game-card"
            style={styles.card}
            onClick={() => handleSelectGame(s.game_id)}
          >
            <div style={styles.cardDate}>
              {s.game_date} <span style={styles.gameId}>#{s.game_id}</span>
            </div>
            <div style={styles.cardDetails}>
              <span>{s.player_count} players</span>
              <span>{s.hand_count} hands</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PlayerStatusView({ status, onCapture, onFold, folding, onHandBack, handingBack }) {
  switch (status) {
    case 'pending':
      return (
        <div>
          <p style={{ color: '#ca8a04' }}>Your turn! Capture your cards.</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              data-testid="capture-cards-btn"
              style={styles.captureBtn}
              onClick={onCapture}
            >
              Capture Cards
            </button>
            <button
              data-testid="fold-btn"
              style={styles.foldBtn}
              onClick={onFold}
              disabled={folding}
            >
              {folding ? 'Folding…' : 'Fold'}
            </button>
          </div>
        </div>
      );
    case 'joined':
      return (
        <div>
          <p style={{ color: '#16a34a' }}>Cards submitted ✓</p>
          <button
            data-testid="hand-back-btn"
            style={styles.handBackBtn}
            onClick={onHandBack}
            disabled={handingBack}
          >
            {handingBack ? 'Handing back…' : 'Hand Back Cards'}
          </button>
        </div>
      );
    case 'folded':
      return <p style={{ color: '#dc2626' }}>Folded</p>;
    case 'handed_back':
      return <p style={{ color: '#2563eb' }}>Waiting for dealer decision…</p>;
    case 'won':
      return <p style={{ color: '#16a34a' }}>You won!</p>;
    case 'lost':
      return <p style={{ color: '#6b7280' }}>You lost.</p>;
    default:
      return <p style={{ color: '#6b7280' }}>Waiting for hand…</p>;
  }
}

const styles = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    marginBottom: '0.75rem',
  },
  error: {
    color: '#dc2626',
    padding: '1rem 0',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    padding: '1rem',
    borderRadius: '12px',
    border: '2px solid indigo',
    background: '#eef2ff',
    color: '#312e81',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    fontSize: '1rem',
    WebkitTapHighlightColor: 'transparent',
  },
  cardDate: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  gameId: {
    fontWeight: 'normal',
    fontSize: '0.85rem',
    color: '#6b7280',
  },
  cardDetails: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.9rem',
  },
  changeBtn: {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: '1px solid #6b7280',
    background: '#f3f4f6',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  captureBtn: {
    marginTop: '0.5rem',
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
  foldBtn: {
    marginTop: '0.5rem',
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: '2px solid #dc2626',
    borderRadius: '8px',
    background: '#fff',
    color: '#dc2626',
    cursor: 'pointer',
  },
  handBackBtn: {
    marginTop: '0.5rem',
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
  },
};

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import {
  fetchSessions,
  fetchGame,
  fetchHands,
  fetchHandStatus,
  updateHolecards,
  patchPlayerResult,
} from '../api/client.ts';
import type {
  GameSessionListItem,
  HandStatusResponse,
  CardDetectionEntry,
} from '../api/types.ts';
import { CameraCapture } from '../dealer/CameraCapture.tsx';
import { DetectionReview } from '../dealer/DetectionReview.tsx';
import { PlayerActionButtons } from './PlayerActionButtons.tsx';

export const PLAYER_SESSION_KEY = 'aia-player-session';

function saveSession(gameId: number, playerName: string) {
  sessionStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ gameId, playerName }));
}

function loadSession(): { gameId: number; playerName: string } | null {
  try {
    const raw = sessionStorage.getItem(PLAYER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.gameId === 'number' && typeof parsed.playerName === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(PLAYER_SESSION_KEY);
}

type PlayerStep = 'gameSelect' | 'namePick' | 'playing';
type CaptureStep = null | 'camera' | 'review';
type ParticipationStatus = 'idle' | 'pending' | 'joined' | 'folded' | 'handed_back' | 'won' | 'lost';

interface ReviewData {
  targetName: string;
  detections: CardDetectionEntry[];
  imageUrl: string;
}

function parseGameIdFromHash(): number | null {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]game=(\d+)/);
  return match ? Number(match[1]) : null;
}

function parsePlayerFromHash(): string | null {
  const hash = window.location.hash || '';
  const match = hash.match(/[?&]player=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

interface PlayerStatusViewProps {
  status: ParticipationStatus;
  onCapture: () => void;
  onHandBack: () => void;
  handingBack: boolean;
}

function PlayerStatusView({ status, onCapture, onHandBack, handingBack }: PlayerStatusViewProps) {
  switch (status) {
    case 'pending':
      return (
        <div>
          <p style={{ color: '#ca8a04' }}>Your turn! Capture your cards.</p>
          <button
            data-testid="capture-cards-btn"
            style={styles.captureBtn}
            onClick={onCapture}
          >
            Capture Cards
          </button>
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

export function PlayerApp() {
  const [step, setStep] = useState<PlayerStep>('gameSelect');
  const [gameId, setGameId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<GameSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState<ParticipationStatus>('idle');
  const [, setCommunityRecorded] = useState(false);
  const [handNumber, setHandNumber] = useState<number | null>(null);
  const [captureStep, setCaptureStep] = useState<CaptureStep>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [handingBack, setHandingBack] = useState(false);
  const [handBackError, setHandBackError] = useState<string | null>(null);
  const [noActiveHand, setNoActiveHand] = useState(false);
  const [communityCardCount, setCommunityCardCount] = useState(0);
  const [pollError, setPollError] = useState<string | null>(null);
  const handNumberRef = useRef<number | null>(null);

  const loadPlayers = useCallback(function loadPlayers(id: number) {
    setPlayersLoading(true);
    fetchGame(id)
      .then(data => setPlayers(data.player_names || []))
      .catch(err => setError(err.message))
      .finally(() => setPlayersLoading(false));
  }, []);

  useEffect(() => {
    const urlGameId = parseGameIdFromHash();
    const urlPlayer = parsePlayerFromHash();

    // If both game and player are in URL, skip selection screens
    if (urlGameId !== null && urlPlayer) {
      fetchSessions()
        .then(data => {
          const active = data.filter(s => s.status === 'active');
          const found = active.find(s => s.game_id === urlGameId);
          if (found) {
            setGameId(urlGameId);
            setPlayerName(urlPlayer);
            setStep('playing');
            saveSession(urlGameId, urlPlayer);
          } else {
            setError(`Game #${urlGameId} not found or not active`);
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
      return;
    }

    const saved = loadSession();

    fetchSessions()
      .then(data => {
        const active = data.filter(s => s.status === 'active');
        const sorted = [...active].sort((a, b) => b.game_id - a.game_id);
        setSessions(sorted);

        if (saved) {
          const found = active.find(s => s.game_id === saved.gameId);
          if (found) {
            setGameId(saved.gameId);
            setPlayerName(saved.playerName);
            setStep('playing');
            return;
          } else {
            clearSession();
          }
        }

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
  }, [loadPlayers]);

  function handleSelectGame(id: number) {
    setGameId(id);
    setStep('namePick');
    loadPlayers(id);
  }

  function handleSelectPlayer(name: string) {
    setPlayerName(name);
    setPlayerStatus('idle');
    setStep('playing');
    if (gameId) saveSession(gameId, name);
  }

  function handleChangePlayer() {
    clearSession();
    setPlayerName(null);
    setPlayerStatus('idle');
    setNoActiveHand(false);
    setPollError(null);
    handNumberRef.current = null;
    setCaptureStep(null);
    setReviewData(null);
    setCaptureError(null);
    if (gameId) loadPlayers(gameId);
    setStep('namePick');
  }

  function handleLeaveGame() {
    clearSession();
    setPlayerName(null);
    setGameId(null);
    setPlayerStatus('idle');
    setNoActiveHand(false);
    setPollError(null);
    handNumberRef.current = null;
    setCaptureStep(null);
    setReviewData(null);
    setCaptureError(null);
    setStep('gameSelect');
  }

  function handleStartCapture() {
    setCaptureStep('camera');
    setCaptureError(null);
  }

  function handleDetectionResult(targetName: string, apiResponse: CardDetectionEntry[], file: File) {
    setCaptureStep('review');
    const imageUrl = URL.createObjectURL(file);
    setReviewData({
      targetName,
      detections: apiResponse,
      imageUrl,
    });
  }

  function handleCaptureCancel() {
    setCaptureStep(null);
    setReviewData(null);
  }

  async function handleReviewConfirm(_targetName: string, cardValues: string[]) {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
    const card1 = cardValues[0] || null;
    const card2 = cardValues[1] || null;
    try {
      await updateHolecards(gameId!, handNumber!, playerName!, {
        card_1: card1,
        card_2: card2,
      });
      setCaptureStep(null);
      setReviewData(null);
      setCaptureError(null);
    } catch (err: unknown) {
      setCaptureStep(null);
      setReviewData(null);
      const message = err instanceof Error ? err.message : 'Failed to submit cards';
      setCaptureError(message);
    }
  }

  function handleReviewRetake() {
    if (reviewData?.imageUrl) URL.revokeObjectURL(reviewData.imageUrl);
    setReviewData(null);
    setCaptureStep('camera');
  }

  async function handleHandBack() {
    setHandingBack(true);
    setHandBackError(null);
    try {
      await patchPlayerResult(gameId!, handNumber!, playerName!, { result: 'handed_back' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to hand back cards';
      setHandBackError(message);
    } finally {
      setHandingBack(false);
    }
  }

  useEffect(() => {
    if (step !== 'playing' || !gameId || !playerName) return;

    const controller = new AbortController();
    const { signal } = controller;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function pollCycle() {
      fetchHands(gameId!, { signal })
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
          const ccCount = [latest.flop_1, latest.flop_2, latest.flop_3, latest.turn, latest.river]
            .filter(c => c != null).length;
          setCommunityCardCount(ccCount);
          return fetchHandStatus(gameId!, latest.hand_number, { signal });
        })
        .then(data => {
          if (!data || signal.aborted) return;
          setPollError(null);
          setCommunityRecorded((data as HandStatusResponse).community_recorded);
          const me = (data as HandStatusResponse).players.find(p => p.name === playerName);
          if (me) {
            setPlayerStatus(me.participation_status as ParticipationStatus);
          }
        })
        .catch(err => {
          if ((err as Error).name === 'AbortError') return;
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
        {handNumber && <p style={{ color: '#6b7280', margin: '0 0 0.75rem' }}>Hand #{handNumber}</p>}

        {captureStep === 'camera' && gameId && (
          <CameraCapture
            gameId={gameId}
            targetName={playerName!}
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
              onHandBack={handleHandBack}
              handingBack={handingBack}
            />
            {playerStatus === 'joined' && handNumber && (
              <PlayerActionButtons
                gameId={gameId!}
                handNumber={handNumber}
                playerName={playerName!}
                communityCardCount={communityCardCount}
              />
            )}
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
          data-testid="table-view-btn"
          style={styles.tableViewBtn}
          onClick={() => {
            window.location.hash = `#/player/table?game=${gameId}&player=${encodeURIComponent(playerName!)}`;
          }}
        >
          Table View
        </button>

        <button
          data-testid="change-player-btn"
          style={styles.changeBtn}
          onClick={handleChangePlayer}
        >
          Change Player
        </button>

        <button
          data-testid="leave-game-btn"
          style={styles.changeBtn}
          onClick={handleLeaveGame}
        >
          Leave Game
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

const styles: Record<string, CSSProperties> = {
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
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    width: '100%',
    borderRadius: '8px',
    border: '1px solid #6b7280',
    background: '#f3f4f6',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '1rem',
  },
  captureBtn: {
    marginTop: '0.5rem',
    padding: '0.75rem 1.5rem',
    minHeight: '48px',
    minWidth: '48px',
    width: '100%',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
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

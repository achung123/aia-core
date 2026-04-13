import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchHands } from '../api/client.ts';
import type { HandResponse } from '../api/types.ts';
import { createPokerScene } from '../scenes/pokerScene.ts';
import { isShowdown } from '../scenes/showdown.ts';
import { computeSeatCameraPosition, animateCameraToSeat, getDefaultCameraPosition } from '../scenes/seatCamera.ts';
import { SessionScrubber } from '../components/SessionScrubber.tsx';

/* ── Card-parsing helpers (same as MobilePlaybackView) ──────── */

const SUIT_SYMBOL: Record<string, string> = {
  h: '♥', d: '♦', c: '♣', s: '♠',
  H: '♥', D: '♦', C: '♣', S: '♠',
};

interface ParsedCard {
  rank: string;
  suit: string;
}

interface PlayerHandData {
  player_name: string;
  hole_cards: [ParsedCard, ParsedCard] | null;
  result: string;
}

interface CardData {
  flop: (ParsedCard | null)[];
  turn: ParsedCard | null;
  river: ParsedCard | null;
  player_hands: PlayerHandData[];
}

function parseCard(cardStr: string | null | undefined): ParsedCard | null {
  if (!cardStr) return null;
  const rank = cardStr.slice(0, -1);
  const suitChar = cardStr.slice(-1);
  return { rank, suit: SUIT_SYMBOL[suitChar] || suitChar };
}

const RESULT_MAP: Record<string, string> = { won: 'win', folded: 'fold', lost: 'loss' };

/**
 * Build card data for the 3D scene from the player's perspective:
 * - The viewing player's hole cards are shown face-up
 * - At showdown (any won/lost result), all non-folded players' cards are revealed
 * - All other players' cards are masked (null = face-down)
 */
function handToPlayerCardData(hand: HandResponse, viewingPlayer: string): CardData {
  const showdown = isShowdown(hand.player_hands || []);
  return {
    flop: [parseCard(hand.flop_1), parseCard(hand.flop_2), parseCard(hand.flop_3)],
    turn: parseCard(hand.turn),
    river: parseCard(hand.river),
    player_hands: (hand.player_hands || []).map(ph => {
      const result = RESULT_MAP[ph.result ?? ''] || ph.result || '';
      const isViewing = ph.player_name === viewingPlayer;
      const hasCards = ph.card_1 && ph.card_2;
      const isFolded = result === 'fold';

      // Show cards for: viewing player always, or non-folded players at showdown
      const showCards = hasCards && (isViewing || (showdown && !isFolded));

      return {
        player_name: ph.player_name,
        hole_cards: showCards
          ? ([parseCard(ph.card_1)!, parseCard(ph.card_2)!] as [ParsedCard, ParsedCard])
          : null,
        result,
      };
    }),
  };
}

/* ── Street index ─────────────────────────────────────────────── */

function computeStreetIndex(hand: HandResponse): number {
  if (isShowdown(hand.player_hands || [])) return 4;
  if (hand.river) return 3;
  if (hand.turn) return 2;
  if (hand.flop_1) return 1;
  return 0;
}

/* ── Main component ───────────────────────────────────────────── */

export function TableView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameIdStr = searchParams.get('game');
  const playerName = searchParams.get('player');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef = useRef<any>(null);
  const labelsRef = useRef<HTMLDivElement[]>([]);
  const animCancelRef = useRef<(() => void) | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hands, setHands] = useState<HandResponse[]>([]);
  const [currentHandNumber, setCurrentHandNumber] = useState(0);

  const gameId = gameIdStr ? Number(gameIdStr) : null;

  /* Navigate back to the player action screen */
  const handleBack = useCallback(() => {
    if (gameId && playerName) {
      navigate(`/player?game=${gameId}&player=${encodeURIComponent(playerName)}`);
    } else {
      navigate('/player');
    }
  }, [navigate, gameId, playerName]);

  /* Three.js scene lifecycle */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameId) return;

    let cancelled = false;

    function init(tries = 30): void {
      if (cancelled || !canvas) return;
      if (tries > 0 && canvas.clientWidth === 0 && canvas.clientHeight === 0) {
        requestAnimationFrame(() => init(tries - 1));
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scene: any = createPokerScene(canvas, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      if (cancelled) {
        scene.dispose();
        return;
      }
      sceneRef.current = scene;
      // Default top-down-ish view; will be repositioned once data loads
      scene.camera.position.set(0, 14, 3);
      scene.camera.lookAt(0, 0, 0);
      scene.camera.updateProjectionMatrix();
      if (scene.controls) {
        scene.controls.saveState();
      }
    }
    init();

    return () => {
      cancelled = true;
      labelsRef.current.forEach(el => el.remove());
      labelsRef.current = [];
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, [gameId]);

  /* Label position updates */
  function updateLabelPositions(): void {
    if (!sceneRef.current) return;
    const { seatPositions, camera, renderer } = sceneRef.current;
    const domEl = renderer.domElement as HTMLCanvasElement | undefined;
    if (!domEl || !seatPositions) return;
    const cw = domEl.clientWidth || 1;
    const ch = domEl.clientHeight || 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labelsRef.current.forEach((label, i: number) => {
      if (seatPositions[i] && seatPositions[i].clone) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (seatPositions[i] as any).clone().project(camera);
        if (p.z > 1) {
          label.style.display = 'none';
          return;
        }
        label.style.display = '';
        const x = (p.x * 0.5 + 0.5) * cw;
        const y = (1 - (p.y * 0.5 + 0.5)) * ch;
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        label.style.transform = 'translate(-50%, -50%)';
      }
    });
  }

  function createSeatLabelsForPlayers(playerNames: string[]): void {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    labelsRef.current.forEach(el => el.remove());
    labelsRef.current = [];

    if (sceneRef.current?.controls) {
      sceneRef.current.controls.removeEventListener('change', updateLabelPositions);
    }

    const labels: HTMLDivElement[] = [];
    playerNames.forEach((name, i) => {
      const div = document.createElement('div');
      div.className = 'seat-label';
      div.setAttribute('data-testid', `seat-label-${i}`);
      div.style.cssText =
        'position:absolute;pointer-events:auto;cursor:pointer;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.8);z-index:4;';
      div.textContent = name;
      div.addEventListener('click', () => handleSeatClick(i));
      wrapper.appendChild(div);
      labels.push(div);
    });
    labelsRef.current = labels;

    if (sceneRef.current?.controls) {
      sceneRef.current.controls.addEventListener('change', updateLabelPositions);
    }

    updateLabelPositions();
  }

  /* Animate camera to a seat */
  function handleSeatClick(seatIndex: number): void {
    if (!sceneRef.current) return;
    const { seatPositions, camera, controls } = sceneRef.current;
    if (!seatPositions || !seatPositions[seatIndex]) return;

    // Cancel any in-flight animation
    if (animCancelRef.current) {
      animCancelRef.current();
      animCancelRef.current = null;
    }

    const seat = seatPositions[seatIndex];
    const { position, target } = computeSeatCameraPosition(seat);
    const { cancel } = animateCameraToSeat(camera, controls, position, target);
    animCancelRef.current = cancel;
  }

  /* Reset camera to overhead default */
  function handleResetView(): void {
    if (!sceneRef.current) return;
    const { camera, controls } = sceneRef.current;

    if (animCancelRef.current) {
      animCancelRef.current();
      animCancelRef.current = null;
    }

    const { position, target } = getDefaultCameraPosition();
    const { cancel } = animateCameraToSeat(camera, controls, position, target);
    animCancelRef.current = cancel;
  }

  /* Center camera on player's seat (animated) */
  function centerOnPlayer(playerSeatIndex: number): void {
    handleSeatClick(playerSeatIndex);
  }

  /* Build seat/player maps from all hands */
  const seatPlayerMapRef = useRef<Record<number, string>>({});
  const playerNamesRef = useRef<string[]>([]);

  function buildSeatMaps(allHands: HandResponse[]): void {
    const seatPlayerMap: Record<number, string> = {};
    const seen = new Set<string>();
    const names: string[] = [];
    allHands.forEach(h => {
      (h.player_hands || []).forEach(ph => {
        if (ph.player_name && !seen.has(ph.player_name)) {
          seen.add(ph.player_name);
          names.push(ph.player_name);
        }
      });
    });
    names.forEach((name, i) => {
      seatPlayerMap[i] = name;
    });
    seatPlayerMapRef.current = seatPlayerMap;
    playerNamesRef.current = names;
  }

  /* Update the 3D scene for a specific hand */
  function updateSceneForHand(hand: HandResponse): void {
    if (!sceneRef.current || !playerName) return;
    const cardData = handToPlayerCardData(hand, playerName);
    sceneRef.current.update({
      cardData,
      seatPlayerMap: seatPlayerMapRef.current,
      plMap: {},
      streetIndex: computeStreetIndex(hand),
    });
  }

  /* Handle scrubber change */
  function handleScrubberChange(handNumber: number): void {
    setCurrentHandNumber(handNumber);
    const hand = hands.find(h => h.hand_number === handNumber);
    if (hand) {
      updateSceneForHand(hand);
    }
  }

  /* Fetch and render hand data */
  useEffect(() => {
    if (!gameId || !playerName) return;

    const controller = new AbortController();
    const { signal } = controller;

    fetchHands(gameId, { signal })
      .then(fetchedHands => {
        if (signal.aborted || !fetchedHands || fetchedHands.length === 0) {
          if (!signal.aborted) {
            setError('No hands found for this game.');
            setLoading(false);
          }
          return;
        }

        // Sort by hand_number ascending
        const sorted = [...fetchedHands].sort((a, b) => a.hand_number - b.hand_number);
        setHands(sorted);

        // Get the latest hand
        const latest = sorted[sorted.length - 1];
        setCurrentHandNumber(latest.hand_number);

        // Build seat/player maps
        buildSeatMaps(sorted);
        createSeatLabelsForPlayers(playerNamesRef.current);

        // Render the latest hand
        updateSceneForHand(latest);

        // Center camera on the player's seat
        if (sceneRef.current) {
          const playerSeatIndex = playerNamesRef.current.indexOf(playerName);
          if (playerSeatIndex >= 0) {
            centerOnPlayer(playerSeatIndex);
          }
        }

        setLoading(false);
      })
      .catch(err => {
        if ((err as Error).name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, playerName]);

  /* Early-return for missing params */
  if (!gameId) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>Missing game ID in URL.</p>
        <button data-testid="back-to-hand-btn" style={styles.backBtn} onClick={handleBack}>
          ← Back to Hand
        </button>
      </div>
    );
  }

  if (!playerName) {
    return (
      <div style={styles.container}>
        <p style={styles.error}>Missing player name in URL.</p>
        <button data-testid="back-to-hand-btn" style={styles.backBtn} onClick={handleBack}>
          ← Back to Hand
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={styles.viewport}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
      />

      {/* Overlay UI */}
      <div style={styles.overlay}>
        <button data-testid="back-to-hand-btn" style={styles.backBtn} onClick={handleBack}>
          ← Back to Hand
        </button>
        <button data-testid="reset-view-btn" style={styles.resetBtn} onClick={handleResetView}>
          Reset View
        </button>
        {loading && <p style={styles.loadingText}>Loading table…</p>}
        {error && <p style={styles.error}>{error}</p>}
      </div>

      {/* Hand scrubber at the bottom */}
      {hands.length > 0 && (
        <div style={styles.scrubberContainer}>
          <SessionScrubber
            handCount={hands.length}
            currentHand={currentHandNumber}
            onChange={handleScrubberChange}
          />
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '1rem',
  },
  viewport: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#1a1a2e',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
    touchAction: 'none',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '12px',
    zIndex: 10,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
  },
  backBtn: {
    pointerEvents: 'auto',
    padding: '0.6rem 1.2rem',
    minHeight: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: 'rgba(79, 70, 229, 0.9)',
    color: '#fff',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
  resetBtn: {
    pointerEvents: 'auto',
    padding: '0.6rem 1.2rem',
    minHeight: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: 'rgba(55, 65, 81, 0.9)',
    color: '#fff',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
  loadingText: {
    color: '#c7d2fe',
    fontSize: '0.9rem',
    margin: 0,
  },
  error: {
    color: '#f87171',
    fontSize: '0.9rem',
    margin: 0,
  },
  scrubberContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
};

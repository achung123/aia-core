import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchHands } from '../api/client.ts';
import type { HandResponse } from '../api/types.ts';
import { createPokerScene } from '../scenes/pokerScene.ts';

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
 * - All other players' cards are masked (null = face-down)
 */
function handToPlayerCardData(hand: HandResponse, viewingPlayer: string): CardData {
  return {
    flop: [parseCard(hand.flop_1), parseCard(hand.flop_2), parseCard(hand.flop_3)],
    turn: parseCard(hand.turn),
    river: parseCard(hand.river),
    player_hands: (hand.player_hands || []).map(ph => ({
      player_name: ph.player_name,
      hole_cards:
        ph.player_name === viewingPlayer && ph.card_1 && ph.card_2
          ? ([parseCard(ph.card_1)!, parseCard(ph.card_2)!] as [ParsedCard, ParsedCard])
          : null,
      result: RESULT_MAP[ph.result ?? ''] || ph.result || '',
    })),
  };
}

/* ── Street index ─────────────────────────────────────────────── */

function computeStreetIndex(hand: HandResponse): number {
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        'position:absolute;pointer-events:none;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.8);z-index:4;';
      div.textContent = name;
      wrapper.appendChild(div);
      labels.push(div);
    });
    labelsRef.current = labels;

    if (sceneRef.current?.controls) {
      sceneRef.current.controls.addEventListener('change', updateLabelPositions);
    }

    updateLabelPositions();
  }

  /* Center camera on player's seat */
  function centerOnPlayer(playerSeatIndex: number): void {
    if (!sceneRef.current) return;
    const { seatPositions, camera, controls } = sceneRef.current;
    if (!seatPositions || !seatPositions[playerSeatIndex]) return;

    const seat = seatPositions[playerSeatIndex];
    // Position camera behind and above the player's seat, looking at center
    const behindX = seat.x * 0.5;
    const behindZ = seat.z * 0.5;
    camera.position.set(seat.x * 1.3, 8, seat.z * 1.3 + 2);
    if (controls && controls.target) {
      controls.target.set(behindX, 0, behindZ);
      controls.update();
      controls.saveState();
    }
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }

  /* Fetch and render hand data */
  useEffect(() => {
    if (!gameId || !playerName) return;

    const controller = new AbortController();
    const { signal } = controller;

    fetchHands(gameId, { signal })
      .then(hands => {
        if (signal.aborted || !hands || hands.length === 0) {
          if (!signal.aborted) {
            setError('No hands found for this game.');
            setLoading(false);
          }
          return;
        }

        // Get the latest hand
        const latest = hands.reduce((max, h) =>
          h.hand_number > max.hand_number ? h : max, hands[0]);

        // Build player-perspective card data
        const cardData = handToPlayerCardData(latest, playerName);

        // Build seat/player maps
        const seatPlayerMap: Record<number, string> = {};
        const seen = new Set<string>();
        const playerNames: string[] = [];
        hands.forEach(h => {
          (h.player_hands || []).forEach(ph => {
            if (ph.player_name && !seen.has(ph.player_name)) {
              seen.add(ph.player_name);
              playerNames.push(ph.player_name);
            }
          });
        });
        playerNames.forEach((name, i) => {
          seatPlayerMap[i] = name;
        });

        createSeatLabelsForPlayers(playerNames);

        if (sceneRef.current) {
          sceneRef.current.update({
            cardData,
            seatPlayerMap,
            plMap: {},
            streetIndex: computeStreetIndex(latest),
          });

          // Center camera on the player's seat
          const playerSeatIndex = playerNames.indexOf(playerName);
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
        {loading && <p style={styles.loadingText}>Loading table…</p>}
        {error && <p style={styles.error}>{error}</p>}
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
};

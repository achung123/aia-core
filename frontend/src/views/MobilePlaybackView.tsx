import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { fetchSessions, fetchHands } from '../api/client.ts';
import type { GameSessionListItem, HandResponse } from '../api/types.ts';
import { createPokerScene } from '../scenes/pokerScene.ts';
import { calculateEquity } from '../poker/evaluator.ts';
import { SessionScrubber } from '../components/SessionScrubber.tsx';
import { StreetScrubber } from '../components/StreetScrubber.tsx';

/* ── Card-parsing helpers ─────────────────────────────────────── */

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
  profit_loss: number | null;
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

function handToCardData(hand: HandResponse): CardData {
  return {
    flop: [parseCard(hand.flop_1), parseCard(hand.flop_2), parseCard(hand.flop_3)],
    turn: parseCard(hand.turn),
    river: parseCard(hand.river),
    player_hands: (hand.player_hands || []).map(ph => ({
      player_name: ph.player_name,
      hole_cards:
        ph.card_1 && ph.card_2
          ? ([parseCard(ph.card_1)!, parseCard(ph.card_2)!] as [ParsedCard, ParsedCard])
          : null,
      result: RESULT_MAP[ph.result ?? ''] || ph.result || '',
      profit_loss: ph.profit_loss ?? null,
    })),
  };
}

function communityForStreet(cardData: CardData, streetName: string): ParsedCard[] {
  const cards: ParsedCard[] = [];
  if (streetName !== 'Pre-Flop' && cardData.flop) {
    cards.push(...cardData.flop.filter((c): c is ParsedCard => c !== null));
  }
  if (['Turn', 'River', 'Showdown'].includes(streetName) && cardData.turn) {
    cards.push(cardData.turn);
  }
  if (['River', 'Showdown'].includes(streetName) && cardData.river) {
    cards.push(cardData.river);
  }
  return cards;
}

/* ── Inline EquityRow component ───────────────────────────────── */

interface EquityRowProps {
  equityMap: Record<string, number> | null;
  loading: boolean;
}

function equityColor(eq: number): string {
  if (eq >= 0.5) return '#4ade80';
  if (eq >= 0.25) return '#facc15';
  return '#f87171';
}

function EquityRow({ equityMap, loading }: EquityRowProps) {
  if (loading) {
    return (
      <div data-testid="equity-row" style={eqStyles.row}>
        <div
          data-testid="equity-loading"
          style={{ color: '#aaa', padding: 8, textAlign: 'center', width: '100%', fontSize: 14 }}
        >
          Loading equity…
        </div>
      </div>
    );
  }
  if (!equityMap) return null;
  return (
    <div data-testid="equity-row" style={eqStyles.row}>
      {Object.entries(equityMap).map(([name, eq]) => (
        <div key={name} data-testid="equity-card" style={eqStyles.card}>
          <div style={eqStyles.name}>{name}</div>
          <div style={{ ...eqStyles.equity, color: equityColor(eq) }}>
            {(eq * 100).toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  );
}

const eqStyles: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    gap: 6,
    padding: '8px 12px',
    background: '#1a1a2e',
    overflowX: 'auto',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    minWidth: 80,
    padding: '8px 12px',
    borderRadius: 8,
    background: '#1e1b4b',
    border: '1px solid #312e81',
    textAlign: 'center',
    flexShrink: 0,
  },
  name: {
    color: '#c7d2fe',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  equity: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'system-ui, sans-serif',
  },
};

/* ── Street index map ─────────────────────────────────────────── */

const STREET_INDEX: Record<string, number> = {
  'Pre-Flop': 0,
  Flop: 1,
  Turn: 2,
  River: 3,
  Showdown: 4,
};

/* ── Main component ───────────────────────────────────────────── */

export function MobilePlaybackView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef = useRef<any>(null);
  const labelsRef = useRef<HTMLDivElement[]>([]);

  const [sessions, setSessions] = useState<GameSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  const [activeGameStatus, setActiveGameStatus] = useState<string | null>(null);
  const [hands, setHands] = useState<HandResponse[]>([]);
  const [handIndex, setHandIndex] = useState(0);
  const [currentStreet, setCurrentStreet] = useState('Pre-Flop');
  const [equityMap, setEquityMap] = useState<Record<string, number> | null>(null);
  const [equityLoading, setEquityLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Fetch sessions on mount */
  useEffect(() => {
    fetchSessions()
      .then(data => {
        const sorted = [...data].sort((a, b) => b.game_date.localeCompare(a.game_date));
        setSessions(sorted);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  /* Three.js scene lifecycle — re-runs when activeGameId changes so the
     canvas (only rendered for the playback screen) is in the DOM. */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    function init(): void {
      if (cancelled) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scene: any = createPokerScene(canvas, {
        width: canvas!.clientWidth || canvas!.parentElement?.clientWidth || 800,
        height: canvas!.clientHeight || canvas!.parentElement?.clientHeight || 600,
      });
      sceneRef.current = scene;
      scene.camera.position.set(0, 18, 6);
      scene.camera.lookAt(0, 0, 0);
      scene.camera.updateProjectionMatrix();
      if (scene.controls) {
        scene.controls.saveState();
      }

      // ResizeObserver to re-bound canvas when container changes
      const canvasArea = canvas!.parentElement;
      if (canvasArea) {
        ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              scene.renderer.setSize(width, height);
              scene.camera.aspect = width / height;
              scene.camera.updateProjectionMatrix();
            }
          }
        });
        ro.observe(canvasArea);
      }
    }
    init();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      labelsRef.current.forEach(el => el.remove());
      labelsRef.current = [];
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, [activeGameId]);

  /* Label position updates */
  function updateLabelPositions(): void {
    if (!sceneRef.current) return;
    const { seatPositions, camera, renderer } = sceneRef.current;
    const domEl = renderer.domElement as HTMLCanvasElement | undefined;
    if (!domEl || !seatPositions) return;
    const cw = domEl.clientWidth || 1;
    const ch = domEl.clientHeight || 1;
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

  function showHand(index: number, handsList?: HandResponse[]): void {
    const list = handsList ?? hands;
    if (!list.length) return;
    const cardData = handToCardData(list[index]);
    const seatPlayerMap: Record<number, string> = {};
    const seen = new Set<string>();
    const playerNames: string[] = [];
    list.forEach(h => {
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

    setCurrentStreet('Pre-Flop');
    createSeatLabelsForPlayers(playerNames);

    if (sceneRef.current) {
      const scene = sceneRef.current;
      requestAnimationFrame(() => {
        scene.update({
          cardData,
          seatPlayerMap,
          plMap: {},
          streetIndex: STREET_INDEX['Pre-Flop'],
        });
      });
    }
  }

  function handleStreetChange(streetName: string): void {
    setCurrentStreet(streetName);
    if (!hands.length) return;
    const cardData = handToCardData(hands[handIndex]);

    if (sceneRef.current) {
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

      const scene = sceneRef.current;
      requestAnimationFrame(() => {
        scene.update({
          cardData,
          seatPlayerMap,
          plMap: {},
          streetIndex: STREET_INDEX[streetName] ?? 0,
        });
      });
    }
  }

  async function selectGame(gameId: number): Promise<void> {
    const session = sessions.find(s => s.game_id === gameId);
    setActiveGameId(gameId);
    setActiveGameStatus(session?.status ?? null);

    try {
      const fetchedHands = await fetchHands(gameId);
      setHands(fetchedHands);
      setHandIndex(0);
      if (fetchedHands.length) {
        showHand(0, fetchedHands);
      }

      // Start polling if game is active
      if (session?.status === 'active') {
        pollRef.current = setInterval(async () => {
          try {
            const updated = await fetchHands(gameId);
            setHands(updated);
          } catch {
            // Silently ignore poll errors
          }
        }, 10_000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleBack(): void {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setActiveGameId(null);
    setActiveGameStatus(null);
    setHands([]);
    setHandIndex(0);
    setCurrentStreet('Pre-Flop');
    setEquityMap(null);
    labelsRef.current.forEach(el => el.remove());
    labelsRef.current = [];
  }

  /* Clean up polling on unmount */
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  function handleSessionChange(newHandNumber: number): void {
    setHandIndex(newHandNumber - 1);
    showHand(newHandNumber - 1);
  }

  /* Equity computation */
  useEffect(() => {
    if (!activeGameId || !hands.length) {
      setEquityMap(null);
      return;
    }
    const hand = hands[handIndex];
    if (!hand) {
      setEquityMap(null);
      return;
    }

    const cardData = handToCardData(hand);
    const playersWithCards = (cardData.player_hands || []).filter(
      ph => ph.hole_cards && ph.hole_cards.length === 2 && ph.hole_cards[0] && ph.hole_cards[1],
    );

    if (playersWithCards.length < 2) {
      setEquityMap(null);
      return;
    }

    const communityCards = communityForStreet(cardData, currentStreet);
    const holeCards = playersWithCards.map(ph => ph.hole_cards!);

    try {
      setEquityLoading(true);
      const results = calculateEquity(holeCards, communityCards);
      const eqMap: Record<string, number> = {};
      playersWithCards.forEach((ph, i) => {
        eqMap[ph.player_name] = results[i].equity;
      });
      setEquityMap(Object.keys(eqMap).length > 0 ? eqMap : null);
    } catch {
      setEquityMap(null);
    } finally {
      setEquityLoading(false);
    }
  }, [activeGameId, handIndex, hands, currentStreet]);

  /* ── Game selector screen ─────────────────────────────────────── */
  if (!activeGameId) {
    return (
      <div data-testid="playback-game-selector" style={selectorStyles.container}>
        <h2 style={selectorStyles.heading}>Playback</h2>

        {loading && <p style={selectorStyles.loading}>Loading games…</p>}
        {error && <p style={selectorStyles.error}>{error}</p>}

        {!loading && !error && sessions.length === 0 && (
          <p style={selectorStyles.empty}>No games available.</p>
        )}

        <div style={selectorStyles.list}>
          {sessions.map(s => {
            const isActive = s.status === 'active';
            return (
              <button
                key={s.game_id}
                data-testid="game-card"
                style={{
                  ...selectorStyles.card,
                  ...(isActive ? selectorStyles.cardActive : selectorStyles.cardComplete),
                }}
                onClick={() => selectGame(s.game_id)}
              >
                <div style={selectorStyles.cardDate}>
                  {s.game_date} <span style={selectorStyles.gameId}>#{s.game_id}</span>
                </div>
                <div style={selectorStyles.cardDetails}>
                  <span style={{ fontWeight: 600 }}>
                    {isActive ? '● Active' : 'Complete'}
                  </span>
                  <span>{s.player_count} players</span>
                  <span>{s.hand_count} hands</span>
                </div>
                {s.winners && s.winners.length > 0 && (
                  <div style={selectorStyles.winnersRow}>
                    🏆 {s.winners.join(', ')}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Playback screen ────────────────────────────────────────── */
  return (
    <div
      ref={wrapperRef}
      data-testid="mobile-canvas"
      style={mobileStyles.wrapper}
    >
      {/* Back button (overlay on canvas) */}
      <button
        data-testid="back-button"
        onClick={handleBack}
        style={mobileStyles.backButton}
      >
        ← Back
      </button>

      {/* Canvas area — flex:1 fills space between HUD */}
      <div data-testid="canvas-area" style={mobileStyles.canvasArea}>
        <canvas ref={canvasRef} style={mobileStyles.canvas} />
      </div>

      {/* Scrubber controls — below the canvas, not overlaid */}
      <div data-testid="scrubber-mount" style={mobileStyles.scrubberMount}>
        {hands.length > 0 && (
          <div>
            <SessionScrubber
              handCount={hands.length}
              currentHand={handIndex + 1}
              onChange={handleSessionChange}
            />
            {hands[handIndex] && (
              <StreetScrubber
                currentStreet={currentStreet}
                handData={{ turn: hands[handIndex].turn, river: hands[handIndex].river }}
                onStreetChange={handleStreetChange}
              />
            )}
            {(equityLoading || equityMap) && (
              <EquityRow equityMap={equityMap} loading={equityLoading} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────── */

const selectorStyles: Record<string, CSSProperties> = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: '1rem',
  },
  heading: {
    fontSize: '1.4rem',
    marginBottom: '0.75rem',
    color: '#e2e8f0',
  },
  loading: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '2rem 0',
  },
  error: {
    textAlign: 'center',
    color: '#dc2626',
    padding: '1rem 0',
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: '2rem 0',
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
    borderRadius: 12,
    border: '2px solid',
    cursor: 'pointer',
    textAlign: 'left',
    background: 'none',
    width: '100%',
    fontSize: '1rem',
    WebkitTapHighlightColor: 'transparent',
  },
  cardActive: {
    borderColor: '#6366f1',
    background: 'rgba(99, 102, 241, 0.12)',
    color: '#c7d2fe',
  },
  cardComplete: {
    borderColor: '#2e303a',
    background: '#1e1f2b',
    color: '#94a3b8',
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
    flexWrap: 'wrap',
    gap: '1rem',
    fontSize: '0.9rem',
  },
  winnersRow: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#4ade80',
  },
};

const mobileStyles: Record<string, CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' },
  canvasArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  canvas: { display: 'block', width: '100%', height: '100%' },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 15,
    minWidth: 48,
    minHeight: 48,
    padding: '8px 14px',
    border: 'none',
    borderRadius: 8,
    background: '#4f46e5',
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  scrubberMount: { zIndex: 5, flexShrink: 0 },
};

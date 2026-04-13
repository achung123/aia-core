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
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeGameId, setActiveGameId] = useState<number | null>(null);
  const [hands, setHands] = useState<HandResponse[]>([]);
  const [handIndex, setHandIndex] = useState(0);
  const [currentStreet, setCurrentStreet] = useState('Pre-Flop');
  const [equityMap, setEquityMap] = useState<Record<string, number> | null>(null);
  const [equityLoading, setEquityLoading] = useState(false);

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

  /* Three.js scene lifecycle */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    function init(): void {
      if (cancelled) return;
      if (canvas!.clientWidth > 0 && canvas!.clientHeight > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const scene: any = createPokerScene(canvas, {
          width: window.innerWidth,
          height: window.innerHeight,
        });
        sceneRef.current = scene;
        scene.camera.position.set(0, 14, 3);
        scene.camera.lookAt(0, 0, 0);
        scene.camera.updateProjectionMatrix();
        if (scene.controls) {
          scene.controls.saveState();
        }
      } else {
        requestAnimationFrame(init);
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
  }, []);

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
      sceneRef.current.update({
        cardData,
        seatPlayerMap,
        plMap: {},
        streetIndex: STREET_INDEX['Pre-Flop'],
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

      sceneRef.current.update({
        cardData,
        seatPlayerMap,
        plMap: {},
        streetIndex: STREET_INDEX[streetName] ?? 0,
      });
    }
  }

  async function selectGame(gameId: number): Promise<void> {
    setActiveGameId(gameId);
    setDrawerOpen(false);

    try {
      const fetchedHands = await fetchHands(gameId);
      setHands(fetchedHands);
      setHandIndex(0);
      if (fetchedHands.length) {
        showHand(0, fetchedHands);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleBack(): void {
    setActiveGameId(null);
    setHands([]);
    setHandIndex(0);
    setCurrentStreet('Pre-Flop');
    setEquityMap(null);
    setDrawerOpen(true);
    labelsRef.current.forEach(el => el.remove());
    labelsRef.current = [];
  }

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

  return (
    <div
      ref={wrapperRef}
      data-testid="mobile-canvas"
      style={mobileStyles.wrapper}
    >
      <canvas ref={canvasRef} style={mobileStyles.canvas} />

      {/* Back button */}
      {activeGameId && (
        <button
          data-testid="back-button"
          onClick={handleBack}
          style={mobileStyles.backButton}
        >
          ← Back
        </button>
      )}

      {/* Scrubber controls */}
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

      {/* Bottom drawer */}
      <div data-testid="bottom-drawer" style={mobileStyles.drawer}>
        <button
          data-testid="drawer-toggle"
          onClick={() => setDrawerOpen(o => !o)}
          style={mobileStyles.drawerToggle}
        >
          {drawerOpen ? '▼ Sessions' : '▲ Sessions'}
        </button>

        <div
          data-testid="drawer-content"
          style={{
            display: drawerOpen ? 'block' : 'none',
            overflowY: 'auto',
            maxHeight: 'calc(60vh - 40px)',
            padding: 8,
          }}
        >
          {loading && <p style={{ color: '#aaa', textAlign: 'center' }}>Loading games…</p>}
          {error && <p style={{ color: '#f55', textAlign: 'center' }}>{error}</p>}

          {!loading && !error && sessions.length === 0 && (
            <p style={{ color: '#aaa', textAlign: 'center' }}>No sessions found.</p>
          )}

          {sessions.map(s => (
            <button
              key={s.game_id}
              data-testid="game-card"
              onClick={() => selectGame(s.game_id)}
              style={{
                display: 'block',
                width: '100%',
                padding: 12,
                marginBottom: 6,
                background: s.game_id === activeGameId ? '#2a2a4e' : '#111',
                color: '#ddd',
                border: '1px solid #333',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600 }}>{s.game_date}</div>
              <div style={{ fontSize: 11, color: '#999' }}>
                {s.hand_count ?? '?'} hands · {s.player_count ?? '?'} players
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────── */

const mobileStyles: Record<string, CSSProperties> = {
  wrapper: { position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' },
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
  scrubberMount: { position: 'absolute', bottom: 60, left: 0, right: 0, zIndex: 5 },
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#1a1a2e',
    borderTop: '2px solid #333',
    zIndex: 10,
    maxHeight: '60vh',
  },
  drawerToggle: {
    width: '100%',
    padding: 10,
    background: '#222',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
  },
};

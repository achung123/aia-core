import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchSessions, fetchHands } from '../api/client.ts';
import type { GameSessionListItem, HandResponse } from '../api/types';
import { createPokerScene } from '../scenes/pokerScene.ts';
import { calculateEquity } from '../poker/evaluator.ts';
import { SessionScrubber } from '../components/SessionScrubber.tsx';
import { StreetScrubber } from '../components/StreetScrubber.tsx';
import { gameSelectorStyles as selectorStyles, playbackLayoutStyles as mobileStyles, equityRowStyles as eqStyles } from '../styles/playbackStyles';

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
    player_hands: (hand.player_hands || []).map(playerHand => ({
      player_name: playerHand.player_name,
      hole_cards:
        playerHand.card_1 && playerHand.card_2
          ? ([parseCard(playerHand.card_1)!, parseCard(playerHand.card_2)!] as [ParsedCard, ParsedCard])
          : null,
      result: RESULT_MAP[playerHand.result ?? ''] || playerHand.result || '',
      profit_loss: playerHand.profit_loss ?? null,
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

/* ── Street index map ─────────────────────────────────────────── */

const STREET_INDEX: Record<string, number> = {
  'Pre-Flop': 0,
  Flop: 1,
  Turn: 2,
  River: 3,
  Showdown: 4,
};

/* ── Main component ───────────────────────────────────────────── */

export function PlaybackView() {
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

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

  /* Auto-select game from ?gameId= query param */
  useEffect(() => {
    const paramId = searchParams.get('gameId');
    if (paramId && sessions.length > 0 && !activeGameId) {
      const id = Number(paramId);
      if (sessions.some(s => s.game_id === id)) {
        selectGame(id);
      }
    }
  }, [sessions, searchParams]);  // eslint-disable-line react-hooks/exhaustive-deps

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
    list.forEach(hand => {
      (hand.player_hands || []).forEach(playerHand => {
        if (playerHand.player_name && !seen.has(playerHand.player_name)) {
          seen.add(playerHand.player_name);
          playerNames.push(playerHand.player_name);
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
      hands.forEach(hand => {
        (hand.player_hands || []).forEach(playerHand => {
          if (playerHand.player_name && !seen.has(playerHand.player_name)) {
            seen.add(playerHand.player_name);
            playerNames.push(playerHand.player_name);
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
    labelsRef.current.forEach(el => el.remove());
    labelsRef.current = [];
    navigate('/data');
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
      playerHand => playerHand.hole_cards && playerHand.hole_cards.length === 2 && playerHand.hole_cards[0] && playerHand.hole_cards[1],
    );

    if (playersWithCards.length < 2) {
      setEquityMap(null);
      return;
    }

    const communityCards = communityForStreet(cardData, currentStreet);
    const holeCards = playersWithCards.map(playerHand => playerHand.hole_cards!);

    try {
      setEquityLoading(true);
      const results = calculateEquity(holeCards, communityCards);
      const equities: Record<string, number> = {};
      playersWithCards.forEach((playerHand, i) => {
        equities[playerHand.player_name] = results[i].equity;
      });
      setEquityMap(Object.keys(equities).length > 0 ? equities : null);
    } catch {
      setEquityMap(null);
    } finally {
      setEquityLoading(false);
    }
  }, [activeGameId, handIndex, hands, currentStreet]);

  /* ── No game selected — prompt user to pick from Game Sessions ── */
  if (!activeGameId) {
    return (
      <div data-testid="playback-game-selector" style={selectorStyles.container}>
        <h2 style={selectorStyles.heading}>Playback</h2>

        {loading && <p style={selectorStyles.loading}>Loading game…</p>}
        {error && <p style={selectorStyles.error}>{error}</p>}

        {!loading && !error && (
          <p style={{ color: '#94a3b8', textAlign: 'center' as const, marginTop: '2rem' }}>
            Select a game from{' '}
            <a href="#/data" style={{ color: '#c084fc' }}>Game Sessions</a>
            {' '}and click <strong>▶ Playback</strong> to watch it here.
          </p>
        )}
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

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { fetchSessions, fetchHands } from '../api/client.ts';
import type { GameSessionListItem, HandResponse } from '../api/types.ts';
// Scene modules are still JS — will be typed in T-023/T-024
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: JS module without type declarations
import { createPokerScene } from '../scenes/pokerScene.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: JS module without type declarations
import { createSeatLabels, loadSession as updateLabelsForSession, updateSeatLabelPositions } from '../scenes/tableGeometry.js';
import { calculateEquity } from '../poker/evaluator.ts';
import { SessionScrubber } from '../components/SessionScrubber.tsx';
import { StreetScrubber } from '../components/StreetScrubber.tsx';
import { EquityOverlay, type ScreenPosition } from '../components/EquityOverlay.tsx';

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

/* ── Utility helpers ──────────────────────────────────────────── */

function extractPlayerNames(handsList: HandResponse[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const h of handsList) {
    for (const ph of h.player_hands || []) {
      if (ph.player_name && !seen.has(ph.player_name)) {
        seen.add(ph.player_name);
        names.push(ph.player_name);
      }
    }
  }
  return names;
}

function buildSeatPlayerMap(playerNames: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  playerNames.forEach((name, i) => {
    map[i] = name;
  });
  return map;
}

function computeCumulativePL(hands: HandResponse[], handIndex: number): Record<string, number> {
  const plMap: Record<string, number> = {};
  for (let i = 0; i <= handIndex; i++) {
    for (const ph of hands[i].player_hands || []) {
      const pl = ph.profit_loss ?? 0;
      plMap[ph.player_name] = (plMap[ph.player_name] || 0) + pl;
    }
  }
  return plMap;
}

const STREET_INDEX: Record<string, number> = {
  'Pre-Flop': 0,
  Flop: 1,
  Turn: 2,
  River: 3,
  Showdown: 4,
};

const SEAT_COUNT = 10;

/* ── Component ────────────────────────────────────────────────── */

export function PlaybackView() {
  /* Refs */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef = useRef<any>(null);
  const labelsRef = useRef<HTMLDivElement[]>([]);

  /* State */
  const [sessions, setSessions] = useState<GameSessionListItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [hands, setHands] = useState<HandResponse[]>([]);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [currentHand, setCurrentHand] = useState(1); // 1-based
  const [currentStreet, setCurrentStreet] = useState('Pre-Flop');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [equityMap, setEquityMap] = useState<Record<string, number>>({});
  const [seatPlayerMap, setSeatPlayerMap] = useState<Record<number, string>>({});
  const [seatScreenPositions, setSeatScreenPositions] = useState<ScreenPosition[]>([]);

  /* Fetch session list on mount */
  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch((err: Error) => setSessionsError(err.message))
      .finally(() => setSessionsLoading(false));
  }, []);

  /* Three.js scene setup / teardown */
  useEffect(() => {
    const canvas = canvasRef.current;
    const area = canvasAreaRef.current;
    if (!canvas || !area) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;

    function initScene(tries = 30): void {
      if (cancelled) return;
      if (tries > 0 && canvas!.clientWidth === 0 && canvas!.clientHeight === 0) {
        requestAnimationFrame(() => initScene(tries - 1));
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pokerScene: any = createPokerScene(canvas);
      if (cancelled) {
        pokerScene.dispose();
        return;
      }
      sceneRef.current = pokerScene;

      const { camera, renderer, controls, seatPositions } = pokerScene;
      const labelEls: HTMLDivElement[] = createSeatLabels(area);
      labelsRef.current = labelEls;
      updateSeatLabelPositions(labelEls, seatPositions, camera, renderer);

      function syncPositions(): void {
        updateSeatLabelPositions(labelsRef.current, seatPositions, camera, renderer);
        const domEl: HTMLCanvasElement = renderer.domElement;
        const cw = domEl.clientWidth || 1;
        const ch = domEl.clientHeight || 1;
        setSeatScreenPositions(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          seatPositions.map((pos: any) => {
            const p = pos.clone().project(camera);
            return {
              x: (p.x * 0.5 + 0.5) * cw,
              y: (1 - (p.y * 0.5 + 0.5)) * ch,
            };
          }),
        );
      }

      window.addEventListener('resize', syncPositions);
      controls.addEventListener('change', syncPositions);
      syncPositions();

      teardown = () => {
        window.removeEventListener('resize', syncPositions);
        controls.removeEventListener('change', syncPositions);
        labelsRef.current.forEach((el: HTMLDivElement) => el.remove());
        labelsRef.current = [];
        pokerScene.dispose();
      };
    }

    initScene();

    return () => {
      cancelled = true;
      if (teardown) teardown();
      sceneRef.current = null;
    };
  }, []);

  /* Load a session */
  const loadSessionById = useCallback(async (session: GameSessionListItem) => {
    setSessionLoading(true);
    setSessionError(null);

    try {
      const fetchedHands = await fetchHands(session.game_id);
      const names = extractPlayerNames(fetchedHands);
      const spm = buildSeatPlayerMap(names);

      setHands(fetchedHands);
      setPlayerNames(names);
      setSeatPlayerMap(spm);
      setCurrentHand(1);
      setCurrentStreet('Pre-Flop');

      // Update imperative seat labels
      if (labelsRef.current.length) {
        updateLabelsForSession(labelsRef.current, names);
        if (sceneRef.current) {
          updateSeatLabelPositions(
            labelsRef.current,
            sceneRef.current.seatPositions,
            sceneRef.current.camera,
            sceneRef.current.renderer,
          );
        }
      }

      // Show first hand in scene
      if (fetchedHands.length && sceneRef.current) {
        const cardData = handToCardData(fetchedHands[0]);
        sceneRef.current.update({
          cardData,
          seatPlayerMap: spm,
          plMap: computeCumulativePL(fetchedHands, 0),
          streetIndex: 0,
        });
      }
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSessionLoading(false);
    }
  }, []);

  /* Hand navigation */
  const handleHandChange = useCallback(
    (handNumber: number) => {
      setCurrentHand(handNumber);
      setCurrentStreet('Pre-Flop');

      const scene = sceneRef.current;
      if (!scene || !hands.length) return;

      const idx = handNumber - 1;
      const cardData = handToCardData(hands[idx]);
      scene.update({
        cardData,
        seatPlayerMap,
        plMap: computeCumulativePL(hands, idx),
        streetIndex: 0,
      });
    },
    [hands, seatPlayerMap],
  );

  /* Street navigation */
  const handleStreetChange = useCallback(
    (streetName: string) => {
      setCurrentStreet(streetName);

      const scene = sceneRef.current;
      if (!scene || !hands.length) return;

      const idx = currentHand - 1;
      const cardData = handToCardData(hands[idx]);
      scene.update({
        cardData,
        seatPlayerMap,
        plMap: computeCumulativePL(hands, idx),
        streetIndex: STREET_INDEX[streetName] ?? 0,
      });
    },
    [hands, currentHand, seatPlayerMap],
  );

  /* Equity computation */
  useEffect(() => {
    if (!hands.length) {
      setEquityMap({});
      return;
    }

    const hand = hands[currentHand - 1];
    if (!hand) {
      setEquityMap({});
      return;
    }

    const cardData = handToCardData(hand);
    const active = cardData.player_hands.filter(
      ph => ph.hole_cards && ph.hole_cards[0] && ph.hole_cards[1],
    );

    if (active.length < 2) {
      setEquityMap({});
      return;
    }

    const community = communityForStreet(cardData, currentStreet);
    const holeCards = active.map(ph => ph.hole_cards!);

    try {
      const results = calculateEquity(holeCards, community);
      const eqMap: Record<string, number> = {};
      active.forEach((ph, i) => {
        eqMap[ph.player_name] = results[i].equity;
      });
      setEquityMap(eqMap);
    } catch {
      setEquityMap({});
    }
  }, [hands, currentHand, currentStreet]);

  /* ── Render ── */

  const hasEquity = Object.keys(equityMap).length > 0;
  const currentHandData = hands.length ? hands[currentHand - 1] : null;
  // playerNames is used to update imperative seat labels
  void playerNames;

  return (
    <div data-testid="playback-layout" style={styles.layout}>
      {/* Session sidebar */}
      <div data-testid="session-panel" style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>Sessions</h2>
        <div data-testid="session-list">
          {sessionsLoading && <p style={styles.muted}>Loading…</p>}
          {sessionsError && <p style={styles.error}>{sessionsError}</p>}
          {!sessionsLoading && !sessionsError && sessions.length === 0 && (
            <p style={styles.muted}>No sessions found.</p>
          )}
          {sessions.map(s => (
            <div
              key={s.game_id}
              data-testid="session-row"
              style={styles.sessionRow}
              onClick={() => loadSessionById(s)}
            >
              <div style={styles.sessionDate}>{s.game_date}</div>
              <div style={styles.sessionInfo}>
                {s.hand_count ?? '?'} hands · {s.player_count ?? '?'} players
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div style={styles.main}>
        <div ref={canvasAreaRef} data-testid="canvas-area" style={styles.canvasArea}>
          <canvas ref={canvasRef} data-testid="three-canvas" style={styles.canvas} />
          {sessionLoading && (
            <div data-testid="spinner" style={styles.spinner}>
              Loading…
            </div>
          )}
          {sessionError && (
            <div data-testid="error-banner" style={styles.errorBanner}>
              Failed to load session: {sessionError}
            </div>
          )}
          {hasEquity && (
            <EquityOverlay
              seatCount={SEAT_COUNT}
              equityMap={equityMap}
              seatPlayerMap={seatPlayerMap}
              seatPositions={seatScreenPositions}
            />
          )}
        </div>

        {/* Scrubbers */}
        <div data-testid="scrubber-container">
          {hands.length > 0 && currentHandData && (
            <>
              <SessionScrubber
                handCount={hands.length}
                currentHand={currentHand}
                onChange={handleHandChange}
              />
              <StreetScrubber
                currentStreet={currentStreet}
                handData={{ turn: currentHandData.turn, river: currentHandData.river }}
                onStreetChange={handleStreetChange}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────── */

const styles: Record<string, CSSProperties> = {
  layout: { display: 'flex', height: '100vh' },
  sidebar: { width: 240, overflowY: 'auto', background: '#111', padding: 10 },
  sidebarTitle: { color: '#fff', fontSize: 14, margin: '0 0 8px' },
  muted: { color: '#aaa' },
  error: { color: '#f55' },
  sessionRow: { padding: 8, cursor: 'pointer', color: '#ddd', borderBottom: '1px solid #333' },
  sessionDate: { fontWeight: 600 },
  sessionInfo: { fontSize: 11, color: '#999' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  canvasArea: { flex: 1, position: 'relative' },
  canvas: { display: 'block', width: '100%', height: '100%' },
  spinner: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%,-50%)',
    color: '#fff',
  },
  errorBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    background: '#c00',
    color: '#fff',
    padding: 8,
  },
};

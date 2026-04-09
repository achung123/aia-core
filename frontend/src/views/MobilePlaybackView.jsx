import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { fetchSessions, fetchHands, fetchEquity } from '../api/client.js';
import { createPokerScene } from '../scenes/pokerScene.js';
import { SessionScrubber } from '../mobile/SessionScrubber.jsx';
import { StreetScrubber } from '../mobile/StreetScrubber.jsx';
import { EquityRow } from '../mobile/EquityRow.jsx';

function parseCard(cardStr) {
  if (!cardStr) return null;
  const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠', H: '♥', D: '♦', C: '♣', S: '♠' };
  const rank = cardStr.slice(0, -1);
  const suitChar = cardStr.slice(-1);
  return { rank, suit: SUIT_SYMBOL[suitChar] || suitChar };
}

const RESULT_MAP = { won: 'win', folded: 'fold', lost: 'loss' };

function handToCardData(hand) {
  return {
    flop: [parseCard(hand.flop_1), parseCard(hand.flop_2), parseCard(hand.flop_3)],
    turn: parseCard(hand.turn),
    river: parseCard(hand.river),
    player_hands: (hand.player_hands || []).map(ph => ({
      player_name: ph.player_name,
      hole_cards: ph.card_1 && ph.card_2 ? [parseCard(ph.card_1), parseCard(ph.card_2)] : null,
      result: RESULT_MAP[ph.result] || ph.result,
      profit_loss: ph.profit_loss,
    })),
  };
}

export function MobilePlaybackView() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeGameId, setActiveGameId] = useState(null);
  const [hands, setHands] = useState([]);
  const [handIndex, setHandIndex] = useState(0);
  const [currentStreet, setCurrentStreet] = useState('Pre-Flop');
  const [equityMap, setEquityMap] = useState(null);
  const [equityLoading, setEquityLoading] = useState(false);

  useEffect(() => {
    fetchSessions()
      .then(data => {
        const sorted = [...data].sort((a, b) =>
          b.game_date.localeCompare(a.game_date)
        );
        setSessions(sorted);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function init() {
      if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        sceneRef.current = createPokerScene(canvas, {
          width: window.innerWidth,
          height: window.innerHeight,
        });
      } else {
        requestAnimationFrame(init);
      }
    }
    init();

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  function showHand(index, handsList) {
    const list = handsList || hands;
    if (!list.length) return;
    const cardData = handToCardData(list[index]);
    const seatPlayerMap = {};
    const seen = new Set();
    const playerNames = [];
    list.forEach(h => {
      (h.player_hands || []).forEach(ph => {
        if (ph.player_name && !seen.has(ph.player_name)) {
          seen.add(ph.player_name);
          playerNames.push(ph.player_name);
        }
      });
    });
    playerNames.forEach((name, i) => { seatPlayerMap[i] = name; });

    setCurrentStreet('Pre-Flop');

    if (sceneRef.current) {
      const streetMap = { 'Pre-Flop': 0, 'Flop': 1, 'Turn': 2, 'River': 3, 'Showdown': 4 };
      sceneRef.current.update({
        cardData,
        seatPlayerMap,
        plMap: {},
        streetIndex: streetMap['Pre-Flop'],
      });
    }
  }

  function handleStreetChange(streetName) {
    setCurrentStreet(streetName);
    if (!hands.length) return;
    const cardData = handToCardData(hands[handIndex]);

    if (sceneRef.current) {
      const streetMap = { 'Pre-Flop': 0, 'Flop': 1, 'Turn': 2, 'River': 3, 'Showdown': 4 };
      const seatPlayerMap = {};
      const seen = new Set();
      const playerNames = [];
      hands.forEach(h => {
        (h.player_hands || []).forEach(ph => {
          if (ph.player_name && !seen.has(ph.player_name)) {
            seen.add(ph.player_name);
            playerNames.push(ph.player_name);
          }
        });
      });
      playerNames.forEach((name, i) => { seatPlayerMap[i] = name; });

      sceneRef.current.update({
        cardData,
        seatPlayerMap,
        plMap: {},
        streetIndex: streetMap[streetName] ?? 0,
      });
    }
  }

  async function selectGame(gameId) {
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
      setError(err.message);
    }
  }

  function handleBack() {
    setActiveGameId(null);
    setHands([]);
    setHandIndex(0);
    setCurrentStreet('Pre-Flop');
    setEquityMap(null);
    setDrawerOpen(true);
  }

  function handleSessionChange(newIndex) {
    setHandIndex(newIndex - 1);
    showHand(newIndex - 1);
  }

  // Fetch equity from backend when hand changes
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

    let cancelled = false;
    setEquityLoading(true);
    fetchEquity(activeGameId, hand.hand_number)
      .then(data => {
        if (cancelled) return;
        const eqMap = {};
        (data.equities || []).forEach(e => {
          eqMap[e.player_name] = e.equity;
        });
        setEquityMap(Object.keys(eqMap).length > 0 ? eqMap : null);
      })
      .catch(() => {
        if (!cancelled) setEquityMap(null);
      })
      .finally(() => {
        if (!cancelled) setEquityLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeGameId, handIndex, hands]);

  const currentCardData = hands.length ? handToCardData(hands[handIndex]) : null;

  return (
    <div
      data-testid="mobile-canvas"
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Back button */}
      {activeGameId && (
        <button
          data-testid="back-button"
          onClick={handleBack}
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 15,
            minWidth: '48px',
            minHeight: '48px',
            padding: '8px 14px',
            border: 'none',
            borderRadius: '8px',
            background: '#4f46e5',
            color: '#fff',
            fontSize: '16px',
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          ← Back
        </button>
      )}

      {/* Scrubber controls */}
      <div
        data-testid="scrubber-mount"
        style={{ position: 'absolute', bottom: '60px', left: 0, right: 0, zIndex: 5 }}
      >
        {hands.length > 0 && (
          <div>
            <SessionScrubber
              current={handIndex + 1}
              total={hands.length}
              onchange={handleSessionChange}
            />
            {currentCardData && (
              <StreetScrubber
                currentStreet={currentStreet}
                handData={currentCardData}
                onStreetChange={handleStreetChange}
              />
            )}
            {(equityLoading || equityMap) && <EquityRow equityMap={equityMap} loading={equityLoading} />}
          </div>
        )}
      </div>

      {/* Bottom drawer */}
      <div
        data-testid="bottom-drawer"
        style={{
          position: 'absolute',
          bottom: '0px',
          left: 0,
          right: 0,
          background: '#1a1a2e',
          borderTop: '2px solid #333',
          zIndex: 10,
          maxHeight: '60vh',
        }}
      >
        <button
          data-testid="drawer-toggle"
          onClick={() => setDrawerOpen(o => !o)}
          style={{
            width: '100%',
            padding: '10px',
            background: '#222',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {drawerOpen ? '▼ Sessions' : '▲ Sessions'}
        </button>

        <div
          data-testid="drawer-content"
          style={{
            display: drawerOpen ? 'block' : 'none',
            overflowY: 'auto',
            maxHeight: 'calc(60vh - 40px)',
            padding: '8px',
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
                padding: '12px',
                marginBottom: '6px',
                background: s.game_id === activeGameId ? '#2a2a4e' : '#111',
                color: '#ddd',
                border: '1px solid #333',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontWeight: 600 }}>{s.game_date}</div>
              <div style={{ fontSize: '11px', color: '#999' }}>
                {s.hand_count ?? '?'} hands · {s.player_count ?? '?'} players
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

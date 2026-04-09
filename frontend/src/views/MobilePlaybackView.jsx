import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { fetchSessions, fetchHands } from '../api/client.js';
import { createPokerScene } from '../scenes/pokerScene.js';

function parseCard(cardStr) {
  if (!cardStr) return null;
  const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠', H: '♥', D: '♦', C: '♣', S: '♠' };
  const rank = cardStr.slice(0, -1);
  const suitChar = cardStr.slice(-1);
  return { rank, suit: SUIT_SYMBOL[suitChar] || suitChar };
}

function handToCardData(hand) {
  return {
    flop: [parseCard(hand.flop_1), parseCard(hand.flop_2), parseCard(hand.flop_3)],
    turn: parseCard(hand.turn),
    river: parseCard(hand.river),
    player_hands: (hand.player_hands || []).map(ph => ({
      player_name: ph.player_name,
      hole_cards: ph.card_1 && ph.card_2 ? [parseCard(ph.card_1), parseCard(ph.card_2)] : null,
      result: ph.result,
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

  async function selectGame(gameId) {
    setActiveGameId(gameId);
    setDrawerOpen(false);

    try {
      const hands = await fetchHands(gameId);
      if (!hands.length || !sceneRef.current) return;

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

      const cardData = handToCardData(hands[0]);
      sceneRef.current.update({
        cardData,
        seatPlayerMap,
        plMap: {},
        streetIndex: 0,
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div
      data-testid="mobile-canvas"
      style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Scrubber mount point */}
      <div
        data-testid="scrubber-mount"
        style={{ position: 'absolute', bottom: '60px', left: 0, right: 0, zIndex: 5 }}
      />

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

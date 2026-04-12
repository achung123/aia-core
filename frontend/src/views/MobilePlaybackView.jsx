import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { fetchSessions, fetchHands } from '../api/client.js';
import { createPokerScene } from '../scenes/pokerScene.js';
import { SessionScrubber } from '../mobile/SessionScrubber.jsx';
import { StreetScrubber } from '../mobile/StreetScrubber.jsx';
import { EquityRow } from '../mobile/EquityRow.jsx';
import { calculateEquity } from '../poker/evaluator.js';

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

function communityForStreet(cardData, streetName) {
  const cards = [];
  if (streetName !== 'Pre-Flop' && cardData.flop) {
    cards.push(...cardData.flop.filter(Boolean));
  }
  if ((streetName === 'Turn' || streetName === 'River' || streetName === 'Showdown') && cardData.turn) {
    cards.push(cardData.turn);
  }
  if ((streetName === 'River' || streetName === 'Showdown') && cardData.river) {
    cards.push(cardData.river);
  }
  return cards;
}

export function MobilePlaybackView() {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const sceneRef = useRef(null);
  const labelsRef = useRef([]);
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
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    function init() {
      if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
        sceneRef.current = createPokerScene(canvas, {
          width: window.innerWidth,
          height: window.innerHeight,
        });
        // Near-top-down camera so cards are always visible above the scrubber
        sceneRef.current.camera.position.set(0, 14, 3);
        sceneRef.current.camera.lookAt(0, 0, 0);
        sceneRef.current.camera.updateProjectionMatrix();
        if (sceneRef.current.controls) {
          sceneRef.current.controls.saveState();
        }
      } else {
        requestAnimationFrame(init);
      }
    }
    init();

    return () => {
      labelsRef.current.forEach((el) => el.remove());
      labelsRef.current = [];
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []);

  function updateLabelPositions() {
    if (!sceneRef.current) return;
    const { seatPositions, camera, renderer } = sceneRef.current;
    const domEl = renderer.domElement;
    if (!domEl || !seatPositions) return;
    const cw = domEl.clientWidth || 1;
    const ch = domEl.clientHeight || 1;
    labelsRef.current.forEach((label, i) => {
      if (seatPositions[i] && seatPositions[i].clone) {
        const p = seatPositions[i].clone().project(camera);
        if (p.z > 1) { label.style.display = 'none'; return; }
        label.style.display = '';
        const x = (p.x * 0.5 + 0.5) * cw;
        const y = (1 - (p.y * 0.5 + 0.5)) * ch;
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        label.style.transform = 'translate(-50%, -50%)';
      }
    });
  }

  function createSeatLabelsForPlayers(playerNames) {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Remove old labels
    labelsRef.current.forEach((el) => el.remove());
    labelsRef.current = [];

    // Remove old OrbitControls listener
    if (sceneRef.current && sceneRef.current.controls) {
      sceneRef.current.controls.removeEventListener('change', updateLabelPositions);
    }

    const labels = [];
    playerNames.forEach((name, i) => {
      const div = document.createElement('div');
      div.className = 'seat-label';
      div.setAttribute('data-testid', `seat-label-${i}`);
      div.style.cssText = 'position:absolute;pointer-events:none;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.8);z-index:4;';
      div.textContent = name;
      wrapper.appendChild(div);
      labels.push(div);
    });
    labelsRef.current = labels;

    // Listen for orbit changes
    if (sceneRef.current && sceneRef.current.controls) {
      sceneRef.current.controls.addEventListener('change', updateLabelPositions);
    }

    updateLabelPositions();
  }

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

    createSeatLabelsForPlayers(playerNames);

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
    labelsRef.current.forEach((el) => el.remove());
    labelsRef.current = [];
  }

  function handleSessionChange(newIndex) {
    setHandIndex(newIndex - 1);
    showHand(newIndex - 1);
  }

  // Calculate equity client-side when hand or street changes
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
      (ph) => ph.hole_cards && ph.hole_cards.length === 2 && ph.hole_cards[0] && ph.hole_cards[1],
    );

    if (playersWithCards.length < 2) {
      setEquityMap(null);
      return;
    }

    // Build community cards for the current street
    const communityCards = communityForStreet(cardData, currentStreet);
    const holeCards = playersWithCards.map((ph) => ph.hole_cards);

    try {
      setEquityLoading(true);
      const results = calculateEquity(holeCards, communityCards);
      const eqMap = {};
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

  const currentCardData = hands.length ? handToCardData(hands[handIndex]) : null;

  return (
    <div
      ref={wrapperRef}
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

import { useState, useRef, useEffect } from 'preact/hooks';
import { createPokerScene } from '../scenes/pokerScene.js';
import { calculateEquity } from '../poker/evaluator.js';
import { StreetScrubber } from '../mobile/StreetScrubber.jsx';

const SUIT_SYMBOL = { h: '♥', d: '♦', c: '♣', s: '♠', H: '♥', D: '♦', C: '♣', S: '♠' };
const RESULT_MAP = { won: 'win', folded: 'fold', lost: 'loss' };

function parseCard(cardStr) {
  if (!cardStr) return null;
  const rank = cardStr.slice(0, -1);
  const suitChar = cardStr.slice(-1);
  return { rank, suit: SUIT_SYMBOL[suitChar] || suitChar };
}

function communityForStreet(community, streetName) {
  const cards = [];
  if (streetName !== 'Pre-Flop' && community) {
    if (community.flop1) cards.push(parseCard(community.flop1));
    if (community.flop2) cards.push(parseCard(community.flop2));
    if (community.flop3) cards.push(parseCard(community.flop3));
  }
  if ((streetName === 'Turn' || streetName === 'River' || streetName === 'Showdown') && community?.turn) {
    cards.push(parseCard(community.turn));
  }
  if ((streetName === 'River' || streetName === 'Showdown') && community?.river) {
    cards.push(parseCard(community.river));
  }
  return cards.filter(Boolean);
}

export function DealerPreview({ community, players, gameId, handNumber }) {
  const [expanded, setExpanded] = useState(false);
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const sceneRef = useRef(null);
  const labelsRef = useRef([]);
  const [equityMap, setEquityMap] = useState({});
  const [currentStreet, setCurrentStreet] = useState('Pre-Flop');

  // Create / dispose scene when expanded changes
  useEffect(() => {
    if (!expanded) {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      labelsRef.current.forEach((el) => el.remove());
      labelsRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const seatCount = players ? players.length : 10;
    sceneRef.current = createPokerScene(canvas, { seatCount });

    // Create seat name labels
    const labels = [];
    for (let i = 0; i < seatCount; i++) {
      const div = document.createElement('div');
      div.className = 'seat-label';
      div.setAttribute('data-testid', `seat-label-${i}`);
      div.style.cssText = 'position:absolute;pointer-events:none;color:#fff;font-size:12px;font-weight:600;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.8);';
      div.textContent = (players && players[i]) ? players[i].name : `Seat ${i + 1}`;
      wrapper.appendChild(div);
      labels.push(div);
    }
    labelsRef.current = labels;

    // Reproject labels when the user orbits/zooms
    const { controls, seatPositions, camera, renderer } = sceneRef.current;
    function repositionLabels() {
      const domEl = renderer.domElement;
      if (!domEl || !seatPositions) return;
      const cw = domEl.clientWidth || 1;
      const ch = domEl.clientHeight || 1;
      labels.forEach((label, i) => {
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
    if (controls) {
      controls.addEventListener('change', repositionLabels);
    }

    return () => {
      if (controls) {
        controls.removeEventListener('change', repositionLabels);
      }
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      labels.forEach((el) => el.remove());
      labelsRef.current = [];
    };
  }, [expanded, players?.length]);

  // Update scene + labels when cards or street change
  useEffect(() => {
    if (!sceneRef.current || !expanded) return;

    const seatPlayerMap = {};
    const playerHands = [];

    if (players) {
      players.forEach((p, i) => {
        seatPlayerMap[i] = p.name;
        playerHands.push({
          player_name: p.name,
          hole_cards: p.card1 && p.card2 ? [parseCard(p.card1), parseCard(p.card2)] : null,
          result: RESULT_MAP[p.status] || p.status,
        });
      });
    }

    const cardData = {
      flop: [parseCard(community?.flop1), parseCard(community?.flop2), parseCard(community?.flop3)],
      turn: parseCard(community?.turn),
      river: parseCard(community?.river),
      player_hands: playerHands,
    };

    const streetMap = { 'Pre-Flop': 0, 'Flop': 1, 'Turn': 2, 'River': 3, 'Showdown': 4 };
    const streetIndex = streetMap[currentStreet] ?? 0;

    sceneRef.current.update({ cardData, seatPlayerMap, streetIndex });

    // Update seat label positions + names
    const { seatPositions, camera, renderer } = sceneRef.current;
    const canvas = renderer.domElement;
    if (canvas && seatPositions) {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      labelsRef.current.forEach((label, i) => {
        if (players && players[i]) {
          label.textContent = players[i].name;
          label.style.opacity = '1';
        } else {
          label.textContent = `Seat ${i + 1}`;
          label.style.opacity = '0.3';
        }
        if (seatPositions[i] && seatPositions[i].clone) {
          const p = seatPositions[i].clone().project(camera);
          if (p.z > 1) { label.style.display = 'none'; return; }
          label.style.display = '';
          const x = (p.x * 0.5 + 0.5) * w;
          const y = (1 - (p.y * 0.5 + 0.5)) * h;
          label.style.left = `${x}px`;
          label.style.top = `${y}px`;
          label.style.transform = 'translate(-50%, -50%)';
        }
      });
    }
  }, [
    expanded,
    currentStreet,
    community?.flop1, community?.flop2, community?.flop3, community?.turn, community?.river,
    ...((players || []).flatMap((p) => [p.card1, p.card2, p.name, p.status])),
  ]);

  // Auto-advance street when new community cards come in
  useEffect(() => {
    if (community) {
      if (community.river) setCurrentStreet('River');
      else if (community.turn) setCurrentStreet('Turn');
      else if (community.flop1) setCurrentStreet('Flop');
      else setCurrentStreet('Pre-Flop');
    } else {
      setCurrentStreet('Pre-Flop');
    }
  }, [community?.flop1, community?.turn, community?.river]);

  // Calculate equity client-side based on current street
  useEffect(() => {
    const playersWithCards = (players || []).filter((p) => p.card1 && p.card2);
    if (playersWithCards.length < 2) {
      setEquityMap({});
      return;
    }

    const boardCards = communityForStreet(community, currentStreet);
    const holeCards = playersWithCards.map((p) => [parseCard(p.card1), parseCard(p.card2)]);

    try {
      const results = calculateEquity(holeCards, boardCards);
      const eqMap = {};
      playersWithCards.forEach((p, i) => {
        eqMap[p.name] = Math.round(results[i].equity * 100);
      });
      setEquityMap(eqMap);
    } catch {
      setEquityMap({});
    }
  }, [
    currentStreet,
    community?.flop1, community?.flop2, community?.flop3, community?.turn, community?.river,
    ...((players || []).flatMap((p) => [p.card1, p.card2])),
  ]);

  // ResizeObserver for responsive canvas + label reposition
  useEffect(() => {
    if (!expanded || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const observer = new ResizeObserver(() => {
      if (!sceneRef.current) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      sceneRef.current.renderer.setSize(w, h);
      sceneRef.current.camera.aspect = w / h;
      sceneRef.current.camera.updateProjectionMatrix();

      // Reposition labels on resize
      const { seatPositions, camera, renderer: r } = sceneRef.current;
      const domEl = r.domElement;
      if (domEl && seatPositions) {
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
    });

    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [expanded]);

  const hasEquity = Object.keys(equityMap).length > 0;

  // Build handData for the StreetScrubber
  const handData = {
    flop: community ? [community.flop1, community.flop2, community.flop3].filter(Boolean) : [],
    turn: community?.turn || null,
    river: community?.river || null,
  };

  return (
    <div style={containerStyle}>
      <button
        data-testid="preview-toggle"
        style={toggleStyle}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Hide Table' : 'Show Table'}
      </button>
      {expanded && (
        <div ref={wrapperRef} data-testid="preview-canvas-wrapper" style={canvasWrapperStyle}>
          <canvas ref={canvasRef} style={canvasStyle} />
        </div>
      )}
      {expanded && (
        <StreetScrubber
          currentStreet={currentStreet}
          handData={handData}
          onStreetChange={setCurrentStreet}
        />
      )}
      {expanded && hasEquity && (
        <div data-testid="equity-badges" style={badgeContainerStyle}>
          {(players || []).map((p) =>
            equityMap[p.name] != null ? (
              <span key={p.name} data-testid={`equity-badge-${p.name}`} style={badgeStyle}>
                {p.name}: {equityMap[p.name]}%
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

const containerStyle = {
  marginBottom: '1rem',
};

const toggleStyle = {
  padding: '0.5rem 1rem',
  fontSize: '0.9rem',
  cursor: 'pointer',
  borderRadius: '6px',
  border: '1px solid #2e303a',
  background: '#1e1f2b',
  color: '#e2e8f0',
  marginBottom: '0.5rem',
};

const canvasWrapperStyle = {
  width: '100%',
  borderRadius: '8px',
  overflow: 'hidden',
  position: 'relative',
};

const canvasStyle = {
  width: '100%',
  height: 'auto',
  aspectRatio: '4 / 3',
  display: 'block',
};

const badgeContainerStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  marginTop: '0.5rem',
};

const badgeStyle = {
  background: '#312e81',
  color: '#fff',
  padding: '0.25rem 0.75rem',
  borderRadius: '999px',
  fontSize: '0.85rem',
  fontWeight: '600',
};

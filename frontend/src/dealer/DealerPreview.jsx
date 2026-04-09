import { useState, useRef, useEffect } from 'preact/hooks';
import { createPokerScene } from '../scenes/pokerScene.js';
import { fetchEquity } from '../api/client.js';

export function DealerPreview({ community, players, gameId, handNumber }) {
  const [expanded, setExpanded] = useState(false);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [equities, setEquities] = useState(null);

  // Create / dispose scene when expanded changes
  useEffect(() => {
    if (!expanded) {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const seatCount = players ? players.length : 10;
    sceneRef.current = createPokerScene(canvas, { seatCount });

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, [expanded, players?.length]);

  // Update scene when cards change
  useEffect(() => {
    if (!sceneRef.current || !expanded) return;

    const seatPlayerMap = {};
    const cardData = { players: {} };

    if (players) {
      players.forEach((p, i) => {
        seatPlayerMap[i] = p.name;
        if (p.card1 || p.card2) {
          cardData.players[p.name] = { hole: [p.card1, p.card2].filter(Boolean) };
        }
      });
    }

    if (community) {
      const board = [community.flop1, community.flop2, community.flop3, community.turn, community.river].filter(Boolean);
      cardData.community = board;
    }

    let streetIndex = 0;
    if (community) {
      if (community.river) streetIndex = 3;
      else if (community.turn) streetIndex = 2;
      else if (community.flop1) streetIndex = 1;
    }

    sceneRef.current.update({ cardData, seatPlayerMap, streetIndex });
  }, [
    expanded,
    community?.flop1, community?.flop2, community?.flop3, community?.turn, community?.river,
    ...((players || []).flatMap((p) => [p.card1, p.card2])),
  ]);

  // Fetch equity when >=2 players have hole cards, or community cards change
  useEffect(() => {
    if (!gameId || !handNumber) {
      setEquities(null);
      return;
    }

    const playersWithCards = (players || []).filter((p) => p.card1 && p.card2);
    if (playersWithCards.length < 2) {
      setEquities(null);
      return;
    }

    let cancelled = false;
    fetchEquity(gameId, handNumber)
      .then((data) => {
        if (!cancelled) setEquities(data.equities);
      })
      .catch(() => {
        if (!cancelled) setEquities(null);
      });

    return () => { cancelled = true; };
  }, [
    gameId,
    handNumber,
    community?.flop1, community?.flop2, community?.flop3, community?.turn, community?.river,
    ...((players || []).flatMap((p) => [p.card1, p.card2])),
  ]);

  // ResizeObserver for responsive canvas
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
    });

    observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [expanded]);

  // Build equity lookup by player name
  const equityMap = {};
  if (equities) {
    equities.forEach((e) => { equityMap[e.player_name] = Math.round(e.equity * 100); });
  }

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
        <div data-testid="preview-canvas-wrapper" style={canvasWrapperStyle}>
          <canvas ref={canvasRef} style={canvasStyle} />
        </div>
      )}
      {expanded && equities && equities.length > 0 && (
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
  border: '1px solid #ccc',
  background: '#f0f0f0',
  marginBottom: '0.5rem',
};

const canvasWrapperStyle = {
  width: '100%',
  borderRadius: '8px',
  overflow: 'hidden',
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

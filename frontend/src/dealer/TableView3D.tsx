import { useRef, useEffect } from 'react';
import { createPokerScene } from '../scenes/pokerScene.ts';
import type { HandResponse } from '../api/types.ts';

/* ── Card-parsing helpers ─────────────────────────────────────── */

const SUIT_SYMBOL: Record<string, string> = {
  h: '♥', d: '♦', c: '♣', s: '♠',
  H: '♥', D: '♦', C: '♣', S: '♠',
};

interface ParsedCard {
  rank: string;
  suit: string;
}

function parseCard(cardStr: string | null | undefined): ParsedCard | null {
  if (!cardStr) return null;
  const rank = cardStr.slice(0, -1);
  const suitChar = cardStr.slice(-1);
  return { rank, suit: SUIT_SYMBOL[suitChar] || suitChar };
}

const RESULT_MAP: Record<string, string> = { won: 'win', folded: 'fold', lost: 'loss' };

function handToCardData(hand: HandResponse) {
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
    })),
  };
}

function computeStreetIndex(hand: HandResponse): number {
  if (hand.river) return 3;
  if (hand.turn) return 2;
  if (hand.flop_1) return 1;
  return 0;
}

function buildSeatPlayerMap(hand: HandResponse): Record<number, string> {
  const map: Record<number, string> = {};
  (hand.player_hands || []).forEach((ph, i) => {
    map[i] = ph.player_name;
  });
  return map;
}

/* ── Component ────────────────────────────────────────────────── */

export interface TableView3DProps {
  hands: HandResponse[];
}

export function TableView3D({ hands }: TableView3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef = useRef<any>(null);

  // Initialize scene on mount, dispose on unmount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pokerScene = createPokerScene(canvas, {
      width: canvas.clientWidth || 800,
      height: canvas.clientHeight || 600,
      externalResize: true,
    });
    sceneRef.current = pokerScene;

    // ResizeObserver for container-based resizing
    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            pokerScene.renderer.setSize(width, height);
            pokerScene.camera.aspect = width / height;
            pokerScene.camera.updateProjectionMatrix();
          }
        }
      });
      observer.observe(container);
    }

    return () => {
      observer?.disconnect();
      pokerScene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Update scene when hands change
  useEffect(() => {
    if (!sceneRef.current || hands.length === 0) return;

    const latestHand = hands[hands.length - 1];
    const cardData = handToCardData(latestHand);
    const seatPlayerMap = buildSeatPlayerMap(latestHand);
    const streetIndex = computeStreetIndex(latestHand);

    sceneRef.current.update({ cardData, seatPlayerMap, streetIndex });
  }, [hands]);

  return (
    <div
      ref={containerRef}
      data-testid="table-view-3d"
      style={{ width: '100%', height: 'min(400px, 50vh)', position: 'relative' }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

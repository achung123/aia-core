import type React from 'react';

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface EquityOverlayProps {
  seatCount: number;
  equityMap: Record<string, number>;
  seatPlayerMap: Record<number, string>;
  seatPositions?: ScreenPosition[];
}

const badgeBase: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  font: 'bold 12px monospace',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  padding: '2px 8px',
  borderRadius: '4px',
  color: '#fff',
  transition: 'background .25s, opacity .25s',
  transform: 'translate(-50%, 0)',
};

export function EquityOverlay({
  seatCount,
  equityMap,
  seatPlayerMap,
  seatPositions,
}: EquityOverlayProps) {
  const badges: React.ReactNode[] = [];

  for (let i = 0; i < seatCount; i++) {
    const name = seatPlayerMap[i];
    const eq = name !== undefined ? equityMap[name] : undefined;
    const hasEquity = eq !== undefined && eq !== null;

    const pct = hasEquity ? (eq * 100).toFixed(1) : '';
    const hue = hasEquity ? Math.round(eq * 120) : 0;

    const posStyle: React.CSSProperties = seatPositions?.[i]
      ? { left: `${seatPositions[i].x}px`, top: `${seatPositions[i].y}px` }
      : {};

    badges.push(
      <div
        key={i}
        className="equity-badge"
        style={{
          ...badgeBase,
          ...posStyle,
          display: hasEquity ? '' : 'none',
          background: hasEquity ? `hsla(${hue},70%,28%,0.88)` : undefined,
        }}
      >
        {hasEquity ? `${pct}%` : ''}
      </div>,
    );
  }

  return <>{badges}</>;
}

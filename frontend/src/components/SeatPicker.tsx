import type { CSSProperties } from 'react';

export interface SeatData {
  seatNumber: number;
  playerName: string | null;
}

export interface SeatPickerProps {
  seats: SeatData[];
  currentPlayerSeat: number | null;
  onSelect: (seatNumber: number) => void;
  onSkip: () => void;
}

/**
 * Compute (x, y) position for seat index on an oval.
 * Seats are laid out clockwise starting from the top.
 */
function seatPosition(index: number, total: number): { left: string; top: string } {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2; // start from top
  const rx = 42; // horizontal radius %
  const ry = 40; // vertical radius %
  const cx = 50;
  const cy = 50;
  return {
    left: `${cx + rx * Math.cos(angle)}%`,
    top: `${cy + ry * Math.sin(angle)}%`,
  };
}

export function SeatPicker({ seats, currentPlayerSeat, onSelect, onSkip }: SeatPickerProps) {
  // Build a full 10-seat array, filling in provided seats
  const seatMap = new Map(seats.map((s) => [s.seatNumber, s]));
  const allSeats: SeatData[] = [];
  for (let i = 1; i <= 10; i++) {
    allSeats.push(seatMap.get(i) || { seatNumber: i, playerName: null });
  }

  return (
    <div data-testid="seat-picker" style={styles.container}>
      <div style={styles.oval}>
        <div style={styles.tableLabel}>Table</div>
        {allSeats.map((seat, i) => {
          const pos = seatPosition(i, 10);
          const isOccupied = seat.playerName !== null;
          const isCurrent = seat.seatNumber === currentPlayerSeat;
          return (
            <button
              key={seat.seatNumber}
              data-testid={`seat-${seat.seatNumber}`}
              disabled={isOccupied}
              onClick={() => onSelect(seat.seatNumber)}
              style={{
                ...styles.seat,
                left: pos.left,
                top: pos.top,
                ...(isOccupied ? styles.seatOccupied : styles.seatOpen),
                ...(isCurrent ? styles.seatCurrent : {}),
              }}
              aria-label={
                isOccupied
                  ? `Seat ${seat.seatNumber}: ${seat.playerName}`
                  : `Seat ${seat.seatNumber}: Open`
              }
            >
              <span style={styles.seatNumber}>{seat.seatNumber}</span>
              <span style={styles.seatLabel}>
                {isOccupied ? seat.playerName : 'Open'}
              </span>
            </button>
          );
        })}
      </div>
      <button data-testid="skip-seat-btn" onClick={onSkip} style={styles.skipBtn}>
        Skip
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
  },
  oval: {
    position: 'relative',
    width: '320px',
    height: '280px',
  },
  tableLabel: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#64748b',
    pointerEvents: 'none',
  },
  seat: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontWeight: 600,
    border: '2px solid #c7d2fe',
    cursor: 'pointer',
    padding: '2px',
    WebkitTapHighlightColor: 'transparent',
  },
  seatOpen: {
    background: '#eef2ff',
    color: '#312e81',
    cursor: 'pointer',
  },
  seatOccupied: {
    background: '#e5e7eb',
    color: '#6b7280',
    cursor: 'not-allowed',
    opacity: 0.8,
  },
  seatCurrent: {
    border: '3px solid #4f46e5',
    boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.3)',
  },
  seatNumber: {
    fontSize: '0.65rem',
    opacity: 0.7,
  },
  seatLabel: {
    fontSize: '0.65rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '52px',
    textAlign: 'center',
  },
  skipBtn: {
    padding: '0.6rem 1.5rem',
    minHeight: '44px',
    fontSize: '0.95rem',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid #2e303a',
    background: '#1e1f2b',
    color: '#94a3b8',
    cursor: 'pointer',
  },
};

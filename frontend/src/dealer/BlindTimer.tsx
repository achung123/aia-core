import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchBlinds, updateBlinds } from '../api/client.ts';
import type { BlindsResponse } from '../api/types.ts';

export interface BlindTimerProps {
  gameId: number;
  onAdvanceBlinds?: () => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function BlindTimer({ gameId, onAdvanceBlinds }: BlindTimerProps) {
  const [blinds, setBlinds] = useState<BlindsResponse | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchBlinds(gameId)
      .then((data) => {
        setBlinds(data);
        setPaused(data.blind_timer_paused);
        if (data.blind_timer_remaining_seconds != null) {
          setRemaining(Math.max(0, data.blind_timer_remaining_seconds));
        } else {
          setRemaining(null);
        }
      })
      .catch(() => { /* ignore fetch errors */ });
  }, [gameId]);

  const shouldTick = remaining != null && remaining > 0 && !paused;

  useEffect(() => {
    if (!shouldTick) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev == null || prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [shouldTick]);

  const handlePauseResume = useCallback(async () => {
    const newPaused = !paused;
    try {
      const updated = await updateBlinds(gameId, { blind_timer_paused: newPaused });
      setPaused(updated.blind_timer_paused);
      if (updated.blind_timer_remaining_seconds != null) {
        setRemaining(Math.max(0, updated.blind_timer_remaining_seconds));
      }
    } catch {
      /* ignore errors */
    }
  }, [gameId, paused]);

  const handleReset = useCallback(async () => {
    if (!blinds) return;
    try {
      const updated = await updateBlinds(gameId, {
        small_blind: blinds.small_blind,
        big_blind: blinds.big_blind,
      });
      setPaused(updated.blind_timer_paused);
      if (updated.blind_timer_remaining_seconds != null) {
        setRemaining(Math.max(0, updated.blind_timer_remaining_seconds));
      }
    } catch {
      /* ignore errors */
    }
  }, [gameId, blinds]);

  const timerActive = remaining != null;
  const expired = remaining != null && remaining <= 0;

  return (
    <div data-testid="blind-timer-container" style={styles.container}>
      <span data-testid="blind-level" style={styles.level}>
        {blinds
          ? `Blinds: $${blinds.small_blind.toFixed(2)} / $${blinds.big_blind.toFixed(2)}`
          : 'Blinds: –'}
      </span>
      <span data-testid="blind-countdown" style={styles.countdown}>
        {timerActive ? formatTime(remaining) : '--:--'}
      </span>
      {timerActive && !expired && (
        <button
          data-testid="blind-pause-btn"
          style={styles.pauseBtn}
          onClick={handlePauseResume}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      )}
      {timerActive && !expired && (
        <button
          data-testid="blind-reset-btn"
          style={styles.pauseBtn}
          onClick={handleReset}
        >
          ↺ Reset
        </button>
      )}
      {expired && (
        <div data-testid="blind-advance-prompt" style={styles.advancePrompt}>
          <span>Time to advance blinds!</span>
          <button
            data-testid="blind-advance-btn"
            style={styles.advanceBtn}
            onClick={() => onAdvanceBlinds?.()}
          >
            Advance Blinds
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    background: '#1e1b4b',
    color: '#e0e7ff',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: 600,
    flexWrap: 'wrap',
  },
  level: {
    whiteSpace: 'nowrap',
  },
  countdown: {
    fontFamily: 'monospace',
    fontSize: '1.1rem',
    minWidth: '3.5rem',
    textAlign: 'center',
  },
  pauseBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: '#e0e7ff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '6px',
    padding: '0.25rem 0.6rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  advancePrompt: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#fbbf24',
    fontWeight: 700,
  },
  advanceBtn: {
    background: '#f59e0b',
    color: '#1e1b4b',
    border: 'none',
    borderRadius: '6px',
    padding: '0.3rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 700,
  },
};

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchBlinds, updateBlinds } from '../api/client.ts';
import type { BlindsResponse } from '../api/types';

export interface BlindTimerProps {
  gameId: number;
  onAdvanceBlinds?: () => void;
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function BlindTimer({ gameId, onAdvanceBlinds }: BlindTimerProps) {
  const [blinds, setBlinds] = useState<BlindsResponse | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editSB, setEditSB] = useState('');
  const [editBB, setEditBB] = useState('');
  const [editMinutes, setEditMinutes] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchBlinds(gameId)
      .then((data) => {
        setBlinds(data);
        setPaused(data.blind_timer_paused);
        setEditSB(String(data.small_blind));
        setEditBB(String(data.big_blind));
        setEditMinutes(String(data.blind_timer_minutes));
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

  const handleStart = useCallback(async () => {
    if (!blinds) return;
    try {
      const updated = await updateBlinds(gameId, {
        small_blind: blinds.small_blind,
        big_blind: blinds.big_blind,
      });
      setBlinds(updated);
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
  const WARNING_SECONDS = 60;
  const isWarning = remaining != null && remaining <= WARNING_SECONDS && remaining > 0;

  const handleSaveSettings = useCallback(async () => {
    const sb = parseFloat(editSB);
    const bb = parseFloat(editBB);
    const mins = parseFloat(editMinutes);
    if (isNaN(sb) || sb <= 0 || isNaN(bb) || bb <= 0) {
      setSettingsError('Blinds must be positive numbers');
      return;
    }
    if (isNaN(mins) || mins <= 0) {
      setSettingsError('Timer must be a positive number of minutes');
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const updated = await updateBlinds(gameId, { small_blind: sb, big_blind: bb, blind_timer_minutes: mins });
      setBlinds(updated);
      setPaused(updated.blind_timer_paused);
      if (updated.blind_timer_remaining_seconds != null) {
        setRemaining(Math.max(0, updated.blind_timer_remaining_seconds));
      }
      setShowSettings(false);
    } catch {
      setSettingsError('Failed to save blind settings');
    } finally {
      setSettingsSaving(false);
    }
  }, [gameId, editSB, editBB, editMinutes]);

  return (
    <div data-testid="blind-timer-container" style={styles.outerContainer}>
      {/* Clickable summary bar — shows blind level, countdown, and ⚙ toggle */}
      <button
        data-testid="blind-timer-toggle"
        style={styles.summaryBar}
        onClick={() => setShowSettings((prev) => !prev)}
      >
        <span data-testid="blind-level" style={styles.level}>
          {blinds
            ? `Blinds: $${blinds.small_blind.toFixed(2)} / $${blinds.big_blind.toFixed(2)}`
            : 'Blinds: –'}
        </span>
        <span
          data-testid="blind-countdown"
          style={{
            ...styles.countdown,
            ...(isWarning ? styles.countdownWarning : {}),
          }}
        >
          {timerActive ? formatTime(remaining) : '--:--'}
        </span>
        <span style={styles.settingsHint}>⚙</span>
      </button>

      {!timerActive && blinds && (
        <div style={styles.timerControls}>
          <button
            data-testid="blind-start-btn"
            style={styles.controlBtn}
            onClick={handleStart}
          >
            ▶ Start Timer
          </button>
        </div>
      )}

      {/* Timer controls — always visible when active */}
      {timerActive && !expired && (
        <div style={styles.timerControls}>
          <button
            data-testid="blind-pause-btn"
            style={styles.controlBtn}
            onClick={handlePauseResume}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button
            data-testid="blind-reset-btn"
            style={styles.controlBtn}
            onClick={handleReset}
          >
            ↺ Reset
          </button>
        </div>
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

      {/* Blind editing form — visible only when ⚙ is toggled */}
      {showSettings && (
        <div data-testid="blind-settings-panel" style={styles.settingsPanel}>
          <div style={styles.settingsForm}>
            <label style={styles.fieldLabel}>Small Blind ($)</label>
            <input
              data-testid="blind-sb-input"
              type="number"
              min="0.01"
              step="0.25"
              value={editSB}
              onChange={(e) => setEditSB(e.target.value)}
              style={styles.fieldInput}
            />
            <label style={styles.fieldLabel}>Big Blind ($)</label>
            <input
              data-testid="blind-bb-input"
              type="number"
              min="0.01"
              step="0.25"
              value={editBB}
              onChange={(e) => setEditBB(e.target.value)}
              style={styles.fieldInput}
            />
            <label style={styles.fieldLabel}>Timer (minutes)</label>
            <input
              data-testid="blind-minutes-input"
              type="number"
              min="1"
              step="1"
              value={editMinutes}
              onChange={(e) => setEditMinutes(e.target.value)}
              style={styles.fieldInput}
            />
            {settingsError && (
              <span data-testid="blind-settings-error" style={styles.settingsError}>{settingsError}</span>
            )}
            <div style={styles.settingsBtns}>
              <button
                data-testid="blind-settings-cancel"
                style={styles.cancelBtn}
                onClick={() => { setShowSettings(false); setSettingsError(null); }}
              >
                Cancel
              </button>
              <button
                data-testid="blind-settings-save"
                style={styles.saveBtn}
                onClick={handleSaveSettings}
                disabled={settingsSaving}
              >
                {settingsSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outerContainer: {
    width: '100%',
  },
  summaryBar: {
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
    width: '100%',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  settingsHint: {
    marginLeft: 'auto',
    fontSize: '1rem',
    opacity: 0.7,
  },
  settingsPanel: {
    marginTop: '0.4rem',
    padding: '0.75rem',
    background: '#1e1b4b',
    borderRadius: '10px',
  },
  timerControls: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '0.4rem',
  },
  controlBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: '#e0e7ff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '6px',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  settingsForm: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.4rem 0.75rem',
    alignItems: 'center',
  },
  fieldLabel: {
    color: '#c7d2fe',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  fieldInput: {
    padding: '0.3rem 0.5rem',
    borderRadius: '6px',
    border: '1px solid #4f46e5',
    fontSize: '0.9rem',
    background: '#312e81',
    color: '#e0e7ff',
    width: '100%',
  },
  settingsError: {
    gridColumn: '1 / -1',
    color: '#fca5a5',
    fontSize: '0.8rem',
  },
  settingsBtns: {
    gridColumn: '1 / -1',
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
    marginTop: '0.25rem',
  },
  cancelBtn: {
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'transparent',
    color: '#c7d2fe',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  saveBtn: {
    padding: '0.35rem 0.75rem',
    borderRadius: '6px',
    border: 'none',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 700,
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
  countdownWarning: {
    color: '#f59e0b',
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

import { useState, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../stores/playerStore';
import { useAwards } from '../hooks/useAnalytics';
import type React from 'react';

export function ProfileSettingsPage() {
  const playerName = usePlayerStore((state) => state.playerName);
  const selectedTitle = usePlayerStore((state) => state.selectedTitle);
  const setSelectedTitle = usePlayerStore((state) => state.setSelectedTitle);
  const navigate = useNavigate();
  const [name, setName] = useState(playerName ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: awards } = useAwards();
  const myAwards = awards?.filter((a) => a.winner_name === playerName) ?? [];

  if (!playerName) {
    return (
      <div data-testid="profile-settings-page" style={styles.page}>
        <h1 style={styles.heading}>Profile Settings</h1>
        <p style={styles.noProfile}>Select a profile first using the profile button in the navigation bar.</p>
      </div>
    );
  }

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      try {
        localStorage.setItem(`aia-avatar-${playerName}`, result);
      } catch {
        // localStorage quota exceeded — silently ignore
      }
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div data-testid="profile-settings-page" style={styles.page}>
      <h1 style={styles.heading}>Profile Settings</h1>

      <section style={styles.section}>
        <label style={styles.label} htmlFor="profile-name">Display Name</label>
        <input
          id="profile-name"
          data-testid="profile-name-input"
          style={styles.input}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          readOnly
        />
        <p style={styles.hint}>Name editing is not yet supported by the server.</p>
      </section>

      <section style={styles.section}>
        <label style={styles.label}>Profile Image</label>
        <div style={styles.avatarRow}>
          <div style={styles.avatarCircle}>
            {avatarPreview ? (
              <img data-testid="avatar-preview" src={avatarPreview} alt="Avatar" style={styles.avatarImg} />
            ) : (
              <span style={styles.avatarLetter}>{playerName[0].toUpperCase()}</span>
            )}
          </div>
          <button
            data-testid="upload-avatar-btn"
            type="button"
            style={styles.uploadBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Image
          </button>
          <input
            ref={fileInputRef}
            data-testid="avatar-file-input"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageChange}
          />
        </div>
      </section>

      <section style={styles.section}>
        <label style={styles.label}>Superlative Title</label>
        {myAwards.length === 0 ? (
          <p data-testid="no-titles" style={styles.hint}>You have no superlatives yet. Play more games to earn one!</p>
        ) : (
          <div data-testid="title-selector" style={styles.titleGrid}>
            <button
              data-testid="title-option-none"
              type="button"
              style={{
                ...styles.titleBtn,
                ...(selectedTitle === null ? styles.titleBtnActive : {}),
              }}
              onClick={() => setSelectedTitle(null)}
            >
              None
            </button>
            {myAwards.map((award) => (
              <button
                key={award.award_name}
                data-testid={`title-option-${award.award_name}`}
                type="button"
                style={{
                  ...styles.titleBtn,
                  ...(selectedTitle === award.emoji ? styles.titleBtnActive : {}),
                }}
                onClick={() => setSelectedTitle(award.emoji)}
              >
                {award.emoji} {award.award_name}
              </button>
            ))}
          </div>
        )}
      </section>

      <div style={styles.actions}>
        <button
          data-testid="save-profile-btn"
          type="button"
          style={styles.saveBtn}
          onClick={handleSave}
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
        <button
          data-testid="back-btn"
          type="button"
          style={styles.backBtn}
          onClick={() => navigate(-1)}
        >
          Back
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '1.5rem',
    maxWidth: 560,
    margin: '0 auto',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '1.5rem',
  },
  noProfile: {
    color: '#94a3b8',
    fontSize: '1rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#e2e8f0',
    marginBottom: '0.4rem',
  },
  input: {
    width: '100%',
    padding: '0.6rem 0.75rem',
    background: '#252540',
    color: '#e2e8f0',
    border: '1px solid #3730a3',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#64748b',
    marginTop: '0.3rem',
  },
  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  avatarLetter: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#fff',
  },
  uploadBtn: {
    padding: '0.5rem 1rem',
    background: '#252540',
    color: '#c7d2fe',
    border: '1px solid #3730a3',
    borderRadius: '8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '2rem',
  },
  saveBtn: {
    padding: '0.6rem 1.5rem',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  backBtn: {
    padding: '0.6rem 1.5rem',
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #3730a3',
    borderRadius: '8px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
  },
  titleGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  titleBtn: {
    padding: '0.5rem 1rem',
    background: '#252540',
    color: '#c7d2fe',
    border: '1px solid #3730a3',
    borderRadius: '8px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    transition: 'border-color 0.15s, background 0.15s',
  },
  titleBtnActive: {
    background: '#3730a3',
    borderColor: '#818cf8',
    color: '#fff',
  },
};

import { useRef, useState, useEffect } from 'preact/hooks';
import { uploadImage, getDetectionResults } from '../api/client.js';

export function CameraCapture({ gameId, targetName, onDetectionResult, onCancel }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function triggerInput() {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  }

  useEffect(() => {
    triggerInput();
  }, []);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) {
      onCancel();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const upload = await uploadImage(gameId, file);
      const detections = await getDetectionResults(gameId, upload.id);
      onDetectionResult(targetName, detections, file);
    } catch (err) {
      setError(err.message || 'Upload failed');
      setLoading(false);
    }
  }

  function handleRetry() {
    setError(null);
    triggerInput();
  }

  return (
    <div style={styles.overlay}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {!loading && !error && (
        <div style={styles.card}>
          <p style={styles.text}>Waiting for camera…</p>
          <button style={styles.cancelButton} onClick={onCancel}>Cancel</button>
        </div>
      )}

      {loading && !error && (
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.text}>Uploading &amp; detecting cards…</p>
        </div>
      )}

      {error && (
        <div style={styles.card}>
          <p style={styles.errorText}>{error}</p>
          <div style={styles.buttonRow}>
            <button style={styles.retryButton} onClick={handleRetry}>Retry</button>
            <button style={styles.cancelButton} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    textAlign: 'center',
    maxWidth: '320px',
    width: '90%',
  },
  spinner: {
    width: '40px',
    height: '40px',
    margin: '0 auto 1rem',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #4f46e5',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  text: {
    fontSize: '1rem',
    color: '#374151',
  },
  errorText: {
    fontSize: '1rem',
    color: '#dc2626',
    marginBottom: '1rem',
  },
  buttonRow: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
  },
  retryButton: {
    padding: '0.5rem 1.25rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '8px',
    background: '#4f46e5',
    color: '#fff',
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '0.5rem 1.25rem',
    minHeight: '48px',
    minWidth: '48px',
    fontSize: '1rem',
    fontWeight: 'bold',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    background: '#fff',
    color: '#374151',
    cursor: 'pointer',
  },
};

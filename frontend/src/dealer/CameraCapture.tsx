import { useRef, useState, useEffect } from 'react';
import { uploadImage, getDetectionResults } from '../api/client.ts';
import type { CardDetectionEntry } from '../api/types.ts';

export interface CameraCaptureProps {
  gameId: number;
  targetName: string;
  onDetectionResult: (targetName: string, detections: CardDetectionEntry[], file: File) => void;
  onCancel: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

type Phase = 'idle' | 'preview' | 'uploading' | 'error';

export function CameraCapture({ gameId, targetName, onDetectionResult, onCancel }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resolution, setResolution] = useState<string | null>(null);

  // Clean up blob URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function triggerInput(): void {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) {
      onCancel();
      return;
    }

    const url = URL.createObjectURL(file);
    setCapturedFile(file);
    setPreviewUrl(url);
    setResolution(null);
    setPhase('preview');
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>): void {
    const img = e.currentTarget;
    setResolution(`${img.naturalWidth} × ${img.naturalHeight}`);
  }

  async function handleUsePhoto(): Promise<void> {
    if (!capturedFile) return;

    setPhase('uploading');
    setError(null);

    try {
      const upload = await uploadImage(gameId, capturedFile);
      const detections = await getDetectionResults(gameId, upload.upload_id);
      onDetectionResult(targetName, detections.detections, capturedFile);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setError(message);
      setPhase('error');
    }
  }

  function handleRetake(): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedFile(null);
    setPreviewUrl(null);
    setResolution(null);
    setPhase('idle');
  }

  function handleRetry(): void {
    setError(null);
    setPhase('idle');
    triggerInput();
  }

  return (
    <div style={styles.overlay}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {phase === 'idle' && (
        <div style={styles.card}>
          <p style={styles.text}>Tap to open camera</p>
          <div style={styles.buttonRow}>
            <button style={styles.primaryButton} onClick={triggerInput}>Open Camera</button>
            <button style={styles.secondaryButton} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}

      {phase === 'preview' && previewUrl && capturedFile && (
        <div style={styles.previewCard}>
          <img
            src={previewUrl}
            alt="Captured preview"
            onLoad={handleImageLoad}
            style={styles.previewImage}
          />
          <div style={styles.infoRow}>
            <span style={styles.infoText}>{formatFileSize(capturedFile.size)}</span>
            {resolution && <span style={styles.infoText}>{resolution}</span>}
          </div>
          <div style={styles.buttonRow}>
            <button style={styles.primaryButton} onClick={handleUsePhoto}>Use Photo</button>
            <button style={styles.secondaryButton} onClick={handleRetake}>Retake</button>
          </div>
        </div>
      )}

      {phase === 'uploading' && (
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.text}>Uploading &amp; detecting cards…</p>
        </div>
      )}

      {phase === 'error' && (
        <div style={styles.card}>
          <p style={styles.errorText}>{error}</p>
          <div style={styles.buttonRow}>
            <button style={styles.primaryButton} onClick={handleRetry}>Retry</button>
            <button style={styles.secondaryButton} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
    textAlign: 'center' as const,
    maxWidth: '320px',
    width: '90%',
  },
  previewCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '1rem',
    textAlign: 'center' as const,
    maxWidth: '420px',
    width: '95%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '60vh',
    borderRadius: '8px',
    objectFit: 'contain' as const,
  },
  infoRow: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    margin: '0.5rem 0',
  },
  infoText: {
    fontSize: '0.85rem',
    color: '#6b7280',
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
  primaryButton: {
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
  secondaryButton: {
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

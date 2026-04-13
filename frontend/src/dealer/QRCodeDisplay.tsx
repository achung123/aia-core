import { useState, useEffect, type CSSProperties } from 'react';
import QRCode from 'qrcode';

export interface QRCodeDisplayProps {
  gameId: number;
  visible: boolean;
}

export function QRCodeDisplay({ gameId, visible }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const url = `${window.location.origin}/player?game=${gameId}`;
    QRCode.toDataURL(url, { width: 200, margin: 2 }).then(setDataUrl);
  }, [gameId, visible]);

  if (!visible) return null;

  const playerUrl = `${window.location.origin}/player?game=${gameId}`;

  return (
    <div data-testid="qr-code-display" style={styles.wrapper}>
      {dataUrl && (
        <img data-testid="qr-code-img" src={dataUrl} alt="QR code for player join link" style={styles.img} />
      )}
      <div style={styles.label}>{playerUrl}</div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.75rem',
    marginTop: '0.5rem',
  },
  img: {
    width: '200px',
    height: '200px',
  },
  label: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    marginTop: '0.5rem',
    wordBreak: 'break-all',
    textAlign: 'center',
  },
};

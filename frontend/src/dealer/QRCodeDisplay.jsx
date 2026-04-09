import { useState, useEffect } from 'preact/hooks';
import QRCode from 'qrcode';

export function QRCodeDisplay({ gameId, visible }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!visible) return;
    const url = `${window.location.origin}/#/player?game=${gameId}`;
    QRCode.toDataURL(url, { width: 200, margin: 2 }).then(setDataUrl);
  }, [gameId, visible]);

  if (!visible) return null;

  const playerUrl = `${window.location.origin}/#/player?game=${gameId}`;

  return (
    <div data-testid="qr-code-display" style={styles.wrapper}>
      {dataUrl && (
        <img data-testid="qr-code-img" src={dataUrl} alt="QR code for player join link" style={styles.img} />
      )}
      <div style={styles.label}>{playerUrl}</div>
    </div>
  );
}

const styles = {
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
    color: '#6b7280',
    marginTop: '0.5rem',
    wordBreak: 'break-all',
    textAlign: 'center',
  },
};

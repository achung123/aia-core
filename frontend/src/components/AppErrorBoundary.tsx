import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { theme } from '../theme';

interface Props {
  children: ReactNode;
  /** Changing this clears the error — pass the current route. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches anything a page throws while rendering, so a bug in one screen
 * shows a way out instead of a blank page. The nav bar sits outside it, so
 * the person can still move to another page; changing route clears it.
 *
 * It cannot catch errors in event handlers or promises — those are handled
 * where they happen.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Page crashed while rendering', error, info.componentStack);
  }

  componentDidUpdate(previous: Props): void {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <div role="alert" data-testid="app-error" style={box}>
        <h2 style={title}>Something went wrong on this page</h2>
        <p style={text}>
          The rest of the app is fine. Reload to try again, or head back to the
          start. Your game is saved on the server.
        </p>
        <div style={buttons}>
          <button data-testid="app-error-reload" style={button} onClick={() => window.location.reload()}>
            Reload
          </button>
          <a data-testid="app-error-home" style={{ ...button, textDecoration: 'none' }} href="#/">
            Go to start
          </a>
        </div>
        <details style={details}>
          <summary>Details</summary>
          <pre data-testid="app-error-details" style={pre}>{error.message}</pre>
        </details>
      </div>
    );
  }
}

const box: CSSProperties = {
  maxWidth: 480,
  margin: '3rem auto',
  padding: '1.25rem',
  borderRadius: 8,
  background: theme.accentSurface,
  border: `1px solid ${theme.accentPressed}`,
  color: theme.accentSoft,
  fontFamily: 'system-ui, sans-serif',
};
const title: CSSProperties = { margin: '0 0 0.5rem', fontSize: '1.15rem' };
const text: CSSProperties = { margin: '0 0 1rem', color: theme.accentSoft, lineHeight: 1.45 };
const buttons: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const button: CSSProperties = {
  minHeight: 44,
  padding: '0 16px',
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 8,
  border: `1px solid ${theme.accent}`,
  background: theme.accentSurfaceStrong,
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.95rem',
};
const details: CSSProperties = { marginTop: '1rem', color: theme.accentText, fontSize: '0.85rem' };
const pre: CSSProperties = { whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0.5rem 0 0' };

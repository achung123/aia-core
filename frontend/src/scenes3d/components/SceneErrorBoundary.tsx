// Regression guard for the 3D scene.
//
// Runtime errors inside `<PokerCanvas>` children (bad geometry args, null
// derefs in scene composition, Three.js WebGL init failures, etc.) bubble
// up through `<Canvas>` and then through the React router root. React 18
// treats any uncaught render error as fatal and unmounts the entire app,
// which is exactly the "slider flashes for a split second then the whole
// page goes gray" symptom reported on both desktop and mobile.
//
// This boundary catches those errors, keeps the surrounding UI (nav bar,
// playback controls, back button) rendered, and surfaces a human-readable
// message on screen so failures are debuggable without opening devtools —
// which isn't possible on mobile.
//
// The SceneErrorOverlay is rendered as a *sibling* of the Canvas (via a
// shared ref-count'd module-level error slot) so the visible error is in
// real DOM, not in the R3F scene graph. Inside the Canvas we only render
// an empty `<group/>` so WebGL keeps a live clear color.

import {
  Component,
  createContext,
  useContext,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface SceneError {
  message: string;
  stack?: string;
  componentStack?: string;
}

// ---------------------------------------------------------------------------
// Module-level pub/sub so a boundary *inside* the Canvas can notify DOM
// consumers *outside* the Canvas without crossing the reconciler boundary.
// ---------------------------------------------------------------------------

type Listener = (e: SceneError | null) => void;
const listeners = new Set<Listener>();
let currentError: SceneError | null = null;

export function publishSceneError(e: SceneError | null): void {
  currentError = e;
  for (const l of listeners) l(e);
}

export function subscribeSceneError(l: Listener): () => void {
  listeners.add(l);
  l(currentError);
  return () => {
    listeners.delete(l);
  };
}

// ---------------------------------------------------------------------------
// Class-based boundary. Must live inside <Canvas> so it catches throws in
// the R3F scene. Renders an empty R3F group as the fallback so WebGL state
// stays valid while the DOM overlay surfaces the error.
// ---------------------------------------------------------------------------

interface SceneErrorBoundaryProps {
  children: ReactNode;
  /** Test hook — render a visible R3F fallback rather than an empty group. */
  testFallback?: ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Also log — developers inspecting the console still see the raw stack.
    // eslint-disable-next-line no-console
    console.error('[SceneErrorBoundary]', error, info);
    publishSceneError({
      message: error.message || String(error),
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Empty group keeps the R3F reconciler happy; the visible error
      // message is rendered *outside* the Canvas by <SceneErrorOverlay>.
      return (
        this.props.testFallback ?? (
          // eslint-disable-next-line react/no-unknown-property
          <group name="poker-scene-error-fallback" />
        )
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// DOM-side overlay. Renders nothing while the scene is healthy; renders a
// fixed-position panel with the error message when something throws.
// ---------------------------------------------------------------------------

export function SceneErrorOverlay() {
  const [err, setErr] = useState<SceneError | null>(currentError);
  useEffect(() => subscribeSceneError(setErr), []);

  if (!err) return null;
  return (
    <div
      role="alert"
      data-testid="scene-error-overlay"
      style={{
        position: 'fixed',
        top: 72,
        left: 12,
        right: 12,
        zIndex: 2000,
        padding: '12px 14px',
        borderRadius: 8,
        background: 'rgba(127, 29, 29, 0.95)',
        color: '#fff',
        font: '13px/1.35 system-ui, -apple-system, sans-serif',
        boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
        maxHeight: '60vh',
        overflow: 'auto',
        whiteSpace: 'pre-wrap',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 4 }}>
        3D scene error
      </strong>
      <div>{err.message}</div>
      {err.stack && (
        <details style={{ marginTop: 8, opacity: 0.9 }} open>
          <summary style={{ cursor: 'pointer' }}>JS stack</summary>
          <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap' }}>
            {err.stack}
          </pre>
        </details>
      )}
      {err.componentStack && (
        <details style={{ marginTop: 8, opacity: 0.85 }}>
          <summary style={{ cursor: 'pointer' }}>Component stack</summary>
          <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap' }}>
            {err.componentStack}
          </pre>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Context so tests can verify the boundary wraps children without reaching
// into React internals.
// ---------------------------------------------------------------------------

export const SceneErrorBoundaryContext = createContext<true | null>(null);

export function useInsideSceneErrorBoundary(): boolean {
  return useContext(SceneErrorBoundaryContext) === true;
}

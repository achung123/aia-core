/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// happy-dom has no WebGL. Mock the R3F <Canvas> so mounting doesn't try to
// acquire a WebGL context. The mock captures the props it received so we can
// assert that <PokerCanvas> forwards baseline camera, gl, and dpr defaults.
const canvasPropsSpy = vi.fn<(props: Record<string, unknown>) => void>();

// Silence React's "unknown DOM tag" warnings for R3F intrinsic elements
// (ambientLight, directionalLight). They only leak through because we render
// the mocked Canvas children into real happy-dom. They are not real failures.
const R3F_TAG_WARNING = /is using incorrect casing|is unrecognized in this browser/;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  consoleErrorSpy = vi
    .spyOn(console, 'error')
    .mockImplementation((msg: unknown, ...rest: unknown[]) => {
      if (typeof msg === 'string' && R3F_TAG_WARNING.test(msg)) return;
      // Preserve real errors for debugging.
      // eslint-disable-next-line no-console
      console.warn('[unexpected console.error]', msg, ...rest);
    });
});
afterAll(() => {
  consoleErrorSpy.mockRestore();
});

vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [key: string]: unknown;
  }) => {
    canvasPropsSpy(props);
    return (
      <div data-testid="mock-r3f-canvas" className={props.className as string}>
        {children}
      </div>
    );
  },
}));

import { PokerCanvas } from '../../src/scenes3d/PokerCanvas';
import { useTableStore } from '../../src/scenes3d/state/tableStore';

afterEach(() => {
  cleanup();
  canvasPropsSpy.mockClear();
});

describe('<PokerCanvas>', () => {
  it('mounts without errors', () => {
    expect(() => render(<PokerCanvas />)).not.toThrow();
  });

  it('renders the R3F <Canvas>', () => {
    const { getByTestId } = render(<PokerCanvas />);
    expect(getByTestId('mock-r3f-canvas')).toBeInTheDocument();
  });

  it('caps dpr at [1, 2] by default', () => {
    render(<PokerCanvas />);
    expect(canvasPropsSpy).toHaveBeenCalledTimes(1);
    const props = canvasPropsSpy.mock.calls[0][0];
    expect(props.dpr).toEqual([1, 2]);
  });

  it('forwards a custom dpr prop', () => {
    render(<PokerCanvas dpr={1} />);
    const props = canvasPropsSpy.mock.calls[0][0];
    expect(props.dpr).toBe(1);
  });

  it('configures a PerspectiveCamera via the camera prop', () => {
    render(<PokerCanvas />);
    const props = canvasPropsSpy.mock.calls[0][0] as {
      camera: { position: number[]; fov: number };
    };
    expect(props.camera).toBeDefined();
    expect(props.camera.fov).toBe(45);
    expect(Array.isArray(props.camera.position)).toBe(true);
    expect(props.camera.position).toHaveLength(3);
  });

  it('configures gl options with antialias + high-performance', () => {
    render(<PokerCanvas />);
    const props = canvasPropsSpy.mock.calls[0][0] as {
      gl: { antialias: boolean; powerPreference: string };
    };
    expect(props.gl.antialias).toBe(true);
    expect(props.gl.powerPreference).toBe('high-performance');
  });

  it('renders ambient + directional lights inside the canvas', () => {
    const { container } = render(<PokerCanvas />);
    // R3F intrinsic elements don't render as real DOM nodes, but our mock
    // passes children through. React will render intrinsic lowercase tags
    // (ambientLight, directionalLight) as unknown DOM elements in happy-dom.
    expect(container.querySelector('ambientLight')).not.toBeNull();
    expect(container.querySelector('directionalLight')).not.toBeNull();
  });

  it('renders children passed to it', () => {
    const { getByTestId } = render(
      <PokerCanvas>
        <div data-testid="child-scene">scene</div>
      </PokerCanvas>,
    );
    expect(getByTestId('child-scene')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// T-038 Item-1 — Canvas-level shadow enablement (Cycle 38 M-2)
// ---------------------------------------------------------------------------
describe('<PokerCanvas> — T-038 canvas shadows gating (reads qualityTier from useTableStore)', () => {
  it('enables <Canvas shadows> when qualityTier === "high"', () => {
    useTableStore.setState({ qualityTier: 'high' });
    render(<PokerCanvas />);
    const props = canvasPropsSpy.mock.calls[0][0];
    expect(props.shadows).toBe(true);
  });

  it('omits shadows prop when qualityTier === "medium" (T-014 AC-4 has runtime effect)', () => {
    useTableStore.setState({ qualityTier: 'medium' });
    render(<PokerCanvas />);
    const props = canvasPropsSpy.mock.calls[0][0];
    // Falsy value — either explicitly false or undefined. Either way the
    // renderer won't allocate a shadow-map framebuffer.
    expect(Boolean(props.shadows)).toBe(false);
  });

  it('omits shadows prop when qualityTier === "low"', () => {
    useTableStore.setState({ qualityTier: 'low' });
    render(<PokerCanvas />);
    const props = canvasPropsSpy.mock.calls[0][0];
    expect(Boolean(props.shadows)).toBe(false);
  });
});

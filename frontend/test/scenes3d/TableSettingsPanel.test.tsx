/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { TableSettingsPanel } from '../../src/scenes3d/components/TableSettingsPanel';
import {
  useTableStore,
  DEFAULT_THEME,
  FELT_COLORS,
  CARD_BACKS,
} from '../../src/scenes3d/state/tableStore';

beforeEach(() => {
  useTableStore.setState({
    theme: { ...DEFAULT_THEME },
    qualityTier: 'medium',
    manualOverride: false,
  });
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe('<TableSettingsPanel> (T-015)', () => {
  it('renders one swatch button per felt color (AC 1)', () => {
    const { getAllByTestId } = render(<TableSettingsPanel />);
    const swatches = getAllByTestId(/^felt-swatch-/);
    expect(swatches).toHaveLength(FELT_COLORS.length);
  });

  it('renders one option per card back (AC 1)', () => {
    const { getAllByTestId } = render(<TableSettingsPanel />);
    const backs = getAllByTestId(/^card-back-/);
    expect(backs).toHaveLength(CARD_BACKS.length);
  });

  it('renders dark + light mode toggle buttons (AC 1)', () => {
    const { getByTestId } = render(<TableSettingsPanel />);
    expect(getByTestId('mode-dark')).toBeTruthy();
    expect(getByTestId('mode-light')).toBeTruthy();
  });

  it('clicking a felt swatch updates the store (AC 3)', () => {
    const { getByTestId } = render(<TableSettingsPanel />);
    const target = FELT_COLORS.find(
      (f) => f.hex !== useTableStore.getState().theme.feltColor,
    )!;
    fireEvent.click(getByTestId(`felt-swatch-${target.id}`));
    expect(useTableStore.getState().theme.feltColor).toBe(target.hex);
  });

  it('clicking a card back updates the store (AC 3)', () => {
    const { getByTestId } = render(<TableSettingsPanel />);
    const target = CARD_BACKS.find(
      (c) => c.id !== useTableStore.getState().theme.cardBack,
    )!;
    fireEvent.click(getByTestId(`card-back-${target.id}`));
    expect(useTableStore.getState().theme.cardBack).toBe(target.id);
  });

  it('clicking mode toggles the store (AC 3)', () => {
    const { getByTestId } = render(<TableSettingsPanel />);
    fireEvent.click(getByTestId('mode-light'));
    expect(useTableStore.getState().theme.mode).toBe('light');
    fireEvent.click(getByTestId('mode-dark'));
    expect(useTableStore.getState().theme.mode).toBe('dark');
  });

  it('marks the active felt with aria-pressed="true"', () => {
    const activeHex = useTableStore.getState().theme.feltColor;
    const activeId = FELT_COLORS.find((f) => f.hex === activeHex)!.id;
    const { getByTestId } = render(<TableSettingsPanel />);
    expect(getByTestId(`felt-swatch-${activeId}`).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('re-renders in response to external store changes (AC 3)', () => {
    const { getByTestId } = render(<TableSettingsPanel />);
    // simulate programmatic theme change (as another mounted panel would do)
    const other = FELT_COLORS.find(
      (f) => f.hex !== useTableStore.getState().theme.feltColor,
    )!;
    act(() => {
      useTableStore.getState().setTheme({ feltColor: other.hex });
    });
    expect(getByTestId(`felt-swatch-${other.id}`).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('exposes an accessible region label (AC 4)', () => {
    const { getByRole } = render(<TableSettingsPanel />);
    const region = getByRole('region');
    expect(region.getAttribute('aria-label')).toMatch(/theme|settings/i);
  });

  it('renders nothing when hidden', () => {
    const { container } = render(<TableSettingsPanel hidden />);
    expect(container.firstChild).toBeNull();
  });
});

describe('<TableSettingsPanel> — T-038 Item-3 tier dropdown (T-027 AC-4)', () => {
  it('renders one button per quality tier (low / medium / high)', () => {
    const { getByTestId } = render(<TableSettingsPanel />);
    expect(getByTestId('tier-low')).toBeTruthy();
    expect(getByTestId('tier-medium')).toBeTruthy();
    expect(getByTestId('tier-high')).toBeTruthy();
  });

  it('marks the active tier with aria-pressed="true"', () => {
    useTableStore.setState({ qualityTier: 'high' });
    const { getByTestId } = render(<TableSettingsPanel />);
    expect(getByTestId('tier-high').getAttribute('aria-pressed')).toBe('true');
    expect(getByTestId('tier-low').getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a tier calls setTier with the chosen tier', () => {
    useTableStore.setState({ qualityTier: 'medium' });
    const { getByTestId } = render(<TableSettingsPanel />);
    fireEvent.click(getByTestId('tier-low'));
    expect(useTableStore.getState().qualityTier).toBe('low');
    fireEvent.click(getByTestId('tier-high'));
    expect(useTableStore.getState().qualityTier).toBe('high');
  });

  it('clicking a tier flips manualOverride to true (T-027 AC-4)', () => {
    useTableStore.setState({ qualityTier: 'medium', manualOverride: false });
    const { getByTestId } = render(<TableSettingsPanel />);
    expect(useTableStore.getState().manualOverride).toBe(false);
    fireEvent.click(getByTestId('tier-low'));
    expect(useTableStore.getState().manualOverride).toBe(true);
  });

  it('re-renders in response to external tier changes', () => {
    useTableStore.setState({ qualityTier: 'medium' });
    const { getByTestId } = render(<TableSettingsPanel />);
    expect(getByTestId('tier-medium').getAttribute('aria-pressed')).toBe('true');
    act(() => {
      useTableStore.getState().setTier('low');
    });
    expect(getByTestId('tier-low').getAttribute('aria-pressed')).toBe('true');
    expect(getByTestId('tier-medium').getAttribute('aria-pressed')).toBe('false');
  });
});

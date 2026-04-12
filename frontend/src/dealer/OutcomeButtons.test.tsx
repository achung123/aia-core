import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { OutcomeButtons } from './OutcomeButtons.tsx';
import type { OutcomeButtonsProps } from './OutcomeButtons.tsx';

afterEach(cleanup);

describe('OutcomeButtons', () => {
  const defaultProps: OutcomeButtonsProps = {
    playerName: 'Alice',
    onSelect: vi.fn(),
    error: null,
    submitting: false,
  };

  it('renders four outcome buttons: Won, Folded, Lost, Not Playing', () => {
    render(<OutcomeButtons {...defaultProps} />);
    expect(screen.getByText('Won')).toBeDefined();
    expect(screen.getByText('Folded')).toBeDefined();
    expect(screen.getByText('Lost')).toBeDefined();
    expect(screen.getByText('Not Playing')).toBeDefined();
  });

  it('displays the player name', () => {
    render(<OutcomeButtons {...defaultProps} />);
    expect(screen.getByText(/Alice/)).toBeDefined();
  });

  it('Won button has green background', () => {
    render(<OutcomeButtons {...defaultProps} />);
    const btn = screen.getByText('Won');
    expect(btn.style.backgroundColor).toBe('#16a34a');
  });

  it('Folded button has red background', () => {
    render(<OutcomeButtons {...defaultProps} />);
    const btn = screen.getByText('Folded');
    expect(btn.style.backgroundColor).toBe('#dc2626');
  });

  it('Lost button has orange background', () => {
    render(<OutcomeButtons {...defaultProps} />);
    const btn = screen.getByText('Lost');
    expect(btn.style.backgroundColor).toBe('#ea580c');
  });

  it('does not call onSelect immediately when Won is clicked (awaits street)', () => {
    const onSelect = vi.fn();
    render(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Won'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect immediately when Folded is clicked (awaits street)', () => {
    const onSelect = vi.fn();
    render(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Folded'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect immediately when Lost is clicked (awaits street)', () => {
    const onSelect = vi.fn();
    render(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Lost'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows error message when error prop is set', () => {
    render(<OutcomeButtons {...defaultProps} error="Network error" />);
    expect(screen.getByText('Network error')).toBeDefined();
  });

  it('buttons remain enabled when error is shown', () => {
    render(<OutcomeButtons {...defaultProps} error="Network error" />);
    expect((screen.getByText('Won') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText('Folded') as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByText('Lost') as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables buttons when submitting', () => {
    render(<OutcomeButtons {...defaultProps} submitting={true} />);
    expect((screen.getByText('Won') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Folded') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Lost') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Not Playing') as HTMLButtonElement).disabled).toBe(true);
  });

  it('includes a back/cancel button', () => {
    const onCancel = vi.fn();
    render(<OutcomeButtons {...defaultProps} onCancel={onCancel} />);
    const cancelBtn = screen.getByText('Back');
    expect(cancelBtn).toBeDefined();
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();
  });

  describe('street selection', () => {
    it('Not Playing calls onSelect immediately with no street', () => {
      const onSelect = vi.fn();
      render(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
      fireEvent.click(screen.getByText('Not Playing'));
      expect(onSelect).toHaveBeenCalledWith('not_playing', null);
    });

    it('shows street buttons (Pre-Flop, Flop, Turn, River) after selecting an outcome', async () => {
      render(<OutcomeButtons {...defaultProps} />);
      fireEvent.click(screen.getByText('Won'));
      await waitFor(() => {
        expect(screen.getByText('Pre-Flop')).toBeDefined();
        expect(screen.getByText('Flop')).toBeDefined();
        expect(screen.getByText('Turn')).toBeDefined();
        expect(screen.getByText('River')).toBeDefined();
      });
    });

    it('calls onSelect with result and street after selecting street', async () => {
      const onSelect = vi.fn();
      render(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
      fireEvent.click(screen.getByText('Folded'));
      await waitFor(() => {
        expect(screen.getByText('Flop')).toBeDefined();
      });
      expect(onSelect).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Flop'));
      expect(onSelect).toHaveBeenCalledWith('folded', 'flop');
    });

    it('calls onSelect with won and river', async () => {
      const onSelect = vi.fn();
      render(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
      fireEvent.click(screen.getByText('Won'));
      await waitFor(() => {
        expect(screen.getByText('River')).toBeDefined();
      });
      fireEvent.click(screen.getByText('River'));
      expect(onSelect).toHaveBeenCalledWith('won', 'river');
    });

    it('calls onSelect with lost and turn', async () => {
      const onSelect = vi.fn();
      render(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
      fireEvent.click(screen.getByText('Lost'));
      await waitFor(() => {
        expect(screen.getByText('Turn')).toBeDefined();
      });
      fireEvent.click(screen.getByText('Turn'));
      expect(onSelect).toHaveBeenCalledWith('lost', 'turn');
    });

    it('hides outcome buttons and shows street buttons after outcome click', async () => {
      render(<OutcomeButtons {...defaultProps} />);
      fireEvent.click(screen.getByText('Won'));
      await waitFor(() => {
        expect(screen.getByText('Flop')).toBeDefined();
      });
      expect(screen.queryByText('Won')).toBeNull();
      expect(screen.queryByText('Folded')).toBeNull();
      expect(screen.queryByText('Lost')).toBeNull();
    });
  });
});

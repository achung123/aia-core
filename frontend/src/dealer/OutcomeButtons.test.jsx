/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest';
import { render } from 'preact';
import { OutcomeButtons } from './OutcomeButtons.jsx';

function renderToContainer(vnode) {
  const container = document.createElement('div');
  render(vnode, container);
  return container;
}

function findButton(container, text) {
  return Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent.includes(text),
  );
}

describe('OutcomeButtons', () => {
  const defaultProps = {
    playerName: 'Alice',
    onSelect: vi.fn(),
    error: null,
    submitting: false,
  };

  it('renders four outcome buttons: Won, Folded, Lost, Not Playing', () => {
    const container = renderToContainer(<OutcomeButtons {...defaultProps} />);
    expect(findButton(container, 'Won')).not.toBeNull();
    expect(findButton(container, 'Folded')).not.toBeNull();
    expect(findButton(container, 'Lost')).not.toBeNull();
    expect(findButton(container, 'Not Playing')).not.toBeNull();
  });

  it('displays the player name', () => {
    const container = renderToContainer(<OutcomeButtons {...defaultProps} />);
    expect(container.textContent).toContain('Alice');
  });

  it('Won button has green background', () => {
    const container = renderToContainer(<OutcomeButtons {...defaultProps} />);
    const btn = findButton(container, 'Won');
    expect(btn.style.backgroundColor).toBe('#16a34a');
  });

  it('Folded button has red background', () => {
    const container = renderToContainer(<OutcomeButtons {...defaultProps} />);
    const btn = findButton(container, 'Folded');
    expect(btn.style.backgroundColor).toBe('#dc2626');
  });

  it('Lost button has orange background', () => {
    const container = renderToContainer(<OutcomeButtons {...defaultProps} />);
    const btn = findButton(container, 'Lost');
    expect(btn.style.backgroundColor).toBe('#ea580c');
  });

  it('does not call onSelect immediately when Won is clicked (awaits street)', () => {
    const onSelect = vi.fn();
    const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    findButton(container, 'Won').click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect immediately when Folded is clicked (awaits street)', () => {
    const onSelect = vi.fn();
    const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    findButton(container, 'Folded').click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect immediately when Lost is clicked (awaits street)', () => {
    const onSelect = vi.fn();
    const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    findButton(container, 'Lost').click();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows error message when error prop is set', () => {
    const container = renderToContainer(
      <OutcomeButtons {...defaultProps} error="Network error" />,
    );
    expect(container.textContent).toContain('Network error');
  });

  it('buttons remain enabled when error is shown', () => {
    const container = renderToContainer(
      <OutcomeButtons {...defaultProps} error="Network error" />,
    );
    expect(findButton(container, 'Won').disabled).toBe(false);
    expect(findButton(container, 'Folded').disabled).toBe(false);
    expect(findButton(container, 'Lost').disabled).toBe(false);
  });

  it('disables buttons when submitting', () => {
    const container = renderToContainer(
      <OutcomeButtons {...defaultProps} submitting={true} />,
    );
    expect(findButton(container, 'Won').disabled).toBe(true);
    expect(findButton(container, 'Folded').disabled).toBe(true);
    expect(findButton(container, 'Lost').disabled).toBe(true);
    expect(findButton(container, 'Not Playing').disabled).toBe(true);
  });

  it('includes a back/cancel button', () => {
    const onCancel = vi.fn();
    const container = renderToContainer(
      <OutcomeButtons {...defaultProps} onCancel={onCancel} />,
    );
    const cancelBtn = findButton(container, 'Back');
    expect(cancelBtn).not.toBeNull();
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalled();
  });

  describe('street selection', () => {
    it('Not Playing calls onSelect immediately with no street', () => {
      const onSelect = vi.fn();
      const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
      findButton(container, 'Not Playing').click();
      expect(onSelect).toHaveBeenCalledWith('not_playing', null);
    });

    it('shows street buttons (Flop, Turn, River) after selecting an outcome', async () => {
      const container = renderToContainer(<OutcomeButtons {...defaultProps} />);
      findButton(container, 'Won').click();
      await vi.waitFor(() => {
        expect(findButton(container, 'Flop')).not.toBeUndefined();
        expect(findButton(container, 'Turn')).not.toBeUndefined();
        expect(findButton(container, 'River')).not.toBeUndefined();
      });
    });

    it('calls onSelect with result and street after selecting street', async () => {
      const onSelect = vi.fn();
      const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
      findButton(container, 'Folded').click();
      await vi.waitFor(() => {
        expect(findButton(container, 'Flop')).not.toBeUndefined();
      });
      // onSelect should NOT have been called yet (waiting for street)
      expect(onSelect).not.toHaveBeenCalled();
      findButton(container, 'Flop').click();
      expect(onSelect).toHaveBeenCalledWith('folded', 'flop');
    });

    it('calls onSelect with won and river', async () => {
      const onSelect = vi.fn();
      const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
      findButton(container, 'Won').click();
      await vi.waitFor(() => {
        expect(findButton(container, 'River')).not.toBeUndefined();
      });
      findButton(container, 'River').click();
      expect(onSelect).toHaveBeenCalledWith('won', 'river');
    });

    it('calls onSelect with lost and turn', async () => {
      const onSelect = vi.fn();
      const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
      findButton(container, 'Lost').click();
      await vi.waitFor(() => {
        expect(findButton(container, 'Turn')).not.toBeUndefined();
      });
      findButton(container, 'Turn').click();
      expect(onSelect).toHaveBeenCalledWith('lost', 'turn');
    });

    it('hides outcome buttons and shows street buttons after outcome click', async () => {
      const container = renderToContainer(<OutcomeButtons {...defaultProps} />);
      findButton(container, 'Won').click();
      await vi.waitFor(() => {
        // Street buttons should be shown
        expect(findButton(container, 'Flop')).not.toBeUndefined();
      });
      // Outcome buttons should be gone
      expect(findButton(container, 'Won')).toBeUndefined();
      expect(findButton(container, 'Folded')).toBeUndefined();
      expect(findButton(container, 'Lost')).toBeUndefined();
    });
  });
});

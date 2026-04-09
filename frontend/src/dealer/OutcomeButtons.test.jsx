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

  it('renders three outcome buttons: Won, Folded, Lost', () => {
    const container = renderToContainer(<OutcomeButtons {...defaultProps} />);
    expect(findButton(container, 'Won')).not.toBeNull();
    expect(findButton(container, 'Folded')).not.toBeNull();
    expect(findButton(container, 'Lost')).not.toBeNull();
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

  it('calls onSelect with "won" when Won is clicked', () => {
    const onSelect = vi.fn();
    const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    findButton(container, 'Won').click();
    expect(onSelect).toHaveBeenCalledWith('won');
  });

  it('calls onSelect with "folded" when Folded is clicked', () => {
    const onSelect = vi.fn();
    const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    findButton(container, 'Folded').click();
    expect(onSelect).toHaveBeenCalledWith('folded');
  });

  it('calls onSelect with "lost" when Lost is clicked', () => {
    const onSelect = vi.fn();
    const container = renderToContainer(<OutcomeButtons {...defaultProps} onSelect={onSelect} />);
    findButton(container, 'Lost').click();
    expect(onSelect).toHaveBeenCalledWith('lost');
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
});

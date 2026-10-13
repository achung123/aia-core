import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(() => Promise.resolve('data:image/png;base64,FAKE')),
  },
}));

import QRCode from 'qrcode';
import { QRCodeDisplay } from '../../src/../src/dealer/QRCodeDisplay.tsx';

afterEach(cleanup);

describe('QRCodeDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when not visible', () => {
    render(<QRCodeDisplay gameId={42} visible={false} />);
    expect(screen.queryByTestId('qr-code-display')).toBeNull();
  });

  it('calls QRCode.toDataURL with the correct game URL when visible', async () => {
    await act(async () => {
      render(<QRCodeDisplay gameId={42} visible={true} />);
    });
    const expectedUrl = `${window.location.origin}/player?game=42`;
    expect(QRCode.toDataURL).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
  });

  it('renders a QR code image after loading', async () => {
    await act(async () => {
      render(<QRCodeDisplay gameId={7} visible={true} />);
    });
    // Flush the promise-based state update
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const img = screen.getByTestId('qr-code-img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('data:image/png;base64,FAKE');
  });

  it('displays the player URL as text', async () => {
    await act(async () => {
      render(<QRCodeDisplay gameId={7} visible={true} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const wrapper = screen.getByTestId('qr-code-display');
    expect(wrapper.textContent).toContain('/player?game=7');
    expect(wrapper.textContent).not.toContain('/#/');
  });

  it('updates QR code when gameId changes', async () => {
    const { rerender } = render(<QRCodeDisplay gameId={1} visible={true} />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);

    await act(async () => {
      rerender(<QRCodeDisplay gameId={2} visible={true} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(QRCode.toDataURL).toHaveBeenCalledTimes(2);
    const expectedUrl = `${window.location.origin}/player?game=2`;
    expect(QRCode.toDataURL).toHaveBeenLastCalledWith(expectedUrl, expect.any(Object));
  });
});

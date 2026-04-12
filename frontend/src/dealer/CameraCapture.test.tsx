import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { CameraCapture } from './CameraCapture.tsx';

vi.mock('../api/client.ts', () => ({
  uploadImage: vi.fn(),
  getDetectionResults: vi.fn(),
}));

import { uploadImage, getDetectionResults } from '../api/client.ts';

const mockUploadImage = vi.mocked(uploadImage);
const mockGetDetectionResults = vi.mocked(getDetectionResults);

describe('CameraCapture', () => {
  const defaultProps = {
    gameId: 1,
    targetName: 'Alice',
    onDetectionResult: vi.fn(),
    onCancel: vi.fn(),
  };

  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial state with Open Camera and Cancel buttons', () => {
    render(<CameraCapture {...defaultProps} />);
    expect(screen.getByText('Open Camera')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
    expect(screen.getByText('Tap to open camera')).toBeDefined();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<CameraCapture {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows loading state after file selection', async () => {
    mockUploadImage.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CameraCapture {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Uploading/)).toBeDefined();
    });
  });

  it('calls onDetectionResult after successful upload and detection', async () => {
    const onDetectionResult = vi.fn();
    mockUploadImage.mockResolvedValue({
      upload_id: 42,
      game_id: 1,
      file_path: '/uploads/photo.jpg',
      status: 'completed',
    });
    mockGetDetectionResults.mockResolvedValue({
      upload_id: 42,
      game_id: 1,
      status: 'completed',
      detections: [
        { card_position: 'hole1', detected_value: 'Ah', confidence: 0.99 },
      ],
    });

    render(<CameraCapture {...defaultProps} onDetectionResult={onDetectionResult} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onDetectionResult).toHaveBeenCalledWith(
        'Alice',
        [{ card_position: 'hole1', detected_value: 'Ah', confidence: 0.99 }],
        file,
      );
    });
  });

  it('shows error state on upload failure', async () => {
    mockUploadImage.mockRejectedValue(new Error('Network error'));
    render(<CameraCapture {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('calls onCancel when no file is selected', () => {
    const onCancel = vi.fn();
    render(<CameraCapture {...defaultProps} onCancel={onCancel} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(onCancel).toHaveBeenCalled();
  });
});

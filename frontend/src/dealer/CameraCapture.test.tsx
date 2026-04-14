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

  it('file input is not display:none so mobile browsers allow programmatic click', () => {
    render(<CameraCapture {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    // display:none inputs cannot be .click()-ed on iOS Safari / Android WebView
    expect(input.style.display).not.toBe('none');
  });

  it('Open Camera button triggers file input click', () => {
    render(<CameraCapture {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByText('Open Camera'));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<CameraCapture {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows loading state after Use Photo is clicked', async () => {
    mockUploadImage.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CameraCapture {...defaultProps} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Use Photo')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Use Photo'));

    await waitFor(() => {
      expect(screen.getByText(/Uploading/)).toBeDefined();
    });
  });

  it('calls onDetectionResult after preview and Use Photo', async () => {
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
      expect(screen.getByText('Use Photo')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Use Photo'));

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
      expect(screen.getByText('Use Photo')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Use Photo'));

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

  describe('image preview', () => {
    function selectFile() {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['fake-image-data'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(file, 'size', { value: 2_500_000 });
      fireEvent.change(input, { target: { files: [file] } });
      return file;
    }

    it('shows preview with Use Photo and Retake buttons after capture', async () => {
      render(<CameraCapture {...defaultProps} />);
      selectFile();

      await waitFor(() => {
        expect(screen.getByText('Use Photo')).toBeDefined();
      });
      expect(screen.getByText('Retake')).toBeDefined();
      expect(screen.getByRole('img')).toBeDefined();
    });

    it('renders preview from local blob URL without backend call', async () => {
      render(<CameraCapture {...defaultProps} />);
      selectFile();

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeDefined();
      });

      const img = screen.getByRole('img') as HTMLImageElement;
      expect(img.src).toMatch(/^blob:/);
      expect(mockUploadImage).not.toHaveBeenCalled();
    });

    it('shows file size info in preview', async () => {
      render(<CameraCapture {...defaultProps} />);
      selectFile();

      await waitFor(() => {
        expect(screen.getByText(/2\.5\s*MB/i)).toBeDefined();
      });
    });

    it('shows resolution info after image loads', async () => {
      // Mock createObjectURL
      const blobUrl = 'blob:http://localhost/fake-uuid';
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { createObjectURL: () => blobUrl, revokeObjectURL });

      render(<CameraCapture {...defaultProps} />);
      selectFile();

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeDefined();
      });

      // Simulate image onload with dimensions
      const img = screen.getByRole('img') as HTMLImageElement;
      Object.defineProperty(img, 'naturalWidth', { value: 4032, configurable: true });
      Object.defineProperty(img, 'naturalHeight', { value: 3024, configurable: true });
      fireEvent.load(img);

      await waitFor(() => {
        expect(screen.getByText(/4032\s*×\s*3024/)).toBeDefined();
      });

      vi.unstubAllGlobals();
    });

    it('Use Photo sends image to backend for OCR', async () => {
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
      selectFile();

      await waitFor(() => {
        expect(screen.getByText('Use Photo')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Use Photo'));

      await waitFor(() => {
        expect(mockUploadImage).toHaveBeenCalledWith(1, expect.any(File));
      });
      await waitFor(() => {
        expect(onDetectionResult).toHaveBeenCalledWith(
          'Alice',
          [{ card_position: 'hole1', detected_value: 'Ah', confidence: 0.99 }],
          expect.any(File),
        );
      });
    });

    it('Retake discards preview and re-opens camera', async () => {
      render(<CameraCapture {...defaultProps} />);
      selectFile();

      await waitFor(() => {
        expect(screen.getByText('Retake')).toBeDefined();
      });

      fireEvent.click(screen.getByText('Retake'));

      // Should go back to initial state
      await waitFor(() => {
        expect(screen.getByText('Open Camera')).toBeDefined();
      });
      // Preview image should be gone
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('buttons have minimum 48px touch target', async () => {
      render(<CameraCapture {...defaultProps} />);
      selectFile();

      await waitFor(() => {
        expect(screen.getByText('Use Photo')).toBeDefined();
      });

      const useBtn = screen.getByText('Use Photo');
      const retakeBtn = screen.getByText('Retake');
      expect(useBtn.style.minHeight).toBe('48px');
      expect(retakeBtn.style.minHeight).toBe('48px');
    });
  });
});

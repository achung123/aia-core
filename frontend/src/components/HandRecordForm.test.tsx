/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { HandRecordForm } from './HandRecordForm.tsx';

vi.mock('../api/client.ts', () => ({
  createHand: vi.fn(),
  updateHolecards: vi.fn(),
}));

import { createHand, updateHolecards } from '../api/client.ts';

const mockedCreateHand = createHand as ReturnType<typeof vi.fn>;
const mockedUpdateHolecards = updateHolecards as ReturnType<typeof vi.fn>;

describe('HandRecordForm', () => {
  const playerNames = ['Alice', 'Bob'];
  const sessionId = 42;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateHand.mockResolvedValue({ hand_number: 1, hand_id: 10, game_id: 42 });
    mockedUpdateHolecards.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders heading and community card fields', () => {
    render(<HandRecordForm sessionId={sessionId} playerNames={playerNames} onSuccess={() => {}} />);
    expect(screen.getByText('Record Hand')).toBeInTheDocument();
    expect(screen.getByText('Community Cards')).toBeInTheDocument();
    expect(screen.getByLabelText('Flop 1 *')).toBeInTheDocument();
    expect(screen.getByLabelText('Flop 2 *')).toBeInTheDocument();
    expect(screen.getByLabelText('Flop 3 *')).toBeInTheDocument();
    expect(screen.getByLabelText('Turn')).toBeInTheDocument();
    expect(screen.getByLabelText('River')).toBeInTheDocument();
  });

  it('renders per-player card fields', () => {
    render(<HandRecordForm sessionId={sessionId} playerNames={playerNames} onSuccess={() => {}} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows validation error for invalid card format on blur', async () => {
    render(<HandRecordForm sessionId={sessionId} playerNames={playerNames} onSuccess={() => {}} />);
    const flop1 = screen.getByLabelText('Flop 1 *');
    fireEvent.change(flop1, { target: { value: 'XZ' } });
    fireEvent.blur(flop1);

    await waitFor(() => {
      expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
    });
  });

  it('shows required error on blur for empty required field', async () => {
    render(<HandRecordForm sessionId={sessionId} playerNames={playerNames} onSuccess={() => {}} />);
    const flop1 = screen.getByLabelText('Flop 1 *');
    fireEvent.focus(flop1);
    fireEvent.blur(flop1);

    await waitFor(() => {
      expect(screen.getByText('Required')).toBeInTheDocument();
    });
  });

  it('shows duplicate card error', async () => {
    render(<HandRecordForm sessionId={sessionId} playerNames={playerNames} onSuccess={() => {}} />);
    const flop1 = screen.getByLabelText('Flop 1 *');
    const flop2 = screen.getByLabelText('Flop 2 *');

    fireEvent.change(flop1, { target: { value: 'AS' } });
    fireEvent.blur(flop1);
    fireEvent.change(flop2, { target: { value: 'AS' } });
    fireEvent.blur(flop2);

    await waitFor(() => {
      expect(screen.getAllByText('Duplicate card').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('prevents submit when card errors exist', async () => {
    const onSuccess = vi.fn();
    render(<HandRecordForm sessionId={sessionId} playerNames={playerNames} onSuccess={onSuccess} />);

    fireEvent.submit(screen.getByRole('button', { name: 'Submit Hand' }));

    await waitFor(() => {
      expect(screen.getByText(/fix card errors/)).toBeInTheDocument();
    });
    expect(mockedCreateHand).not.toHaveBeenCalled();
  });

  it('submits hand successfully with valid data', async () => {
    const onSuccess = vi.fn();
    render(<HandRecordForm sessionId={sessionId} playerNames={playerNames} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('Flop 1 *'), { target: { value: 'AH' } });
    fireEvent.change(screen.getByLabelText('Flop 2 *'), { target: { value: '2D' } });
    fireEvent.change(screen.getByLabelText('Flop 3 *'), { target: { value: '3C' } });

    // Fill all required player card fields
    const allRequired = screen.getAllByPlaceholderText('e.g. AS');
    allRequired.forEach((input, i) => {
      const cards = ['KS', 'QS', 'JS', '10S'];
      fireEvent.change(input, { target: { value: cards[i] || `${i + 4}H` } });
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Submit Hand' }));

    await waitFor(() => {
      expect(mockedCreateHand).toHaveBeenCalled();
    });
  });

  it('shows server error on failed submit', async () => {
    mockedCreateHand.mockRejectedValue(new Error('Server error'));
    render(<HandRecordForm sessionId={sessionId} playerNames={playerNames} onSuccess={() => {}} />);

    // Fill minimum valid data
    fireEvent.change(screen.getByLabelText('Flop 1 *'), { target: { value: 'AH' } });
    fireEvent.change(screen.getByLabelText('Flop 2 *'), { target: { value: '2D' } });
    fireEvent.change(screen.getByLabelText('Flop 3 *'), { target: { value: '3C' } });
    const allRequired = screen.getAllByPlaceholderText('e.g. AS');
    allRequired.forEach((input, i) => {
      const cards = ['KS', 'QS', 'JS', '10S'];
      fireEvent.change(input, { target: { value: cards[i] || `${i + 4}H` } });
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Submit Hand' }));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});

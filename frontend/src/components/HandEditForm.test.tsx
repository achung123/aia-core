/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { HandEditForm } from './HandEditForm.tsx';
import type { HandResponse } from '../api/types.ts';

vi.mock('../api/client.ts', () => ({
  updateCommunityCards: vi.fn(),
  updateHolecards: vi.fn(),
}));

import { updateCommunityCards, updateHolecards } from '../api/client.ts';

const mockedUpdateCommunity = updateCommunityCards as ReturnType<typeof vi.fn>;
const mockedUpdateHolecards = updateHolecards as ReturnType<typeof vi.fn>;

const HAND_DATA: HandResponse = {
  hand_id: 10,
  game_id: 42,
  hand_number: 1,
  flop_1: 'AH',
  flop_2: '2D',
  flop_3: '3C',
  turn: 'KS',
  river: null,
  source_upload_id: null,
  created_at: '2026-04-12T00:00:00',
  player_hands: [
    {
      player_hand_id: 1,
      hand_id: 10,
      player_id: 1,
      player_name: 'Alice',
      card_1: 'QH',
      card_2: 'JH',
      result: 'win',
      profit_loss: 10,
      outcome_street: null,
    },
    {
      player_hand_id: 2,
      hand_id: 10,
      player_id: 2,
      player_name: 'Bob',
      card_1: '9S',
      card_2: '8S',
      result: 'loss',
      profit_loss: -10,
      outcome_street: null,
    },
  ],
};

describe('HandEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUpdateCommunity.mockResolvedValue({
      ...HAND_DATA,
      flop_1: 'AH',
      flop_2: '2D',
      flop_3: '3C',
    });
    mockedUpdateHolecards.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it('renders heading with hand number', () => {
    render(<HandEditForm sessionId={42} handData={HAND_DATA} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Edit Hand #1')).toBeInTheDocument();
  });

  it('pre-fills community card values', () => {
    render(<HandEditForm sessionId={42} handData={HAND_DATA} onSave={() => {}} onCancel={() => {}} />);
    expect((screen.getByLabelText('Flop 1 *') as HTMLInputElement).value).toBe('AH');
    expect((screen.getByLabelText('Flop 2 *') as HTMLInputElement).value).toBe('2D');
    expect((screen.getByLabelText('Flop 3 *') as HTMLInputElement).value).toBe('3C');
    expect((screen.getByLabelText('Turn') as HTMLInputElement).value).toBe('KS');
    expect((screen.getByLabelText('River') as HTMLInputElement).value).toBe('');
  });

  it('pre-fills player card values', () => {
    render(<HandEditForm sessionId={42} handData={HAND_DATA} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('fires onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<HandEditForm sessionId={42} handData={HAND_DATA} onSave={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows validation error for invalid card', async () => {
    render(<HandEditForm sessionId={42} handData={HAND_DATA} onSave={() => {}} onCancel={() => {}} />);
    const flop1 = screen.getByLabelText('Flop 1 *');
    fireEvent.change(flop1, { target: { value: 'XZ' } });
    fireEvent.blur(flop1);

    await waitFor(() => {
      expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
    });
  });

  it('submits only changed fields', async () => {
    const onSave = vi.fn();
    mockedUpdateCommunity.mockResolvedValue({
      ...HAND_DATA,
      flop_1: '5H',
    });
    mockedUpdateHolecards.mockResolvedValue({
      card_1: 'QH',
      card_2: 'JH',
    });

    render(<HandEditForm sessionId={42} handData={HAND_DATA} onSave={onSave} onCancel={() => {}} />);

    // Change flop 1
    const flop1 = screen.getByLabelText('Flop 1 *');
    fireEvent.change(flop1, { target: { value: '5H' } });

    fireEvent.submit(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedUpdateCommunity).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('skips API calls when nothing changed', async () => {
    const onSave = vi.fn();
    render(<HandEditForm sessionId={42} handData={HAND_DATA} onSave={onSave} onCancel={() => {}} />);

    fireEvent.submit(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    expect(mockedUpdateCommunity).not.toHaveBeenCalled();
    expect(mockedUpdateHolecards).not.toHaveBeenCalled();
  });

  it('shows server error on failed save', async () => {
    mockedUpdateCommunity.mockRejectedValue(new Error('Server error'));
    render(<HandEditForm sessionId={42} handData={HAND_DATA} onSave={() => {}} onCancel={() => {}} />);

    // Change a field to trigger API call
    const flop1 = screen.getByLabelText('Flop 1 *');
    fireEvent.change(flop1, { target: { value: '5H' } });

    fireEvent.submit(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});

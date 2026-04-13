/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { act } from 'react';

vi.mock('../api/client.ts', () => ({
  patchPlayerResult: vi.fn(() => Promise.resolve({})),
  updateCommunityCards: vi.fn(() => Promise.resolve({})),
  updateHolecards: vi.fn(() => Promise.resolve({})),
}));

import { patchPlayerResult, updateCommunityCards, updateHolecards } from '../api/client.ts';
import { ReviewScreen } from './ReviewScreen.tsx';
import type { ReviewScreenProps } from './ReviewScreen.tsx';
import type { Player, CommunityCards } from '../stores/dealerStore.ts';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseCommunity: CommunityCards = {
  flop1: 'Ah', flop2: 'Kd', flop3: '9c',
  flopRecorded: true,
  turn: '5s', turnRecorded: true,
  river: '2h', riverRecorded: true,
};

const basePlayers: Player[] = [
  { name: 'Alice', card1: 'Js', card2: 'Tc', recorded: true, status: 'won', outcomeStreet: 'river' },
  { name: 'Bob', card1: '8h', card2: '7d', recorded: true, status: 'lost', outcomeStreet: 'river' },
  { name: 'Charlie', card1: null, card2: null, recorded: false, status: 'folded', outcomeStreet: 'flop' },
];

function makeProps(overrides: Partial<ReviewScreenProps> = {}): ReviewScreenProps {
  return {
    gameId: 42,
    handId: 3,
    players: basePlayers.map((p) => ({ ...p })),
    community: { ...baseCommunity },
    onSaved: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('ReviewScreen — rendering', () => {
  it('renders heading with hand number', () => {
    render(<ReviewScreen {...makeProps()} />);
    expect(screen.getByText('Hand Review')).toBeDefined();
    expect(screen.getByText(/Hand #3/)).toBeDefined();
  });

  it('renders community cards', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    expect(container.querySelector('[data-testid="review-community-flop1"]')?.textContent).toBe('Ah');
    expect(container.querySelector('[data-testid="review-community-flop2"]')?.textContent).toBe('Kd');
    expect(container.querySelector('[data-testid="review-community-flop3"]')?.textContent).toBe('9c');
    expect(container.querySelector('[data-testid="review-community-turn"]')?.textContent).toBe('5s');
    expect(container.querySelector('[data-testid="review-community-river"]')?.textContent).toBe('2h');
  });

  it('renders participating players and auto-folded players, excludes not_playing', () => {
    const players: Player[] = [
      { name: 'Alice', card1: 'Js', card2: 'Tc', recorded: true, status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
      { name: 'Dave', card1: null, card2: null, recorded: false, status: 'not_playing', outcomeStreet: null },
    ];
    const { container } = render(<ReviewScreen {...makeProps({ players })} />);
    expect(container.querySelector('[data-testid="review-player-Alice"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="review-player-Bob"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="review-player-Dave"]')).toBeNull();
  });

  it('renders player hole cards', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    expect(container.querySelector('[data-testid="review-player-Alice-card1"]')?.textContent).toBe('Js');
    expect(container.querySelector('[data-testid="review-player-Alice-card2"]')?.textContent).toBe('Tc');
    expect(container.querySelector('[data-testid="review-player-Bob-card1"]')?.textContent).toBe('8h');
    expect(container.querySelector('[data-testid="review-player-Bob-card2"]')?.textContent).toBe('7d');
  });

  it('renders dashes for null cards', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    expect(container.querySelector('[data-testid="review-player-Charlie-card1"]')?.textContent).toBe('—');
    expect(container.querySelector('[data-testid="review-player-Charlie-card2"]')?.textContent).toBe('—');
  });

  it('renders result buttons for each player with current result highlighted', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    // Alice has "won" — the won button should be highlighted (aria-pressed)
    const aliceWon = container.querySelector('[data-testid="review-player-Alice-result-won"]') as HTMLButtonElement;
    expect(aliceWon).not.toBeNull();
    expect(aliceWon.getAttribute('aria-pressed')).toBe('true');

    const aliceLost = container.querySelector('[data-testid="review-player-Alice-result-lost"]') as HTMLButtonElement;
    expect(aliceLost.getAttribute('aria-pressed')).toBe('false');
  });

  it('renders outcome street dropdown with current value', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    const aliceStreet = container.querySelector('[data-testid="review-player-Alice-street"]') as HTMLSelectElement;
    expect(aliceStreet).not.toBeNull();
    expect(aliceStreet.value).toBe('river');

    const charlieStreet = container.querySelector('[data-testid="review-player-Charlie-street"]') as HTMLSelectElement;
    expect(charlieStreet.value).toBe('flop');
  });

  it('renders Confirm & Save and Cancel buttons', () => {
    render(<ReviewScreen {...makeProps()} />);
    expect(screen.getByTestId('review-confirm-btn')).toBeDefined();
    expect(screen.getByTestId('review-cancel-btn')).toBeDefined();
  });
});

describe('ReviewScreen — editing community cards', () => {
  it('tapping a community card opens CardPicker', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    fireEvent.click(container.querySelector('[data-testid="review-community-flop1"]')!);
    expect(screen.getByText('Select Card')).toBeDefined();
  });

  it('selecting a card from CardPicker updates the community card', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    fireEvent.click(container.querySelector('[data-testid="review-community-flop1"]')!);
    // CardPicker shows — click 'Q♠' to select Qs
    fireEvent.click(screen.getByText('Q♠'));
    expect(container.querySelector('[data-testid="review-community-flop1"]')?.textContent).toBe('Qs');
  });
});

describe('ReviewScreen — editing player cards', () => {
  it('tapping a player card opens CardPicker', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-card1"]')!);
    expect(screen.getByText('Select Card')).toBeDefined();
  });

  it('selecting a card from CardPicker updates the player card', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-card1"]')!);
    fireEvent.click(screen.getByText('3♥'));
    expect(container.querySelector('[data-testid="review-player-Alice-card1"]')?.textContent).toBe('3h');
  });
});

describe('ReviewScreen — editing results', () => {
  it('clicking a result button changes the player result', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    const aliceLost = container.querySelector('[data-testid="review-player-Alice-result-lost"]') as HTMLButtonElement;
    fireEvent.click(aliceLost);
    expect(aliceLost.getAttribute('aria-pressed')).toBe('true');

    const aliceWon = container.querySelector('[data-testid="review-player-Alice-result-won"]') as HTMLButtonElement;
    expect(aliceWon.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('ReviewScreen — editing outcome street', () => {
  it('changing the dropdown updates the outcome street', () => {
    const { container } = render(<ReviewScreen {...makeProps()} />);
    const aliceStreet = container.querySelector('[data-testid="review-player-Alice-street"]') as HTMLSelectElement;
    fireEvent.change(aliceStreet, { target: { value: 'turn' } });
    expect(aliceStreet.value).toBe('turn');
  });
});

describe('ReviewScreen — Confirm & Save', () => {
  it('calls patchPlayerResult for each dirty player result', async () => {
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Change all three results to make them dirty
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-result-lost"]')!);
    fireEvent.click(container.querySelector('[data-testid="review-player-Bob-result-won"]')!);
    fireEvent.click(container.querySelector('[data-testid="review-player-Charlie-result-won"]')!);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledTimes(3);
    });

    expect(patchPlayerResult).toHaveBeenCalledWith(42, 3, 'Alice', {
      result: 'lost',
      outcome_street: 'river',
    });
    expect(patchPlayerResult).toHaveBeenCalledWith(42, 3, 'Bob', {
      result: 'won',
      outcome_street: 'river',
    });
    expect(patchPlayerResult).toHaveBeenCalledWith(42, 3, 'Charlie', {
      result: 'won',
      outcome_street: 'flop',
    });

    expect(onSaved).toHaveBeenCalled();
  });

  it('calls updateCommunityCards when community cards are edited', async () => {
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Edit a community card
    fireEvent.click(container.querySelector('[data-testid="review-community-turn"]')!);
    fireEvent.click(screen.getByText('J♣'));

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(updateCommunityCards).toHaveBeenCalledTimes(1);
    });

    expect(updateCommunityCards).toHaveBeenCalledWith(42, 3, {
      flop_1: 'Ah',
      flop_2: 'Kd',
      flop_3: '9c',
      turn: 'Jc',
      river: '2h',
    });
  });

  it('does not call updateCommunityCards when community cards are unchanged', async () => {
    const onSaved = vi.fn();
    render(<ReviewScreen {...makeProps({ onSaved })} />);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    expect(updateCommunityCards).not.toHaveBeenCalled();
  });

  it('calls updateHolecards when player cards are edited', async () => {
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Edit Alice's card1
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-card1"]')!);
    fireEvent.click(screen.getByText('4♦'));

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(updateHolecards).toHaveBeenCalledTimes(1);
    });

    expect(updateHolecards).toHaveBeenCalledWith(42, 3, 'Alice', {
      card_1: '4d',
      card_2: 'Tc',
    });
  });

  it('does not call updateHolecards when player cards are unchanged', async () => {
    const onSaved = vi.fn();
    render(<ReviewScreen {...makeProps({ onSaved })} />);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });

    expect(updateHolecards).not.toHaveBeenCalled();
  });

  it('shows error when a save call fails', async () => {
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Make Alice result dirty so patchPlayerResult is actually called
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-result-lost"]')!);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(screen.getByTestId('review-error')).toBeDefined();
    });
    expect(screen.getByTestId('review-error').textContent).toContain('Alice result');
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('ReviewScreen — Cancel', () => {
  it('calls onCancel without making any API calls', () => {
    const onCancel = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onCancel })} />);

    fireEvent.click(container.querySelector('[data-testid="review-cancel-btn"]')!);

    expect(onCancel).toHaveBeenCalled();
    expect(patchPlayerResult).not.toHaveBeenCalled();
    expect(updateCommunityCards).not.toHaveBeenCalled();
    expect(updateHolecards).not.toHaveBeenCalled();
  });
});

describe('ReviewScreen — dirty tracking for results', () => {
  it('does not call patchPlayerResult when results are unchanged', async () => {
    const onSaved = vi.fn();
    render(<ReviewScreen {...makeProps({ onSaved })} />);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(patchPlayerResult).not.toHaveBeenCalled();
  });

  it('only patches results for players whose result or street changed', async () => {
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Change only Alice's result from 'won' to 'lost'
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-result-lost"]')!);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    expect(patchPlayerResult).toHaveBeenCalledTimes(1);
    expect(patchPlayerResult).toHaveBeenCalledWith(42, 3, 'Alice', {
      result: 'lost',
      outcome_street: 'river',
    });
  });
});

// Helper: click "Finish Hand" button then confirm the dialog
async function clickFinishAndConfirm() {
  fireEvent.click(screen.getByTestId('review-confirm-btn'));
  await act(async () => {
    fireEvent.click(screen.getByTestId('finish-confirm-ok'));
  });
}

describe('ReviewScreen — auto-fold logic (AC2)', () => {
  it('auto-assigns folded to players with null cards and non-terminal result', () => {
    const players: Player[] = [
      { name: 'Alice', card1: 'Js', card2: 'Tc', recorded: true, status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'handed_back', outcomeStreet: null },
    ];
    const { container } = render(<ReviewScreen {...makeProps({ players })} />);
    const bobFolded = container.querySelector('[data-testid="review-player-Bob-result-folded"]') as HTMLButtonElement;
    expect(bobFolded).not.toBeNull();
    expect(bobFolded.getAttribute('aria-pressed')).toBe('true');
  });

  it('auto-assigns folded to playing-status players with null cards', () => {
    const players: Player[] = [
      { name: 'Alice', card1: 'Js', card2: 'Tc', recorded: true, status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'playing', outcomeStreet: null },
    ];
    const { container } = render(<ReviewScreen {...makeProps({ players })} />);
    expect(container.querySelector('[data-testid="review-player-Bob"]')).not.toBeNull();
    const bobFolded = container.querySelector('[data-testid="review-player-Bob-result-folded"]') as HTMLButtonElement;
    expect(bobFolded).not.toBeNull();
    expect(bobFolded.getAttribute('aria-pressed')).toBe('true');
  });

  it('does NOT auto-fold players who have cards even if result is non-terminal', () => {
    const players: Player[] = [
      { name: 'Alice', card1: 'Js', card2: 'Tc', recorded: true, status: 'handed_back', outcomeStreet: null },
    ];
    const { container } = render(<ReviewScreen {...makeProps({ players })} />);
    const aliceFolded = container.querySelector('[data-testid="review-player-Alice-result-folded"]') as HTMLButtonElement;
    expect(aliceFolded).not.toBeNull();
    expect(aliceFolded.getAttribute('aria-pressed')).toBe('false');
  });

  it('does NOT auto-fold players who already have a terminal result', () => {
    const players: Player[] = [
      { name: 'Alice', card1: null, card2: null, recorded: false, status: 'won', outcomeStreet: 'river' },
    ];
    const { container } = render(<ReviewScreen {...makeProps({ players })} />);
    const aliceWon = container.querySelector('[data-testid="review-player-Alice-result-won"]') as HTMLButtonElement;
    expect(aliceWon).not.toBeNull();
    expect(aliceWon.getAttribute('aria-pressed')).toBe('true');
  });

  it('auto-fold result is patched via API on save', async () => {
    const onSaved = vi.fn();
    const players: Player[] = [
      { name: 'Alice', card1: 'Js', card2: 'Tc', recorded: true, status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', card1: null, card2: null, recorded: false, status: 'handed_back', outcomeStreet: null },
    ];
    render(<ReviewScreen {...makeProps({ players, onSaved })} />);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalledWith(42, 3, 'Bob', {
        result: 'folded',
        outcome_street: null,
      });
      expect(onSaved).toHaveBeenCalled();
    });
  });
});

describe('ReviewScreen — Finish Hand gating (AC1)', () => {
  it('Finish Hand button is disabled when a player has no terminal result', () => {
    const players: Player[] = [
      { name: 'Alice', card1: 'Js', card2: 'Tc', recorded: true, status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', card1: '8h', card2: '7d', recorded: true, status: 'handed_back', outcomeStreet: null },
    ];
    render(<ReviewScreen {...makeProps({ players })} />);
    const btn = screen.getByTestId('review-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Finish Hand button is enabled when all players have terminal results', () => {
    render(<ReviewScreen {...makeProps()} />);
    const btn = screen.getByTestId('review-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('Finish Hand button becomes enabled after manually setting all results', () => {
    const players: Player[] = [
      { name: 'Alice', card1: 'Js', card2: 'Tc', recorded: true, status: 'won', outcomeStreet: 'river' },
      { name: 'Bob', card1: '8h', card2: '7d', recorded: true, status: 'handed_back', outcomeStreet: null },
    ];
    const { container } = render(<ReviewScreen {...makeProps({ players })} />);

    const btn = screen.getByTestId('review-confirm-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    // Set Bob's result to lost
    fireEvent.click(container.querySelector('[data-testid="review-player-Bob-result-lost"]')!);
    expect(btn.disabled).toBe(false);
  });

  it('Finish Hand button text says "Finish Hand"', () => {
    render(<ReviewScreen {...makeProps()} />);
    const btn = screen.getByTestId('review-confirm-btn');
    expect(btn.textContent).toBe('Finish Hand');
  });
});

describe('ReviewScreen — confirmation dialog (AC3)', () => {
  it('clicking Finish Hand shows confirmation dialog with outcome summary', () => {
    render(<ReviewScreen {...makeProps()} />);
    fireEvent.click(screen.getByTestId('review-confirm-btn'));

    expect(screen.getByTestId('finish-confirm-dialog')).toBeDefined();
    expect(screen.getByText(/Alice: won/)).toBeDefined();
    expect(screen.getByText(/Bob: lost/)).toBeDefined();
    expect(screen.getByText(/Charlie: folded/)).toBeDefined();
  });

  it('cancelling the dialog does not trigger save', () => {
    render(<ReviewScreen {...makeProps()} />);
    fireEvent.click(screen.getByTestId('review-confirm-btn'));
    fireEvent.click(screen.getByTestId('finish-confirm-cancel'));

    expect(screen.queryByTestId('finish-confirm-dialog')).toBeNull();
    expect(patchPlayerResult).not.toHaveBeenCalled();
  });

  it('confirming the dialog triggers save and calls onSaved', async () => {
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Make Alice result dirty
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-result-lost"]')!);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(patchPlayerResult).toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('after finish, onSaved callback is invoked (AC4: returns to dashboard)', async () => {
    const onSaved = vi.fn();
    render(<ReviewScreen {...makeProps({ onSaved })} />);

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ReviewScreen — partial save failure', () => {
  it('reports specific failed calls on partial failure', async () => {
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Make Alice and Bob results dirty
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-result-lost"]')!);
    fireEvent.click(container.querySelector('[data-testid="review-player-Bob-result-won"]')!);

    // Alice's result call will fail, Bob's will succeed
    (patchPlayerResult as ReturnType<typeof vi.fn>)
      .mockImplementation((_gid: number, _hid: number, playerName: string) => {
        if (playerName === 'Alice') return Promise.reject(new Error('Network error'));
        return Promise.resolve({});
      });

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(screen.getByTestId('review-error')).toBeDefined();
    });
    const errorText = screen.getByTestId('review-error').textContent!;
    expect(errorText).toContain('Alice result');
    expect(errorText).not.toContain('Bob');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('retry after partial failure skips already-succeeded mutations', async () => {
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Make Alice and Bob results dirty
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-result-lost"]')!);
    fireEvent.click(container.querySelector('[data-testid="review-player-Bob-result-won"]')!);

    // First save: Alice fails, Bob succeeds
    (patchPlayerResult as ReturnType<typeof vi.fn>)
      .mockImplementation((_gid: number, _hid: number, playerName: string) => {
        if (playerName === 'Alice') return Promise.reject(new Error('Network error'));
        return Promise.resolve({});
      });

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(screen.getByTestId('review-error')).toBeDefined();
    });
    expect(patchPlayerResult).toHaveBeenCalledTimes(2); // Alice + Bob

    // Reset mocks — everything succeeds now
    vi.clearAllMocks();
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});

    // Retry via Finish Hand + confirm dialog
    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    // Only Alice should be retried (Bob already succeeded)
    expect(patchPlayerResult).toHaveBeenCalledTimes(1);
    expect(patchPlayerResult).toHaveBeenCalledWith(42, 3, 'Alice', {
      result: 'lost',
      outcome_street: 'river',
    });
  });

  it('retry with community cards skips already-saved community', async () => {
    const onSaved = vi.fn();
    const { container } = render(<ReviewScreen {...makeProps({ onSaved })} />);

    // Make Alice result dirty and community dirty
    fireEvent.click(container.querySelector('[data-testid="review-player-Alice-result-lost"]')!);
    fireEvent.click(container.querySelector('[data-testid="review-community-turn"]')!);
    fireEvent.click(screen.getByText('J♣'));

    // Community succeeds, Alice result fails
    (patchPlayerResult as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Server error'));
    (updateCommunityCards as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(screen.getByTestId('review-error')).toBeDefined();
    });
    expect(updateCommunityCards).toHaveBeenCalledTimes(1);

    // Reset and retry via Finish Hand + confirm dialog
    vi.clearAllMocks();
    (patchPlayerResult as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (updateCommunityCards as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await clickFinishAndConfirm();

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalled();
    });
    // Community should NOT be re-submitted (already saved)
    expect(updateCommunityCards).not.toHaveBeenCalled();
    // Alice result should be retried
    expect(patchPlayerResult).toHaveBeenCalledTimes(1);
  });
});

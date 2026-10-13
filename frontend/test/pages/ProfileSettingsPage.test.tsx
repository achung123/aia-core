/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../src/api/client.ts', () => ({
  fetchAwards: vi.fn(),
}));

import { fetchAwards } from '../../src/api/client';
import { ProfileSettingsPage } from '../../src/pages/ProfileSettingsPage';
import { usePlayerStore } from '../../src/stores/playerStore';

const mockedFetchAwards = vi.mocked(fetchAwards);

const AWARDS = [
  { award_name: 'Iron Man', emoji: '\U0001f9be', description: 'Most hands played', winner_name: 'Alice', stat_value: 120, stat_label: 'hands' },
  { award_name: 'Sniper', emoji: '\U0001f3af', description: 'Highest win rate', winner_name: 'Alice', stat_value: 72.5, stat_label: 'win %' },
  { award_name: 'Big Stack', emoji: '\U0001f4b0', description: 'Highest profit', winner_name: 'Bob', stat_value: 500, stat_label: 'profit' },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfileSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockedFetchAwards.mockResolvedValue(AWARDS);
});

afterEach(() => {
  cleanup();
  usePlayerStore.getState().setPlayerName(null);
  vi.clearAllMocks();
});

describe('ProfileSettingsPage', () => {
  it('shows message when no profile is selected', () => {
    renderPage();
    expect(screen.getByText(/select a profile first/i)).toBeTruthy();
  });

  it('renders settings form when profile is selected', () => {
    usePlayerStore.getState().setPlayerName('Alice');
    renderPage();
    expect(screen.getByTestId('profile-name-input')).toBeTruthy();
  });

  describe('Superlative Title section', () => {
    it('shows "no titles" message when player has no awards', async () => {
      usePlayerStore.getState().setPlayerName('Charlie');
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('no-titles')).toBeTruthy();
      });
    });

    it('shows title selector with awards the player has won', async () => {
      usePlayerStore.getState().setPlayerName('Alice');
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('title-selector')).toBeTruthy();
      });
      // Alice has Iron Man and Sniper
      expect(screen.getByTestId('title-option-Iron Man')).toBeTruthy();
      expect(screen.getByTestId('title-option-Sniper')).toBeTruthy();
      // Bob's award should not appear
      expect(screen.queryByTestId('title-option-Big Stack')).toBeNull();
      // None option always present
      expect(screen.getByTestId('title-option-none')).toBeTruthy();
    });

    it('selecting a title updates the store', async () => {
      usePlayerStore.getState().setPlayerName('Alice');
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('title-selector')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('title-option-Iron Man'));
      expect(usePlayerStore.getState().selectedTitle).toBe('\U0001f9be');
    });

    it('selecting "None" clears the title', async () => {
      usePlayerStore.getState().setPlayerName('Alice');
      usePlayerStore.getState().setSelectedTitle('\U0001f9be');
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('title-selector')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('title-option-none'));
      expect(usePlayerStore.getState().selectedTitle).toBeNull();
    });

    it('switching player clears previous title', () => {
      usePlayerStore.getState().setPlayerName('Alice');
      usePlayerStore.getState().setSelectedTitle('\U0001f9be');
      // Switching to Bob should clear the title
      usePlayerStore.getState().setPlayerName('Bob');
      expect(usePlayerStore.getState().selectedTitle).toBeNull();
    });
  });
});

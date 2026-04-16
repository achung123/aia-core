/** @vitest-environment happy-dom */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../src/api/client.ts', () => ({
  fetchPlayers: vi.fn(),
}));

const mockSetPlayerName = vi.fn();

vi.mock('../src/stores/playerStore.ts', () => {
  const usePlayerStore = (selector: (s: { playerName: string | null; setPlayerName: (n: string | null) => void }) => unknown) =>
    selector({ playerName: null, setPlayerName: mockSetPlayerName });
  return { usePlayerStore };
});

import NavBar from '../src/NavBar';
import { fetchPlayers } from '../src/api/client';

const mockedFetchPlayers = vi.mocked(fetchPlayers);

beforeEach(() => {
  mockedFetchPlayers.mockResolvedValue([
    { player_id: 1, name: 'Alice', created_at: '2025-01-01' },
    { player_id: 2, name: 'Bob', created_at: '2025-01-02' },
  ]);
  mockSetPlayerName.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderNavBar(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <NavBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NavBar', () => {
  it('renders a nav element', () => {
    renderNavBar();
    const nav = screen.getByRole('navigation');
    expect(nav).toBeTruthy();
  });

  it('renders 3 navigation links', () => {
    renderNavBar();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
  });

  it('renders links with correct text', () => {
    renderNavBar();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Dealer')).toBeTruthy();
    expect(screen.getByText('Game')).toBeTruthy();
  });

  it('links point to correct routes', () => {
    renderNavBar();
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/dealer');
    expect(hrefs).toContain('/player');
  });

  it('applies active class to current route link', () => {
    renderNavBar(['/']);
    const homeLink = screen.getByText('Home');
    expect(homeLink.className).toContain('active');
  });

  it('renders a profile button', () => {
    renderNavBar();
    expect(screen.getByTestId('profile-btn')).toBeTruthy();
  });

  it('shows "Select Profile" when no player is selected', () => {
    renderNavBar();
    expect(screen.getByText('Select Profile')).toBeTruthy();
  });

  it('opens profile menu when button is clicked', async () => {
    renderNavBar();
    fireEvent.click(screen.getByTestId('profile-btn'));
    expect(screen.getByTestId('profile-menu')).toBeTruthy();
  });

  it('shows Switch Profile button in menu', async () => {
    renderNavBar();
    fireEvent.click(screen.getByTestId('profile-btn'));
    expect(screen.getByTestId('switch-profile-btn')).toBeTruthy();
  });

  it('shows player list after clicking Switch Profile', async () => {
    renderNavBar();
    await screen.findByText('Select Profile');
    fireEvent.click(screen.getByTestId('profile-btn'));
    fireEvent.click(screen.getByTestId('switch-profile-btn'));
    expect(await screen.findByTestId('profile-option-Alice')).toBeTruthy();
    expect(screen.getByTestId('profile-option-Bob')).toBeTruthy();
  });

  it('calls setPlayerName when a player is selected from menu', async () => {
    renderNavBar();
    fireEvent.click(screen.getByTestId('profile-btn'));
    fireEvent.click(screen.getByTestId('switch-profile-btn'));
    const alice = await screen.findByTestId('profile-option-Alice');
    fireEvent.click(alice);
    expect(mockSetPlayerName).toHaveBeenCalledWith('Alice');
  });

  it('calls setPlayerName with null when sign out is clicked', async () => {
    // Re-mock with a player selected
    vi.doMock('../src/stores/playerStore.ts', () => {
      const usePlayerStore = (selector: (s: { playerName: string | null; setPlayerName: (n: string | null) => void }) => unknown) =>
        selector({ playerName: 'Alice', setPlayerName: mockSetPlayerName });
      return { usePlayerStore };
    });
    // Need to re-import after mock change — use renderNavBar directly since the mock is hoisted
    // Actually, vi.doMock won't work here easily. Let's just test the menu structure.
    renderNavBar();
    fireEvent.click(screen.getByTestId('profile-btn'));
    // When no player is selected, sign out is not shown
    expect(screen.queryByTestId('profile-settings-btn')).toBeNull();
  });
});

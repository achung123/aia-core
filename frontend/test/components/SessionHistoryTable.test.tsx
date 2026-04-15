/** @vitest-environment happy-dom */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionHistoryTable } from '../../src/components/SessionHistoryTable';
import type { PlayerSessionTrend } from '../../src/api/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeTrend(overrides: Partial<PlayerSessionTrend> & { game_id: number }): PlayerSessionTrend {
  return {
    game_date: '2025-06-01',
    hands_played: 10,
    hands_won: 4,
    win_rate: 40,
    profit_loss: 100,
    ...overrides,
  };
}

function renderTable(data: PlayerSessionTrend[]) {
  return render(
    <MemoryRouter>
      <SessionHistoryTable data={data} />
    </MemoryRouter>,
  );
}

describe('SessionHistoryTable', () => {
  describe('column display', () => {
    it('renders column headers', () => {
      renderTable([makeTrend({ game_id: 1 })]);
      expect(screen.getByRole('columnheader', { name: /date/i })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: /hands/i })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: /wins/i })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: /losses/i })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: /win rate/i })).toBeTruthy();
      expect(screen.getByRole('columnheader', { name: /p&l/i })).toBeTruthy();
    });

    it('renders session data in rows', () => {
      renderTable([
        makeTrend({ game_id: 1, game_date: '2025-06-01', hands_played: 10, hands_won: 4, win_rate: 40, profit_loss: 100 }),
      ]);
      expect(screen.getByText('2025-06-01')).toBeTruthy();
      expect(screen.getByText('10')).toBeTruthy();
      expect(screen.getByText('4')).toBeTruthy();
      expect(screen.getByText('6')).toBeTruthy(); // losses = 10 - 4
      expect(screen.getByText('40%')).toBeTruthy();
      expect(screen.getByText('100')).toBeTruthy();
    });

    it('renders empty state when no data', () => {
      renderTable([]);
      expect(screen.getByText(/no session/i)).toBeTruthy();
    });
  });

  describe('sorting', () => {
    const data = [
      makeTrend({ game_id: 1, game_date: '2025-06-01', hands_played: 10, win_rate: 40, profit_loss: 100 }),
      makeTrend({ game_id: 2, game_date: '2025-07-01', hands_played: 20, win_rate: 60, profit_loss: -50 }),
      makeTrend({ game_id: 3, game_date: '2025-05-01', hands_played: 5, win_rate: 80, profit_loss: 200 }),
    ];

    it('sorts by date descending by default', () => {
      renderTable(data);
      const rows = screen.getAllByRole('row');
      // row[0] is header, data rows start at [1]
      expect(rows[1].textContent).toContain('2025-07-01');
      expect(rows[2].textContent).toContain('2025-06-01');
      expect(rows[3].textContent).toContain('2025-05-01');
    });

    it('toggles sort direction when clicking same header', () => {
      renderTable(data);
      const dateHeader = screen.getByRole('columnheader', { name: /date/i });

      // Click once — already desc, toggles to asc
      fireEvent.click(dateHeader);
      const rowsAsc = screen.getAllByRole('row');
      expect(rowsAsc[1].textContent).toContain('2025-05-01');
      expect(rowsAsc[3].textContent).toContain('2025-07-01');

      // Click again — back to desc
      fireEvent.click(dateHeader);
      const rowsDesc = screen.getAllByRole('row');
      expect(rowsDesc[1].textContent).toContain('2025-07-01');
    });

    it('sorts by P&L when clicking P&L header', () => {
      renderTable(data);
      const plHeader = screen.getByRole('columnheader', { name: /p&l/i });
      fireEvent.click(plHeader);

      const rows = screen.getAllByRole('row');
      // Default for new column is desc
      expect(rows[1].textContent).toContain('200');
      expect(rows[3].textContent).toContain('-50');
    });

    it('shows sort indicator on active column', () => {
      renderTable(data);
      const dateHeader = screen.getByRole('columnheader', { name: /date/i });
      expect(dateHeader.textContent).toContain('▼'); // desc indicator
    });
  });

  describe('row navigation', () => {
    it('navigates to game recap on row click', () => {
      renderTable([makeTrend({ game_id: 42 })]);
      const row = screen.getAllByRole('row')[1]; // first data row
      fireEvent.click(row);
      expect(mockNavigate).toHaveBeenCalledWith('/games/42/recap');
    });

    it('each row has cursor pointer style', () => {
      renderTable([makeTrend({ game_id: 1 })]);
      const row = screen.getAllByRole('row')[1];
      expect((row as HTMLElement).style.cursor).toBe('pointer');
    });
  });

  describe('pagination', () => {
    const manyRows = Array.from({ length: 25 }, (_, i) =>
      makeTrend({ game_id: i + 1, game_date: `2025-01-${String(i + 1).padStart(2, '0')}` }),
    );

    it('shows only 20 rows per page', () => {
      renderTable(manyRows);
      const dataRows = screen.getAllByRole('row').slice(1); // exclude header
      expect(dataRows).toHaveLength(20);
    });

    it('renders pagination controls when >20 rows', () => {
      renderTable(manyRows);
      expect(screen.getByRole('button', { name: /next/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /prev/i })).toBeTruthy();
    });

    it('does not render pagination when <=20 rows', () => {
      renderTable(manyRows.slice(0, 20));
      expect(screen.queryByRole('button', { name: /next/i })).toBeNull();
    });

    it('navigates to next page', () => {
      renderTable(manyRows);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      const dataRows = screen.getAllByRole('row').slice(1);
      expect(dataRows).toHaveLength(5); // 25 - 20 = 5 on page 2
    });

    it('shows page indicator', () => {
      renderTable(manyRows);
      expect(screen.getByText(/page 1 of 2/i)).toBeTruthy();
    });

    it('disables prev button on first page', () => {
      renderTable(manyRows);
      const prevBtn = screen.getByRole('button', { name: /prev/i });
      expect(prevBtn).toBeDisabled();
    });

    it('disables next button on last page', () => {
      renderTable(manyRows);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      const nextBtn = screen.getByRole('button', { name: /next/i });
      expect(nextBtn).toBeDisabled();
    });
  });

  describe('mobile layout', () => {
    it('wraps table in a scrollable container', () => {
      renderTable([makeTrend({ game_id: 1 })]);
      const container = screen.getByTestId('session-history-table');
      expect(container.style.overflowX).toBe('auto');
    });

    it('applies sticky positioning to first column cells', () => {
      renderTable([makeTrend({ game_id: 1 })]);
      const rows = screen.getAllByRole('row');
      // Header first cell
      const headerCell = rows[0].querySelector('th');
      expect(headerCell?.style.position).toBe('sticky');
      expect(headerCell?.style.left).toBe('0px');
      // Data first cell
      const dataCell = rows[1].querySelector('td');
      expect(dataCell?.style.position).toBe('sticky');
      expect(dataCell?.style.left).toBe('0px');
    });
  });
});

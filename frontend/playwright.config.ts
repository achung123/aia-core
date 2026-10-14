import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// End-to-end tests run the real backend and frontend against a throwaway
// SQLite database, so they never touch backend/poker.db.
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8099);
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5199);
const DATABASE = path.join(os.tmpdir(), `aia-e2e-${BACKEND_PORT}.db`);

export const API_URL = `http://127.0.0.1:${BACKEND_PORT}`;
export const APP_URL = `http://127.0.0.1:${FRONTEND_PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Each test creates its own game, but they share one backend and one database
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // The dealer and players all use phones at the table
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      name: 'backend',
      // A fresh database on every run, built by the real migrations
      command: `rm -f "${DATABASE}" && uv run alembic upgrade head && uv run uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: '../backend',
      url: `${API_URL}/`,
      env: {
        DATABASE_URL: `sqlite:///${DATABASE}`,
        ALLOWED_ORIGINS: APP_URL,
      },
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      name: 'frontend',
      command: `npx vite --host 127.0.0.1 --port ${FRONTEND_PORT} --strictPort`,
      url: APP_URL,
      env: { VITE_API_BASE_URL: API_URL },
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});

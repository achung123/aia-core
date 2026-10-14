// Plays one mock game with made-up players and takes the onboarding screenshots.
import { chromium, devices, request } from '@playwright/test';

const [, , OUT, PHOTO] = process.argv;
const BASE = 'http://127.0.0.1:5196';
const API = 'http://127.0.0.1:8096';
const NAMES = ['Ava', 'Ben', 'Cleo', 'Dan'];
const PHONE = { ...devices['Pixel 7'], deviceScaleFactor: 1.5 };
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const api = await request.newContext({ baseURL: API });
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const taken = [];
async function shot(page, name, { settle = 700, full = false } = {}) {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 82, fullPage: full });
  taken.push(name);
  console.log('shot', name);
}
const act = async (name, street, action, amount = null, force = false) => {
  const response = await api.post(
    `/games/1/hands/1/players/${name}/actions${force ? '?force=true' : ''}`,
    { data: { street, action, amount, is_all_in: false } },
  );
  if (response.status() !== 201) console.log('  ! action', name, action, response.status(), (await response.text()).slice(0, 120));
};
const cards = (name, c1, c2) =>
  api.patch(`/games/1/hands/1/players/${name}`, { data: { card_1: c1, card_2: c2 } });
const phone = async (extra = {}) => {
  const context = await browser.newContext({ ...PHONE, ...extra });
  return { context, page: await context.newPage() };
};
async function stubDetection(page, detected) {
  await page.route('**/games/*/hands/image', (route) =>
    route.fulfill({ json: { upload_id: 1, game_id: 1, file_path: 'photo.png', status: 'processing' } }),
  );
  await page.route('**/games/*/hands/image/*', (route) =>
    route.fulfill({
      json: {
        upload_id: 1, game_id: 1, status: 'completed',
        detections: detected.map((card, index) => ({
          card_position: String(index), detected_value: card, confidence: 0.97, alternatives: [],
        })),
      },
    }),
  );
}

try {
  // ───────────────────────── Dealer: set up the game ─────────────────────────
  const dealer = await phone();
  const d = dealer.page;
  await d.goto(`${BASE}/#/dealer`);
  await d.getByTestId('new-game-btn').waitFor();
  await shot(d, '03-dealer-games');
  await d.getByTestId('new-game-btn').click();
  for (const name of NAMES) {
    await d.getByPlaceholder('New player name').fill(name);
    await d.getByRole('button', { name: 'Add', exact: true }).click();
    await d.waitForTimeout(900);
  }
  await shot(d, '04-create-game');
  await d.getByRole('button', { name: 'Create Game' }).click();
  await d.getByTestId('start-hand-btn').waitFor();
  await shot(d, '05-hand-dashboard');
  await d.getByTestId('toggle-qr-btn').click();
  await shot(d, '06-qr-code', { full: true });
  await d.getByTestId('toggle-qr-btn').click();
  await d.getByTestId('start-hand-btn').click();
  await d.getByTestId('active-hand-layout').waitFor();
  await shot(d, '07-hand-awaiting-cards', { full: true });

  // ───────────────────────── Player: Ava joins from her phone ───────────────
  const ava = await phone();
  const a = ava.page;
  await a.goto(`${BASE}/#/player`);
  await a.getByTestId('game-card').first().waitFor();
  await shot(a, '08-player-pick-game');
  await a.getByTestId('game-card').first().click();
  await a.getByTestId('no-player-selected').waitFor();
  await a.getByTestId('profile-btn').click();
  await a.getByTestId('switch-profile-btn').click();
  await a.getByTestId('profile-option-Ava').waitFor();
  await shot(a, '09-player-pick-name');
  await a.getByTestId('profile-option-Ava').click();
  await a.getByTestId('capture-cards-btn').waitFor({ timeout: 20000 });
  await shot(a, '10-player-capture-button');
  await a.getByTestId('capture-cards-btn').click();
  await shot(a, '11-player-camera');
  await a.locator('input[type="file"]').setInputFiles(PHOTO);
  await shot(a, '12-player-photo-preview', { settle: 900 });
  await a.getByRole('button', { name: /use photo/i }).click();
  await a.getByRole('button', { name: 'Confirm', exact: true }).waitFor({ timeout: 90000 });
  await shot(a, '13-player-check-cards');
  await a.getByRole('button', { name: 'Confirm', exact: true }).click();
  await a.getByText('Cards submitted').waitFor({ timeout: 20000 });
  await shot(a, '14-player-cards-submitted');

  // The others hand in their cards (made-up hands, no photos needed)
  await cards('Ben', 'Ks', 'Kd');
  await cards('Cleo', 'Qs', 'Qd');
  await cards('Dan', '10c', '9c');
  await d.waitForTimeout(1500);
  await shot(d, '15-dealer-betting-turn', { full: true });

  // ───────────────────────── Cleo bets from her phone ───────────────────────
  const cleo = await phone();
  const c = cleo.page;
  await cleo.context.addInitScript(() => {
    sessionStorage.setItem('aia-active-player', JSON.stringify({ state: { playerName: 'Cleo', selectedTitle: null }, version: 0 }));
    sessionStorage.setItem('aia-player-session', JSON.stringify({ gameId: 1, playerName: 'Cleo' }));
  });
  await c.goto(`${BASE}/#/player`);
  await c.getByTestId('action-buttons').waitFor({ timeout: 30000 });
  await shot(c, '16-player-your-turn');
  await c.getByTestId('action-raise').click();
  for (const chip of ['0.50', '0.10']) await c.getByTestId(`chip-${chip}`).click();
  await shot(c, '17-player-raise-chips');
  await c.getByTestId('chip-confirm').click();
  await c.waitForTimeout(800);

  // Rest of preflop
  await act('Dan', 'preflop', 'fold');
  await act('Ava', 'preflop', 'call', 0.5);
  await act('Ben', 'preflop', 'call', 0.4);
  await d.waitForTimeout(1800);
  await shot(d, '18-dealer-deal-the-flop', { full: true });

  // ───────────────────────── Dealer photographs the flop ────────────────────
  await stubDetection(d, ['8d', '7h', '3s']);
  await d.getByTestId('flop-tile').click();
  await d.locator('input[type="file"]').setInputFiles({ name: 'flop.png', mimeType: 'image/png', buffer: PIXEL });
  await d.getByRole('button', { name: /use photo/i }).click();
  await d.getByRole('button', { name: 'Confirm', exact: true }).waitFor({ timeout: 20000 });
  await shot(d, '19-dealer-check-flop');
  await d.getByRole('button', { name: 'Confirm', exact: true }).click();
  await d.getByTestId('community-board').waitFor();
  await d.waitForTimeout(1500);
  await shot(d, '20-dealer-flop-dealt', { full: true });

  // Dealer overrides panel
  await d.getByTestId('dealer-overrides-toggle').click();
  await d.waitForTimeout(500);
  await d.getByTestId('dealer-overrides').scrollIntoViewIfNeeded();
  await shot(d, '21-dealer-overrides', { full: true });
  await d.getByTestId('dealer-overrides-toggle').click();

  // Flop, turn, river betting
  await act('Ava', 'flop', 'bet', 0.5);
  await act('Ben', 'flop', 'fold');
  await act('Cleo', 'flop', 'call', 0.5);
  await api.patch('/games/1/hands/1/turn', { data: { turn: 'Jd' } });
  await d.waitForTimeout(1200);
  await act('Ava', 'turn', 'check');
  await act('Cleo', 'turn', 'check');
  await api.patch('/games/1/hands/1/river', { data: { river: '4c' } });
  await d.waitForTimeout(1200);
  await act('Ava', 'river', 'bet', 1.0);
  await act('Cleo', 'river', 'call', 1.0);
  await d.waitForTimeout(2200);
  await shot(d, '22-dealer-finish-the-hand', { full: true });

  // 3D view with equity
  await d.getByTestId('view-toggle-btn').click();
  await d.getByTestId('table-view-3d').waitFor();
  await d.waitForTimeout(6000);
  await shot(d, '23-dealer-3d-view', { full: true });
  await d.getByTestId('view-toggle-btn').click();

  // ───────────────────────── Finish the hand ────────────────────────────────
  await d.getByRole('button', { name: 'Finish Hand' }).click();
  const confirmEarly = d.getByTestId('finish-confirm-dialog').getByRole('button', { name: /confirm|yes|finish/i });
  await d.getByTestId('review-confirm-btn').or(confirmEarly).first().waitFor();
  if (await confirmEarly.isVisible()) await confirmEarly.click();
  await d.getByTestId('review-player-Cleo-result-won').click();
  await d.getByTestId('review-player-Ava-result-lost').click();
  await d.getByTestId('payout-preview').waitFor({ timeout: 15000 });
  await d.waitForTimeout(800);
  await d.getByTestId('payout-preview').scrollIntoViewIfNeeded();
  await shot(d, '24-dealer-review-payout', { full: true });
  await d.getByTestId('review-confirm-btn').click();
  await d.getByTestId('finish-confirm-ok').click();
  await d.getByTestId('start-hand-btn').waitFor({ timeout: 20000 });
  await shot(d, '25-dealer-hand-saved', { full: true });

  // End the game
  await d.getByTestId('end-game-btn').click();
  await d.getByTestId('winner-checkbox-Cleo').click();
  await shot(d, '26-dealer-end-game');
  await d.getByTestId('end-game-confirm-yes').click();
  await d.waitForTimeout(1500);

  // ───────────────────────── Playback and the player's table ────────────────
  const viewer = await phone();
  const v = viewer.page;
  await v.goto(`${BASE}/#/playback?gameId=1`);
  await v.getByTestId('session-replay-controls').waitFor({ timeout: 30000 });
  await v.getByTestId('scrubber-street-river').click();
  await v.waitForTimeout(6000);
  await v.getByRole('button', { name: /dismiss/i }).click({ timeout: 2000 }).catch(() => {});
  await shot(v, '27-playback-river');
  await v.getByTestId('scrubber-street-showdown').click();
  await v.waitForTimeout(3000);
  await shot(v, '28-playback-showdown');

  await a.goto(`${BASE}/#/player/table?game=1&player=Ava`);
  await a.waitForTimeout(7000);
  await shot(a, '29-player-table');

  await v.goto(`${BASE}/#/`);
  await v.waitForTimeout(5500);
  await shot(v, '30-home-leaderboard', { full: true });
} catch (error) {
  console.log('FAILED:', String(error).slice(0, 500));
  process.exitCode = 1;
} finally {
  await browser.close();
  await api.dispose();
  console.log('screens taken:', taken.length);
}

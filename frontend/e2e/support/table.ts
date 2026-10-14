import { expect, request as playwrightRequest } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import { API_URL } from '../../playwright.config';

/** A 1x1 PNG — stands in for the photo a phone camera would take. */
const PHOTO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

let uniqueSuffix = 0;

/** Player names unique to one test, so tests can share a database. */
export function uniqueNames(...names: string[]): string[] {
  uniqueSuffix += 1;
  const tag = `${Date.now().toString(36).slice(-4)}${uniqueSuffix}`;
  return names.map((name) => `${name}${tag}`);
}

export interface Seat {
  name: string;
  page: Page;
}

/**
 * One poker table: a dealer's phone and one phone per player, all talking to
 * the real backend. The only thing faked is card recognition — the "photo"
 * is a blank pixel and the detection result is whatever the test says was dealt.
 */
export class Table {
  readonly api: APIRequestContext;
  readonly gameId: number;
  readonly dealer: Page;
  readonly players: Map<string, Page>;
  private readonly contexts: BrowserContext[];

  private constructor(
    api: APIRequestContext, gameId: number, dealer: Page, players: Map<string, Page>, contexts: BrowserContext[],
  ) {
    this.api = api;
    this.gameId = gameId;
    this.dealer = dealer;
    this.players = players;
    this.contexts = contexts;
  }

  /** Create a game (seat order = name order) and sit everyone down at their phone. */
  static async open(browser: Browser, names: string[], buyIns: number | Record<string, number> = 20): Promise<Table> {
    const api = await playwrightRequest.newContext({ baseURL: API_URL });
    const defaultBuyIn = typeof buyIns === 'number' ? buyIns : 20;
    const created = await api.post('/games', {
      data: {
        game_date: new Date().toISOString().slice(0, 10),
        player_names: names,
        default_buy_in: defaultBuyIn,
        ...(typeof buyIns === 'number' ? {} : { player_buy_ins: buyIns }),
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const gameId: number = (await created.json()).game_id;

    const contexts: BrowserContext[] = [];
    const dealerContext = await browser.newContext();
    contexts.push(dealerContext);
    const dealer = await dealerContext.newPage();

    const players = new Map<string, Page>();
    for (const name of names) {
      const context = await browser.newContext();
      contexts.push(context);
      // What the app stores once a player has picked their name and game
      await context.addInitScript(
        ([playerName, id]) => {
          sessionStorage.setItem('aia-active-player', JSON.stringify({ state: { playerName, selectedTitle: null }, version: 0 }));
          sessionStorage.setItem('aia-player-session', JSON.stringify({ gameId: id, playerName }));
        },
        [name, gameId] as const,
      );
      const page = await context.newPage();
      await page.goto('/#/player');
      await expect(page.getByRole('heading', { name })).toBeVisible();
      players.set(name, page);
    }

    await dealer.goto('/#/dealer');
    await dealer.getByTestId('game-card').filter({ hasText: `#${gameId}` }).click();
    await expect(dealer.getByTestId('start-hand-btn')).toBeVisible();

    return new Table(api, gameId, dealer, players, contexts);
  }

  async close(): Promise<void> {
    await Promise.all(this.contexts.map((context) => context.close()));
    await this.api.dispose();
  }

  page(name: string): Page {
    const page = this.players.get(name);
    if (!page) throw new Error(`No player named ${name} at this table`);
    return page;
  }

  // ── Dealer ────────────────────────────────────────────────────────────

  async startHand(): Promise<void> {
    await this.dealer.getByTestId('start-hand-btn').click();
    await expect(this.dealer.getByTestId('active-hand-layout')).toBeVisible();
  }

  /** Dealer photographs a street; recognition "sees" the given cards. */
  async dealStreet(street: 'flop' | 'turn' | 'river', cards: string[]): Promise<void> {
    await this.dealer.getByTestId(`${street}-tile`).click();
    await photographCards(this.dealer, cards);
    for (const card of cards) {
      await expect(this.dealer.getByTestId('community-board')).toContainText(prettyCard(card));
    }
  }

  async openOverrides(): Promise<void> {
    const toggle = this.dealer.getByTestId('dealer-overrides-toggle');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  }

  /** Dealer finishes the hand, marking the given players as winners. */
  async finishHand(winners: string[], losers: string[] = []): Promise<void> {
    await this.dealer.getByRole('button', { name: 'Finish Hand' }).click();
    // The dashboard may ask to confirm before moving to review
    const confirmEarly = this.dealer.getByTestId('finish-confirm-dialog').getByRole('button', { name: /confirm|yes|finish/i });
    await expect(this.dealer.getByTestId('review-confirm-btn').or(confirmEarly)).toBeVisible();
    if (await confirmEarly.isVisible()) await confirmEarly.click();

    for (const name of winners) await this.dealer.getByTestId(`review-player-${name}-result-won`).click();
    for (const name of losers) await this.dealer.getByTestId(`review-player-${name}-result-lost`).click();
    await this.dealer.getByTestId('review-confirm-btn').click();
    await this.dealer.getByTestId('finish-confirm-ok').click();
    await expect(this.dealer.getByTestId('start-hand-btn')).toBeVisible();
  }

  // ── Players ───────────────────────────────────────────────────────────

  /** Every player photographs their hole cards. */
  async everyoneShowsCards(cards: Record<string, [string, string]>): Promise<void> {
    for (const [name, hole] of Object.entries(cards)) {
      const page = this.page(name);
      await page.getByTestId('capture-cards-btn').click();
      // The phone saves the cards in the background; make sure the save lands
      const saved = page.waitForResponse(
        (response) => response.request().method() === 'PATCH' && /\/hands\/\d+\/players\//.test(response.url()),
      );
      await photographCards(page, hole);
      const response = await saved;
      expect(response.ok(), `${name}'s cards were rejected: ${await response.text()}`).toBeTruthy();
    }
  }

  async waitForTurn(name: string): Promise<void> {
    await expect(this.page(name).getByTestId('action-buttons')).toBeVisible();
  }

  async fold(name: string): Promise<void> {
    await this.waitForTurn(name);
    await this.page(name).getByTestId('action-fold').click();
    await this.turnPassed(name);
  }

  async check(name: string): Promise<void> {
    await this.waitForTurn(name);
    await this.page(name).getByTestId('action-check').click();
    await this.turnPassed(name);
  }

  async call(name: string): Promise<void> {
    await this.waitForTurn(name);
    await this.page(name).getByTestId('action-call').click();
    await this.turnPassed(name);
  }

  /** Bet or raise by tapping chips that add up to `amount` (new money this action). */
  async wager(name: string, action: 'bet' | 'raise', amount: number): Promise<void> {
    await this.waitForTurn(name);
    const page = this.page(name);
    await page.getByTestId(`action-${action}`).click();
    for (const chip of chipsFor(amount)) await page.getByTestId(`chip-${chip.toFixed(2)}`).click();
    await expect(page.getByTestId('chip-total')).toContainText(amount.toFixed(2));
    await page.getByTestId('chip-confirm').click();
    await this.turnPassed(name);
  }

  async allIn(name: string, action: 'bet' | 'raise'): Promise<void> {
    await this.waitForTurn(name);
    const page = this.page(name);
    await page.getByTestId(`action-${action}`).click();
    await page.getByTestId('chip-all-in').click();
    await this.turnPassed(name);
  }

  private async turnPassed(name: string): Promise<void> {
    await expect(this.page(name).getByTestId('action-error')).toHaveCount(0);
    await expect(this.page(name).getByTestId('action-buttons')).toBeHidden();
  }

  // ── What the server says ──────────────────────────────────────────────

  async status(handNumber = 1): Promise<HandStatus> {
    const response = await this.api.get(`/games/${this.gameId}/hands/${handNumber}/status`);
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }

  async stacks(handNumber = 1): Promise<Record<string, number>> {
    const status = await this.status(handNumber);
    return Object.fromEntries(status.players.map((player) => [player.name, player.current_chips]));
  }

  async hand(handNumber = 1): Promise<HandRecord> {
    const response = await this.api.get(`/games/${this.gameId}/hands/${handNumber}`);
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  }

  async results(handNumber = 1): Promise<Record<string, { result: string | null; profit_loss: number | null }>> {
    const hand = await this.hand(handNumber);
    return Object.fromEntries(
      hand.player_hands.map((entry) => [entry.player_name, { result: entry.result, profit_loss: entry.profit_loss }]),
    );
  }

  /** The stack a player sees on their own phone. */
  async expectStackOnPhone(name: string, amount: number): Promise<void> {
    await expect(this.page(name).getByTestId('player-stack')).toHaveText(`Stack: $${amount.toFixed(2)}`);
  }
}

export interface HandStatus {
  phase: string;
  pot: number;
  current_player_name: string | null;
  amount_to_call: number;
  action_index: number;
  side_pots: { amount: number; eligible_players: string[] }[];
  players: { name: string; current_chips: number; result: string | null }[];
}

export interface HandRecord {
  pot: number;
  sb_player_name: string | null;
  bb_player_name: string | null;
  player_hands: { player_name: string; result: string | null; profit_loss: number | null }[];
}

/**
 * Take a "photo" on the given phone and confirm what was recognised.
 * Only the upload and detection calls are stubbed; saving the cards is real.
 */
async function photographCards(page: Page, cards: string[]): Promise<void> {
  const uploadRoute = '**/games/*/hands/image';
  const detectionRoute = '**/games/*/hands/image/*';
  await page.route(uploadRoute, (route) =>
    route.fulfill({ json: { upload_id: 1, game_id: 0, file_path: 'e2e.png', status: 'processing' } }),
  );
  await page.route(detectionRoute, (route) =>
    route.fulfill({
      json: {
        upload_id: 1,
        game_id: 0,
        status: 'completed',
        detections: cards.map((card, index) => ({
          card_position: String(index),
          detected_value: card,
          confidence: 0.99,
          alternatives: [],
        })),
      },
    }),
  );

  await page.locator('input[type="file"]').setInputFiles({ name: 'cards.png', mimeType: 'image/png', buffer: PHOTO });
  await page.getByRole('button', { name: /use photo/i }).click();
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();

  await page.unroute(uploadRoute);
  await page.unroute(detectionRoute);
}

/** Break an amount into the chip buttons the picker offers. */
function chipsFor(amount: number): number[] {
  const values = [3, 2, 1, 0.5, 0.4, 0.3, 0.2, 0.1];
  const chips: number[] = [];
  let cents = Math.round(amount * 100);
  for (const value of values) {
    const valueCents = Math.round(value * 100);
    while (cents >= valueCents) {
      chips.push(value);
      cents -= valueCents;
    }
  }
  if (cents !== 0) throw new Error(`Cannot make ${amount} out of chips`);
  return chips;
}

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };

/** 'Ah' → 'A♥', as the board renders it. */
function prettyCard(card: string): string {
  const rank = card.slice(0, -1).toUpperCase();
  return `${rank === 'T' ? '10' : rank}${SUIT_SYMBOLS[card.slice(-1).toLowerCase()]}`;
}

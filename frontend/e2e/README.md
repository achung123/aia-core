# End-to-end tests

Playwright drives a whole table: one phone for the dealer and one per player, each in
its own browser context, all talking to the real backend and frontend.

```bash
cd frontend
npx playwright install chromium   # first time only
npm run e2e                       # headless
npm run e2e:headed                # watch the phones
npx playwright test full-hand     # one scenario
npx playwright show-trace test-results/<test>/trace.zip   # after a failure
```

The config starts both servers itself: the backend on port 8099 against a fresh SQLite
database in the temp directory (built with `alembic upgrade head`), and Vite on 5199.
Your `backend/poker.db` is never touched. Override the ports with `E2E_BACKEND_PORT` /
`E2E_FRONTEND_PORT`.

## What is real and what is not

Everything is real except card recognition. When a test "photographs" cards, the upload
and detection calls are stubbed to return the cards the test names; saving them, the
betting, the dealer's review and the payout all go through the app as a person would.

## Scenarios

| File | What it proves |
|---|---|
| `full-hand.e2e.ts` | Three players bet across every street; the winner is paid and P&L sums to zero |
| `all-in-side-pot.e2e.ts` | A short all-in winner takes only the main pot; the cards decide the side pot |
| `fold-to-one.e2e.ts` | The last player standing is paid once (finishing the hand does not pay again); blinds move on the next hand |
| `dealer-overrides.e2e.ts` | Undo a misclick, act for a player, give the turn, correct a stack |

## Writing a new one

`support/table.ts` has a `Table` helper that reads like the game:

```ts
const table = await Table.open(browser, [alice, bob, carol], 20);
await table.startHand();
await table.everyoneShowsCards({ [alice]: ['Ah', 'Ad'], ... });
await table.wager(carol, 'raise', 0.6);
await table.call(alice);
await table.dealStreet('flop', ['3c', '8d', '9s']);
await table.finishHand([alice], [bob]);
expect(await table.stacks()).toEqual({ ... });
```

Use `uniqueNames()` for player names — tests share one database. Tens are written `10h`,
not `Th`. Players' phones poll every five seconds, so a hand takes 30–45 seconds.

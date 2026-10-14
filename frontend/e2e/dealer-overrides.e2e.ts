import { test, expect } from '@playwright/test';
import { Table, uniqueNames } from './support/table';

test('the dealer undoes a misclick, acts for a player, and corrects a stack', async ({ browser }) => {
  const [alice, bob, carol] = uniqueNames('Alice', 'Bob', 'Carol');
  const table = await Table.open(browser, [alice, bob, carol], 20);

  await table.startHand();
  await table.everyoneShowsCards({
    [alice]: ['Ah', 'Ad'],
    [bob]: ['Kh', 'Kd'],
    [carol]: ['7c', '2s'],
  });

  // Carol raises by mistake
  await table.wager(carol, 'raise', 3);
  expect((await table.stacks())[carol]).toBe(17);

  // Undo: her chips come back and it is her turn again
  await table.openOverrides();
  await table.dealer.getByTestId('dealer-undo').click();
  await expect(table.dealer.getByText(`Act for ${carol}`)).toBeVisible();
  let status = await table.status();
  expect(status.pot).toBe(0.3);
  expect(status.current_player_name).toBe(carol);
  expect((await table.stacks())[carol]).toBe(20);

  // Carol has stepped away: the dealer calls for her
  await table.dealer.getByTestId('dealer-overrides').getByTestId('action-call').click();
  await expect(table.dealer.getByText(`Act for ${alice}`)).toBeVisible();
  status = await table.status();
  expect(status.pot).toBe(0.5);
  expect(status.current_player_name).toBe(alice);

  // Bob is in the big blind; the dealer skips ahead and gives him the turn
  await table.dealer.getByTestId('dealer-give-turn').selectOption(bob);
  await expect(table.dealer.getByText(`Act for ${bob}`)).toBeVisible();
  await table.waitForTurn(bob);

  // Bob's stack was miscounted at buy-in
  await table.dealer.getByTestId('dealer-stack-player').selectOption(bob);
  await table.dealer.getByTestId('dealer-stack-amount').fill('25');
  await table.dealer.getByTestId('dealer-stack-reason').fill('miscounted buy-in');
  await table.dealer.getByTestId('dealer-stack-save').click();
  await table.expectStackOnPhone(bob, 25);

  const log = await (await table.api.get(`/games/${table.gameId}/chip-adjustments`)).json();
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ player_name: bob, delta: 5.2, chips_after: 25, reason: 'miscounted buy-in' });

  await table.close();
});

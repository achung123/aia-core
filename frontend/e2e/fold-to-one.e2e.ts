import { test, expect } from '@playwright/test';
import { Table, uniqueNames } from './support/table';

test('everyone folds to a raise: the raiser is paid once, and the next hand moves the blinds', async ({ browser }) => {
  const [alice, bob, carol] = uniqueNames('Alice', 'Bob', 'Carol');
  const table = await Table.open(browser, [alice, bob, carol], 20);

  await table.startHand();
  await table.everyoneShowsCards({
    [alice]: ['Ah', 'Ad'],
    [bob]: ['Kh', 'Kd'],
    [carol]: ['7c', '2s'],
  });

  await table.wager(carol, 'raise', 1);
  await table.fold(alice);
  await table.fold(bob);

  // Paid as soon as the last opponent folds: her 1.00 back plus the blinds
  const paid = { [alice]: 19.9, [bob]: 19.8, [carol]: 20.3 };
  expect(await table.stacks()).toEqual(paid);
  await table.expectStackOnPhone(carol, 20.3);

  // The dealer still walks through "Finish Hand" — that must not pay again
  await table.finishHand([]);
  expect(await table.stacks()).toEqual(paid);
  expect(await table.results()).toEqual({
    [alice]: { result: 'folded', profit_loss: -0.1 },
    [bob]: { result: 'folded', profit_loss: -0.2 },
    [carol]: { result: 'won', profit_loss: 0.3 },
  });

  // Hand 2: blinds move one seat and come out of the new stacks
  await table.startHand();
  await table.everyoneShowsCards({
    [alice]: ['Qh', 'Qd'],
    [bob]: ['Jh', 'Jd'],
    [carol]: ['10h', '10d'],
  });
  const second = await table.hand(2);
  expect(second.sb_player_name).toBe(bob);
  expect(second.bb_player_name).toBe(carol);
  expect(await table.stacks(2)).toEqual({ [alice]: 19.9, [bob]: 19.7, [carol]: 20.1 });
  await table.waitForTurn(alice);

  await table.close();
});

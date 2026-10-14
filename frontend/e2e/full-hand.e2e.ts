import { test, expect } from '@playwright/test';
import { Table, uniqueNames } from './support/table';

test('three players play a hand to showdown and the winner is paid', async ({ browser }) => {
  const [alice, bob, carol] = uniqueNames('Alice', 'Bob', 'Carol');
  const table = await Table.open(browser, [alice, bob, carol], 20);

  await table.startHand();
  await table.everyoneShowsCards({
    [alice]: ['Ah', 'Ad'],
    [bob]: ['Kh', 'Kd'],
    [carol]: ['7c', '2s'],
  });

  // Blinds: Alice 0.10, Bob 0.20. Carol is first to act.
  await table.wager(carol, 'raise', 0.6);
  await table.call(alice);
  await table.call(bob);
  expect((await table.status()).pot).toBe(1.8);

  await table.dealStreet('flop', ['3c', '8d', '9s']);
  await table.check(alice);
  await table.wager(bob, 'bet', 1);
  await table.fold(carol);
  await table.call(alice);

  await table.dealStreet('turn', ['4h']);
  await table.check(alice);
  await table.check(bob);

  await table.dealStreet('river', ['Jc']);
  await table.check(alice);
  await table.check(bob);

  await table.finishHand([alice], [bob]);

  // Pot: 0.60 x 3 preflop + 1.00 x 2 on the flop = 3.80
  expect(await table.results()).toEqual({
    [alice]: { result: 'won', profit_loss: 2.2 },
    [bob]: { result: 'lost', profit_loss: -1.6 },
    [carol]: { result: 'folded', profit_loss: -0.6 },
  });
  expect(await table.stacks()).toEqual({ [alice]: 22.2, [bob]: 18.4, [carol]: 19.4 });
  await table.expectStackOnPhone(alice, 22.2);
  await table.expectStackOnPhone(carol, 19.4);

  await table.close();
});

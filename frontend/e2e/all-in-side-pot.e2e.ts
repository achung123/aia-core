import { test, expect } from '@playwright/test';
import { Table, uniqueNames } from './support/table';

test('a short-stacked all-in winner takes only the main pot; the side pot goes to the next best hand', async ({ browser }) => {
  const [alice, bob, carol] = uniqueNames('Alice', 'Bob', 'Carol');
  const table = await Table.open(browser, [alice, bob, carol], { [alice]: 5, [bob]: 20, [carol]: 20 });

  await table.startHand();
  await table.everyoneShowsCards({
    [alice]: ['Ah', 'Ad'], // best hand, shortest stack
    [bob]: ['Kh', 'Kd'],
    [carol]: ['7c', '2s'],
  });

  await table.wager(carol, 'raise', 6);
  await table.call(alice); // only 4.90 behind: the call puts Alice all-in
  await table.call(bob);

  const afterPreflop = await table.status();
  expect(afterPreflop.pot).toBe(17);
  expect(afterPreflop.side_pots).toEqual([{ amount: 2, eligible_players: [bob, carol] }]);
  expect((await table.stacks())[alice]).toBe(0);

  // Alice is all-in, so only Bob and Carol act from here
  await table.dealStreet('flop', ['3c', '8d', '9s']);
  await table.check(bob);
  await table.check(carol);
  await table.dealStreet('turn', ['4h']);
  await table.check(bob);
  await table.check(carol);
  await table.dealStreet('river', ['Jc']);
  await table.check(bob);
  await table.check(carol);

  // The dealer only says Alice won; the cards decide the side pot
  await table.finishHand([alice], [bob, carol]);

  expect(await table.results()).toEqual({
    [alice]: { result: 'won', profit_loss: 10 }, // main pot 15 for her 5
    [bob]: { result: 'won', profit_loss: -4 }, // side pot 2 back for his 6
    [carol]: { result: 'lost', profit_loss: -6 },
  });
  expect(await table.stacks()).toEqual({ [alice]: 15, [bob]: 16, [carol]: 14 });
  await table.expectStackOnPhone(alice, 15);

  await table.close();
});

import { test, expect } from '@playwright/test';
import { Table, uniqueNames } from './support/table';

test('player table sees a dealer-dealt flop without reloading', async ({ browser }) => {
  const [alice, bob, carol] = uniqueNames('Alice', 'Bob', 'Carol');
  const table = await Table.open(browser, [alice, bob, carol], 20);

  try {
    await table.startHand();
    await table.everyoneShowsCards({
      [alice]: ['Ah', 'Ad'],
      [bob]: ['Kh', 'Kd'],
      [carol]: ['7c', '2s'],
    });
    await table.call(carol);
    await table.call(alice);
    await table.check(bob);

    const alicePhone = table.page(alice);
    await alicePhone.getByTestId('table-view-btn').click();
    await expect(alicePhone).toHaveURL(/#\/player\/table/);
    await expect(alicePhone.locator('canvas')).toBeVisible();

    let reloads = 0;
    alicePhone.on('load', () => { reloads += 1; });

    await table.dealStreet('flop', ['3c', '8d', '9s']);
    await expect(alicePhone.getByTestId('player-table-street')).toHaveText('Street: flop');
    await alicePhone.waitForTimeout(500);

    expect(reloads).toBe(0);
  } finally {
    await table.close();
  }
});

// T-032 — unit test for the `no-equity-in-player` ESLint rule (layer 3
// of the triple-layer equity gate). Uses ESLint's built-in RuleTester
// driven by vitest describe/it globals so the test runs under
// `npx vitest run` alongside the rest of the frontend suite.

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-equity-in-player.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only ?? it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
});

ruleTester.run('no-equity-in-player', rule, {
  valid: [
    // Unrelated imports are fine.
    { code: "import { fetchGame } from '../api/client';" },
    { code: "import { useHandPolling } from '../hooks/useHandPolling';" },
    { code: "import { PokerTable } from '../scenes3d/PokerTable';" },
    // No imports at all.
    { code: 'const x = 1;' },
  ],
  invalid: [
    {
      code: "import { fetchEquity } from '../api/client';",
      errors: [{ messageId: 'forbidden', data: { name: 'fetchEquity' } }],
    },
    {
      code: "import { useEquityQuery } from '../scenes3d/data/useEquityQuery';",
      errors: [{ messageId: 'forbidden', data: { name: 'useEquityQuery' } }],
    },
    {
      code: "import { calculateEquity } from '../poker/evaluator';",
      errors: [{ messageId: 'forbidden', data: { name: 'calculateEquity' } }],
    },
    // Mixed: only the forbidden name is flagged.
    {
      code: "import { fetchGame, fetchEquity } from '../api/client';",
      errors: [{ messageId: 'forbidden', data: { name: 'fetchEquity' } }],
    },
    // Alias imports — `.imported.name` is the thing that matters.
    {
      code: "import { fetchEquity as e } from '../api/client';",
      errors: [{ messageId: 'forbidden', data: { name: 'fetchEquity' } }],
    },
    // Default import with a matching local name.
    {
      code: "import fetchEquity from '../api/client';",
      errors: [{ messageId: 'forbidden', data: { name: 'fetchEquity' } }],
    },
    // All three forbidden names in one statement — three errors.
    {
      code:
        "import { fetchEquity, useEquityQuery, calculateEquity } from 'somewhere';",
      errors: [
        { messageId: 'forbidden', data: { name: 'fetchEquity' } },
        { messageId: 'forbidden', data: { name: 'useEquityQuery' } },
        { messageId: 'forbidden', data: { name: 'calculateEquity' } },
      ],
    },
  ],
});

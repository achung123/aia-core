// T-032 — ESLint rule `no-equity-in-player` (layer 3 of the triple-layer
// equity gate from plan.md § "Equity Overlay — Enforcement Model").
//
// Layers:
//   1. Runtime prop guard — `resolveEquityOverlay(prop, viewer)` in
//      `frontend/src/scenes3d/state/equityGuard.ts`.
//   2. Query-layer gate — `useEquityQuery.enabled` short-circuits so
//      react-query never invokes the fetcher under player policy.
//   3. **This rule** — static-analysis denylist that bars any import of
//      `fetchEquity`, `useEquityQuery`, or `calculateEquity` under files
//      that render the player POV (scoped via `files:` in
//      `eslint.config.js`).
//
// Rationale: even if a future refactor accidentally strips the runtime
// guards, this rule fails `npm run lint` at build time so opponent-range
// leakage through the equity endpoint cannot ship.
//
// The rule matches by **imported specifier name**, not module path —
// this is intentionally strict. Any of the three named imports from any
// module path under a scoped file trips the rule. Alias imports
// (`import { fetchEquity as x }`) are also flagged because the imported
// identifier is what matters (`.imported.name`).

const FORBIDDEN_NAMES = new Set([
  'fetchEquity',
  'useEquityQuery',
  'calculateEquity',
]);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow equity helper imports in player-POV files (layer 3 of the equity gate).',
    },
    schema: [],
    messages: {
      forbidden:
        'Equity helper "{{ name }}" must not be imported in player-POV files; equity is gated off under viewer.policy="player".',
    },
  },
  create(context) {
    function check(node) {
      for (const spec of node.specifiers) {
        // Named imports: `import { fetchEquity } from ...`
        if (spec.type === 'ImportSpecifier' && spec.imported && FORBIDDEN_NAMES.has(spec.imported.name)) {
          context.report({ node: spec, messageId: 'forbidden', data: { name: spec.imported.name } });
          continue;
        }
        // Default imports where the local name matches — rare but catch
        // cases like `import fetchEquity from '...'`.
        if (spec.type === 'ImportDefaultSpecifier' && FORBIDDEN_NAMES.has(spec.local.name)) {
          context.report({ node: spec, messageId: 'forbidden', data: { name: spec.local.name } });
        }
      }
    }
    return {
      ImportDeclaration: check,
    };
  },
};

export default rule;

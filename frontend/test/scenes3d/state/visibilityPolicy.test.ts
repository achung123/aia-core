import { describe, it, expect } from 'vitest';

import { canSee } from '../../../src/scenes3d/state/visibilityPolicy';
import type { TableStatePhase } from '../../../src/scenes3d/types';

const PRE_SHOWDOWN_PHASES: TableStatePhase[] = [
  'awaiting_cards',
  'preflop',
  'flop',
  'turn',
  'river',
];

const ALL_PHASES: TableStatePhase[] = [...PRE_SHOWDOWN_PHASES, 'showdown'];

describe('canSee — spectator policy', () => {
  // Row 1: spectator hides cards until showdown, regardless of fold state.
  it.each(PRE_SHOWDOWN_PHASES)(
    'hides all cards in phase %s (folded=false)',
    (phase) => {
      expect(
        canSee({
          viewerSeat: null,
          cardOwnerSeat: 3,
          policy: 'spectator',
          phase,
          ownerFolded: false,
        }),
      ).toBe(false);
    },
  );

  it.each(PRE_SHOWDOWN_PHASES)(
    'hides all cards in phase %s (folded=true)',
    (phase) => {
      expect(
        canSee({
          viewerSeat: null,
          cardOwnerSeat: 3,
          policy: 'spectator',
          phase,
          ownerFolded: true,
        }),
      ).toBe(false);
    },
  );

  // Row 2: spectator + showdown + folded → hidden.
  it('hides folded cards at showdown', () => {
    expect(
      canSee({
        viewerSeat: null,
        cardOwnerSeat: 2,
        policy: 'spectator',
        phase: 'showdown',
        ownerFolded: true,
      }),
    ).toBe(false);
  });

  // Row 3: spectator + showdown + not folded → revealed.
  it('reveals non-folded cards at showdown', () => {
    expect(
      canSee({
        viewerSeat: null,
        cardOwnerSeat: 2,
        policy: 'spectator',
        phase: 'showdown',
        ownerFolded: false,
      }),
    ).toBe(true);
  });

  it('ignores viewerSeat (spectator never equals an owner)', () => {
    // Even if a stray viewerSeat is passed, spectator policy must not
    // accidentally leak based on seat-equality; only phase/fold matters.
    expect(
      canSee({
        viewerSeat: 2,
        cardOwnerSeat: 2,
        policy: 'spectator',
        phase: 'preflop',
        ownerFolded: false,
      }),
    ).toBe(false);
  });
});

describe('canSee — player policy', () => {
  // Row 4: own cards always revealed.
  it.each(ALL_PHASES)(
    "reveals viewer's own cards in phase %s (folded=false)",
    (phase) => {
      expect(
        canSee({
          viewerSeat: 4,
          cardOwnerSeat: 4,
          policy: 'player',
          phase,
          ownerFolded: false,
        }),
      ).toBe(true);
    },
  );

  it.each(ALL_PHASES)(
    "reveals viewer's own cards in phase %s even if marked folded",
    (phase) => {
      expect(
        canSee({
          viewerSeat: 4,
          cardOwnerSeat: 4,
          policy: 'player',
          phase,
          ownerFolded: true,
        }),
      ).toBe(true);
    },
  );

  // Row 5: folded opponents are never revealed.
  it.each(ALL_PHASES)(
    'hides folded opponents in phase %s',
    (phase) => {
      expect(
        canSee({
          viewerSeat: 4,
          cardOwnerSeat: 1,
          policy: 'player',
          phase,
          ownerFolded: true,
        }),
      ).toBe(false);
    },
  );

  // Row 6: non-folded opponents hidden before showdown.
  it.each(PRE_SHOWDOWN_PHASES)(
    'hides non-folded opponents in phase %s',
    (phase) => {
      expect(
        canSee({
          viewerSeat: 4,
          cardOwnerSeat: 1,
          policy: 'player',
          phase,
          ownerFolded: false,
        }),
      ).toBe(false);
    },
  );

  // Row 7: non-folded opponents revealed at showdown.
  it('reveals non-folded opponents at showdown', () => {
    expect(
      canSee({
        viewerSeat: 4,
        cardOwnerSeat: 1,
        policy: 'player',
        phase: 'showdown',
        ownerFolded: false,
      }),
    ).toBe(true);
  });

  // viewerSeat=null edge: in player policy, no viewer → treat all cards as
  // opponents. Non-folded + showdown still reveals, earlier phases hide.
  it('treats viewerSeat=null as non-owner in player policy', () => {
    expect(
      canSee({
        viewerSeat: null,
        cardOwnerSeat: 2,
        policy: 'player',
        phase: 'preflop',
        ownerFolded: false,
      }),
    ).toBe(false);
    expect(
      canSee({
        viewerSeat: null,
        cardOwnerSeat: 2,
        policy: 'player',
        phase: 'showdown',
        ownerFolded: false,
      }),
    ).toBe(true);
    expect(
      canSee({
        viewerSeat: null,
        cardOwnerSeat: 2,
        policy: 'player',
        phase: 'showdown',
        ownerFolded: true,
      }),
    ).toBe(false);
  });
});

describe('canSee — purity', () => {
  it('does not mutate its input args', () => {
    const args = {
      viewerSeat: 1,
      cardOwnerSeat: 2,
      policy: 'player' as const,
      phase: 'flop' as const,
      ownerFolded: false,
    };
    const snapshot = { ...args };
    canSee(args);
    expect(args).toEqual(snapshot);
  });

  it('returns the same result for identical inputs (referentially pure)', () => {
    const a = canSee({
      viewerSeat: 0,
      cardOwnerSeat: 1,
      policy: 'spectator',
      phase: 'showdown',
      ownerFolded: false,
    });
    const b = canSee({
      viewerSeat: 0,
      cardOwnerSeat: 1,
      policy: 'spectator',
      phase: 'showdown',
      ownerFolded: false,
    });
    expect(a).toBe(b);
    expect(a).toBe(true);
  });
});

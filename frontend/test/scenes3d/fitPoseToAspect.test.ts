import { describe, it, expect } from 'vitest';

import {
  CAMERA_PRESETS,
  PORTRAIT_ASPECT,
  computeSeatPresetPose,
  fitAlongViewDirection,
  fitPoseToAspect,
  measureFit,
  orientPoseForAspect,
} from '../../src/scenes3d/animations/cameraPresets';
import { computeLabelScale } from '../../src/scenes3d/components/labelScale';

const FOV = 45;

function distance(pose: { position: number[]; target: number[] }): number {
  return Math.hypot(
    pose.position[0] - pose.target[0],
    pose.position[1] - pose.target[1],
    pose.position[2] - pose.target[2],
  );
}

describe('orientPoseForAspect', () => {
  it('leaves a landscape screen alone', () => {
    expect(orientPoseForAspect(CAMERA_PRESETS.topDown, 1.6)).toBe(CAMERA_PRESETS.topDown);
  });

  it('turns the overhead camera a quarter on a portrait screen', () => {
    const turned = orientPoseForAspect(CAMERA_PRESETS.topDown, 0.46);
    expect(turned.position[0]).toBeCloseTo(0.01, 6);
    expect(turned.position[1]).toBe(12);
    expect(turned.position[2]).toBeCloseTo(0, 6);
  });

  it('only turns cameras that look straight down', () => {
    expect(orientPoseForAspect(CAMERA_PRESETS.default, 0.46)).toBe(CAMERA_PRESETS.default);
    expect(orientPoseForAspect(CAMERA_PRESETS.cinematic, 0.46)).toBe(CAMERA_PRESETS.cinematic);
  });

  it('treats the portrait threshold as exclusive', () => {
    expect(orientPoseForAspect(CAMERA_PRESETS.topDown, PORTRAIT_ASPECT)).toBe(CAMERA_PRESETS.topDown);
  });
});

describe('fitPoseToAspect', () => {
  it('keeps an overhead target fixed and only slides along the view axis', () => {
    const fitted = fitPoseToAspect(CAMERA_PRESETS.topDown, 1.5, FOV);
    expect(fitted.target).toEqual(CAMERA_PRESETS.topDown.target);
    expect(fitted.position[0]).toBeCloseTo(0, 6);
  });

  it('backs off for a narrow screen and comes in for a wide one', () => {
    const narrow = distance(fitPoseToAspect(CAMERA_PRESETS.default, 0.5, FOV));
    const wide = distance(fitPoseToAspect(CAMERA_PRESETS.default, 2.2, FOV));
    expect(narrow).toBeGreaterThan(wide);
  });

  it('gives a portrait phone a closer camera by turning the table', () => {
    const turned = distance(fitPoseToAspect(CAMERA_PRESETS.topDown, 0.46, FOV));
    // The same overhead view, offset just enough that it is not treated as
    // straight down and so is not turned
    const notTurned = distance(
      fitPoseToAspect({ position: [0, 12, 1.5], target: [0, 0, 0] }, 0.46, FOV),
    );
    expect(turned).toBeGreaterThan(0);
    expect(turned).toBeLessThan(notTurned * 0.8);
  });

  it('leaves room for labels at the size they will be drawn', () => {
    const fitted = distance(fitPoseToAspect(CAMERA_PRESETS.default, 0.46, FOV));
    // The fit is self-consistent: labels drawn at the fitted distance are
    // the size the fit allowed for, and never exceed the cap.
    expect(computeLabelScale(fitted)).toBeLessThanOrEqual(2);
    expect(computeLabelScale(fitted)).toBeGreaterThanOrEqual(1);
  });

  it('returns the pose untouched when the aspect is unknown', () => {
    expect(fitPoseToAspect(CAMERA_PRESETS.default, null, FOV)).toBe(CAMERA_PRESETS.default);
    expect(fitPoseToAspect(CAMERA_PRESETS.default, 0, FOV)).toBe(CAMERA_PRESETS.default);
    expect(fitPoseToAspect(CAMERA_PRESETS.default, NaN, FOV)).toBe(CAMERA_PRESETS.default);
  });
});

describe('fitPoseToAspect — oblique views are centred on what is on screen', () => {
  const aspects = [0.46, 0.75, 1.0, 1.78, 2.4];
  const poses = [
    ['seat 0 of 6', computeSeatPresetPose(0, 6)],
    ['seat 2 of 6', computeSeatPresetPose(2, 6)],
    ['seat 0 of 2', computeSeatPresetPose(0, 2)],
    ['seat 4 of 9', computeSeatPresetPose(4, 9)],
    ['default', CAMERA_PRESETS.default],
  ] as const;

  for (const [name, pose] of poses) {
    for (const aspect of aspects) {
      it(`${name} @ ${aspect}: everything stays on screen`, () => {
        const fitted = fitPoseToAspect(pose, aspect, FOV);
        const measure = measureFit(fitted, aspect, FOV);
        expect(measure.inside).toBe(true);
      });

      it(`${name} @ ${aspect}: uses the frame at least as well as fitting along the view`, () => {
        const centred = measureFit(fitPoseToAspect(pose, aspect, FOV), aspect, FOV);
        const along = measureFit(fitAlongViewDirection(pose, aspect, FOV), aspect, FOV);
        const used = (m: { fillX: number; fillY: number }) => Math.max(m.fillX, m.fillY);
        // Equal is fine (an already-tight fit); it must never be looser
        expect(used(centred)).toBeGreaterThanOrEqual(used(along) - 0.02);
        // ...and it must really fill the frame in one direction
        expect(used(centred)).toBeGreaterThan(0.85);
      });
    }
  }

  it('makes a substantial difference for a low seat view on a wide screen', () => {
    const pose = computeSeatPresetPose(0, 6);
    const along = measureFit(fitAlongViewDirection(pose, 2.4, FOV), 2.4, FOV);
    const centred = measureFit(fitPoseToAspect(pose, 2.4, FOV), 2.4, FOV);
    const area = (m: { fillX: number; fillY: number }) => m.fillX * m.fillY;
    expect(area(centred)).toBeGreaterThan(area(along) * 1.2);
  });

  it('keeps the look direction inside the orbit limits', () => {
    for (const [, pose] of poses) {
      for (const aspect of aspects) {
        const fitted = fitPoseToAspect(pose, aspect, FOV);
        const rise = fitted.position[1] - fitted.target[1];
        const run = Math.hypot(
          fitted.position[0] - fitted.target[0],
          fitted.position[2] - fitted.target[2],
        );
        const polar = Math.atan2(run, rise) * (180 / Math.PI);
        expect(polar).toBeGreaterThanOrEqual(29.9);
        expect(polar).toBeLessThanOrEqual(78.1);
      }
    }
  });

  it('does not move the target far from the table', () => {
    for (const [, pose] of poses) {
      for (const aspect of aspects) {
        const fitted = fitPoseToAspect(pose, aspect, FOV);
        expect(Math.hypot(fitted.target[0], fitted.target[2])).toBeLessThan(4);
        expect(Number.isFinite(fitted.position[0] + fitted.position[1] + fitted.position[2])).toBe(true);
      }
    }
  });
});

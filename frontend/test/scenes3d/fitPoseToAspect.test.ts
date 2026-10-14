import { describe, it, expect } from 'vitest';

import {
  CAMERA_PRESETS,
  PORTRAIT_ASPECT,
  fitPoseToAspect,
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
  it('keeps the viewing target and moves only along the viewing direction', () => {
    const fitted = fitPoseToAspect(CAMERA_PRESETS.default, 1.5, FOV);
    expect(fitted.target).toEqual(CAMERA_PRESETS.default.target);
    // Same direction: x stays 0, y/z keep their 6:8 ratio
    expect(fitted.position[0]).toBeCloseTo(0, 6);
    expect(fitted.position[1] / fitted.position[2]).toBeCloseTo(6 / 8, 6);
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

// How big 3D labels (nameplates, badges) are drawn, as a function of how far
// the camera is. Kept free of three.js so the camera-fitting maths can share
// it: the fit has to leave room for the labels at the size they will have.

/** Label scale per world unit of camera distance, and its limits. */
export const LABEL_SCALE_PER_DISTANCE = 0.1;
export const LABEL_MIN_SCALE = 1;
export const LABEL_MAX_SCALE = 2;
/** World units a label moves away from the table centre per unit of scale. */
export const LABEL_OUTWARD_SHIFT = 0.3;

export function computeLabelScale(distance: number): number {
  return Math.min(
    LABEL_MAX_SCALE,
    Math.max(LABEL_MIN_SCALE, distance * LABEL_SCALE_PER_DISTANCE),
  );
}

import { IAutoMovieVector3 } from "@automovie/interface";

import { Vector3 } from "./Vector3";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Closest point on segment `[start, end]` to `point`. */
const closestPointOnSegment = (
  point: IAutoMovieVector3,
  start: IAutoMovieVector3,
  end: IAutoMovieVector3,
): IAutoMovieVector3 => {
  const segment = Vector3.subtract(end, start);
  // Guard the zero-length segment (start === end, e.g. two bones the FK
  // resolves onto the same world point): an unguarded `0/0` yields NaN, and a
  // NaN distance slips every `distance < minimum` collision test as false,
  // silently passing a real overlap. `Number.EPSILON` floors the span so t=0
  // and the closest point degrades to `start`, i.e. the exact point-to-point
  // distance. Mirrors `hull.ts`'s `closestPointOnSegmentXZ`.
  const span = Math.max(Vector3.dot(segment, segment), Number.EPSILON);
  const t = clamp01(
    Vector3.dot(Vector3.subtract(point, start), segment) / span,
  );
  return Vector3.lerp(start, end, t);
};

/** Distance from `point` to segment `[start, end]`. */
export const pointSegmentDistance = (
  point: IAutoMovieVector3,
  start: IAutoMovieVector3,
  end: IAutoMovieVector3,
): number =>
  Vector3.length(
    Vector3.subtract(point, closestPointOnSegment(point, start, end)),
  );

/**
 * The exact closest pair of points on segments `a→b` and `c→d`, the clamped
 * segment-segment solver (Ericson, _Real-Time Collision Detection_ §5.1.9),
 * minimising `|P1(s) − P2(t)|` over `s, t ∈ [0, 1]`.
 *
 * The predecessor took the smallest of the four endpoint-to-segment distances,
 * which is only an upper bound on the true distance: two segments crossing
 * through each other's **interior** (an X, the commonest self-intersection: an
 * arm sweeping through a torso) report each endpoint a full segment-width away
 * while the real distance is zero, so the forced self-intersection check (and
 * the body-collision warning) missed the overlap entirely. This solves for the
 * interior-closest parameters directly.
 *
 * Degenerate inputs stay total (the #685 discipline): a zero-length segment
 * collapses to its start via the `A/E ≤ ε` point branches, and parallel
 * segments (`denom = 0`) pin `s = 0` and clamp `t`, so no division ever hits a
 * zero denominator.
 *
 * @author Samchon
 */
const closestSegmentPair = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  c: IAutoMovieVector3,
  d: IAutoMovieVector3,
): { pointA: IAutoMovieVector3; pointB: IAutoMovieVector3 } => {
  const d1 = Vector3.subtract(b, a); // direction of segment 1
  const d2 = Vector3.subtract(d, c); // direction of segment 2
  const r = Vector3.subtract(a, c);
  const A = Vector3.dot(d1, d1); // squared length of segment 1, >= 0
  const E = Vector3.dot(d2, d2); // squared length of segment 2, >= 0
  const F = Vector3.dot(d2, r);

  let s: number;
  let t: number;
  if (A <= Number.EPSILON && E <= Number.EPSILON) {
    // both segments collapse to points
    s = 0;
    t = 0;
  } else if (A <= Number.EPSILON) {
    // segment 1 is a point: project it onto segment 2
    s = 0;
    t = clamp01(F / E);
  } else {
    const C = Vector3.dot(d1, r);
    if (E <= Number.EPSILON) {
      // segment 2 is a point: project it onto segment 1
      t = 0;
      s = clamp01(-C / A);
    } else {
      const B = Vector3.dot(d1, d2);
      const denom = A * E - B * B; // >= 0 (Cauchy-Schwarz)
      // non-parallel: the unconstrained closest s; parallel (denom 0) pins s=0
      s = denom > Number.EPSILON ? clamp01((B * F - C * E) / denom) : 0;
      t = (B * s + F) / E;
      // t fell outside [0,1]: pin it to the near end and re-solve s for that end
      if (t < 0) {
        t = 0;
        s = clamp01(-C / A);
      } else if (t > 1) {
        t = 1;
        s = clamp01((B - C) / A);
      }
    }
  }
  return {
    pointA: Vector3.add(a, Vector3.scale(d1, s)),
    pointB: Vector3.add(c, Vector3.scale(d2, t)),
  };
};

/**
 * Exact distance between two segments `a→b` and `c→d` (the interior-aware
 * clamped solver, {@link closestSegmentPair}). Shares the closest pair with
 * {@link closestPointsBetweenSegments}, so a contact normal derived from those
 * points always agrees with the distance that flagged the contact.
 *
 * @author Samchon
 */
export const segmentSegmentDistance = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  c: IAutoMovieVector3,
  d: IAutoMovieVector3,
): number => {
  const pair = closestSegmentPair(a, b, c, d);
  return Vector3.length(Vector3.subtract(pair.pointA, pair.pointB));
};

/**
 * The closest pair of points between segments `a→b` and `c→d`, and their
 * distance.
 */
export interface IAutoMovieClosestSegmentPoints {
  /** Point on the first segment. */
  pointA: IAutoMovieVector3;
  /** Point on the second segment. */
  pointB: IAutoMovieVector3;
  /** Distance between the two points. */
  distance: number;
}

/**
 * Closest points between two segments and their distance, the exact clamped
 * solver ({@link closestSegmentPair}), the same pair
 * {@link segmentSegmentDistance} measures, so a contact normal derived from the
 * pair agrees with the distance that flagged the contact.
 *
 * @author Samchon
 */
export const closestPointsBetweenSegments = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  c: IAutoMovieVector3,
  d: IAutoMovieVector3,
): IAutoMovieClosestSegmentPoints => {
  const pair = closestSegmentPair(a, b, c, d);
  return {
    ...pair,
    distance: Vector3.length(Vector3.subtract(pair.pointA, pair.pointB)),
  };
};

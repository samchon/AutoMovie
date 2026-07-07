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
  const span = Vector3.dot(segment, segment);
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
 * Distance between two segments `a→b` and `c→d`, approximated by the smallest
 * of the four endpoint-to-segment distances. This misses the
 * interior-to-interior case a full segment-segment solver would catch, but the
 * capsule proxies it serves are coarse anyway, and every caller shares this one
 * approximation so distances stay consistent across validators.
 *
 * @author Samchon
 */
export const segmentSegmentDistance = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  c: IAutoMovieVector3,
  d: IAutoMovieVector3,
): number =>
  Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );

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
 * Closest points between two segments, using the same four-candidate endpoint
 * approximation as {@link segmentSegmentDistance} so a contact normal derived
 * from the returned points agrees with the distance that flagged the contact.
 *
 * @author Samchon
 */
export const closestPointsBetweenSegments = (
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
  c: IAutoMovieVector3,
  d: IAutoMovieVector3,
): IAutoMovieClosestSegmentPoints => {
  const candidates: ReadonlyArray<
    Omit<IAutoMovieClosestSegmentPoints, "distance">
  > = [
    { pointA: a, pointB: closestPointOnSegment(a, c, d) },
    { pointA: b, pointB: closestPointOnSegment(b, c, d) },
    { pointA: closestPointOnSegment(c, a, b), pointB: c },
    { pointA: closestPointOnSegment(d, a, b), pointB: d },
  ];
  return candidates
    .map((pair) => ({
      ...pair,
      distance: Vector3.length(Vector3.subtract(pair.pointA, pair.pointB)),
    }))
    .reduce((best, cur) => (cur.distance < best.distance ? cur : best));
};

import { IAutoMovieVector3 } from "@automovie/interface";

/**
 * 2D convex hull and point queries over the horizontal XZ plane.
 *
 * Points are {@link IAutoMovieVector3}; only `x` and `z` are used (`y` ignored),
 * because support and balance are decided by the ground-plane footprint. The
 * hull is built with Andrew's monotone chain — deterministic (no `Math.random`)
 * so support/topple judgments are reproducible — and canonicalized to
 * counter-clockwise order, so callers never have to assume the input points
 * were given convex or correctly ordered.
 *
 * @author Samchon
 */
export const convexHull2D = (
  points: readonly IAutoMovieVector3[],
): IAutoMovieVector3[] => {
  const unique = dedupeXZ(points);
  if (unique.length <= 2) return unique;
  const sorted = [...unique].sort((a, b) => a.x - b.x || a.z - b.z);
  const lower: IAutoMovieVector3[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: IAutoMovieVector3[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];
  // All input points collinear → the chain collapses to the two extremes.
  return hull.length >= 3 ? hull : dedupeXZ(hull);
};

/**
 * Is `point` inside (or on the boundary of) a counter-clockwise hull? Always
 * `false` for a degenerate hull of fewer than three vertices (a point or a
 * segment cannot enclose area).
 */
export const pointInHull = (
  point: IAutoMovieVector3,
  hull: readonly IAutoMovieVector3[],
): boolean => {
  if (hull.length < 3) return false;
  for (let i = 0; i < hull.length; i++)
    if (cross(hull[i]!, hull[(i + 1) % hull.length]!, point) < -EPSILON)
      return false;
  return true;
};

/**
 * Distance from `point` to a convex hull on the XZ plane: `0` when inside,
 * otherwise the distance to the nearest boundary. Degenerate hulls fall back to
 * the distance to their single vertex (size 1) or segment (size 2).
 */
export const pointHullDistance = (
  point: IAutoMovieVector3,
  hull: readonly IAutoMovieVector3[],
): number => {
  if (hull.length === 0) return Infinity;
  if (hull.length === 1) return distanceXZ(point, hull[0]!);
  if (pointInHull(point, hull)) return 0;
  return nearestHullEdge(point, hull).distance;
};

/** One hull boundary edge and the point's distance to it. */
export interface IAutoMovieHullEdge {
  start: IAutoMovieVector3;
  end: IAutoMovieVector3;
  distance: number;
}

/**
 * The hull boundary edge nearest to `point` — the tip-over axis when an object
 * topples over that edge. A single-vertex hull degenerates to a zero-length
 * edge at that vertex.
 */
export const nearestHullEdge = (
  point: IAutoMovieVector3,
  hull: readonly IAutoMovieVector3[],
): IAutoMovieHullEdge => {
  if (hull.length === 1)
    return {
      start: hull[0]!,
      end: hull[0]!,
      distance: distanceXZ(point, hull[0]!),
    };
  const edgeCount = hull.length === 2 ? 1 : hull.length;
  let best: IAutoMovieHullEdge = {
    start: hull[0]!,
    end: hull[1]!,
    distance: Infinity,
  };
  for (let i = 0; i < edgeCount; i++) {
    const start = hull[i]!;
    const end = hull[(i + 1) % hull.length]!;
    const distance = distanceXZ(
      point,
      closestPointOnSegmentXZ(point, start, end),
    );
    if (distance < best.distance) best = { start, end, distance };
  }
  return best;
};

/** Closest point to `point` on segment `start`–`end`, on the XZ plane (y=0). */
export const closestPointOnSegmentXZ = (
  point: IAutoMovieVector3,
  start: IAutoMovieVector3,
  end: IAutoMovieVector3,
): IAutoMovieVector3 => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const span = Math.max(dx * dx + dz * dz, Number.EPSILON);
  const t = clamp(((point.x - start.x) * dx + (point.z - start.z) * dz) / span);
  return { x: start.x + dx * t, y: 0, z: start.z + dz * t };
};

const EPSILON = 1e-9;

const cross = (
  o: IAutoMovieVector3,
  a: IAutoMovieVector3,
  b: IAutoMovieVector3,
): number => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

const distanceXZ = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

const dedupeXZ = (
  points: readonly IAutoMovieVector3[],
): IAutoMovieVector3[] => {
  const seen = new Set<string>();
  const out: IAutoMovieVector3[] = [];
  for (const p of points) {
    const key = `${p.x},${p.z}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
};

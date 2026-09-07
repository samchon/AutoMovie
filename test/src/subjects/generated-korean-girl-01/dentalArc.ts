import { Vector3 } from "@automovie/engine";
import type { IAutoMovieVector3 } from "@automovie/interface";

import { portraitPoint as p, portraitSpline } from "../geometry";

/**
 * A dental guide measured along its horizontal arch rather than projected X.
 * All coordinates and distances use the caller's millimetre construction frame.
 * The hidden posterior continuation is inferred, not measured from the photo.
 *
 * @author Samchon
 */
export interface IPortraitDentalArc {
  /** Total horizontal arc length, including the posterior continuations. */
  length: number;
  /** Arc distance at the central sample of the upper inner lip. */
  center: number;
  /** Position and horizontal unit tangent at a distance on the guide. */
  sample: (distance: number) => {
    position: IAutoMovieVector3;
    tangent: IAutoMovieVector3;
  };
}

/**
 * Fit the visible arch to the refined oral rim and continue it into the mouth.
 * Sampling uses cumulative XZ distance: equal crown widths remain equal when
 * the arch turns, while lip height still determines their vertical placement.
 */
export function createPortraitDentalArc(
  upper: IAutoMovieVector3[],
  rowLength: number,
): IPortraitDentalArc {
  if (
    upper.length < 3 ||
    !Number.isFinite(rowLength) ||
    rowLength <= 0 ||
    upper.some((point) => ![point.x, point.y, point.z].every(Number.isFinite))
  )
    throw new Error(
      "A dental arc needs a finite upper rim and positive row length.",
    );
  const core = Array.from({ length: 257 }, (_v, i) =>
    portraitSpline(upper, i / 256),
  );
  const extension = Math.max(12, rowLength / 2);
  const tail = (
    corner: IAutoMovieVector3,
    neighbour: IAutoMovieVector3,
  ): IAutoMovieVector3[] => {
    const tangent = Vector3.normalize(
      p(corner.x - neighbour.x, 0, corner.z - neighbour.z),
    );
    if (Vector3.length(tangent) === 0)
      throw new Error("A dental arc needs nonzero horizontal corner tangents.");
    const a = Vector3.add(corner, Vector3.scale(tangent, extension / 3));
    const b = p(a.x, corner.y, corner.z - (2 * extension) / 3);
    const end = p(a.x, corner.y, corner.z - extension);
    return Array.from({ length: 65 }, (_v, i) => {
      const t = i / 64,
        s = 1 - t;
      return Vector3.add(
        Vector3.add(
          Vector3.scale(corner, s ** 3),
          Vector3.scale(a, 3 * s * s * t),
        ),
        Vector3.add(
          Vector3.scale(b, 3 * s * t * t),
          Vector3.scale(end, t ** 3),
        ),
      );
    });
  };
  const left = tail(core[0], core[1]).slice(1).reverse();
  const right = tail(core[256], core[255]).slice(1);
  const points = [...left, ...core, ...right];
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    const distance = Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].z - points[i - 1].z,
    );
    if (!(distance > 0) || !Number.isFinite(distance))
      throw new Error(
        "A dental guide must advance at every horizontal sample.",
      );
    cumulative.push(cumulative[i - 1] + distance);
  }
  const length = cumulative[cumulative.length - 1];
  return {
    length,
    center: cumulative[left.length + 128],
    sample: (distance) => {
      if (!Number.isFinite(distance) || distance < 0 || distance > length)
        throw new Error("Dental distance must stay on its finite guide.");
      let low = 0,
        high = points.length - 1;
      while (high - low > 1) {
        const middle = Math.floor((low + high) / 2);
        if (cumulative[middle] <= distance) low = middle;
        else high = middle;
      }
      const t =
        (distance - cumulative[low]) / (cumulative[high] - cumulative[low]);
      return {
        position: Vector3.lerp(points[low], points[high], t),
        tangent: Vector3.normalize(
          p(points[high].x - points[low].x, 0, points[high].z - points[low].z),
        ),
      };
    },
  };
}

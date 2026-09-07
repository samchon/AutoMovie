import { Vector3 } from "@automovie/engine";
import type { IAutoMovieVector3 } from "@automovie/interface";

/**
 * The visible eye's spherical curvature basis, in construction millimetres.
 * A fitted surface radius is a portrait control, not a measured globe diameter.
 *
 * @author Samchon
 */
export interface IPortraitEyeSphere {
  /** Sphere centre behind the fitted lid opening. */
  center: IAutoMovieVector3;
  /** Positive spherical surface radius in millimetres. */
  radius: number;
}

const mean = (points: IAutoMovieVector3[]): IAutoMovieVector3 =>
  Vector3.scale(
    points.reduce(Vector3.add, Vector3.create()),
    1 / points.length,
  );

/**
 * Fit one spherical cap in the aperture's own plane. Its orientation comes from
 * the canthal chord and separation of the upper/lower lids, never from gaze.
 * The mean rim residual chooses depth; camera-ray projection then preserves
 * observed image positions while placing each lid contact on the same sphere.
 */
export function fitPortraitEyeSphere(
  upper: IAutoMovieVector3[],
  lower: IAutoMovieVector3[],
  viewRay: IAutoMovieVector3,
  radius: number,
): IPortraitEyeSphere {
  if (
    upper.length < 3 ||
    lower.length < 3 ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    [...upper, ...lower, viewRay].some(
      (point) => ![point.x, point.y, point.z].every(Number.isFinite),
    ) ||
    Vector3.length(viewRay) === 0
  )
    throw new Error(
      "Eye fitting needs finite lid curves, a viewing direction and a positive radius.",
    );
  const rim = [...lower, ...upper.slice(1, -1).reverse()];
  const center = mean(rim);
  let normal = Vector3.normalize(
    Vector3.cross(
      Vector3.subtract(upper[upper.length - 1], upper[0]),
      Vector3.subtract(mean(upper), mean(lower)),
    ),
  );
  if (Vector3.length(normal) === 0)
    throw new Error("An eye aperture needs a nondegenerate fitting plane.");
  if (Vector3.dot(normal, viewRay) < 0) normal = Vector3.scale(normal, -1);
  let depth = 0;
  for (const point of rim) {
    const delta = Vector3.subtract(point, center);
    const height = Vector3.dot(delta, normal);
    const squared = radius ** 2 - Vector3.dot(delta, delta) + height ** 2;
    if (squared <= 0)
      throw new Error("The selected eye curvature cannot span this aperture.");
    depth += height - Math.sqrt(squared);
  }
  return {
    center: Vector3.add(center, Vector3.scale(normal, depth / rim.length)),
    radius,
  };
}

/** Intersect the sphere on the hemisphere facing the supplied camera direction. */
export function portraitEyeSphereIntersection(
  sphere: IPortraitEyeSphere,
  origin: IAutoMovieVector3,
  viewRay: IAutoMovieVector3,
): IAutoMovieVector3 {
  const direction = Vector3.normalize(viewRay);
  const delta = Vector3.subtract(origin, sphere.center);
  const along = Vector3.dot(delta, direction);
  const discriminant =
    along ** 2 - Vector3.dot(delta, delta) + sphere.radius ** 2;
  if (
    Vector3.length(direction) === 0 ||
    !Number.isFinite(discriminant) ||
    discriminant < 0
  )
    throw new Error("The measured eye ray misses the fitted sphere.");
  return Vector3.add(
    origin,
    Vector3.scale(direction, -along + Math.sqrt(discriminant)),
  );
}

/** Front-facing spherical height, shared by sclera and the visible iris layers. */
export function portraitEyeSphereHeight(
  sphere: IPortraitEyeSphere,
  x: number,
  y: number,
): number {
  const squared =
    sphere.radius ** 2 -
    (x - sphere.center.x) ** 2 -
    (y - sphere.center.y) ** 2;
  if (!Number.isFinite(squared) || squared < 0)
    throw new Error("Eye surface samples must lie inside the fitted sphere.");
  return sphere.center.z + Math.sqrt(squared);
}

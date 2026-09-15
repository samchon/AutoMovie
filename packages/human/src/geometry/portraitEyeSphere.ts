import { Vector3 } from "@automovie/engine";
import type { IAutoMovieVector3 } from "@automovie/interface";

/**
 * The visible eye's spherical curvature basis, in construction millimetres.
 * A fitted surface radius is a portrait control, not a measured globe diameter.
 *
 * @author Samchon
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Separates the fitted globe centre and curvature radius from gaze or visible aperture size.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Defines the common millimetre spherical support used by eyelid contact, sclera and iris placement.
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
 * Fit a spherical cap with an explicit depth-fitting direction. The default
 * uses the canthal plane. Observation-ray fitting retains the rim mean's image
 * position instead of letting uncertain rim depth tilt the centre away from it.
 * Both use the mean rim residual for depth and never consult current gaze.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Fits the globe from the lid aperture without making gaze the anatomical orientation.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Selects the canthal-plane or recorded-ray fitting direction, preserves default arithmetic and refuses insufficient spherical support.
 */
export function fitPortraitEyeSphere(
  upper: IAutoMovieVector3[],
  lower: IAutoMovieVector3[],
  viewRay: IAutoMovieVector3,
  radius: number,
  alignment: "aperture-plane" | "observation-ray" = "aperture-plane",
): IPortraitEyeSphere {
  if (
    (alignment !== "aperture-plane" && alignment !== "observation-ray") ||
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
  if (alignment === "observation-ray") normal = Vector3.normalize(viewRay);
  if (Vector3.dot(normal, viewRay) < 0) normal = Vector3.scale(normal, -1);
  let depth = 0;
  for (const point of rim) {
    const delta = Vector3.subtract(point, center);
    const height = Vector3.dot(delta, normal);
    const squared = radius ** 2 - Vector3.dot(delta, delta) + height ** 2;
    if (!Number.isFinite(squared) || squared <= 0)
      throw new Error("The selected eye curvature cannot span this aperture.");
    depth += height - Math.sqrt(squared);
  }
  return {
    center: Vector3.add(center, Vector3.scale(normal, depth / rim.length)),
    radius,
  };
}

/**
 * Intersect the sphere on the hemisphere facing the supplied camera direction.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Projects observed lid contact onto the camera-facing hemisphere of its resident globe.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Solves the view-direction ray/sphere intersection and refuses a zero direction or nonfinite or negative discriminant.
 */
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

/**
 * Front-facing spherical height, shared by sclera and the visible iris layers.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Shares one globe height between visible sclera and iris layers.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Evaluates the anterior spherical surface at head-frame XY and refuses samples outside its finite aperture.
 */
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

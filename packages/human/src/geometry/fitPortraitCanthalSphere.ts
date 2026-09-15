import { Vector3 } from "@automovie/engine";
import type { IAutoMovieVector3 as Point } from "@automovie/interface";

import type { IPortraitEyeSphere } from "./portraitEyeSphere";

/**
 * Fit an optical body independently of the complete canthal aperture width.
 * The eye component supplies observed, shaped upper/lower curves in common
 * construction millimetres before applying blink. The camera ray points
 * forward; the canthal midpoint owns transverse placement, never the iris's
 * gaze marker. This routine owns no caller data and returns one fixed sphere.
 *
 * Only rays inside the declared optical disk contribute a spherical residual.
 * Each visible canthus inside that disk also bounds the body's forward depth.
 * Projecting the least-squares depth onto their common half-line preserves
 * those anchors. Exterior anchors are connected by portraitCanthalMesh; they
 * do not force a larger optical radius. Radius remains an authored dimension,
 * not a clinical estimate. Skin attachment and performed corneal clearance
 * remain separate admission conditions of the consuming component.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components Fits one identity globe while retaining independently located canthi.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components Separates the optical radius from aperture support and intersects visible-anchor depth constraints before expression.
 */
export function fitPortraitCanthalSphere(
  upper: readonly Point[],
  lower: readonly Point[],
  direction: Point,
  radius: number,
  lift = 0,
): IPortraitEyeSphere {
  if (
    upper.length < 3 ||
    lower.length < 3 ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(lift) ||
    [...upper, ...lower, direction].some(
      (p) => ![p.x, p.y, p.z].every(Number.isFinite),
    ) ||
    Vector3.length(direction) === 0
  )
    throw new Error(
      "Canthal fitting needs finite curves, direction and optical dimensions.",
    );
  const anchors = [upper[0], upper[upper.length - 1]];
  if (
    Vector3.length(Vector3.subtract(anchors[0], lower[0])) !== 0 ||
    Vector3.length(Vector3.subtract(anchors[1], lower[lower.length - 1])) !==
      0 ||
    Vector3.length(Vector3.subtract(...(anchors as [Point, Point]))) === 0
  )
    throw new Error("Canthal curves must share two distinct fixed endpoints.");
  const midpoint = Vector3.scale(Vector3.add(anchors[0], anchors[1]), 0.5);
  const ray = Vector3.normalize(direction);
  const residual = (point: Point): number[] => {
    const delta = Vector3.subtract(point, midpoint);
    const depth = Vector3.dot(delta, ray);
    const squared = radius * radius - Vector3.dot(delta, delta) + depth * depth;
    return squared < 0 ? [] : [depth - Math.sqrt(squared)];
  };
  const offsets = [...lower, ...upper.slice(1, -1)].flatMap(residual);
  if (offsets.length === 0)
    throw new Error(
      "The optical disk must support at least one observed lid ray.",
    );
  const bounds = anchors.flatMap(residual);
  const mean = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
  const depth = Math.min(mean, ...bounds) + lift;
  if (!Number.isFinite(depth) || bounds.some((bound) => depth > bound + 1e-9))
    throw new Error(
      "Optical depth must preserve visible canthi in its finite domain.",
    );
  const center = Vector3.add(midpoint, Vector3.scale(ray, depth));
  if (![center.x, center.y, center.z].every(Number.isFinite))
    throw new Error("Canthal fitting exceeds finite construction coordinates.");
  return { center, radius };
}

import {
  IAutoMovieSpace,
  IAutoMovieSurface,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { convexHull2D, nearestHullEdge } from "../math/hull";
import { ViolationCollector } from "./violation";

const SURFACE_KINDS = ["floor", "platform", "ramp"] as const;
const MIN_RAMP_AXIS = 1e-9;

/**
 * A footprint vertex farther than this from its own convex hull's boundary sits
 * strictly inside the hull — a concave notch or a redundant interior point.
 * Meters, so a nanometre tolerance is exact for authored coordinates while a
 * real notch (centimetres and up) is caught.
 */
const CONVEX_TOLERANCE = 1e-9;

/**
 * Tier-1 structural check for an {@link IAutoMovieSpace} — the constraints the
 * rough types don't encode, so the space queries ({@link heightAt},
 * {@link supportContactsFor}) always compute over well-formed patches.
 *
 * Checks: non-empty space/surface ids, unique surface ids, a known surface
 * kind, a footprint of at least three non-collinear points with finite plan
 * coordinates (polygon `y` is documented-ignored and not checked) that form a
 * **convex** polygon — the ground query classifies against the footprint's
 * convex hull, so a concave footprint would have its notch silently filled; a
 * vertex strictly inside the hull is rejected while a collinear point on an
 * edge is allowed — finite height anchors, a non-degenerate ramp axis (`rampTo`
 * must sit at a different XZ than `anchor`), and walkable ids that resolve
 * uniquely to declared surfaces. Everything is `error` severity — a malformed
 * space is broken input, not an artistic choice.
 *
 * @author Samchon
 */
export const validateSpace = (props: {
  space: IAutoMovieSpace;
}): IAutoMovieValidation => {
  const path = "$input";
  const collector = new ViolationCollector();
  const { space } = props;

  if (space.id.trim().length === 0)
    collector.push(
      "type",
      `${path}.id`,
      "space id must be non-empty",
      space.id,
    );

  const ids = new Set<string>();
  space.surfaces.forEach((surface, i) => {
    const sp = `${path}.surfaces[${i}]`;
    if (surface.id.trim().length === 0)
      collector.push(
        "type",
        `${sp}.id`,
        "surface id must be non-empty",
        surface.id,
      );
    if (ids.has(surface.id))
      collector.push(
        "type",
        `${sp}.id`,
        `surface id "${surface.id}" must be unique within the space`,
        surface.id,
      );
    ids.add(surface.id);
    validateSurface(surface, sp, collector);
  });

  const walked = new Set<string>();
  space.walkable.forEach((id, i) => {
    const wp = `${path}.walkable[${i}]`;
    if (!ids.has(id))
      collector.push(
        "type",
        wp,
        `walkable id "${id}" does not resolve to any surface of this space`,
        id,
      );
    if (walked.has(id))
      collector.push("type", wp, `walkable id "${id}" is duplicated`, id);
    walked.add(id);
  });

  return collector.toValidation();
};

const validateSurface = (
  surface: IAutoMovieSurface,
  path: string,
  collector: ViolationCollector,
): void => {
  if (!SURFACE_KINDS.includes(surface.kind))
    collector.push(
      "type",
      `${path}.kind`,
      `unknown surface kind "${String(surface.kind)}"`,
      surface.kind,
    );

  if (surface.polygon.length < 3)
    collector.push(
      "type",
      `${path}.polygon`,
      `a surface footprint needs at least 3 points, but had ${surface.polygon.length}`,
      surface.polygon.length,
    );
  let planFinite = true;
  surface.polygon.forEach((point, i) => {
    for (const axis of ["x", "z"] as const)
      if (!Number.isFinite(point[axis])) {
        planFinite = false;
        collector.push(
          "range",
          `${path}.polygon[${i}].${axis}`,
          `polygon ${axis} must be finite, but was ${point[axis]}`,
          point[axis],
        );
      }
  });
  if (planFinite && surface.polygon.length >= 3) {
    const hull = convexHull2D(surface.polygon);
    if (hull.length < 3)
      collector.push(
        "type",
        `${path}.polygon`,
        "surface footprint points are collinear — they enclose no area",
        surface.polygon,
      );
    // The footprint is contractually convex; the ground query (surfaceContains)
    // classifies against its convex hull, so a concave footprint would have its
    // notch silently filled. A vertex strictly inside the hull (a reflex/notch
    // corner, or a redundant interior point) sits off the hull boundary — a
    // collinear point on an edge stays on the boundary and is allowed.
    else if (
      surface.polygon.some(
        (point) => nearestHullEdge(point, hull).distance > CONVEX_TOLERANCE,
      )
    )
      collector.push(
        "type",
        `${path}.polygon`,
        "surface footprint is concave — a vertex sits inside its convex hull, which the ground query would fill; footprints must be convex",
        surface.polygon,
      );
  }

  validateAnchor(surface.anchor, `${path}.anchor`, collector);
  if (surface.rampTo !== null) {
    validateAnchor(surface.rampTo, `${path}.rampTo`, collector);
    const ax = surface.rampTo.x - surface.anchor.x;
    const az = surface.rampTo.z - surface.anchor.z;
    if (
      Number.isFinite(ax) &&
      Number.isFinite(az) &&
      ax * ax + az * az < MIN_RAMP_AXIS
    )
      collector.push(
        "range",
        `${path}.rampTo`,
        "ramp axis is degenerate — rampTo must sit at a different (x, z) than anchor",
        surface.rampTo,
      );
  }
};

const validateAnchor = (
  anchor: IAutoMovieVector3,
  path: string,
  collector: ViolationCollector,
): void => {
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(anchor[axis]))
      collector.push(
        "range",
        `${path}.${axis}`,
        `anchor ${axis} must be finite, but was ${anchor[axis]}`,
        anchor[axis],
      );
};

import {
  IAutoMovieHeightRule,
  IAutoMovieSpace,
  IAutoMovieSurface,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  polygonInside,
  polygonIsSimple,
  polygonsOverlap,
} from "../architecture/planarGeometry";
import {
  IAutoMovieFootprintRing,
  footprintRing,
  footprintRingPlacement,
} from "../space/footprint";
import { ViolationCollector } from "./violation";

const SURFACE_KINDS = ["floor", "platform", "ramp"] as const;
const MIN_RAMP_AXIS = 1e-9;

/**
 * Below twice this plan area, in square metres, a ring encloses nothing: its
 * points are collinear, or they double back over one another. A square
 * nanometre is exact for authored coordinates while any real patch clears it by
 * orders of magnitude.
 */
const MIN_RING_DOUBLE_AREA = 1e-9;

/**
 * Tier-1 structural check for an {@link IAutoMovieSpace}, the constraints the
 * rough types don't encode, so the space queries ({@link heightAt},
 * {@link supportContactsFor}) always compute over well-formed patches.
 *
 * Checks: non-empty space/surface ids, unique surface ids, a known surface
 * kind, an outer footprint ring of at least three points with finite plan
 * coordinates (polygon `y` is documented-ignored and not checked) that encloses
 * area and does not cross itself, holes that each do the same and lie strictly
 * inside the outer ring and apart from one another, exactly one statement of
 * the surface's ground and its own rules (finite height anchors and a
 * non-degenerate ramp axis for the two-anchor spelling; finite parameters and
 * an exactly-sized lattice for a declared height rule), and walkable ids that
 * resolve uniquely to declared surfaces. Everything is `error` severity: a
 * malformed space is broken input, not an artistic choice.
 *
 * **Concave and holed footprints are accepted, and the order that happened in
 * matters.** This validator used to demand a convex footprint, and it was right
 * to: the ground query classified against the convex hull, so a notch was
 * filled and an atrium void was floored, quietly, in the query feet and props
 * read. `surfaceContains` classifies against the authored rings now (#1868), so
 * what is refused here is what that query still cannot answer — a ring with no
 * inside, or holes that do not describe a region — rather than a shape it can.
 *
 * @author Samchon
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `validateSpace` locates malformed surface ids, rings, height rules, anchors, holes, and spacing at their exact space member paths.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `validateSpace` preserves surface identity, ring position, observed coordinate, and expected structural relation for every staging-space finding.
 * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-contact-scope `validateSpace` checks the support surface identities, walkable state, footprint rings, holes, and height rules used by contact queries.
 * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-level-slope `validateSpace` validates constant, plane, and sampled height fields that state finished support elevation and local slope.
 * @evidence requirements/interior/floors-and-raised-floors.md#interior-floor-openings-edges `validateSpace` preserves authored footprint holes and rejects rings that cannot describe a valid support region.
 * @evidence specifications/interior-space/surface-assemblies.md#interior-space-floor-raised-floor-contract The validator implements the finished support-surface, footprint-hole, walkability, elevation, and local-slope subset without claiming slab or raised-floor assembly depth.
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

  validateSurfaceFootprint(surface, path, collector);
  validateSurfaceGround(surface, path, collector);
};

/**
 * The rings that say where a patch is, held to what the ground query needs.
 *
 * A ring must enclose area and must not cross itself, because a query asking
 * which side of it a foot is on has no answer otherwise. A hole must lie
 * strictly inside the outer ring — a void reaching past the slab is a slab
 * whose edge was authored twice — and must stay clear of every other hole,
 * because two voids that touch are one void written as two and the material
 * between them has nothing left to be.
 */
const validateSurfaceFootprint = (
  surface: IAutoMovieSurface,
  path: string,
  collector: ViolationCollector,
): void => {
  const outer = validateRing(
    surface.polygon,
    `${path}.polygon`,
    "surface footprint",
    collector,
  );
  const holes = (surface.holes ?? []).map((hole, i) =>
    validateRing(hole, `${path}.holes[${i}]`, "footprint hole", collector),
  );
  if (outer === null) return;
  holes.forEach((hole, i) => {
    if (hole === null) return;
    const hp = `${path}.holes[${i}]`;
    if (!polygonInside(hole.plan, outer.plan))
      collector.push(
        "type",
        hp,
        "footprint hole must lie inside the surface footprint, but it reaches outside it",
        surface.holes![i],
      );
    else if (ringsTouch(hole, outer))
      collector.push(
        "type",
        hp,
        "footprint hole must lie strictly inside the surface footprint, but it touches the outer ring; author the notch in the outer ring instead",
        surface.holes![i],
      );
    for (let other = 0; other < i; ++other) {
      const before = holes[other]!;
      if (before !== null && polygonsOverlap(hole.plan, before.plan))
        collector.push(
          "type",
          hp,
          `footprint hole must stay clear of hole [${other}], but the two share plan area`,
          surface.holes![i],
        );
    }
  });
};

/**
 * Do two nested rings meet anywhere at all?
 *
 * Asked from both sides on purpose. A hole flush along the outer ring puts its
 * own vertices on that ring, while an outer ring whose reflex corner reaches in
 * to touch a hole edge puts an outer vertex on the hole — one test would miss
 * whichever case it is not written from. Containment has already been settled
 * by the caller, so a shared point is the only contact left to find.
 */
const ringsTouch = (
  hole: IAutoMovieFootprintRing,
  outer: IAutoMovieFootprintRing,
): boolean =>
  hole.points.some(
    (point) => footprintRingPlacement(outer, point.x, point.z) === "boundary",
  ) ||
  outer.points.some(
    (point) => footprintRingPlacement(hole, point.x, point.z) === "boundary",
  );

/**
 * One closed footprint ring, or `null` when it is too broken to compare with
 * another. Every defect is reported at the ring's own path, so an author is
 * told which of several rings is wrong rather than that "the footprint" is.
 */
const validateRing = (
  points: readonly IAutoMovieVector3[],
  path: string,
  label: string,
  collector: ViolationCollector,
): IAutoMovieFootprintRing | null => {
  let planFinite = true;
  points.forEach((point, i) => {
    for (const axis of ["x", "z"] as const)
      if (!Number.isFinite(point[axis])) {
        planFinite = false;
        collector.push(
          "range",
          `${path}[${i}].${axis}`,
          `${label} ${axis} must be finite, but was ${point[axis]}`,
          point[axis],
        );
      }
  });
  if (points.length < 3) {
    collector.push(
      "type",
      path,
      `a ${label} needs at least 3 points, but had ${points.length}`,
      points.length,
    );
    return null;
  }
  if (!planFinite) return null;
  const ring = footprintRing(points);
  if (Math.abs(ring.doubleArea) <= MIN_RING_DOUBLE_AREA) {
    collector.push(
      "type",
      path,
      `${label} points enclose no area: they are collinear or double back over one another`,
      points,
    );
    return null;
  }
  if (!polygonIsSimple(ring.plan)) {
    collector.push(
      "type",
      path,
      `${label} crosses itself, so it has no inside for the ground query to answer with`,
      points,
    );
    return null;
  }
  return ring;
};

/**
 * The one ground statement a surface is allowed, and its own rules.
 *
 * A patch that states its height twice is a patch whose feet and whose renderer
 * can be told different numbers the day the two are edited apart, and one that
 * states it not at all has no ground to stand on: the height query answers the
 * scalar zero plane rather than throwing, which is a reading nobody authored.
 * Both are refused here, at the field the author wrote.
 */
const validateSurfaceGround = (
  surface: IAutoMovieSurface,
  path: string,
  collector: ViolationCollector,
): void => {
  const rampTo = surface.rampTo ?? null;
  const anchored = surface.anchor !== undefined || rampTo !== null;
  if (surface.height !== undefined) {
    if (anchored)
      collector.push(
        "type",
        `${path}.height`,
        "a surface states its ground once: carry either a height rule or the anchor/rampTo pair, not both",
        surface.height,
      );
    validateHeightRule(surface.height, `${path}.height`, collector);
    return;
  }
  if (surface.anchor === undefined) {
    collector.push(
      "type",
      `${path}.height`,
      "a surface must state its ground: give it a height rule or an anchor",
      surface.height,
    );
    return;
  }
  validateAnchor(surface.anchor, `${path}.anchor`, collector);
  if (rampTo !== null) {
    validateAnchor(rampTo, `${path}.rampTo`, collector);
    const ax = rampTo.x - surface.anchor.x;
    const az = rampTo.z - surface.anchor.z;
    if (
      Number.isFinite(ax) &&
      Number.isFinite(az) &&
      ax * ax + az * az < MIN_RAMP_AXIS
    )
      collector.push(
        "range",
        `${path}.rampTo`,
        "ramp axis is degenerate: rampTo must sit at a different (x, z) than anchor",
        rampTo,
      );
  }
};

/**
 * One declared height rule, held to what the height query needs to read it.
 *
 * The same rule a production world's terrain carries, so the checks are the
 * same facts: finite parameters, positive lattice pitch, at least two lines on
 * each axis, and exactly as many samples as the lattice claims. A short
 * `samples` array would read relief nobody authored (the query clamps and
 * answers zero past its end) and a long one hides a row the author meant.
 */
const validateHeightRule = (
  rule: IAutoMovieHeightRule,
  path: string,
  collector: ViolationCollector,
): void => {
  if (rule.kind === "constant") {
    finiteHeight(rule.value, `${path}.value`, "constant height", collector);
    return;
  }
  if (rule.kind === "plane") {
    finiteHeight(
      rule.originHeight,
      `${path}.originHeight`,
      "plane origin height",
      collector,
    );
    finiteHeight(rule.slopeX, `${path}.slopeX`, "plane slopeX", collector);
    finiteHeight(rule.slopeZ, `${path}.slopeZ`, "plane slopeZ", collector);
    return;
  }
  // Runtime junk past the closed union, checked for the same reason the surface
  // kind is: the height query would read the unknown rule as a lattice and
  // dereference fields it has no reason to carry.
  if (rule.kind !== "heightfield") {
    collector.push(
      "type",
      `${path}.kind`,
      `unknown surface height rule "${String((rule as { kind: unknown }).kind)}"`,
      (rule as { kind: unknown }).kind,
    );
    return;
  }
  finiteHeight(
    rule.originX,
    `${path}.originX`,
    "heightfield originX",
    collector,
  );
  finiteHeight(
    rule.originZ,
    `${path}.originZ`,
    "heightfield originZ",
    collector,
  );
  positiveSpacing(
    rule.spacingX,
    `${path}.spacingX`,
    "heightfield spacingX",
    collector,
  );
  positiveSpacing(
    rule.spacingZ,
    `${path}.spacingZ`,
    "heightfield spacingZ",
    collector,
  );
  if (
    Number.isSafeInteger(rule.columns) === false ||
    Number.isSafeInteger(rule.rows) === false ||
    rule.columns < 2 ||
    rule.rows < 2
  )
    collector.push(
      "range",
      `${path}.columns`,
      `a heightfield needs at least two sample columns and rows, but had ${rule.columns} by ${rule.rows}`,
      rule.columns,
    );
  else if (rule.samples.length !== rule.columns * rule.rows)
    collector.push(
      "range",
      `${path}.samples`,
      `a ${rule.columns} by ${rule.rows} heightfield needs exactly ${rule.columns * rule.rows} row-major samples, but had ${rule.samples.length}`,
      rule.samples.length,
    );
  rule.samples.forEach((sample, i) => {
    finiteHeight(
      sample,
      `${path}.samples[${i}]`,
      "heightfield sample",
      collector,
    );
  });
};

const finiteHeight = (
  value: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (Number.isFinite(value) === false)
    collector.push(
      "range",
      path,
      `${label} must be finite, but was ${value}`,
      value,
    );
};

const positiveSpacing = (
  value: number,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (Number.isFinite(value) === false || value <= 0)
    collector.push(
      "range",
      path,
      `${label} must be a finite number > 0, but was ${value}`,
      value,
    );
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

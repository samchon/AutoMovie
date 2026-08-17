import {
  AutoMovieBuiltPlacementBasis,
  AutoMovieBuiltPlacementBodyLocator,
  AutoMovieBuiltPlacementSupportLocator,
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltFloatingBody,
  IAutoMovieBuiltPlacementBounds,
  IAutoMovieBuiltPlacementOverlapPair,
  IAutoMovieBuiltPlacementOverlapReport,
  IAutoMovieBuiltPlacementOverlapResult,
  IAutoMovieBuiltSupportQuery,
  IAutoMovieBuiltSupportResult,
  IAutoMovieBuiltSupportSweepReport,
} from "@automovie/interface";

import {
  IAutoMoviePropSupportFace,
  propBoundsOverlap,
  propSupportGap,
} from "../film/propPlacement";
import {
  footprintConvexPieces,
  footprintRing,
  surfaceFootprint,
} from "../space/footprint";
import {
  builtEnvironmentElementBounds,
  builtInstanceSetPlacementBounds,
} from "./builtEnvironment";

/**
 * Contact slack used when project source does not choose one, in metres. This
 * is the placement epsilon the prop kernel judges its own contact with, so an
 * unqualified building relation and an unqualified prop relation call the same
 * distance "touching".
 */
const DEFAULT_SUPPORT_TOLERANCE = 1e-9;

interface IResolvedSupport {
  face: IAutoMoviePropSupportFace;
  basis: AutoMovieBuiltPlacementBasis;
}

/**
 * Resolve one building element or compact population to its current world box.
 *
 * An environment-owned element is measured through the same tessellated model
 * and full hierarchy transform its spatial queries use, so this is not a second
 * answer to "where does it stand". A compact population delegates to its one
 * placement-bounds fold and is never expanded here.
 *
 * A missing identity or a transform-only group answers `null`, because neither
 * states a place a body occupies. An element the record locates but carries no
 * vertices for — a runtime model reference, a model with no parts — resolves to
 * the single world origin the record does state, and says so with the
 * `element-origin-point` basis rather than passing a point off as geometry. The
 * caller keeps the position it asked for, and every overlap or gap taken from
 * that box carries the label that says it measured no volume.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Supplies the world extent project source needs to inspect one named building placement.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Resolves element geometry or conservative compact-population bounds while preserving the measurement basis.
 * @author Samchon
 */
export const builtEnvironmentPlacementBounds = (props: {
  environment: IAutoMovieBuiltEnvironment;
  target: AutoMovieBuiltPlacementBodyLocator;
}): IAutoMovieBuiltPlacementBounds | null => {
  if (props.target.kind === "element") {
    const bounds = builtEnvironmentElementBounds(
      props.environment,
      props.target.id,
    );
    return bounds === null
      ? null
      : {
          ...bounds,
          basis:
            bounds.min.x === bounds.max.x &&
            bounds.min.y === bounds.max.y &&
            bounds.min.z === bounds.max.z
              ? "element-origin-point"
              : "element-geometry-bounds",
        };
  }
  const population = (props.environment.populations ?? []).find(
    (candidate) => candidate.set.id === props.target.id,
  );
  if (population === undefined) return null;
  return {
    ...builtInstanceSetPlacementBounds(
      population.set,
      population.prototypeBounds,
    ),
    basis: "population-placement-bounds",
  };
};

/**
 * Classify one project-authored bearing or suspension relation.
 *
 * Bearing delegates to the prop placement kernel's two-sided footprint probes,
 * so a small plinth under a wide member and a small member on a wide slab are
 * the same measurement rather than two near-copies. A suspension is accepted
 * only after both named sides resolve. The query is a deterministic visual
 * placement check, not a structural load or safety analysis.
 *
 * A negative or non-finite tolerance throws rather than resolving to a default,
 * because it does not narrow or widen what "touching" means, it withdraws the
 * meaning: every distance would be outside a negative band, so the answer would
 * be a confident `floating` or `sunk` for a member that rests exactly.
 *
 * Both bases travel with the verdict. A subject the record carries no vertices
 * for is probed as its stated origin, so its gap is measured from that point
 * rather than from an underside nobody declared, and `element-origin-point` is
 * how the caller reads a `floating` answer as "the origin sits this high"
 * instead of "this member hangs in the air".
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Gives authoring source the promised resting, floating, sunk, off-support, suspended, and unresolved answers for a named relation.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Applies the specified two-sided bearing probes, tolerance boundary, suspension declaration, and unresolved-state contract.
 * @author Samchon
 */
export const builtEnvironmentSupportStatus = (props: {
  environment: IAutoMovieBuiltEnvironment;
  query: IAutoMovieBuiltSupportQuery;
}): IAutoMovieBuiltSupportResult => {
  const tolerance = props.query.tolerance ?? DEFAULT_SUPPORT_TOLERANCE;
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new RangeError(
      `building support tolerance must be finite and non-negative, but was ${String(tolerance)}`,
    );
  const subject = builtEnvironmentPlacementBounds({
    environment: props.environment,
    target: props.query.subject,
  });
  const support = resolveSupport(props.environment, props.query.support);
  const unresolved: ("subject" | "support")[] = [];
  if (subject === null) unresolved.push("subject");
  if (support === null) unresolved.push("support");
  if (subject === null || support === null)
    return {
      status: "unresolved",
      gap: null,
      unresolved,
      subjectBasis: subject?.basis ?? null,
      supportBasis: support?.basis ?? null,
    };
  if (props.query.kind === "suspended")
    return {
      status: "suspended",
      gap: null,
      unresolved,
      subjectBasis: subject.basis,
      supportBasis: support.basis,
    };
  const gap = propSupportGap({
    face: support.face,
    bounds: subject,
  });
  return {
    status:
      gap === null
        ? "not-over-support"
        : Math.abs(gap) <= tolerance
          ? "resting"
          : gap > 0
            ? "floating"
            : "sunk",
    gap,
    unresolved,
    subjectBasis: subject.basis,
    supportBasis: support.basis,
  };
};

/**
 * Test two named building bodies for positive-volume world-bounds overlap.
 *
 * The comparison delegates to the placement kernel that treats exact face
 * contact as contact rather than intrusion. Population operands stay compact,
 * and every operand's basis remains explicit in the answer, which is what keeps
 * a `separate` verdict readable: a body the record carries no vertices for is
 * an extent-free point that clears almost everything, and the basis is how the
 * caller tells that from a measured miss.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Lets authoring source check one placement against a named neighbour before relying on rendered pixels.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Implements the named-neighbour positive-volume overlap result and preserves unresolved operands and measurement bases.
 * @author Samchon
 */
export const builtEnvironmentPlacementOverlap = (props: {
  environment: IAutoMovieBuiltEnvironment;
  left: AutoMovieBuiltPlacementBodyLocator;
  right: AutoMovieBuiltPlacementBodyLocator;
}): IAutoMovieBuiltPlacementOverlapResult => {
  const left = builtEnvironmentPlacementBounds({
    environment: props.environment,
    target: props.left,
  });
  const right = builtEnvironmentPlacementBounds({
    environment: props.environment,
    target: props.right,
  });
  const unresolved: ("left" | "right")[] = [];
  if (left === null) unresolved.push("left");
  if (right === null) unresolved.push("right");
  return {
    status:
      left === null || right === null
        ? "unresolved"
        : propBoundsOverlap(left, right)
          ? "overlapping"
          : "separate",
    unresolved,
    leftBasis: left?.basis ?? null,
    rightBasis: right?.basis ?? null,
  };
};

const resolveSupport = (
  environment: IAutoMovieBuiltEnvironment,
  locator: AutoMovieBuiltPlacementSupportLocator,
): IResolvedSupport | null => {
  if (locator.kind === "surface") {
    const entry = environment.surfaces.find(
      (candidate) => candidate.surface.id === locator.id,
    );
    if (entry === undefined) return null;
    const polygon = surfaceFootprint(entry.surface);
    if (footprintConvexPieces(polygon).length === 0) return null;
    return {
      face: { polygon, height: entry.surface },
      basis: "surface-height-rule",
    };
  }
  const body = builtEnvironmentPlacementBounds({
    environment,
    target: locator,
  });
  if (body === null) return null;
  const { min, max } = body;
  return {
    face: {
      polygon: {
        outer: footprintRing([
          { x: min.x, y: max.y, z: min.z },
          { x: max.x, y: max.y, z: min.z },
          { x: max.x, y: max.y, z: max.z },
          { x: min.x, y: max.y, z: max.z },
        ]),
        holes: [],
      },
      height: { height: { kind: "constant", value: max.y } },
    },
    basis: body.basis,
  };
};

/**
 * Every body of one building, resolved once with its own extent.
 *
 * A sweep resolves each body exactly once and then works on boxes. That order is
 * what makes a whole-building check affordable: resolving an element means
 * tessellating its model and walking its transform chain, and comparing two boxes
 * is arithmetic, so the resolutions are the cost and repeating them per pair is
 * how a sweep becomes unusable.
 */
const builtEnvironmentBodies = (
  environment: IAutoMovieBuiltEnvironment,
): {
  resolved: {
    body: AutoMovieBuiltPlacementBodyLocator;
    bounds: IAutoMovieBuiltPlacementBounds;
  }[];
  unresolved: AutoMovieBuiltPlacementBodyLocator[];
} => {
  const resolved: {
    body: AutoMovieBuiltPlacementBodyLocator;
    bounds: IAutoMovieBuiltPlacementBounds;
  }[] = [];
  const unresolved: AutoMovieBuiltPlacementBodyLocator[] = [];
  const locators: AutoMovieBuiltPlacementBodyLocator[] = [
    ...environment.elements.map(
      (element): AutoMovieBuiltPlacementBodyLocator => ({
        kind: "element",
        id: element.id,
      }),
    ),
    ...(environment.populations ?? []).map(
      (population): AutoMovieBuiltPlacementBodyLocator => ({
        kind: "population",
        id: population.set.id,
      }),
    ),
  ];
  for (const body of locators) {
    const bounds = builtEnvironmentPlacementBounds({
      environment,
      target: body,
    });
    if (bounds === null) unresolved.push(body);
    else resolved.push({ body, bounds });
  }
  return { resolved, unresolved };
};

/** Whether two boxes share footprint area, exact contact excluded. */
const footprintOverlaps = (
  left: IAutoMovieBuiltPlacementBounds,
  right: IAutoMovieBuiltPlacementBounds,
): boolean =>
  left.min.x < right.max.x &&
  left.max.x > right.min.x &&
  left.min.z < right.max.z &&
  left.max.z > right.min.z;

/**
 * The first index of a top-height-descending list at or below one height.
 *
 * A binary search rather than a scan, because the bodies above a subject are the
 * many in a tall building and reading past them is the cost this ordering exists
 * to avoid.
 */
const firstAtOrBelow = (
  descending: readonly { bounds: IAutoMovieBuiltPlacementBounds }[],
  ceiling: number,
): number => {
  let low = 0;
  let high = descending.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (descending[middle]!.bounds.max.y > ceiling) low = middle + 1;
    else high = middle;
  }
  return low;
};

const boxVolume = (box: IAutoMovieBuiltPlacementBounds): number =>
  Math.max(0, box.max.x - box.min.x) *
  Math.max(0, box.max.y - box.min.y) *
  Math.max(0, box.max.z - box.min.z);

const sharedVolume = (
  left: IAutoMovieBuiltPlacementBounds,
  right: IAutoMovieBuiltPlacementBounds,
): number =>
  Math.max(
    0,
    Math.min(left.max.x, right.max.x) - Math.max(left.min.x, right.min.x),
  ) *
  Math.max(
    0,
    Math.min(left.max.y, right.max.y) - Math.max(left.min.y, right.min.y),
  ) *
  Math.max(
    0,
    Math.min(left.max.z, right.max.z) - Math.max(left.min.z, right.min.z),
  );

/**
 * Find every placed body in a building with clear air under it.
 *
 * The requirement this answers asks for two capabilities in one sentence: express
 * what supports what, and find the floating or disconnected elements.
 * {@link builtEnvironmentSupportStatus} is the first and cannot be the second,
 * because it judges a relation the author already named, and an oriel window
 * nobody suspected is a query nobody wrote. This sweeps the record instead and
 * needs no declaration at all.
 *
 * It reports a measurement rather than a relation. For each body it takes the
 * highest measurable body whose footprint overlaps this one and whose top is at
 * or below this one's underside, then reports the clearance between them. Nothing
 * here claims that body is the support: a lintel measured under a sill is simply
 * the nearest thing beneath it. What the answer does support is the reading that
 * matters, which is that nothing is under this body at all, or that the nearest
 * thing is a metre down.
 *
 * `groundY` is the plane a footing legitimately rests on, and it defaults to the
 * world origin's height. Without it every ground-borne element reports as
 * floating, which is a sweep nobody can read.
 *
 * A body the record carries no vertices for is judged as the stated point it is.
 * Its underside and its top are the same height, so it is classified like any
 * other body and its `element-origin-point` basis travels with the finding, which
 * is how a caller reads "floating" as a claim about a point.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Finds floating and disconnected placed bodies over a whole building without one named query per pair.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Derives every clearance from the same placement bounds the named-pair query measures and reports each body's basis beside it.
 * @author Samchon
 */
export const builtEnvironmentSupportSweep = (props: {
  environment: IAutoMovieBuiltEnvironment;
  /** World height a body may rest on directly. Defaults to `0`. */
  groundY?: number;
  /** Contact slack in metres. Defaults to the engine's placement epsilon. */
  tolerance?: number;
}): IAutoMovieBuiltSupportSweepReport => {
  const tolerance = props.tolerance ?? DEFAULT_SUPPORT_TOLERANCE;
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new RangeError(
      `building support tolerance must be finite and non-negative, but was ${String(tolerance)}`,
    );
  const groundY = props.groundY ?? 0;
  if (!Number.isFinite(groundY))
    throw new RangeError(
      `building ground height must be finite, but was ${String(groundY)}`,
    );

  const { resolved, unresolved } = builtEnvironmentBodies(props.environment);
  // Descending by top height, so the first footprint hit at or below a subject's
  // underside is the nearest body under it and the walk can stop there. The
  // alternative is reading every body for every body, which is the shape that
  // makes a whole-building check something nobody runs twice.
  const descending = [...resolved].sort(
    (left, right) => right.bounds.max.y - left.bounds.max.y,
  );
  const floating: IAutoMovieBuiltFloatingBody[] = [];
  let grounded = 0;
  let borne = 0;
  let compared = 0;
  for (const subject of resolved) {
    if (subject.bounds.min.y <= groundY + tolerance) {
      ++grounded;
      continue;
    }
    const ceiling = subject.bounds.min.y + tolerance;
    let nearest: {
      body: AutoMovieBuiltPlacementBodyLocator;
      clearance: number;
    } | null = null;
    for (
      let index = firstAtOrBelow(descending, ceiling);
      index < descending.length;
      ++index
    ) {
      const candidate = descending[index]!;
      if (candidate === subject) continue;
      ++compared;
      if (footprintOverlaps(subject.bounds, candidate.bounds) === false)
        continue;
      nearest = {
        body: candidate.body,
        clearance: subject.bounds.min.y - candidate.bounds.max.y,
      };
      break;
    }
    if (nearest !== null && nearest.clearance <= tolerance) {
      ++borne;
      continue;
    }
    floating.push({
      body: subject.body,
      basis: subject.bounds.basis,
      below: nearest,
    });
  }
  return {
    measured: resolved.length,
    compared,
    grounded,
    borne,
    floating,
    unresolved,
  };
};

/**
 * Find every pair of placed bodies in a building whose volumes intersect.
 *
 * Sorting by the lower x corner and sweeping an active list is what keeps this
 * usable on a building rather than on a room. A naive pass over one measured
 * production's 3,474 placings is six million pair tests; pruning on one axis
 * leaves the comparisons the geometry actually forces, and `compared` states how
 * many that was, so the cost of the check is part of its answer instead of a
 * number somebody measures once and writes in a document.
 *
 * Exact face contact is excluded by {@link propBoundsOverlap} itself, so a slab
 * bearing on a wall head and a tenon meeting its mortise produce nothing here.
 * What is reported is interpenetration, graded by the share of the smaller body
 * inside the larger and deepest first, because a quoin toothed a centimetre into
 * its wall and a column standing wholly inside one are not one finding.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Answers the neighbour-overlap question across a whole building rather than one named pair at a time.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Reports each intersecting pair's shared volume, its share of the smaller body, both bases, and the comparisons performed.
 * @author Samchon
 */
export const builtEnvironmentPlacementOverlapSweep = (props: {
  environment: IAutoMovieBuiltEnvironment;
}): IAutoMovieBuiltPlacementOverlapReport => {
  const { resolved, unresolved } = builtEnvironmentBodies(props.environment);
  const order = resolved
    .map((entry, index) => ({ ...entry, index }))
    .sort((left, right) =>
      left.bounds.min.x === right.bounds.min.x
        ? left.index - right.index
        : left.bounds.min.x - right.bounds.min.x,
    );
  const pairs: IAutoMovieBuiltPlacementOverlapPair[] = [];
  const active: typeof order = [];
  let compared = 0;
  for (const subject of order) {
    // Anything whose right edge is behind this body's left edge can meet neither
    // it nor anything after it, because the sweep only ever moves right.
    for (let index = active.length - 1; index >= 0; --index)
      if (active[index]!.bounds.max.x <= subject.bounds.min.x)
        active.splice(index, 1);
    for (const candidate of active) {
      ++compared;
      if (propBoundsOverlap(candidate.bounds, subject.bounds) === false)
        continue;
      const first = candidate.index < subject.index ? candidate : subject;
      const second = candidate.index < subject.index ? subject : candidate;
      const volume = sharedVolume(first.bounds, second.bounds);
      const smaller = Math.min(
        boxVolume(first.bounds),
        boxVolume(second.bounds),
      );
      pairs.push({
        left: first.body,
        right: second.body,
        leftBasis: first.bounds.basis,
        rightBasis: second.bounds.basis,
        volume,
        fraction: smaller === 0 ? 0 : volume / smaller,
      });
    }
    active.push(subject);
  }
  return {
    measured: resolved.length,
    compared,
    pairs: pairs.sort((left, right) =>
      right.fraction === left.fraction
        ? right.volume - left.volume
        : right.fraction - left.fraction,
    ),
    unresolved,
  };
};

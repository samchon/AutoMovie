import {
  AutoMovieBuiltPlacementBasis,
  AutoMovieBuiltPlacementBodyLocator,
  AutoMovieBuiltPlacementSupportLocator,
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltPlacementBounds,
  IAutoMovieBuiltPlacementOverlapResult,
  IAutoMovieBuiltSupportQuery,
  IAutoMovieBuiltSupportResult,
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

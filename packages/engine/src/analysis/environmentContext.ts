import {
  IAutoMovieContextOccluder,
  IAutoMovieEnvironmentContext,
  IAutoMovieEnvironmentInstant,
  IAutoMovieHalfSpacePlane,
  IAutoMovieReferenceGround,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import { ViolationCollector } from "../validation/violation";

/** Directions shorter than this carry no direction at all. */
const AXIS_EPSILON = 1e-12;

/** A ray whose slope against a plane is under this is parallel to it. */
const PLANE_EPSILON = 1e-12;

/** The fewest half-spaces whose intersection can bound a solid in 3D. */
export const AUTOMOVIE_ANALYSIS_MIN_SOLID_PLANES = 4;

/**
 * One convex blocker an analysis ray may be stopped by.
 *
 * Both a read-only neighbouring mass and a building's own shading solid are
 * this shape, which is what lets one occlusion routine serve both without
 * either becoming the other. What a solid is _not_ is ownership: the caller
 * decides which list a solid came from, and the analysis never returns a
 * context mass as building geometry.
 */
export interface IAutoMovieAnalysisSolid {
  /** Stable identity of the blocker within its own list. */
  id: string;
  /** Half-spaces whose intersection is the solid; at least four. */
  planes: readonly IAutoMovieHalfSpacePlane[];
}

/**
 * Validate the read-only world a building is analysed against.
 *
 * Two rules carry the weight. The first is physical: an instant whose sun is at
 * or below the reference horizon may not declare a direct beam, because a
 * source under the ground plane illuminates nothing and a beam declared there
 * is how a "daylight" study quietly becomes fiction. The second is about
 * ownership: every context id is checked against the ids the building already
 * owns, so a neighbour's mass can never be addressed as, or mistaken for, a
 * part of the work.
 *
 * Instant ordering is validated rather than repaired. Sorting silently would
 * make two differently-authored contexts produce the same artifact and hide an
 * authoring mistake that a reader needs to see.
 *
 * @author Samchon
 */
export const validateAutoMovieEnvironmentContext = (props: {
  /** Context to check. */
  context: IAutoMovieEnvironmentContext;
  /**
   * Ids the building already owns: elements, spaces, boundaries. A context id
   * colliding with one of these is refused.
   */
  reserved?: readonly string[];
}): IAutoMovieValidation => {
  const { context } = props;
  const out = new ViolationCollector();
  const root = "$input";
  const reserved = new Set(props.reserved ?? []);

  nonEmpty(context.id, `${root}.id`, "environment context id", out);
  if (context.version !== 1)
    out.push(
      "type",
      `${root}.version`,
      `environment context schema version must be 1, but was ${context.version}`,
      context.version,
    );
  if (context.units !== "meter")
    out.push(
      "type",
      `${root}.units`,
      `environment context units must be "meter", but were ${String(context.units)}`,
      context.units,
    );
  direction(context.north, `${root}.north`, "site north", out);
  direction(context.ground.up, `${root}.ground.up`, "reference ground up", out);
  if (!Number.isFinite(context.ground.elevation))
    out.push(
      "range",
      `${root}.ground.elevation`,
      `reference ground elevation must be finite, but was ${context.ground.elevation}`,
      context.ground.elevation,
    );

  const owned = (id: string, path: string, label: string): void => {
    if (reserved.has(id))
      out.push(
        "type",
        path,
        `${label} "${id}" is already owned by the building; external context must never reuse a building-owned id`,
        id,
      );
  };
  owned(context.id, `${root}.id`, "environment context id");

  const instantIds = new Set<string>();
  let previous: number | null = null;
  context.instants.forEach((instant, index) => {
    const path = `${root}.instants[${index}]`;
    nonEmpty(instant.id, `${path}.id`, "instant id", out);
    nonEmpty(instant.label, `${path}.label`, "instant label", out);
    if (instantIds.has(instant.id))
      out.push(
        "type",
        `${path}.id`,
        `instant id "${instant.id}" must be unique`,
        instant.id,
      );
    instantIds.add(instant.id);
    owned(instant.id, `${path}.id`, "instant id");
    if (!Number.isFinite(instant.time))
      out.push(
        "range",
        `${path}.time`,
        `instant time must be finite, but was ${instant.time}`,
        instant.time,
      );
    else {
      if (previous !== null && instant.time <= previous)
        out.push(
          "range",
          `${path}.time`,
          `instants must be strictly increasing in time, but ${instant.time} follows ${previous}`,
          instant.time,
        );
      previous = instant.time;
    }
    direction(instant.sun, `${path}.sun`, "sun direction", out);
    positiveOrZero(
      instant.directNormalIlluminance,
      `${path}.directNormalIlluminance`,
      "direct normal illuminance",
      out,
    );
    positiveOrZero(
      instant.diffuseHorizontalIlluminance,
      `${path}.diffuseHorizontalIlluminance`,
      "diffuse horizontal illuminance",
      out,
    );
    if (
      instant.outdoorAirTemperature !== null &&
      !Number.isFinite(instant.outdoorAirTemperature)
    )
      out.push(
        "range",
        `${path}.outdoorAirTemperature`,
        `outdoor air temperature must be null or finite, but was ${instant.outdoorAirTemperature}`,
        instant.outdoorAirTemperature,
      );
    if (instant.outdoorRelativeHumidity !== null)
      out.range(
        `${path}.outdoorRelativeHumidity`,
        instant.outdoorRelativeHumidity,
        0,
        1,
        "outdoor relative humidity",
      );
    // A sun under the horizon delivers no beam. Checked only once both
    // directions are usable, so a zero vector reports its own fault instead of
    // producing a second, derived complaint about the same field.
    if (
      Vector3.length(instant.sun) > AXIS_EPSILON &&
      Vector3.length(context.ground.up) > AXIS_EPSILON &&
      Number.isFinite(instant.directNormalIlluminance) &&
      instant.directNormalIlluminance > 0 &&
      Vector3.dot(
        Vector3.normalize(instant.sun),
        Vector3.normalize(context.ground.up),
      ) <= 0
    )
      out.push(
        "range",
        `${path}.directNormalIlluminance`,
        `instant "${instant.id}" places the sun at or below the reference horizon, so its direct normal illuminance must be 0, but was ${instant.directNormalIlluminance}`,
        instant.directNormalIlluminance,
      );
  });

  const occluderIds = new Set<string>();
  context.occluders.forEach((occluder, index) => {
    const path = `${root}.occluders[${index}]`;
    nonEmpty(occluder.id, `${path}.id`, "occluder id", out);
    nonEmpty(occluder.kind, `${path}.kind`, "occluder kind", out);
    if (occluderIds.has(occluder.id))
      out.push(
        "type",
        `${path}.id`,
        `occluder id "${occluder.id}" must be unique`,
        occluder.id,
      );
    occluderIds.add(occluder.id);
    owned(occluder.id, `${path}.id`, "occluder id");
    validateSolidPlanes(occluder.planes, `${path}.planes`, "occluder", out);
  });

  return out.toValidation();
};

/**
 * Check the half-spaces of one convex blocker.
 *
 * Shared by the context validator and by every adapter that accepts an authored
 * shading solid, so a neighbour's mass and the building's own canopy are held
 * to exactly the same standard.
 */
export const validateSolidPlanes = (
  planes: readonly IAutoMovieHalfSpacePlane[],
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (planes.length < AUTOMOVIE_ANALYSIS_MIN_SOLID_PLANES)
    out.push(
      "range",
      path,
      `a convex ${label} needs at least ${AUTOMOVIE_ANALYSIS_MIN_SOLID_PLANES} half-spaces to bound a solid, but had ${planes.length}`,
      planes.length,
    );
  planes.forEach((plane, index) => {
    direction(
      plane.normal,
      `${path}[${index}].normal`,
      `${label} plane normal`,
      out,
    );
    if (!Number.isFinite(plane.offset))
      out.push(
        "range",
        `${path}[${index}].offset`,
        `${label} plane offset must be finite, but was ${plane.offset}`,
        plane.offset,
      );
  });
};

/**
 * Refuse a blocker that cannot bound anything.
 *
 * The rule is {@link validateSolidPlanes}, raised to a throw: an adapter reading
 * an authored shading solid has no honest result to return for a solid with no
 * faces, so it stops rather than producing one. Sharing the rule is what keeps
 * a neighbour's mass and the building's own canopy held to one standard.
 */
export const assertAutoMovieAnalysisSolids = (
  solids: readonly IAutoMovieAnalysisSolid[],
  label: string,
): void => {
  const seen = new Set<string>();
  for (const solid of solids) {
    if (solid.id.trim().length === 0)
      throw new Error(`every ${label} must carry a non-blank id`);
    if (seen.has(solid.id))
      throw new Error(`${label} id "${solid.id}" is declared twice`);
    seen.add(solid.id);
    const out = new ViolationCollector();
    validateSolidPlanes(solid.planes, `${label}.planes`, label, out);
    const validated = out.toValidation();
    if (validated.success === false) {
      const first = validated.violations[0]!;
      throw new Error(
        `${label} "${solid.id}" is malformed at ${first.path}: ${first.expected}`,
      );
    }
  }
};

/**
 * Whether a ray from `origin` along a unit `direction` is stopped by one convex
 * solid before `maxDistance`.
 *
 * The slab test over half-spaces, done analytically rather than by marching:
 * every plane either raises the entry parameter or lowers the exit one, and the
 * solid is hit exactly when an interval survives with a positive exit. A ray
 * that starts inside the solid is blocked at once, which is the right answer
 * for a sample point buried in a mass.
 *
 * Normals need not be normalized: the numerator and the denominator scale
 * together, so the parameter is unaffected by how long an authored normal is.
 */
export const autoMovieSolidBlocks = (props: {
  /** World-space ray origin in metres. */
  origin: IAutoMovieVector3;
  /** Unit ray direction. */
  direction: IAutoMovieVector3;
  /** Half-spaces whose intersection is the solid. */
  planes: readonly IAutoMovieHalfSpacePlane[];
  /** Furthest parameter that counts as a hit; `Infinity` for a sky ray. */
  maxDistance: number;
}): boolean => {
  let enter = 0;
  let exit = props.maxDistance;
  for (const plane of props.planes) {
    const denominator = Vector3.dot(plane.normal, props.direction);
    const distance = plane.offset - Vector3.dot(plane.normal, props.origin);
    if (Math.abs(denominator) <= PLANE_EPSILON) {
      // Parallel to this face: either forever inside it, or forever outside.
      if (distance < 0) return false;
      continue;
    }
    const parameter = distance / denominator;
    if (denominator > 0) exit = Math.min(exit, parameter);
    else enter = Math.max(enter, parameter);
    if (enter > exit) return false;
  }
  return exit > 0;
};

/** Whether any of the given solids stops the ray. */
export const autoMovieRayObstructed = (props: {
  origin: IAutoMovieVector3;
  direction: IAutoMovieVector3;
  solids: readonly IAutoMovieAnalysisSolid[];
  maxDistance: number;
}): boolean =>
  props.solids.some((solid) =>
    autoMovieSolidBlocks({
      origin: props.origin,
      direction: props.direction,
      planes: solid.planes,
      maxDistance: props.maxDistance,
    }),
  );

/** Whether a direction points into the sky rather than into the ground. */
export const autoMovieSkyward = (
  direction: IAutoMovieVector3,
  ground: IAutoMovieReferenceGround,
): boolean => Vector3.dot(direction, Vector3.normalize(ground.up)) > 0;

/**
 * Deterministic cosine-weighted directions over the hemisphere around `normal`.
 *
 * The set is a Hammersley sequence mapped by Malley's method, so it is a
 * property of the sample count alone: no random state, no host entropy, the
 * same directions in the same order on Windows and POSIX. Cosine weighting is
 * what makes the estimator exact for the case that matters most: an
 * unobstructed plane sees every one of its directions, so the estimate of an
 * isotropic sky's contribution collapses to the declared horizontal illuminance
 * with no sampling error at all, for any count.
 */
export const autoMovieHemisphereDirections = (props: {
  normal: IAutoMovieVector3;
  count: number;
}): IAutoMovieVector3[] => {
  const { count } = props;
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error(
      `hemisphere sample count must be a positive safe integer, but was ${count}`,
    );
  if (Vector3.length(props.normal) <= AXIS_EPSILON)
    throw new Error("hemisphere sampling needs a non-zero normal");
  const normal = Vector3.normalize(props.normal);
  // Duff et al.'s branchless orthonormal basis: `sign + normal.z` is never zero
  // because `sign` is chosen from the sign of `normal.z`, so there is no
  // singular pole to special-case.
  const sign = normal.z >= 0 ? 1 : -1;
  const a = -1 / (sign + normal.z);
  const b = normal.x * normal.y * a;
  const tangent: IAutoMovieVector3 = {
    x: 1 + sign * normal.x * normal.x * a,
    y: sign * b,
    z: -sign * normal.x,
  };
  const bitangent: IAutoMovieVector3 = {
    x: b,
    y: sign + normal.y * normal.y * a,
    z: -normal.y,
  };
  const out: IAutoMovieVector3[] = [];
  for (let index = 0; index < count; ++index) {
    const radial = (index + 0.5) / count;
    const angle = 2 * Math.PI * radicalInverse2(index);
    const radius = Math.sqrt(radial);
    const local = {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      z: Math.sqrt(1 - radial),
    };
    out.push({
      x: tangent.x * local.x + bitangent.x * local.y + normal.x * local.z,
      y: tangent.y * local.x + bitangent.y * local.y + normal.y * local.z,
      z: tangent.z * local.x + bitangent.z * local.y + normal.z * local.z,
    });
  }
  return out;
};

/** Van der Corput radical inverse in base two. */
const radicalInverse2 = (index: number): number => {
  let bits = index >>> 0;
  let result = 0;
  let fraction = 0.5;
  while (bits > 0) {
    result += (bits & 1) * fraction;
    bits >>>= 1;
    fraction *= 0.5;
  }
  return result;
};

/** The instant of a context by id, or null when it names none. */
export const autoMovieEnvironmentInstant = (
  context: IAutoMovieEnvironmentContext,
  id: string,
): IAutoMovieEnvironmentInstant | null =>
  context.instants.find((instant) => instant.id === id) ?? null;

/** Every context occluder as an analysis solid. */
export const autoMovieContextSolids = (
  context: IAutoMovieEnvironmentContext,
): IAutoMovieAnalysisSolid[] =>
  context.occluders.map((occluder: IAutoMovieContextOccluder) => ({
    id: occluder.id,
    planes: occluder.planes,
  }));

const direction = (
  value: IAutoMovieVector3,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(value[axis]))
      out.push(
        "range",
        `${path}.${axis}`,
        `${label} ${axis} must be finite, but was ${value[axis]}`,
        value[axis],
      );
  const length = Vector3.length(value);
  if (Number.isFinite(length) && length <= AXIS_EPSILON)
    out.push("range", path, `${label} must be a non-zero direction`, value);
};

const positiveOrZero = (
  value: number,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (!Number.isFinite(value) || value < 0)
    out.push(
      "range",
      path,
      `${label} must be a finite number at or above zero, but was ${value}`,
      value,
    );
};

const nonEmpty = (
  value: string,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    out.push("type", path, `${label} must be non-empty`, value);
};

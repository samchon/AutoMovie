import {
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftCollider,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { ViolationCollector } from "../validation/violation";
import { softBodyTravelNumber } from "./softBody";

/** Particles one panel may hold, so a lattice cannot silently cost a gigabyte. */
export const SOFT_MAX_PARTICLES = 16_384;

/** Absolute steps one seek may integrate. */
export const SOFT_MAX_STEPS = 100_000;

/** Constraint relaxation sweeps one step may cost. */
export const SOFT_MAX_ITERATIONS = 64;

/** Anchors one panel may declare. */
export const SOFT_MAX_ANCHORS = 4_096;

/** Named anchor states one panel may declare. */
export const SOFT_MAX_STATES = 32;

/** Colliders one panel may be kept out of. */
export const SOFT_MAX_COLLIDERS = 64;

/**
 * Validate a soft-body domain's lattice, budgets, stability, anchors, states
 * and colliders.
 *
 * The point of the pass is that a domain which survives it can be integrated
 * without the solver second-guessing its own input: the arrays are the right
 * length, no mass is zero, no two rest particles are coincident so every
 * constraint has a direction, no particle starts buried inside a collider, no
 * two anchors fight over the same particle, every named state names anchors
 * that exist, and the step actually honours the travel condition. A domain that
 * fails is refused with the path of every offending field, never quietly
 * clamped — a clamped panel is a panel whose author was told nothing and whose
 * frames changed anyway.
 *
 * @author Samchon
 */
export const validateSoftBodyDomain = (props: {
  domain: IAutoMovieSoftBodyDomain;
}): IAutoMovieValidation => {
  const { domain } = props;
  const out = new ViolationCollector();
  const root = "$input";

  if (domain.id.trim().length === 0)
    out.push("type", `${root}.id`, "soft body id must be non-empty", domain.id);
  if (domain.version !== 1)
    out.push(
      "type",
      `${root}.version`,
      `soft body schema version must be 1, but was ${String(domain.version)}`,
      domain.version,
    );
  if (domain.units !== "meter")
    out.push(
      "type",
      `${root}.units`,
      `soft body units must be "meter", but was ${String(domain.units)}`,
      domain.units,
    );

  const columns = domain.lattice.columns;
  const rows = domain.lattice.rows;
  integer(
    out,
    `${root}.lattice.columns`,
    "lattice columns",
    columns,
    1,
    Infinity,
  );
  integer(out, `${root}.lattice.rows`, "lattice rows", rows, 1, Infinity);
  const count = columns * rows;
  if (Number.isSafeInteger(count) && count > SOFT_MAX_PARTICLES)
    out.push(
      "range",
      `${root}.lattice`,
      `a soft body lattice may hold at most ${SOFT_MAX_PARTICLES} particles, but declared ${count}`,
      count,
      count - SOFT_MAX_PARTICLES,
    );
  if (Number.isSafeInteger(count) && count < 2)
    out.push(
      "range",
      `${root}.lattice`,
      "a soft body lattice must hold at least two particles, or it carries no constraint at all",
      count,
    );

  numeric(
    out,
    `${root}.solver.fixedStepSeconds`,
    "fixed step",
    domain.solver.fixedStepSeconds,
    0,
    true,
    Infinity,
  );
  for (const axis of ["x", "y", "z"] as const)
    numeric(
      out,
      `${root}.solver.gravity.${axis}`,
      `gravity ${axis}`,
      domain.solver.gravity[axis],
      -Infinity,
      false,
      Infinity,
    );
  numeric(
    out,
    `${root}.solver.drag`,
    "drag",
    domain.solver.drag,
    0,
    false,
    Infinity,
  );
  integer(
    out,
    `${root}.solver.iterations`,
    "relaxation iterations",
    domain.solver.iterations,
    1,
    SOFT_MAX_ITERATIONS,
  );
  for (const family of ["structural", "shear", "bend"] as const)
    numeric(
      out,
      `${root}.solver.stiffness.${family}`,
      `${family} stiffness`,
      domain.solver.stiffness[family],
      0,
      false,
      1,
    );
  numeric(
    out,
    `${root}.solver.referenceSpeed`,
    "reference speed",
    domain.solver.referenceSpeed,
    0,
    true,
    Infinity,
  );
  integer(
    out,
    `${root}.solver.maxSteps`,
    "max steps",
    domain.solver.maxSteps,
    1,
    SOFT_MAX_STEPS,
  );

  length(out, `${root}.rest`, "rest", domain.rest.length, count * 3);
  length(out, `${root}.mass`, "mass", domain.mass.length, count);
  domain.rest.forEach((value, index) =>
    numeric(
      out,
      `${root}.rest[${index}]`,
      "rest coordinate",
      value,
      -Infinity,
      false,
      Infinity,
    ),
  );
  domain.mass.forEach((value, index) =>
    numeric(
      out,
      `${root}.mass[${index}]`,
      "particle mass",
      value,
      0,
      true,
      Infinity,
    ),
  );

  // A coincident pair has no direction to project along, so the constraint
  // between them is silently dropped by the solver. Refusing it here is what
  // keeps a mis-generated rest mesh from reading as a panel that simply will
  // not hold together.
  if (domain.rest.length === count * 3)
    for (let row = 0; row < rows; ++row)
      for (let column = 0; column < columns; ++column) {
        const particle = row * columns + column;
        if (column + 1 < columns)
          coincident(out, root, domain, particle, particle + 1);
        if (row + 1 < rows)
          coincident(out, root, domain, particle, particle + columns);
      }

  const travel = softBodyTravelNumber(domain);
  if (Number.isFinite(travel) && travel > 1)
    out.push(
      "range",
      `${root}.solver.fixedStepSeconds`,
      `a position-based step may not travel further than the shortest constraint: dt·referenceSpeed/shortestRestLength <= 1, but the travel number is ${travel}`,
      domain.solver.fixedStepSeconds,
      travel - 1,
    );

  bounded(
    out,
    `${root}.anchors`,
    "anchors",
    domain.anchors.length,
    SOFT_MAX_ANCHORS,
  );
  const anchorIds = new Set<string>();
  const anchoredParticles = new Set<number>();
  domain.anchors.forEach((anchor, index) => {
    const path = `${root}.anchors[${index}]`;
    identity(out, path, "anchor", anchor.id, anchorIds);
    integer(
      out,
      `${path}.particle`,
      "anchor particle",
      anchor.particle,
      0,
      count - 1,
    );
    if (anchoredParticles.has(anchor.particle))
      out.push(
        "type",
        `${path}.particle`,
        `particle ${anchor.particle} is already held by another anchor`,
        anchor.particle,
      );
    anchoredParticles.add(anchor.particle);
    if (anchor.position !== null)
      vector(out, `${path}.position`, anchor.position);
  });

  bounded(
    out,
    `${root}.states`,
    "named states",
    domain.states.length,
    SOFT_MAX_STATES,
  );
  const stateIds = new Set<string>();
  domain.states.forEach((state, index) => {
    const path = `${root}.states[${index}]`;
    identity(out, path, "named state", state.id, stateIds);
    const posed = new Set<string>();
    state.anchors.forEach((pose, at) => {
      const posePath = `${path}.anchors[${at}]`;
      if (!anchorIds.has(pose.anchor))
        out.push(
          "type",
          `${posePath}.anchor`,
          `named state cites anchor "${pose.anchor}", which the domain does not declare`,
          pose.anchor,
        );
      else if (posed.has(pose.anchor))
        out.push(
          "type",
          `${posePath}.anchor`,
          `named state poses anchor "${pose.anchor}" twice`,
          pose.anchor,
        );
      posed.add(pose.anchor);
      vector(out, `${posePath}.position`, pose.position);
    });
  });

  bounded(
    out,
    `${root}.colliders`,
    "colliders",
    domain.colliders.length,
    SOFT_MAX_COLLIDERS,
  );
  const colliderIds = new Set<string>();
  domain.colliders.forEach((collider, index) => {
    const path = `${root}.colliders[${index}]`;
    identity(out, path, "collider", collider.id, colliderIds);
    if (collider.kind === "plane") {
      vector(out, `${path}.normal`, collider.normal);
      if (magnitude(collider.normal) === 0)
        out.push(
          "type",
          `${path}.normal`,
          "collider plane normal must be a non-zero vector",
          collider.normal,
        );
      numeric(
        out,
        `${path}.offset`,
        "collider plane offset",
        collider.offset,
        -Infinity,
        false,
        Infinity,
      );
    } else if (collider.kind === "sphere") {
      vector(out, `${path}.center`, collider.center);
      numeric(
        out,
        `${path}.radius`,
        "collider radius",
        collider.radius,
        0,
        true,
        Infinity,
      );
    } else {
      vector(out, `${path}.min`, collider.min);
      vector(out, `${path}.max`, collider.max);
      for (const axis of ["x", "y", "z"] as const)
        if (collider.max[axis] <= collider.min[axis])
          out.push(
            "range",
            `${path}.max.${axis}`,
            `collider box max ${axis} must be strictly above its min (${collider.min[axis]})`,
            collider.max[axis],
          );
    }
  });

  // A panel that starts inside furniture is a panel whose first step teleports.
  if (domain.rest.length === count * 3)
    domain.colliders.forEach((collider, index) => {
      for (let particle = 0; particle < count; ++particle)
        if (
          embedded(collider, {
            x: domain.rest[particle * 3],
            y: domain.rest[particle * 3 + 1],
            z: domain.rest[particle * 3 + 2],
          })
        ) {
          out.push(
            "type",
            `${root}.colliders[${index}]`,
            `rest particle ${particle} starts inside collider "${collider.id}"`,
            particle,
          );
          return;
        }
    });

  if (domain.wind !== null) {
    vector(out, `${root}.wind.direction`, domain.wind.direction);
    if (magnitude(domain.wind.direction) === 0)
      out.push(
        "type",
        `${root}.wind.direction`,
        "wind direction must be a non-zero vector",
        domain.wind.direction,
      );
    numeric(
      out,
      `${root}.wind.acceleration`,
      "wind acceleration",
      domain.wind.acceleration,
      -Infinity,
      false,
      Infinity,
    );
    numeric(
      out,
      `${root}.wind.gustAcceleration`,
      "wind gust acceleration",
      domain.wind.gustAcceleration,
      0,
      false,
      Infinity,
    );
    numeric(
      out,
      `${root}.wind.gustHz`,
      "wind gust frequency",
      domain.wind.gustHz,
      0,
      false,
      Infinity,
    );
  }

  return out.toValidation();
};

/** Whether a point lies strictly inside one collider. */
const embedded = (
  collider: IAutoMovieSoftCollider,
  point: IAutoMovieVector3,
): boolean => {
  if (collider.kind === "plane") {
    const length = magnitude(collider.normal);
    if (length === 0) return false;
    return (
      (collider.normal.x * point.x +
        collider.normal.y * point.y +
        collider.normal.z * point.z) /
        length <
      collider.offset
    );
  }
  if (collider.kind === "sphere") {
    const dx = point.x - collider.center.x;
    const dy = point.y - collider.center.y;
    const dz = point.z - collider.center.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) < collider.radius;
  }
  return (
    point.x > collider.min.x &&
    point.x < collider.max.x &&
    point.y > collider.min.y &&
    point.y < collider.max.y &&
    point.z > collider.min.z &&
    point.z < collider.max.z
  );
};

/** Euclidean length of one authored vector. */
const magnitude = (vector: IAutoMovieVector3): number =>
  Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);

/** Refuse a structural rest edge whose two particles sit on the same point. */
const coincident = (
  out: ViolationCollector,
  root: string,
  domain: IAutoMovieSoftBodyDomain,
  a: number,
  b: number,
): void => {
  const dx = domain.rest[b * 3] - domain.rest[a * 3];
  const dy = domain.rest[b * 3 + 1] - domain.rest[a * 3 + 1];
  const dz = domain.rest[b * 3 + 2] - domain.rest[a * 3 + 2];
  if (dx * dx + dy * dy + dz * dz !== 0) return;
  out.push(
    "type",
    `${root}.rest[${a * 3}]`,
    `rest particles ${a} and ${b} are coincident, so the constraint between them has no direction`,
    [a, b],
  );
};

/** Every component of an authored vector must be a real number. */
const vector = (
  out: ViolationCollector,
  path: string,
  value: IAutoMovieVector3,
): void => {
  for (const axis of ["x", "y", "z"] as const)
    numeric(
      out,
      `${path}.${axis}`,
      `${axis} component`,
      value[axis],
      -Infinity,
      false,
      Infinity,
    );
};

/** A finite scalar inside `[min, max]`, or `(min, max]` when `exclusive`. */
const numeric = (
  out: ViolationCollector,
  path: string,
  label: string,
  value: number,
  min: number,
  exclusive: boolean,
  max: number,
): void => {
  if (
    !Number.isFinite(value) ||
    (exclusive ? value <= min : value < min) ||
    value > max
  )
    out.push(
      "range",
      path,
      `${label} must be finite within ${exclusive ? "(" : "["}${min}, ${max}]`,
      value,
    );
};

/** A safe integer inside `[min, max]`. */
const integer = (
  out: ViolationCollector,
  path: string,
  label: string,
  value: number,
  min: number,
  max: number,
): void => {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    out.push(
      "type",
      path,
      `${label} must be an integer within [${min}, ${max}]`,
      value,
    );
};

/** A particle-indexed array whose length must equal the lattice's own. */
const length = (
  out: ViolationCollector,
  path: string,
  label: string,
  actual: number,
  expected: number,
): void => {
  if (actual !== expected)
    out.push(
      "type",
      path,
      `${label} must hold exactly ${expected} values, but held ${actual}`,
      actual,
    );
};

/** A declared collection that must stay inside its budget. */
const bounded = (
  out: ViolationCollector,
  path: string,
  label: string,
  actual: number,
  budget: number,
): void => {
  if (actual > budget)
    out.push(
      "range",
      path,
      `a soft body may declare at most ${budget} ${label}, but declared ${actual}`,
      actual,
      actual - budget,
    );
};

/** A non-empty id that has not already been used by a sibling. */
const identity = (
  out: ViolationCollector,
  path: string,
  label: string,
  id: string,
  seen: Set<string>,
): void => {
  if (id.trim().length === 0)
    out.push("type", `${path}.id`, `${label} id must be non-empty`, id);
  else if (seen.has(id))
    out.push("type", `${path}.id`, `${label} id "${id}" is duplicated`, id);
  seen.add(id);
};

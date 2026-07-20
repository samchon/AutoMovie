import { IAutoMovieVector3 } from "@automovie/interface";

import { Vector3 } from "../math/Vector3";

/**
 * A colliding body, reduced to what a collision _response_ needs: how heavy it
 * is, how fast it is going, and the material traits that decide whether a hit
 * bounces, embeds, or passes through. This is deliberately abstract: the point
 * (per the project's direction) is to compute a high-level, deterministic
 * _result_ an AI can be handed as a hint, not to run a full rigid-body sim.
 *
 * @author Samchon
 */
export interface IAutoMovieImpactBody {
  /** Mass (kg); larger = harder to move. */
  mass: number;
  /** Linear velocity (world m/s). */
  velocity: IAutoMovieVector3;
  /** Bounciness `[0,1]`: how much closing speed is returned. */
  restitution: number;
  /** Rigidity `[0,1]`: 1 a hard shell, 0 soft flesh. */
  hardness: number;
  /**
   * How easily this body is pierced `[0,1]`: 1 a soft target an arrow sinks
   * into.
   */
  penetrability: number;
}

/** How a collision resolves: the qualitative outcome. */
export type AutoMovieImpactKind = "bounce" | "embed" | "through" | "deflect";

/**
 * The abstracted result of one collision: the contact normal, the impulse
 * delivered, the closing speed, both bodies' post-impact velocities, and a
 * qualitative {@link AutoMovieImpactKind}. One value serves both consumers: an
 * AI hint ("recoil this hard, this way; it embeds") and a deterministic driver
 * for auto-played aftermath.
 */
export interface IAutoMovieImpact {
  /** Unit contact normal, from `a` toward `b`. */
  normal: IAutoMovieVector3;
  /** Closing speed along the normal at contact (0 if not approaching). */
  speed: number;
  /** Impulse delivered to `b` (the equal and opposite acts on `a`). */
  impulse: IAutoMovieVector3;
  /** `a`'s velocity after the impact. */
  velocityA: IAutoMovieVector3;
  /** `b`'s velocity after the impact. */
  velocityB: IAutoMovieVector3;
  /** What happened. */
  kind: AutoMovieImpactKind;
}

const EMBED_SPEED = 6; // m/s above which a penetrable body is pierced, not bounced
const THROUGH_SPEED = 14; // m/s above which a very soft body is passed clean through
const THROUGH_TRANSFER = 0.3; // fraction of momentum a pass-through still imparts

type ImpactCoefficient = "restitution" | "hardness" | "penetrability";
const VECTOR_AXES = ["x", "y", "z"] as const;

const assertImpactVector = (
  label: "a" | "b",
  name: "velocity",
  vector: IAutoMovieVector3,
): void => {
  for (const axis of VECTOR_AXES)
    if (!Number.isFinite(vector[axis]))
      throw new RangeError(
        `impact body ${label} ${name}.${axis} must be finite, but was ${vector[axis]}`,
      );
};

const assertImpactMass = (label: "a" | "b", mass: number): void => {
  if (!Number.isFinite(mass))
    throw new RangeError(
      `impact body ${label} mass must be finite, but was ${mass}`,
    );
  if (!(mass > 0))
    throw new RangeError(
      `impact body ${label} mass must be > 0, but was ${mass}`,
    );
};

const assertImpactCoefficient = (
  label: "a" | "b",
  name: ImpactCoefficient,
  value: number,
): void => {
  if (!Number.isFinite(value))
    throw new RangeError(
      `impact body ${label} ${name} must be finite, but was ${value}`,
    );
  if (value < 0 || value > 1)
    throw new RangeError(
      `impact body ${label} ${name} must be within [0, 1], but was ${value}`,
    );
};

const assertImpactBody = (
  label: "a" | "b",
  body: IAutoMovieImpactBody,
): void => {
  assertImpactMass(label, body.mass);
  assertImpactVector(label, "velocity", body.velocity);
  assertImpactCoefficient(label, "restitution", body.restitution);
  assertImpactCoefficient(label, "hardness", body.hardness);
  assertImpactCoefficient(label, "penetrability", body.penetrability);
};

/**
 * Resolve a collision between bodies `a` and `b` across unit contact `normal`
 * (pointing from `a` to `b`) into an abstracted {@link IAutoMovieImpact}.
 *
 * Impulse is the textbook normal response, `jn = (1+e)·closing / (1/mₐ +
 * 1/m_b)`, but the **effective restitution and a qualitative kind** come from a
 * cheap, deterministic material heuristic rather than a contact solver: a fast
 * strike into a soft, penetrable body **embeds** (no rebound) or, if very fast
 * and very soft, passes **through** (only a fraction of the momentum
 * transfers); a hard, bouncy pair **bounces**; otherwise it **deflects**.
 * Bodies already separating yield a pure `deflect` with no impulse.
 *
 * @author Samchon
 */
export const resolveImpact = (
  a: IAutoMovieImpactBody,
  b: IAutoMovieImpactBody,
  normal: IAutoMovieVector3,
): IAutoMovieImpact => {
  assertImpactBody("a", a);
  assertImpactBody("b", b);

  const normalLengthSq = Vector3.dot(normal, normal);
  if (!Number.isFinite(normalLengthSq))
    throw new RangeError(
      `impact normal must be finite, but was (${normal.x}, ${normal.y}, ${normal.z})`,
    );
  if (normalLengthSq === 0)
    throw new RangeError("impact normal must be non-zero");

  const n = Vector3.normalize(normal);
  const vRel = Vector3.subtract(b.velocity, a.velocity); // b relative to a
  const vRelN = Vector3.dot(vRel, n);
  const closing = -vRelN; // > 0 when approaching

  if (closing <= 0)
    return {
      normal: n,
      speed: 0,
      impulse: Vector3.create(0, 0, 0),
      velocityA: a.velocity,
      velocityB: b.velocity,
      kind: "deflect",
    };

  const e = a.restitution * b.restitution;
  let kind: AutoMovieImpactKind;
  if (b.penetrability >= 0.6 && closing >= EMBED_SPEED)
    kind =
      b.penetrability >= 0.85 && closing >= THROUGH_SPEED ? "through" : "embed";
  else if (e >= 0.5 && b.hardness >= 0.5) kind = "bounce";
  else kind = "deflect";

  // effective restitution + how much of the impulse actually lands
  const eEff = kind === "bounce" ? e : 0;
  const transfer = kind === "through" ? THROUGH_TRANSFER : 1;

  const invSum = 1 / a.mass + 1 / b.mass;
  const jn = (transfer * (1 + eEff) * closing) / invSum;
  const impulse = Vector3.scale(n, jn);

  return {
    normal: n,
    speed: closing,
    impulse,
    velocityA: Vector3.subtract(a.velocity, Vector3.scale(n, jn / a.mass)),
    velocityB: Vector3.add(b.velocity, Vector3.scale(n, jn / b.mass)),
    kind,
  };
};

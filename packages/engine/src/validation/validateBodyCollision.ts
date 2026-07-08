import {
  AutoMovieHumanoidBone,
  IAutoMovieBody,
  IAutoMovieInteractionEvent,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieJointAxes, resolvePose } from "../kinematics";
import { Vector3 } from "../math/Vector3";
import { closestPointsBetweenSegments } from "../math/segments";
import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import {
  IAutoMovieCollisionResponse,
  suggestCollisionResponse,
} from "../physics/collisionResponse";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { IAutoMovieCapsuleProxy, validateCapsule } from "./capsuleProxy";
import { ViolationCollector } from "./violation";

const DEFAULT_SAMPLE_RATE = 24;
const DEFAULT_MASS = 70; // kg — an unspecified body defaults to a human mass
const DEFAULT_RESTITUTION = 0.2;
const DEFAULT_HARDNESS = 0.5;
const DEFAULT_PENETRABILITY = 0.3;
const DEFAULT_GAIN = 0.05; // recoil flexion degrees per unit impulse
const FALLBACK_NORMAL: IAutoMovieVector3 = { x: 0, y: 1, z: 0 };

/**
 * One actor in an inter-body collision test: its rig, its motion, the capsule
 * proxies that stand in for its volume, and its physical body (mass etc., #595)
 * — `null` bodies fall back to a default human mass. `node` labels it in
 * emitted events. Each capsule's endpoints must be two distinct bones of
 * `skeleton` with a positive radius; {@link detectBodyCollision} validates this
 * itself (a malformed capsule is an error, returned before sampling) rather
 * than trusting an upstream pass.
 *
 * @author Samchon
 */
export interface IAutoMovieCollisionActor {
  /** Scene node id, used to label emitted interaction events. */
  node: string;
  /** Rig for forward kinematics. */
  skeleton: IAutoMovieSkeleton;
  /** Motion clip to sample. */
  motion: IAutoMovieMotion;
  /** Capsule proxies over this actor's bones. */
  capsules: readonly IAutoMovieCapsuleProxy[];
  /** Physical body (mass, restitution). `null` → default mass. */
  body: IAutoMovieBody | null;
  /** Optional clinical-axis remap. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /** Optional rest-frame remap. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}

/**
 * The outcome of an inter-body collision check: the `warning`/`error` envelope,
 * the `contact` interaction events for downstream/render, and a suggested
 * response at the deepest penetration (or `null`).
 *
 * @author Samchon
 */
export interface IAutoMovieBodyCollisionResult {
  /** Warning-severity feedback (or an error for a bad sampleRate). */
  validation: IAutoMovieValidation;
  /** Contact events on the shot clock — "one calculation, two consumers". */
  events: IAutoMovieInteractionEvent[];
  /** Suggested response at the deepest contact, or `null` when none applies. */
  response: IAutoMovieCollisionResponse | null;
}

interface IPenetration {
  frame: number;
  time: number;
  from: AutoMovieHumanoidBone;
  otherFrom: AutoMovieHumanoidBone;
  depth: number;
  pointA: IAutoMovieVector3;
  pointB: IAutoMovieVector3;
}

/**
 * Detect where two actors' capsule proxies interpenetrate over a shot, and —
 * because a film may be deliberately unphysical (D010) — report it as advisory
 * `warning`s, not a hard rejection. At the deepest contact it suggests a
 * plausible response ({@link resolveImpact} + recoil flinch) the model can
 * accept or override, and emits `contact` events so downstream/render see the
 * same computed contact. A `physicsIntent` marker (e.g. a choreographed fight)
 * suppresses the warnings and the suggestion while still surfacing the events.
 *
 * Generalizes {@link validateSelfIntersection} from one body to two. Full
 * synthesis of the suggested react action into `performShot` is deferred (#600
 * follow-up); this returns the response as data.
 *
 * @author Samchon
 */
export const detectBodyCollision = (props: {
  a: IAutoMovieCollisionActor;
  b: IAutoMovieCollisionActor;
  sampleRate?: number;
  physicsIntent?: string;
  gainDegPerImpulse?: number;
  path?: string;
}): IAutoMovieBodyCollisionResult => {
  const collector = new ViolationCollector();
  const path = props.path ?? "$input";
  const sampleRate =
    props.sampleRate === undefined ? DEFAULT_SAMPLE_RATE : props.sampleRate;
  const gain =
    props.gainDegPerImpulse === undefined
      ? DEFAULT_GAIN
      : props.gainDegPerImpulse;
  const suppressed = props.physicsIntent !== undefined;

  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    collector.push(
      "range",
      `${path}.sampleRate`,
      `sampleRate must be a finite number > 0, but was ${sampleRate}`,
      sampleRate,
    );
    return { validation: collector.toValidation(), events: [], response: null };
  }

  // Validate every capsule against its actor's rig before sampling — the same
  // precondition validateSelfIntersection enforces on itself. A malformed
  // capsule (bone not on the rig, non-distinct endpoints, bad radius) resolves
  // to an undefined world position and a NaN distance, and `NaN < minimum` is
  // false, so an unguarded run would drop the overlap in silence. These are
  // structural errors, not physics warnings: return before sampling.
  const capsulesValid = [
    validateActorCapsules(props.a, `${path}.a`, collector),
    validateActorCapsules(props.b, `${path}.b`, collector),
  ].every(Boolean);
  if (!capsulesValid)
    return { validation: collector.toValidation(), events: [], response: null };

  const duration = Math.min(props.a.motion.duration, props.b.motion.duration);
  const times = sampleTimes(duration, sampleRate);
  const mapsA = times.map((time) => resolveMap(props.a, time));
  const mapsB = times.map((time) => resolveMap(props.b, time));

  const penetrations: IPenetration[] = [];
  times.forEach((time, frame) => {
    props.a.capsules.forEach((ca) => {
      props.b.capsules.forEach((cb) => {
        const closest = closestPointsBetweenSegments(
          mapsA[frame]!.get(ca.from)!,
          mapsA[frame]!.get(ca.to)!,
          mapsB[frame]!.get(cb.from)!,
          mapsB[frame]!.get(cb.to)!,
        );
        const minimum = ca.radius + cb.radius;
        if (closest.distance < minimum)
          penetrations.push({
            frame,
            time,
            from: ca.from,
            otherFrom: cb.from,
            depth: minimum - closest.distance,
            pointA: closest.pointA,
            pointB: closest.pointB,
          });
      });
    });
  });

  const events: IAutoMovieInteractionEvent[] = penetrations.map((pen, i) => ({
    id: `contact:${i}`,
    kind: "contact",
    source: "sampledProximity",
    time: pen.time,
    actor: props.a.node,
    target: props.b.node,
    object: null,
    point: Vector3.scale(Vector3.add(pen.pointA, pen.pointB), 0.5),
    actionIndex: null,
    reaction: null,
  }));

  if (suppressed || penetrations.length === 0)
    return { validation: collector.toValidation(), events, response: null };

  penetrations.forEach((pen, i) => {
    collector.warn(
      "physics",
      `${path}.contacts[${i}].distance`,
      `bodies "${props.a.node}" and "${props.b.node}" overlap by ${round(pen.depth)}m at t=${round(pen.time)}s`,
      pen.depth,
      pen.depth,
    );
  });

  const response = suggestResponse(
    props,
    penetrations,
    sampleRate,
    mapsA,
    mapsB,
    gain,
  );
  return { validation: collector.toValidation(), events, response };
};

/**
 * Validate every capsule of one actor against its own rig, one violation per
 * fault (all capsules are checked so a correction round sees them together).
 * Returns whether the actor's capsules are all usable.
 */
const validateActorCapsules = (
  actor: IAutoMovieCollisionActor,
  path: string,
  collector: ViolationCollector,
): boolean => {
  const bones = new Set(actor.skeleton.bones.map((bone) => bone.bone));
  let valid = true;
  actor.capsules.forEach((capsule, index) => {
    if (
      !validateCapsule(capsule, `${path}.capsules[${index}]`, bones, collector)
    )
      valid = false;
  });
  return valid;
};

const suggestResponse = (
  props: {
    a: IAutoMovieCollisionActor;
    b: IAutoMovieCollisionActor;
  },
  penetrations: IPenetration[],
  rate: number,
  mapsA: ReadonlyArray<ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>>,
  mapsB: ReadonlyArray<ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>>,
  gain: number,
): IAutoMovieCollisionResponse => {
  const deepest = [...penetrations].sort((x, y) => y.depth - x.depth)[0]!;
  const prev = Math.max(0, deepest.frame - 1);
  const velA = velocity(mapsA, deepest.frame, prev, deepest.from, rate);
  const velB = velocity(mapsB, deepest.frame, prev, deepest.otherFrom, rate);

  const rawNormal = Vector3.subtract(deepest.pointB, deepest.pointA);
  const normal =
    Vector3.dot(rawNormal, rawNormal) > 0 ? rawNormal : FALLBACK_NORMAL;

  return suggestCollisionResponse({
    a: impactBody(props.a.body, velA),
    b: impactBody(props.b.body, velB),
    normal,
    gainDegPerImpulse: gain,
    chain: [deepest.otherFrom],
    skeleton: props.b.skeleton,
  });
};

const velocity = (
  maps: ReadonlyArray<ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>>,
  frame: number,
  prev: number,
  bone: AutoMovieHumanoidBone,
  rate: number,
): IAutoMovieVector3 =>
  Vector3.scale(
    Vector3.subtract(maps[frame]!.get(bone)!, maps[prev]!.get(bone)!),
    rate,
  );

const impactBody = (
  body: IAutoMovieBody | null,
  vel: IAutoMovieVector3,
): {
  mass: number;
  velocity: IAutoMovieVector3;
  restitution: number;
  hardness: number;
  penetrability: number;
} => ({
  mass: body === null ? DEFAULT_MASS : body.mass,
  velocity: vel,
  restitution: body === null ? DEFAULT_RESTITUTION : body.restitution,
  hardness: DEFAULT_HARDNESS,
  penetrability: DEFAULT_PENETRABILITY,
});

const resolveMap = (
  actor: IAutoMovieCollisionActor,
  time: number,
): Map<AutoMovieHumanoidBone, IAutoMovieVector3> =>
  new Map(
    resolvePose(
      sampleMotion(actor.motion, time).pose,
      actor.skeleton,
      actor.jointAxes,
      actor.restFrames,
    ).map((bone) => [bone.bone, bone.worldPosition]),
  );

const round = (value: number): number => Math.round(value * 1_000) / 1_000;

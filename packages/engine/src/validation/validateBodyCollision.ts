import {
  AutoMovieHumanoidBone,
  IAutoMovieBody,
  IAutoMovieInteractionEvent,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import {
  IAutoMovieJointAxes,
  IAutoMovieSkeletonTopology,
  indexSkeletonTopology,
  resolvePose,
} from "../kinematics";
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
import { fkReachableBones } from "./fkReachableBones";
import { ViolationCollector } from "./violation";

const DEFAULT_SAMPLE_RATE = 24;
const DEFAULT_MASS = 70; // kg: an unspecified body defaults to a human mass
const DEFAULT_RESTITUTION = 0.2;
const DEFAULT_HARDNESS = 0.5;
const DEFAULT_PENETRABILITY = 0.3;
const DEFAULT_GAIN = 0.05; // recoil flexion degrees per unit impulse
const FALLBACK_NORMAL: IAutoMovieVector3 = { x: 0, y: 1, z: 0 };

/**
 * One actor in an inter-body collision test: its rig, its motion, the capsule
 * proxies that stand in for its volume, and its physical body (mass etc.,
 * #595): `null` bodies fall back to a default human mass. `node` labels it in
 * emitted events. Each capsule's endpoints must be two distinct bones of
 * `skeleton` with a positive radius; {@link detectBodyCollision} validates this
 * itself (a malformed capsule is an error, returned before sampling) rather
 * than trusting an upstream pass.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `IAutoMovieCollisionActor` binds a stable scene node to the rig, motion, proxies, and physical inputs inspected for one collision participant.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `IAutoMovieCollisionActor` defines the named subject root from which capsule and motion member paths are reconstructed.
 * @author Samchon
 */
export interface IAutoMovieCollisionActor {
  /**
   * Scene node id, used to label emitted interaction events.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `node` labels the actor and target identities on every sampled contact event.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `node` distinguishes collision subjects even when their capsule layouts or display names coincide.
   */
  node: string;
  /**
   * Rig for forward kinematics.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `skeleton` supplies the bone identities against which malformed capsule endpoints are located.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `skeleton` establishes the rig root and hierarchy used to decide whether a named endpoint is FK-reachable.
   */
  skeleton: IAutoMovieSkeleton;
  /**
   * Motion clip to sample.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `motion` supplies the shot-clock pose samples from which this actor's contact times are identified.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `motion` bounds collision discovery to the participant's declared clip duration and sampled pose state.
   */
  motion: IAutoMovieMotion;
  /**
   * Capsule proxies over this actor's bones.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `capsules` retains the indexed body proxies whose endpoint or radius field can fail before sampling.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `capsules` provides the stable collection position and bone pair used to locate each overlap calculation.
   */
  capsules: readonly IAutoMovieCapsuleProxy[];
  /**
   * Physical body (mass, restitution). `null` → default mass.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `body` identifies the mass and restitution source used for the reported deepest-contact response.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `body` distinguishes declared physical parameters from the documented default-human fallback.
   */
  body: IAutoMovieBody | null;
  /**
   * Optional clinical-axis remap.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `jointAxes` names the optional per-bone axis remap used when resolving this participant's sampled capsules.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `jointAxes` keeps clinical-axis interpretation attached to the actor whose contact positions depend on it.
   */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  /**
   * Optional rest-frame remap.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `restFrames` names the optional per-bone rest basis applied to this actor before overlap is measured.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `restFrames` preserves the pose-resolution basis alongside the subject whose world-space proxy positions it changes.
   */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
}

/**
 * The outcome of an inter-body collision check: the `warning`/`error` envelope,
 * the `contact` interaction events for downstream/render, and a suggested
 * response at the deepest penetration (or `null`).
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `IAutoMovieBodyCollisionResult` keeps collision diagnostics, contact events, and the deepest-contact response under one participant-pair outcome.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `IAutoMovieBodyCollisionResult` separates invalid input, sampled contact scope, and optional correction data instead of conflating their effects.
 * @author Samchon
 */
export interface IAutoMovieBodyCollisionResult {
  /**
   * Warning-severity feedback (or an error for a bad sampleRate).
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `validation` carries capsule-input errors and indexed contact-distance warnings at their discovered paths.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `validation` preserves severity, expected overlap condition, penetration depth, and overshoot for the collision pair.
   */
  validation: IAutoMovieValidation;
  /**
   * Contact events on the shot clock: "one calculation, two consumers".
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `events` records each contact's time, actor, target, and midpoint for downstream identification.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `events` preserves the sampled temporal and subject scope even when physics intent suppresses advisory warnings.
   */
  events: IAutoMovieInteractionEvent[];
  /**
   * Suggested response at the deepest contact, or `null` when none applies.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `response` identifies the correction suggested for the single deepest sampled penetration.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `response` remains null when no unsuppressed contact applies, keeping advisory scope distinct from event existence.
   */
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
 * Detect where two actors' capsule proxies interpenetrate over a shot, and,
 * because a film may be deliberately unphysical, report it as advisory
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
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-path-and-scope `detectBodyCollision` reports malformed actor proxies at their input paths and each interpenetration at an indexed contact-distance path.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-path-scope `detectBodyCollision` binds participant ids, sample times, penetration observations, and warning scope to the same deterministic collision pass.
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

  // Validate every capsule against its actor's rig before sampling, the same
  // precondition validateSelfIntersection enforces on itself. A malformed
  // capsule (bone not on the rig, FK-unreachable, non-distinct endpoints, bad
  // radius) resolves to an undefined world position and a NaN distance (or
  // crashes outright, #1056), and `NaN < minimum` is false, so an unguarded
  // run would drop the overlap in silence. These are structural errors, not
  // physics warnings: return before sampling.
  const topologyA = indexSkeletonTopology(props.a.skeleton);
  const topologyB = indexSkeletonTopology(props.b.skeleton);
  const capsulesValid = [
    validateActorCapsules(props.a, `${path}.a`, topologyA, collector),
    validateActorCapsules(props.b, `${path}.b`, topologyB, collector),
  ].every(Boolean);
  if (!capsulesValid)
    return { validation: collector.toValidation(), events: [], response: null };

  const duration = Math.min(props.a.motion.duration, props.b.motion.duration);
  const times = sampleTimes(duration, sampleRate);
  const mapsA = times.map((time) => resolveMap(props.a, time, topologyA));
  const mapsB = times.map((time) => resolveMap(props.b, time, topologyB));

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
  topology: IAutoMovieSkeletonTopology,
  collector: ViolationCollector,
): boolean => {
  const bones = new Set(actor.skeleton.bones.map((bone) => bone.bone));
  const reachable = fkReachableBones(actor.skeleton, topology);
  let valid = true;
  actor.capsules.forEach((capsule, index) => {
    if (
      !validateCapsule(
        capsule,
        `${path}.capsules[${index}]`,
        bones,
        reachable,
        collector,
      )
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
  topology: IAutoMovieSkeletonTopology,
): Map<AutoMovieHumanoidBone, IAutoMovieVector3> =>
  new Map(
    resolvePose(
      sampleMotion(actor.motion, time).pose,
      actor.skeleton,
      actor.jointAxes,
      actor.restFrames,
      topology,
    ).map((bone) => [bone.bone, bone.worldPosition]),
  );

const round = (value: number): number => Math.round(value * 1_000) / 1_000;

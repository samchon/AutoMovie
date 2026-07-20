import {
  AutoMovieHumanoidBone,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
} from "@automovie/interface";

import {
  IAutoMovieJointAxes,
  indexSkeletonTopology,
  resolvePose,
} from "../kinematics";
import { sampleTimes } from "../motion/sampleClock";
import { sampleMotion } from "../motion/sampleMotion";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { groundFunction } from "../space/ground";
import { IAutoMovieCapsuleProxy, validateCapsule } from "./capsuleProxy";
import { fkReachableBones } from "./fkReachableBones";
import { ViolationCollector } from "./violation";

const DEFAULT_FOOT_BONES = ["leftFoot", "rightFoot"] as const;

/**
 * Tier-3 ground-contact check for clips whose body is expected to stay on or
 * above the ground. It samples the motion on a fixed clock, resolves FK, and
 * reports any configured foot bone whose world-space `y` falls below the ground
 * height at that foot's `(x, z)` minus `tolerance`. With `capsules` it also
 * sweeps whole-body capsule proxies (#1185): a capsule's lowest surface point
 * dipping below the ground warns too, so a hand or hip through the floor is not
 * invisible the way a feet-only check leaves it.
 *
 * Ground is a scalar plane or a `(x, z) → y` height source. Plug a space in via
 * {@link spaceGround} (#605) to validate contact over ramps and platforms; a
 * plain scalar keeps the exact pre-space behavior.
 *
 * This is intentionally opt-in rather than part of `validateMotion`: jumps,
 * mounts, crawling, and non-humanoid rigs need different contact assumptions.
 * The stable path shape is `$input.samples[i].<bone>.worldPosition.y`, where
 * `i` is the validator sample index, not a source keyframe index.
 *
 * Ground penetration is a physical-plausibility **warning**, not a gate: the
 * run still succeeds and the warning surfaces so the orchestrator can plant the
 * foot, restage, or acknowledge a deliberate pass-through (a phasing ghost)
 * with `physicsIntent`.
 *
 * @author Samchon
 */
export const validateGroundContact = (props: {
  /** Motion clip to sample. */
  motion: IAutoMovieMotion;

  /** Skeleton used for forward kinematics. */
  skeleton: IAutoMovieSkeleton;

  /** Bones treated as ground-contact points. Defaults to both humanoid feet. */
  footBones?: readonly AutoMovieHumanoidBone[];

  /**
   * Whole-body capsule proxies swept against the ground (#1185): each is a
   * `from → to` bone segment with a radius, and its lowest surface point
   * (`min(from.y, to.y) − radius`, sampled per endpoint against a heightfield)
   * must stay above the ground, so a hand, hip, elbow, or prop clipping through
   * the floor is no longer invisible the way the foot-point check leaves it. A
   * capsule on a missing or detached bone is a `type` error, not a silent skip
   * (the totality contract the point check does not carry). Omit to check only
   * `footBones`.
   */
  capsules?: readonly IAutoMovieCapsuleProxy[];

  /** Ground height: plane scalar or `(x, z) → y` source. Defaults to `0`. */
  groundY?: number | ((x: number, z: number) => number);

  /** Allowed penetration depth before violation. Defaults to `0`. */
  tolerance?: number;

  /** Samples per second used by the validator. Defaults to `24`. */
  sampleRate?: number;

  /** JSON path of the motion being checked. Defaults to `$input`. */
  path?: string;

  /** Optional clinical-axis remap for rigs authored in semantic axes. */
  jointAxes?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Optional rest-frame remap for clinical authoring. */
  restFrames?: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;

  /**
   * Marker that opts the clip out of the ground-contact expectation: a
   * deliberate pass-through (a phasing ghost, a stylized float) sets this and
   * the matching warnings are suppressed.
   */
  physicsIntent?: string;
}): IAutoMovieValidation => {
  const collector = new ViolationCollector();
  const suppressed = props.physicsIntent !== undefined;
  const footBones = props.footBones ?? DEFAULT_FOOT_BONES;
  const tolerance = props.tolerance ?? 0;
  const sampleRate = props.sampleRate ?? 24;
  const path = props.path ?? "$input";
  const groundAt = groundFunction(props.groundY ?? 0);
  const topology = indexSkeletonTopology(props.skeleton);

  // Capsule endpoints are gated up front, exactly like the self-intersection
  // and body-collision validators: a detached or missing endpoint is an error,
  // never a silent skip, so the sweep only ever reads FK-resolved positions.
  const capsules = props.capsules ?? [];
  const skeletonBones = new Set(props.skeleton.bones.map((bone) => bone.bone));
  const reachableBones = fkReachableBones(props.skeleton, topology);
  const capsuleValid = capsules.map((capsule, capsuleIndex) =>
    validateCapsule(
      capsule,
      `${path}.capsules[${capsuleIndex}]`,
      skeletonBones,
      reachableBones,
      collector,
    ),
  );

  // Guard the sampling clock, matching the sibling sampling validators
  // (validateFootSkate/SelfIntersection/BalanceSupport): a non-finite or
  // non-positive rate makes `sampleTimes` yield an empty/NaN clock (which then
  // throws in the sampler), and a non-finite tolerance makes `minY = ground −
  // NaN = NaN` so `y < NaN` is always false. Either one would silently drop
  // every penetration (a #1051/#1082 silent-skip). Surface both as errors and
  // do not sample against a broken clock.
  const badRate = !Number.isFinite(sampleRate) || sampleRate <= 0;
  const badTolerance = !Number.isFinite(tolerance);
  if (badRate)
    collector.push(
      "range",
      `${path}.sampleRate`,
      `sampleRate must be a finite number > 0, but was ${sampleRate}`,
      sampleRate,
    );
  if (badTolerance)
    collector.push(
      "range",
      `${path}.tolerance`,
      `tolerance must be a finite number, but was ${tolerance}`,
      tolerance,
    );
  if (badRate || badTolerance) return collector.toValidation();

  sampleTimes(props.motion.duration, sampleRate).forEach((time, index) => {
    const resolved = new Map(
      resolvePose(
        sampleMotion(props.motion, time).pose,
        props.skeleton,
        props.jointAxes,
        props.restFrames,
        topology,
      ).map((bone) => [bone.bone, bone]),
    );
    for (const bone of footBones) {
      const foot = resolved.get(bone);
      if (foot === undefined) continue;
      const y = foot.worldPosition.y;
      const ground = groundAt(foot.worldPosition.x, foot.worldPosition.z);
      const minY = ground - tolerance;
      if (y < minY && !suppressed)
        collector.warn(
          "physics",
          `${path}.samples[${index}].${bone}.worldPosition.y`,
          `${bone} world y must stay >= ${minY} at t=${round(time)}s (ground ${ground}, tolerance ${tolerance}; a foot usually should not pass through the ground; mark physicsIntent if it is deliberate)`,
          y,
          minY - y,
        );
    }

    capsules.forEach((capsule, capsuleIndex) => {
      if (!capsuleValid[capsuleIndex]) return;
      // Penetration is linear along a straight capsule over a flat plane or a
      // linear ramp, so its deepest point is at an endpoint: sampling both
      // ends against the (possibly sloped) ground finds the worst dip exactly
      // for a single surface and closely for a heightfield.
      const worst = [capsule.from, capsule.to].reduce(
        (deepest: IPenetration | null, endpoint) => {
          const position = resolved.get(endpoint)!.worldPosition;
          const surfaceY = position.y - capsule.radius;
          const minY = groundAt(position.x, position.z) - tolerance;
          const candidate: IPenetration = {
            surfaceY,
            minY,
            depth: minY - surfaceY,
          };
          return deepest === null || candidate.depth > deepest.depth
            ? candidate
            : deepest;
        },
        null,
      )!;
      if (worst.depth > 0 && !suppressed)
        collector.warn(
          "physics",
          `${path}.samples[${index}].capsules[${capsuleIndex}].lowestY`,
          `capsule (${capsule.from} to ${capsule.to}) lowest surface y must stay >= ${round(worst.minY)} at t=${round(time)}s (radius ${capsule.radius}, tolerance ${tolerance}; a body part usually should not pass through the ground; mark physicsIntent if it is deliberate)`,
          worst.surfaceY,
          worst.depth,
        );
    });
  });

  return collector.toValidation();
};

/** One capsule endpoint's dip below the ground: surface y, threshold, depth. */
interface IPenetration {
  surfaceY: number;
  minY: number;
  depth: number;
}

const round = (value: number): number => Math.round(value * 1_000) / 1_000;

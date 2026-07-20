import {
  AutoMovieHumanoidBone,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMoviePose,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";

import { IAutoMovieJointAxes } from "../kinematics/jointToQuaternion";
import {
  indexSkeletonTopology,
  reachableBoneNames,
} from "../kinematics/resolvePose";
import { Vector3 } from "../math/Vector3";
import { clampJointToSkeleton } from "../rom/clampPose";
import { IAutoMovieRestFrame } from "../rom/restFrame";
import { groundFunction } from "../space/ground";
import { ViolationCollector } from "../validation/violation";
import { contactMask } from "./groundPins";
import {
  HUMANOID_LEG_CHAINS,
  IAutoMoviePlantChain,
  resolveBoneMap,
  solveChainPlant,
} from "./legPlant";

/** Contact tolerance above the source ground counted as a planted contact. */
const DEFAULT_TOLERANCE = 0.02;

/**
 * Drift below this, in target model units, is floating-point residue rather
 * than a proportion mismatch. Under a uniform rig scale the factor distributes
 * cleanly through the FK walk (rotate is linear and every accumulated sum
 * scales with it), so a target effector sits on its mapped source contact to
 * the last bit, the drift measures zero, and the pass leaves the frame
 * untouched. That is what makes contact preservation a mathematical no-op on a
 * proportional rig, and why it is safe to leave on by default.
 */
const NOOP_EPSILON = 1e-9;

/**
 * How a retarget treats the contacts the source clip made.
 *
 * `"pin-source-contacts"` re-solves each contacting limb so the effector holds
 * the source contact mapped through `rootScale`; `"carry-joint-angles"` is v1's
 * verbatim angle copy, which foot-slides whenever the rigs differ in
 * proportion.
 */
export type AutoMovieRetargetContactPolicy =
  | "pin-source-contacts"
  | "carry-joint-angles";

/**
 * One declared hand contact: the arm chain and the clip window over which its
 * hand is touching something.
 *
 * Feet are detected geometrically against the ground, but a hand has no such
 * reference: a hand on a table, a wall, or a partner is indistinguishable from
 * a hand in the air by position alone. So a hand contact is **declared**, never
 * inferred.
 *
 * @author Samchon
 */
export interface IAutoMovieRetargetHandContact {
  /** Hand end-effector bone held on its source contact. */
  hand: AutoMovieHumanoidBone;

  /** Chain-root segment (upper arm). */
  upper: AutoMovieHumanoidBone;

  /** Mid segment (forearm). */
  lower: AutoMovieHumanoidBone;

  /** Inclusive contact-window start, seconds on the clip's own clock. */
  start: number;

  /** Inclusive contact-window end, seconds on the clip's own clock. */
  end: number;
}

/**
 * Contact policy input for {@link retargetHumanoidMotion}. Every field is
 * optional: the pass runs with humanoid legs and no declared hand contact
 * unless the caller says otherwise.
 *
 * @author Samchon
 */
export interface IAutoMovieRetargetContactProps {
  /**
   * Run the contact-preserving pass. Defaults to `true`; `false` restores v1's
   * verbatim angle copy.
   */
  enabled?: boolean;

  /**
   * Ground height for source stance detection: a plane scalar or an `(x, z) →
   * y` source. Defaults to the **source rig's own rest floor** (the lowest
   * world Y of its zero pose), so a rig authored with its feet above the origin
   * still detects stance instead of never touching down.
   */
  groundY?: number | ((x: number, z: number) => number);

  /**
   * Contact tolerance above the ground counted as stance, in source model
   * units. Defaults to `0.02`, the same band {@link plantStanceFeet} and
   * {@link validateGroundContact} use. It doubles as the residual budget: a
   * pinned effector that ends further than `tolerance * rootScale` from its
   * contact is reported as a plausibility warning.
   */
  tolerance?: number;

  /** Hand contacts to preserve. Defaults to none. */
  hands?: readonly IAutoMovieRetargetHandContact[];
}

/** A chain plus the frames on which its contact must be preserved. */
interface IAutoMovieContactWindow {
  chain: IAutoMoviePlantChain;
  /** `null` detects stance against the ground; a span declares it. */
  window: { start: number; end: number } | null;
}

/**
 * The contact-preserving stage of {@link retargetHumanoidMotion}.
 *
 * V1 copied clinical joint angles verbatim and scaled only the root path, which
 * is exact for a proportional rig and wrong for any other: a target whose legs
 * are relatively longer plants its foot somewhere else entirely, and the clip
 * skates. This pass closes that gap without abandoning the clinical-angle
 * contract.
 *
 * For every existing keyframe it FK-resolves the clip on the **source** rig,
 * decides which effectors are in contact (feet via the shared
 * {@link contactMask} ground predicate, hands via the caller's declared
 * windows), maps each contact position into target space by the **same
 * `rootScale` the root path uses** (so the contact and the root stay one
 * consistent frame) and re-solves the target limb onto it with the shared
 * two-bone lowering. The pin is the source effector's position on **that**
 * frame rather than the stance run's first frame: retargeting reproduces the
 * source performance, including a slide the source itself authored;
 * {@link plantStanceFeet} is the pass that removes skate.
 *
 * Three properties make it safe to leave on by default:
 *
 * - **Proportional rigs are untouched.** A frame whose effector already sits on
 *   its mapped contact within {@link NOOP_EPSILON} is skipped outright, so a
 *   uniform scale changes not one angle.
 * - **Keyframes are preserved.** The clip is corrected in place at its authored
 *   times; nothing is re-keyed onto a fixed clock.
 * - **ROM binds the correction.** The IK result is derived data, not authored
 *   intent, so it is clamped into the target's ROM
 *   ({@link clampJointToSkeleton}) instead of being allowed to fail the
 *   retarget. When the clamped chain then cannot hold the contact, the residual
 *   is a `warning`, residual slide is implausible, not impossible.
 *
 * @author Samchon
 */
export const preserveRetargetContacts = (props: {
  /** Rig the clip was authored on. */
  source: IAutoMovieSkeleton;

  /** Rig the clip now plays on. */
  target: IAutoMovieSkeleton;

  /** The authored clip, read for source-space contact detection. */
  sourceMotion: IAutoMovieMotion;

  /** The root-scaled clip this pass corrects. */
  retargeted: IAutoMovieMotion;

  /** Root translation multiplier the contacts are mapped through. */
  rootScale: number;

  /** Lowest world Y of the source rest pose; the default ground plane. */
  sourceFloor: number;

  /** Source clinical axes. */
  sourceJointAxes: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Source clinical rest frames. */
  sourceRestFrames: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;

  /** Target clinical axes. */
  targetJointAxes: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;

  /** Target clinical rest frames. */
  targetRestFrames: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;

  /** Caller policy; omitted means humanoid legs and no hand contact. */
  contacts: IAutoMovieRetargetContactProps | undefined;

  /** Sink the residual-slide warnings are reported on. */
  collector: ViolationCollector;
}): IAutoMovieMotion => {
  const contacts = props.contacts ?? {};
  const groundAt = groundFunction(contacts.groundY ?? props.sourceFloor);
  const tolerance = contacts.tolerance ?? DEFAULT_TOLERANCE;

  const sourceTopology = indexSkeletonTopology(props.source);
  const targetTopology = indexSkeletonTopology(props.target);
  const sourceBones = reachableBoneNames(props.source, sourceTopology);
  const targetBones = reachableBoneNames(props.target, targetTopology);

  // Only a chain both rigs actually resolve can carry a contact; a rig missing
  // an arm (or a hand contact declared against bones it does not have) is
  // skipped rather than half-solved.
  const windows: IAutoMovieContactWindow[] = [
    ...HUMANOID_LEG_CHAINS.map((chain) => ({ chain, window: null })),
    ...(contacts.hands ?? []).map((hand) => ({
      chain: {
        effector: hand.hand,
        upper: hand.upper,
        lower: hand.lower,
      },
      window: { start: hand.start, end: hand.end },
    })),
  ].filter(({ chain }) =>
    [sourceBones, targetBones].every((bones) => resolvable(chain, bones)),
  );
  if (windows.length === 0) return props.retargeted;

  const frames = props.retargeted.keyframes;
  const sourceResolved = props.sourceMotion.keyframes.map((kf) =>
    resolveBoneMap(
      props.source,
      kf.pose,
      sourceTopology,
      props.sourceJointAxes,
      props.sourceRestFrames,
    ),
  );

  // Per-frame contact pins, already mapped into target space.
  const pins = frames.map(
    () => new Map<AutoMovieHumanoidBone, IAutoMovieVector3>(),
  );
  const chains = new Map<AutoMovieHumanoidBone, IAutoMoviePlantChain>();
  for (const { chain, window } of windows) {
    chains.set(chain.effector, chain);
    const mask =
      window === null
        ? contactMask({
            effector: chain.effector,
            resolved: sourceResolved,
            groundAt,
            tolerance,
          })
        : frames.map((kf) => kf.time >= window.start && kf.time <= window.end);
    mask.forEach((inContact, index) => {
      if (inContact === false) return;
      pins[index]!.set(
        chain.effector,
        Vector3.scale(
          sourceResolved[index]!.get(chain.effector)!.worldPosition,
          props.rootScale,
        ),
      );
    });
  }

  const worst = new Map<
    AutoMovieHumanoidBone,
    { residual: number; index: number }
  >();
  const keyframes = frames.map((kf, index) =>
    correctFrame({
      keyframe: kf,
      index,
      pins: pins[index]!,
      chains,
      skeleton: props.target,
      topology: targetTopology,
      jointAxes: props.targetJointAxes,
      restFrames: props.targetRestFrames,
      worst,
    }),
  );

  const budget = tolerance * props.rootScale;
  for (const [effector, entry] of worst)
    if (entry.residual > budget)
      props.collector.warn(
        "physics",
        `$input.motion.keyframes[${entry.index}].pose.joints["${effector}"]`,
        `${effector} could not hold its retargeted contact: the target rig's proportions leave it ${round(entry.residual)} from the mapped source contact, beyond the ${round(budget)} contact budget (residual slide is implausible, not impossible, retune the rig proportions or the contact tolerance)`,
        entry.residual,
        entry.residual - budget,
      );

  return { ...props.retargeted, keyframes };
};

/** Every bone of the chain resolves on the rig's FK walk. */
const resolvable = (
  chain: IAutoMoviePlantChain,
  bones: ReadonlySet<AutoMovieHumanoidBone>,
): boolean =>
  [chain.effector, chain.upper, chain.lower].every((bone) => bones.has(bone));

/**
 * Re-solve one keyframe's pinned limbs and record each effector's worst
 * residual. A limb already on its pin, or one whose chain is geometrically
 * degenerate, is left exactly as authored.
 */
const correctFrame = (props: {
  keyframe: IAutoMovieKeyframe;
  index: number;
  pins: ReadonlyMap<AutoMovieHumanoidBone, IAutoMovieVector3>;
  chains: ReadonlyMap<AutoMovieHumanoidBone, IAutoMoviePlantChain>;
  skeleton: IAutoMovieSkeleton;
  topology: ReturnType<typeof indexSkeletonTopology>;
  jointAxes: Partial<Record<AutoMovieHumanoidBone, IAutoMovieJointAxes>>;
  restFrames: Partial<Record<AutoMovieHumanoidBone, IAutoMovieRestFrame>>;
  worst: Map<AutoMovieHumanoidBone, { residual: number; index: number }>;
}): IAutoMovieKeyframe => {
  if (props.pins.size === 0) return props.keyframe;

  const resolve = (pose: IAutoMoviePose): ReturnType<typeof resolveBoneMap> =>
    resolveBoneMap(
      props.skeleton,
      pose,
      props.topology,
      props.jointAxes,
      props.restFrames,
    );

  let pose: IAutoMoviePose = props.keyframe.pose;
  let resolved = resolve(pose);
  for (const [effector, target] of props.pins) {
    const current = resolved.get(effector)!.worldPosition;
    if (drift(current, target) <= NOOP_EPSILON) continue;
    const chain = props.chains.get(effector)!;
    const solve = (
      bendNormal?: IAutoMovieVector3,
    ): ReturnType<typeof solveChainPlant> =>
      solveChainPlant({
        skeleton: props.skeleton,
        pose,
        chain,
        target,
        topology: props.topology,
        jointAxes: props.jointAxes,
        restFrames: props.restFrames,
        bendNormal,
      });

    // Three bend planes are tried, not one: the world-down pole the ground-IK
    // pass uses, and the mid joint's own hinge in both directions. A hinge
    // joint can only articulate in its hinge plane, so the pole solution
    // routinely lowers into abduction/twist the ROM clamp then zeroes, which
    // would leave the limb further from the contact than doing nothing. Each
    // candidate is clamped and re-resolved, and the one that actually lands
    // closest to the contact wins; ties keep the earlier candidate, so the
    // choice is deterministic.
    const pole = solve();
    if (pole === null) continue;
    // Seeded with the uncorrected limb, so a target the rig simply cannot pose
    // keeps its authored angles and reports the residual instead of being
    // pushed somewhere worse. The two hinge branches cannot be `null` once the
    // pole branch is not: the solver rejects only zero-length segments and a
    // target on the chain root, none of which the bend plane touches.
    let best: { pose: IAutoMoviePose; residual: number } = {
      pose,
      residual: drift(current, target),
    };
    for (const solved of [
      pole,
      solve(pole.hinge)!,
      solve(Vector3.scale(pole.hinge, -1))!,
    ]) {
      const candidate: IAutoMoviePose = {
        ...pose,
        joints: [
          ...pose.joints.filter(
            (j) => j.bone !== chain.upper && j.bone !== chain.lower,
          ),
          clampJointToSkeleton(solved.upper, props.skeleton),
          clampJointToSkeleton(solved.lower, props.skeleton),
        ],
      };
      const residual = drift(
        resolve(candidate).get(effector)!.worldPosition,
        target,
      );
      if (residual < best.residual) best = { pose: candidate, residual };
    }
    if (best.pose === pose) continue;
    pose = best.pose;
    resolved = resolve(pose);
  }

  for (const [effector, target] of props.pins) {
    const residual = drift(resolved.get(effector)!.worldPosition, target);
    const prior = props.worst.get(effector);
    if (prior === undefined || residual > prior.residual)
      props.worst.set(effector, { residual, index: props.index });
  }

  return pose === props.keyframe.pose
    ? props.keyframe
    : { ...props.keyframe, pose };
};

/** Distance between a resolved effector and the contact it must hold. */
const drift = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
  Vector3.length(Vector3.subtract(a, b));

/** Six-decimal rounding so a warning message stays readable and stable. */
const round = (value: number): number => Math.round(value * 1e6) / 1e6;

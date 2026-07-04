import {
  IAutoMovieGait,
  IAutoMovieGaitLimb,
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieProfile,
  IAutoMovieTransform,
} from "@automovie/interface";

import { cubicBezierEasing, ease } from "./easing";

const IDENTITY_ROOT: Pick<IAutoMovieTransform, "rotation" | "scale"> = {
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/** Wrap a cycle position into `[0, 1)`. */
const wrap01 = (x: number): number => ((x % 1) + 1) % 1;

const gaitPhaseEase = (
  curve: IAutoMovieGaitLimb["stanceEasing"],
  bezier: IAutoMovieGaitLimb["stanceBezier"],
  t: number,
): number =>
  curve === "cubicBezier" && bezier !== undefined && bezier !== null
    ? cubicBezierEasing(bezier, t)
    : ease(curve ?? "linear", t);

/**
 * One limb's flexion (degrees) at cycle time `t`. Over its **stance** fraction
 * (`duty`) the limb sweeps from `+amplitude` (forward-planted) to `−amplitude`
 * (pushed back), driving the body; over the remaining **swing** fraction it
 * lifts and recovers from `−amplitude` back to `+amplitude`. The `phase` offset
 * slides the whole cycle so limbs fall in sequence, and the swing is centered
 * on the limb's `neutral` (default 0) so a one-way joint like a knee stays on
 * its anatomical side of zero. Optional stance/swing easing curves shape each
 * half separately while preserving the same endpoints.
 *
 * @author Samchon
 */
export const gaitLimbFlexion = (
  limb: IAutoMovieGaitLimb,
  t: number,
  period: number,
): number => {
  const u = wrap01(t / period + limb.phase);
  const a = limb.amplitude;
  const swing =
    u < limb.duty
      ? a *
        (1 -
          2 *
            gaitPhaseEase(limb.stanceEasing, limb.stanceBezier, u / limb.duty))
      : -a +
        2 *
          a *
          gaitPhaseEase(
            limb.swingEasing,
            limb.swingBezier,
            (u - limb.duty) / (1 - limb.duty),
          );
  return (limb.neutral ?? 0) + swing;
};

const gaitRoot = (
  gait: IAutoMovieGait,
  time: number,
): IAutoMovieTransform | null => {
  if (gait.rootBob === undefined) return null;
  const cycle = wrap01(time / gait.period + gait.rootBob.phase);
  return {
    translation: {
      x: 0,
      y:
        gait.rootBob.center +
        gait.rootBob.amplitude * Math.sin(cycle * Math.PI * 2),
      z: 0,
    },
    rotation: IDENTITY_ROOT.rotation,
    scale: IDENTITY_ROOT.scale,
  };
};

const gaitJoints = (
  limbs: readonly IAutoMovieGaitLimb[],
  time: number,
  period: number,
): IAutoMovieJointPose[] => {
  const joints = new Map<IAutoMovieGaitLimb["bone"], IAutoMovieJointPose>();
  for (const limb of limbs) {
    let joint = joints.get(limb.bone);
    if (joint === undefined) {
      joint = {
        bone: limb.bone,
        flexion: null,
        abduction: null,
        twist: null,
      };
      joints.set(limb.bone, joint);
    }
    joint[limb.axis ?? "flexion"] = gaitLimbFlexion(limb, time, period);
  }
  return [...joints.values()];
};

const assertUniqueGaitAxes = (limbs: readonly IAutoMovieGaitLimb[]): void => {
  const seen = new Set<string>();
  for (const limb of limbs) {
    const axis = limb.axis ?? "flexion";
    const key = `${limb.bone}:${axis}`;
    if (seen.has(key))
      throw new Error(`duplicate gait row for ${limb.bone}.${axis}`);
    seen.add(key);
  }
};

const assertUniqueProfileGaitNames = (
  gaits: readonly IAutoMovieGait[],
): void => {
  const seen = new Set<string>();
  for (const gait of gaits) {
    if (seen.has(gait.name))
      throw new Error(`duplicate profile gait name ${gait.name}`);
    seen.add(gait.name);
  }
};

/**
 * Synthesise a **declarative gait** ({@link IAutoMovieGait}) into a looping
 * {@link IAutoMovieMotion} — the engine fattening a creature's characteristic
 * locomotion (per-limb phase / duty / amplitude) into per-frame flexion. The
 * result is an ordinary one-cycle clip (sampled at `samples` even steps, the
 * closing keyframe repeating the first for a seamless loop) that
 * `locomoteMotion` / `travelMotion` can drive across the floor.
 *
 * The same synthesiser produces a human walk, a horse's lateral-sequence walk,
 * a cat's stalk — the difference lives entirely in the gait data, not the
 * code.
 *
 * @author Samchon
 */
export const gaitMotion = (
  id: string,
  skeleton: string,
  gait: IAutoMovieGait,
  samples: number,
): IAutoMovieMotion => {
  if (!Number.isInteger(samples))
    throw new Error("gait samples must be a positive integer");
  if (samples < 1) throw new Error("gait samples must be a positive integer");
  if (!Number.isFinite(gait.period))
    throw new Error("gait period must be finite and positive");
  if (!(gait.period > 0))
    throw new Error("gait period must be finite and positive");
  assertUniqueGaitAxes(gait.limbs);
  const keyframes: IAutoMovieKeyframe[] = [];
  for (let i = 0; i <= samples; ++i) {
    const time = (i / samples) * gait.period;
    keyframes.push({
      time,
      pose: {
        skeleton,
        root: gaitRoot(gait, time),
        joints: gaitJoints(gait.limbs, time, gait.period),
      },
      expression: null,
      easing: "linear",
      bezier: null,
    });
  }
  return { id, skeleton, duration: gait.period, loop: true, keyframes };
};

/**
 * Bind a profile's gait set ({@link IAutoMovieProfile.gaits}) onto a concrete
 * skeleton — synthesising each named gait into a clip for **this** body. The
 * point of a profile binding: the _same_ profile applied to a horse skeleton
 * and a pony skeleton yields each its own gait clips, so one declarative gait
 * set drives many bodies. Returns the clips keyed by gait name (empty when the
 * profile declares no gaits).
 *
 * @author Samchon
 */
export const bindProfileGaits = (
  profile: IAutoMovieProfile,
  skeleton: string,
  samples: number,
): Record<string, IAutoMovieMotion> => {
  const gaits = profile.gaits ?? [];
  assertUniqueProfileGaitNames(gaits);
  const clips: Record<string, IAutoMovieMotion> = {};
  for (const gait of gaits)
    clips[gait.name] = gaitMotion(
      `${profile.id}:${gait.name}`,
      skeleton,
      gait,
      samples,
    );
  return clips;
};

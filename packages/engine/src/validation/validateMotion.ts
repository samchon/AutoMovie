import {
  AutoMovieEasing,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieValidation,
} from "@automovie/interface";

import { validateExpression } from "./validateExpression";
import { validatePose } from "./validatePose";
import { ViolationCollector } from "./violation";

/**
 * Maximum per-axis angular speed (degrees per second) the temporal verifier
 * allows between adjacent keyframes before flagging it. Human limb motion
 * rarely exceeds this; a larger jump usually means a teleport / bad keyframe.
 */
const MAX_ANGULAR_SPEED_DEG_PER_S = 900;

/**
 * Validate an {@link IAutoMovieMotion} clip — Tier-4 temporal coherence plus the
 * per-keyframe Tier-1/Tier-2 checks (every keyframe pose is validated against
 * the skeleton, every keyframe expression range-checked).
 *
 * Temporal invariants enforced here:
 *
 * - Clip `duration` is finite and positive,
 * - Clip `loop` is boolean so sampler wrapping semantics are explicit,
 * - Keyframe `time` is strictly increasing,
 * - Every keyframe `time` is finite and within `[0, duration]`,
 * - Every keyframe easing name is one of the supported interpolation curves,
 * - Cubic-bezier keyframes carry finite control points and other keyframes do not
 *   carry stray control-point data,
 * - Per-axis angular speed between adjacent keyframes stays under a sane bound
 *   (catches teleporting limbs that per-frame validation alone would miss).
 *
 * @author Samchon
 */
export const validateMotion = (props: {
  motion: IAutoMovieMotion;
  skeleton: IAutoMovieSkeleton;
}): IAutoMovieValidation => {
  const path = "$input";
  const collector = new ViolationCollector();
  const { motion, skeleton } = props;

  if (motion.id.trim().length === 0)
    collector.push(
      "type",
      `${path}.id`,
      "motion id must be a non-empty id",
      motion.id,
    );
  if (motion.skeleton !== skeleton.id)
    collector.push(
      "type",
      `${path}.skeleton`,
      `motion skeleton "${motion.skeleton}" does not match target skeleton "${skeleton.id}"`,
      motion.skeleton,
    );
  if (!Number.isFinite(motion.duration) || !(motion.duration > 0))
    collector.push(
      "temporal",
      `${path}.duration`,
      `motion duration must be a finite number > 0 seconds, but was ${motion.duration}`,
      motion.duration,
    );
  if (typeof motion.loop !== "boolean")
    collector.push(
      "type",
      `${path}.loop`,
      `motion loop must be boolean, but was ${String(motion.loop)}`,
      motion.loop,
    );
  if (motion.keyframes.length < 2)
    collector.push(
      "temporal",
      `${path}.keyframes`,
      `motion must have at least two keyframes, but had ${motion.keyframes.length}`,
      motion.keyframes.length,
    );

  let previousTime = -Infinity;
  motion.keyframes.forEach((kf, i) => {
    const kp = `${path}.keyframes[${i}]`;
    const finiteTime = Number.isFinite(kf.time);

    if (!finiteTime || kf.time < 0 || kf.time > motion.duration)
      collector.push(
        "temporal",
        `${kp}.time`,
        `keyframe time must be a finite number within [0, ${motion.duration}]s, but was ${kf.time}`,
        kf.time,
      );
    if (finiteTime && kf.time <= previousTime)
      collector.push(
        "temporal",
        `${kp}.time`,
        `keyframe times must strictly increase; ${kf.time} is not greater than the previous ${previousTime}`,
        kf.time,
      );
    if (!KEYFRAME_EASINGS.has(kf.easing))
      collector.push(
        "type",
        `${kp}.easing`,
        `unknown keyframe easing "${String(kf.easing)}"`,
        kf.easing,
      );
    validateKeyframeBezier(kf, kp, collector);

    validatePose({ pose: kf.pose, skeleton, path: `${kp}.pose`, collector });
    if (kf.expression !== null)
      validateExpression({
        expression: kf.expression,
        path: `${kp}.expression`,
        collector,
      });

    if (i > 0) checkAngularSpeed(motion, i, kp, collector);
    if (finiteTime) previousTime = kf.time;
  });

  return collector.toValidation();
};

/** Flag adjacent keyframes whose shared joints swing too fast. */
const checkAngularSpeed = (
  motion: IAutoMovieMotion,
  i: number,
  kp: string,
  collector: ViolationCollector,
): void => {
  const prev = motion.keyframes[i - 1]!;
  const cur = motion.keyframes[i]!;
  const dt = cur.time - prev.time;
  if (!Number.isFinite(dt) || dt <= 0) return; // ordering/range already reported above

  const prevByBone = new Map(prev.pose.joints.map((j) => [j.bone, j]));
  for (const j of cur.pose.joints) {
    const p = prevByBone.get(j.bone);
    if (p === undefined) continue;
    const axes = ["flexion", "abduction", "twist"] as const;
    for (const axis of axes) {
      const delta = Math.abs((j[axis] ?? 0) - (p[axis] ?? 0));
      const speed = delta / dt;
      if (speed > MAX_ANGULAR_SPEED_DEG_PER_S)
        collector.push(
          "temporal",
          `${kp}.pose`,
          `${j.bone} ${axis} changes ${delta.toFixed(0)}° in ${dt.toFixed(2)}s (${speed.toFixed(0)}°/s), exceeding ${MAX_ANGULAR_SPEED_DEG_PER_S}°/s`,
          speed,
        );
    }
  }
};

/** Enforce the easing/control-point pairing documented on IAutoMovieKeyframe. */
const validateKeyframeBezier = (
  kf: IAutoMovieKeyframe,
  kp: string,
  collector: ViolationCollector,
): void => {
  if (kf.easing !== "cubicBezier") {
    if (kf.bezier !== null)
      collector.push(
        "type",
        `${kp}.bezier`,
        "keyframe bezier controls are only valid for cubicBezier easing",
        kf.bezier,
      );
    return;
  }

  if (!isFiniteBezierTuple(kf.bezier))
    collector.push(
      "type",
      `${kp}.bezier`,
      "cubicBezier keyframes must carry four finite bezier control values",
      kf.bezier,
    );
};

const isFiniteBezierTuple = (
  value: IAutoMovieKeyframe["bezier"] | unknown,
): value is [number, number, number, number] =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every((item) => Number.isFinite(item));

const KEYFRAME_EASINGS = new Set<AutoMovieEasing>([
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "step",
  "cubicBezier",
]);

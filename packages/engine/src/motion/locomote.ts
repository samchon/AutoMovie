import { IAutoMovieMotion, IAutoMovieVector3 } from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { Vector3 } from "../math/Vector3";
import { timeScaleMotion } from "./timeScale";
import { travelMotion } from "./travel";

/**
 * Distance below which a ground-travel displacement is treated as zero.
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Establishes the numeric tolerance used to distinguish grounded travel from no displacement.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Bounds the ground-support classification against floating-point residue.
 */
export const LOCOMOTE_GROUND_EPSILON = 1e-6;

/**
 * Classify one requested root displacement under the ground-gait epsilon.
 *
 * @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance Separates horizontal support travel, vertical-only motion, and an epsilon-sized no-op.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-contact-phase-weight-support Gives locomotion callers an explicit ground-relative movement classification.
 */
export const classifyLocomoteGroundDisplacement = (
  displacement: IAutoMovieVector3,
): {
  groundDistance: number;
  travelDistance: number;
  alreadyThere: boolean;
  verticalOnly: boolean;
} => {
  const groundDistance = Math.hypot(displacement.x, displacement.z);
  const travelDistance = Math.hypot(
    displacement.x,
    displacement.y,
    displacement.z,
  );
  const alreadyThere = travelDistance < LOCOMOTE_GROUND_EPSILON;
  return {
    groundDistance,
    travelDistance,
    alreadyThere,
    verticalOnly:
      alreadyThere === false && groundDistance < LOCOMOTE_GROUND_EPSILON,
  };
};

const assertFiniteVector = (label: string, vector: IAutoMovieVector3): void => {
  if (!Number.isFinite(vector.x)) throw new Error(`${label}.x must be finite`);
  if (!Number.isFinite(vector.y)) throw new Error(`${label}.y must be finite`);
  if (!Number.isFinite(vector.z)) throw new Error(`${label}.z must be finite`);
};

/**
 * Synthesise the **locomote** action: carry a looping gait clip across a
 * `distance` at `speed` in a `direction`. The engine sizes the travel: it picks
 * how many gait cycles cover the distance at the requested speed, then bakes
 * the effective velocity that ARRIVES at exactly `distance` over those whole
 * cycles (`travelMotion`), so the harness `locomote` verb ("walk to the door")
 * reaches the door instead of stopping a half-stride short. At least one cycle
 * always plays; a distance shorter than half a stride compresses that cycle so
 * the effective speed never falls below half the requested speed (#1065): a
 * quick short step instead of unbounded slow motion.
 *
 * `faceTravel` turns the body to face where it is going: the root is oriented
 * so the model's forward (`+Z`) points down the travel direction, so a figure
 * sent sideways walks facing its path instead of strafing. Omit it (the
 * default) to keep the rest facing: a strafe or a backpedal.
 *
 * @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table Repeats the selected gait by whole cycles while preserving its declared phase law.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-kinematics-procedural-gait-rule Turns the selected gait into a finite clip that arrives at the requested destination.
 * @author Samchon
 */
export const locomoteMotion = (
  id: string,
  gait: IAutoMovieMotion,
  distance: number,
  speed: number,
  direction: IAutoMovieVector3,
  faceTravel = false,
): IAutoMovieMotion => {
  if (!Number.isFinite(distance))
    throw new Error("locomote distance must be finite and positive");
  if (distance <= 0)
    throw new Error("locomote distance must be finite and positive");
  if (!Number.isFinite(speed))
    throw new Error("locomote speed must be finite and positive");
  if (speed <= 0) throw new Error("locomote speed must be finite and positive");
  if (!Number.isFinite(gait.duration))
    throw new Error("locomote gait duration must be finite and positive");
  if (gait.duration <= 0)
    throw new Error("locomote gait duration must be finite and positive");
  assertFiniteVector("locomote direction", direction);
  const directionLength = Vector3.length(direction);
  if (!Number.isFinite(directionLength))
    throw new Error("locomote direction length must be finite");
  if (directionLength === 0)
    throw new Error("locomote direction must be non-zero");

  const quantized = distance / (speed * gait.duration);
  const cycles = Math.max(1, Math.round(quantized));
  // Whole-cycle quantization bounds the effective speed at ½×nominal
  // everywhere EXCEPT the min-1-cycle clamp, where a shrinking distance made
  // slow-motion unbounded: a 0.1 m walk over a full 1 s cycle skated at
  // 0.1 m/s with full-rate leg swing (#1065). Hold the same ½ floor there by
  // COMPRESSING the single cycle (a quick, short step): the whole cycle
  // still plays, so loop continuity and exact arrival are untouched.
  const base = quantized < 0.5 ? timeScaleMotion(gait, quantized / 0.5) : gait;
  const heading = Vector3.scale(direction, 1 / directionLength);
  // Whole cycles quantize the clip length; snap the baked velocity so the
  // clip arrives at exactly `distance` (followPathMotion's policy). Baking
  // the requested speed verbatim would travel speed×cycles×duration and miss
  // the destination by up to half a stride.
  const velocity = Vector3.scale(heading, distance / (cycles * base.duration));
  const facing = faceTravel
    ? Quaternion.fromAxisAngle(
        { x: 0, y: 1, z: 0 },
        (Math.atan2(heading.x, heading.z) * 180) / Math.PI,
      )
    : undefined;
  return travelMotion(id, base, cycles, velocity, facing);
};

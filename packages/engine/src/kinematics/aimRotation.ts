import { IAutoMovieQuaternion, IAutoMovieVector3 } from "@automovie/interface";

import { Vector3 } from "../math/Vector3";
import { rotationBetween } from "../math/rotationBetween";

const VECTOR_AXES = ["x", "y", "z"] as const;

/**
 * The shortest-arc rotation that turns the vector `from` onto `to` — the core
 * of an **aim / look-at** driver (a head or eye whose forward axis tracks a
 * target, a camera that follows its subject) and the analytic two-bone lowering
 * (`twoBoneChainArticulation`, hence `reachPose`/`legPlant`). Feed `from` = the
 * bone's rest forward axis and `to` = `target − bonePosition` and the returned
 * quaternion orients the bone at the target.
 *
 * This validates finite inputs, normalizes them, and delegates to the engine's
 * single shortest-arc primitive {@link rotationBetween} — the same
 * **deadzone-free** `atan2` helper the world-driver / iterative IK path uses,
 * so the analytic and iterative IK families cannot disagree (#643, #720). Every
 * angle down to numerical zero produces its exact rotation, so a target a
 * fraction of a degree off-axis is tracked exactly instead of snapped to the
 * identity.
 *
 * Degenerate cases are handled by {@link rotationBetween}: already-aligned
 * returns identity; antiparallel returns a 180° turn about a deterministic
 * perpendicular (the `|a.x| < 0.9` axis split) so it never divides by a zero
 * cross product.
 *
 * @author Samchon
 */
export const aimRotation = (
  from: IAutoMovieVector3,
  to: IAutoMovieVector3,
): IAutoMovieQuaternion => {
  validateVector("from", from);
  validateVector("to", to);
  return rotationBetween(Vector3.normalize(from), Vector3.normalize(to));
};

const validateVector = (
  label: "from" | "to",
  value: IAutoMovieVector3,
): void => {
  for (const axis of VECTOR_AXES)
    if (!Number.isFinite(value[axis]))
      throw new Error(
        `aimRotation ${label}.${axis} must be finite, but was ${value[axis]}`,
      );
};

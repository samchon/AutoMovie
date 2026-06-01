import { MoticaHumanoidBone } from "../skeleton/MoticaHumanoidBone";

/**
 * The articulation of a single joint, expressed as semantic clinical angles.
 *
 * This is the **LLM-facing** rotation primitive — the one thing the model
 * actually emits to move a body. It deliberately mirrors the axis decomposition
 * of {@link "../skeleton/IMoticaJointConstraint"} (flexion / abduction / twist)
 * so a generated angle can be validated against the joint's ROM by a direct,
 * per-axis comparison. The engine composes these three angles, about the bone's
 * local axes and on top of its rest transform, into the quaternion the renderer
 * consumes.
 *
 * Exposing degrees-per-named-axis (instead of a quaternion) is the core reason
 * an LLM can drive a body at all: "bend the left elbow 90°" is `{ bone:
 * "leftLowerArm", flexion: 90 }`, which the model produces reliably and a human
 * can read.
 *
 * Each axis is `number | null`; `null` means "no rotation on this axis"
 * (equivalent to 0, and the only valid value for an axis the joint cannot move
 * — the ROM verifier rejects a non-null angle on a `null` constraint axis).
 *
 * @author Samchon
 */
export interface IMoticaJointPose {
  /** Which bone this articulation applies to. */
  bone: MoticaHumanoidBone;

  /** Sagittal angle: flexion (+) / extension (−). `null` = unchanged. */
  flexion: number | null;

  /** Frontal angle: abduction (+) / adduction (−). `null` = unchanged. */
  abduction: number | null;

  /** Axial angle: external (+) / internal (−) rotation. `null` = unchanged. */
  twist: number | null;
}

import { IMoticaExpression } from "../expression/IMoticaExpression";
import { IMoticaPose } from "../pose/IMoticaPose";
import { MoticaEasing } from "./MoticaEasing";

/**
 * A single keyframe: a pose (and optional expression) pinned at a timestamp,
 * plus the easing into the _next_ keyframe.
 *
 * A keyframe is just a static {@link "../pose/IMoticaPose"} stamped with a
 * `time` and a blend curve — so everything that validates a pose (ROM, joint
 * conflicts) validates a keyframe for free, and the temporal layer only adds
 * ordering and rate checks on top.
 *
 * @author Samchon
 */
export interface IMoticaKeyframe {
  /**
   * Timestamp within the clip, seconds. Must be `<= clip duration`, and
   * keyframes must be strictly increasing in `time` — both enforced by the
   * engine's temporal verifier.
   */
  time: number;

  /** The body pose held at this instant. */
  pose: IMoticaPose;

  /** Optional facial expression at this instant. `null` = leave the face as-is. */
  expression: IMoticaExpression | null;

  /** How to interpolate from this keyframe toward the next. */
  easing: MoticaEasing;

  /**
   * Control points for `easing: "cubicBezier"` as `[x1, y1, x2, y2]` in the
   * unit square (CSS `cubic-bezier` convention). `null` for all other easings.
   */
  bezier: [number, number, number, number] | null;
}

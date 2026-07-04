import { IautomovieExpression } from "../expression/IautomovieExpression";
import { IautomoviePose } from "../pose/IautomoviePose";
import { automovieEasing } from "./AutomovieEasing";

/**
 * A single keyframe: a pose (and optional expression) pinned at a timestamp,
 * plus the easing into the _next_ keyframe.
 *
 * A keyframe is just a static {@link IautomoviePose} stamped with a `time` and a
 * blend curve ??so everything that validates a pose (ROM, joint conflicts)
 * validates a keyframe for free, and the temporal layer only adds ordering and
 * rate checks on top.
 *
 * @author Samchon
 */
export interface IautomovieKeyframe {
  /**
   * Timestamp within the clip, seconds. Must be `<= clip duration`, and
   * keyframes must be strictly increasing in `time` ??both enforced by the
   * engine's temporal verifier.
   */
  time: number;

  /** The body pose held at this instant. */
  pose: IautomoviePose;

  /** Optional facial expression at this instant. `null` = leave the face as-is. */
  expression: IautomovieExpression | null;

  /** How to interpolate from this keyframe toward the next. */
  easing: automovieEasing;

  /**
   * Control points for `easing: "cubicBezier"` as `[x1, y1, x2, y2]` in the
   * unit square (CSS `cubic-bezier` convention). `null` for all other easings.
   */
  bezier: [number, number, number, number] | null;
}

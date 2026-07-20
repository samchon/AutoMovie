import { IAutoMovieExpression } from "../expression/IAutoMovieExpression";
import { IAutoMoviePose } from "../pose/IAutoMoviePose";
import { AutoMovieEasing } from "./AutoMovieEasing";

/**
 * A single keyframe: a pose (and optional expression) pinned at a timestamp,
 * plus the easing into the _next_ keyframe.
 *
 * A keyframe is just a static {@link IAutoMoviePose} stamped with a `time` and a
 * blend curve, so everything that validates a pose (ROM, joint conflicts)
 * validates a keyframe for free, and the temporal layer only adds ordering and
 * rate checks on top.
 *
 * @author Samchon
 */
export interface IAutoMovieKeyframe {
  /**
   * Timestamp within the clip, seconds. Must be `<= clip duration`, and
   * keyframes must be strictly increasing in `time`; both enforced by the
   * engine's temporal verifier.
   */
  time: number;

  /** The body pose held at this instant. */
  pose: IAutoMoviePose;

  /**
   * Facial expression at this instant, or `null` for the neutral (rest) face.
   * `null` is the unauthored/neutral side, blended toward like a resting joint
   * axis: an expression authored only at the far keyframe ramps in from neutral
   * across the segment (it does not pop to full at the segment start), and one
   * authored only at the near keyframe fades back out to neutral.
   */
  expression: IAutoMovieExpression | null;

  /** How to interpolate from this keyframe toward the next. */
  easing: AutoMovieEasing;

  /**
   * Control points for `easing: "cubicBezier"` as `[x1, y1, x2, y2]` in the
   * unit square (CSS `cubic-bezier` convention). `null` for all other easings.
   */
  bezier: [number, number, number, number] | null;
}

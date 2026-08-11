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
 * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Declares one timed pose-expression sample in a motion clip.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types a clip key whose time and value participate in deterministic interpolation.
 * @author Samchon
 */
export interface IAutoMovieKeyframe {
  /**
   * Timestamp within the clip, seconds. Must be `<= clip duration`, and
   * keyframes must be strictly increasing in `time`; both enforced by the
   * engine's temporal verifier.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Declares the ordered clip-local time of this authored sample.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types the key time used by deterministic segment selection.
   */
  time: number;

  /**
   * The body pose held at this instant.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Carries the pose value authored at this exact key time.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types the pose value sampled and interpolated at the key boundary.
   */
  pose: IAutoMoviePose;

  /**
   * Facial expression at this instant, or `null` for the neutral (rest) face.
   * `null` is the unauthored/neutral side, blended toward like a resting joint
   * axis: an expression authored only at the far keyframe ramps in from neutral
   * across the segment (it does not pop to full at the segment start), and one
   * authored only at the near keyframe fades back out to neutral.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-key-times Carries the optional expression value authored at this exact key time.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types the expression value sampled and interpolated at the key boundary.
   */
  expression: IAutoMovieExpression | null;

  /**
   * How to interpolate from this keyframe toward the next.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation Selects the declared interpolation law for the following segment.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types the interpolation mode applied between adjacent key values.
   */
  easing: AutoMovieEasing;

  /**
   * Control points for `easing: "cubicBezier"` as `[x1, y1, x2, y2]` in the
   * unit square (CSS `cubic-bezier` convention). `null` for all other easings.
   *
   * @evidence requirements/motion/clips-keyframes-and-interpolation.md#motion-interpolation Declares the control points needed by the cubic-Bezier interpolation law.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types the bounded curve parameters used for segment interpolation.
   */
  bezier: [number, number, number, number] | null;
}

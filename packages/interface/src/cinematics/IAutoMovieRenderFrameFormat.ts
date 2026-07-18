/**
 * The output clock and pixel geometry shared by a render and every sidecar
 * sampled beside it. Keeping these values in one object lets callers reuse the
 * exact format for beauty/guide frames, captions, and pose keypoints instead of
 * restating three scalars that can silently diverge across tool calls.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderFrameFormat {
  /** Output frame rate; sets the frame count and sample times `t = i / fps`. */
  fps: number;

  /**
   * Output width in pixels. Must be a positive even whole number: `yuv420p`
   * chroma subsampling can only encode even axes, and the pose-keypoint sidecar
   * projects through the resulting `width / height` camera aspect.
   */
  width: number;

  /** Output height in pixels; subject to the same rule as {@link width}. */
  height: number;
}

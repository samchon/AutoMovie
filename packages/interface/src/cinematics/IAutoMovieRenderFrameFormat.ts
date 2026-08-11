/**
 * The output clock and pixel geometry shared by a render and every sidecar
 * sampled beside it. Keeping these values in one object lets callers reuse the
 * exact format for beauty/guide frames, captions, and pose keypoints instead of
 * restating three scalars that can silently diverge across tool calls.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderFrameFormat` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderFrameFormat` for the spec render artifact lifecycle system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderFrameFormat {
  /**
   * Output frame rate; sets the frame count and sample times `t = i / fps`.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `fps` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `fps` for the spec render artifact lifecycle system contract.
   */
  fps: number;

  /**
   * Output width in pixels. Must be a positive even whole number: `yuv420p`
   * chroma subsampling can only encode even axes, and the pose-keypoint sidecar
   * projects through the resulting `width / height` camera aspect.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `width` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `width` for the spec render artifact lifecycle system contract.
   */
  width: number;

  /**
   * Output height in pixels; subject to the same rule as {@link width}.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `height` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `height` for the spec render artifact lifecycle system contract.
   */
  height: number;
}

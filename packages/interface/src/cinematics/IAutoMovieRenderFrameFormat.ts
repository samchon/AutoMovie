/**
 * One portable window inside the uncropped delivery gate.
 *
 * Coordinates are normalized pixel-edge positions with a top-left origin.
 * `left` and `top` are inclusive clipping boundaries, as are exact contacts
 * with `right` and `bottom`; geometry outside those closed boundaries is not
 * delivered. The selected window is projected back onto the complete output
 * raster, so the same crop remains exact across final, proxy, and diagnostic
 * resolutions.
 *
 * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Exposes the output crop independently of the delivery raster so required landmarks are judged in the actual delivered window.
 * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the delivery crop used by clipping evaluation in one resolution-independent coordinate system.
 * @author Samchon
 */
export interface IAutoMovieDeliveryCrop {
  /**
   * Left edge in `[0, 1)`, measured from the uncropped gate's left edge.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Addresses the selected delivery window's left boundary.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the left clipping boundary in the specified crop coordinate system.
   */
  left: number;

  /**
   * Top edge in `[0, 1)`, measured from the uncropped gate's top edge.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Addresses the selected delivery window's top boundary.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the top clipping boundary in the specified crop coordinate system.
   */
  top: number;

  /**
   * Right edge in `(left, 1]`, measured from the uncropped gate's left edge.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Addresses the selected delivery window's right boundary.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the right clipping boundary in the specified crop coordinate system.
   */
  right: number;

  /**
   * Bottom edge in `(top, 1]`, measured from the uncropped gate's top edge.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Addresses the selected delivery window's bottom boundary.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Types the bottom clipping boundary in the specified crop coordinate system.
   */
  bottom: number;
}

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

  /**
   * Optional window of the uncropped gate projected onto this full raster.
   * Omission and `{ left: 0, top: 0, right: 1, bottom: 1 }` are geometric
   * no-ops.
   *
   * @evidence requirements/camera/framing-and-shot-size.md#camera-framing-delivery-gate Keeps the selected output crop beside the raster whose delivered frame it defines.
   * @evidence specifications/camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation Carries the same portable crop into render and sidecar projection.
   */
  crop?: IAutoMovieDeliveryCrop;
}

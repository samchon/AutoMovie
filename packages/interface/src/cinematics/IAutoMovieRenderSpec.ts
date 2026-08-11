import { IAutoMovieRenderFrameFormat } from "./IAutoMovieRenderFrameFormat";

/**
 * Render parameters for turning a shot or sequence into frames and video. Kept
 * separate from the shot so the same shot renders at a draft 12 fps or a final
 * 30/60 fps without editing the content.
 *
 * The pipeline: `N = round(duration × frameFormat.fps)` frames, sampled at `t =
 * i / frameFormat.fps` (rational, not accumulated, for determinism), each
 * rendered headless to an sRGB image, then encoded (`ffmpeg -framerate fps -r
 * fps -c:v libx264 -pix_fmt yuv420p`). `toneMapping` is `none` for the
 * stylized/toon path and `acesFilmic` for the photoreal path; `pixelFormat` is
 * pinned for player compatibility and reproducibility.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `IAutoMovieRenderSpec` as the portable data boundary for the rendering compile render distinction requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `IAutoMovieRenderSpec` for the spec render artifact lifecycle system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderSpec {
  /**
   * Id of the shot or sequence to render.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `target` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `target` for the spec render artifact lifecycle system contract.
   */
  target: string;

  /**
   * Shared output clock and pixel geometry. Pass this same object to caption
   * and pose-keypoint planning so every companion is sampled against the render
   * it describes.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `frameFormat` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `frameFormat` for the spec render artifact lifecycle system contract.
   */
  frameFormat: IAutoMovieRenderFrameFormat;

  /**
   * Tone mapping applied before sRGB encode. `none` for toon, `acesFilmic` for
   * photoreal.
   *
   * This is the DELIVERY default, and a scene overrides it. `IAutoMovieScene`'s
   * optional `environment` owns the photographic response of the scene it
   * belongs to (its image lighting, its exposure, its curve), and one render
   * spec covers a whole sequence of scenes, so a spec-level curve forced onto
   * every shot would flatten a night interior and a noon exterior into one
   * response. A scene that declares no environment keeps this value, which is
   * exactly what every pre-environment production is: unchanged.
   *
   * Structural passes (depth, normal, mask, outline) ignore both. Their pixels
   * are geometric facts, so tone mapping and exposure are bypassed there rather
   * than negotiated.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `toneMapping` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `toneMapping` for the spec render artifact lifecycle system contract.
   */
  toneMapping: "none" | "acesFilmic";

  /**
   * Video codec.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `codec` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `codec` for the spec render artifact lifecycle system contract.
   */
  codec: "h264";

  /**
   * Pixel format; `yuv420p` for broad player compatibility and deterministic
   * output.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `pixelFormat` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `pixelFormat` for the spec render artifact lifecycle system contract.
   */
  pixelFormat: "yuv420p";

  /**
   * Quality factor (libx264 CRF; ~17 visually lossless, 0 lossless).
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Exposes `crf` as the portable data boundary for the rendering compile render distinction requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle Types `crf` for the spec render artifact lifecycle system contract.
   */
  crf: number;
}

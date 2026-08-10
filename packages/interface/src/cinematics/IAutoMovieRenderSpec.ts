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
 * @author Samchon
 */
export interface IAutoMovieRenderSpec {
  /** Id of the shot or sequence to render. */
  target: string;

  /**
   * Shared output clock and pixel geometry. Pass this same object to caption
   * and pose-keypoint planning so every companion is sampled against the render
   * it describes.
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
   */
  toneMapping: "none" | "acesFilmic";

  /** Video codec. */
  codec: "h264";

  /**
   * Pixel format; `yuv420p` for broad player compatibility and deterministic
   * output.
   */
  pixelFormat: "yuv420p";

  /** Quality factor (libx264 CRF; ~17 visually lossless, 0 lossless). */
  crf: number;
}

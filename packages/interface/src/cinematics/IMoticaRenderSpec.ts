/**
 * Render parameters for turning a shot or sequence into frames and video. Kept
 * separate from the shot so the same shot renders at a draft 12 fps or a final
 * 30/60 fps without editing the content.
 *
 * The pipeline: `N = round(duration × fps)` frames, sampled at `t = i / fps`
 * (rational, not accumulated, for determinism), each rendered headless to an
 * sRGB image, then encoded (`ffmpeg -framerate fps -r fps -c:v libx264 -pix_fmt
 * yuv420p`). `toneMapping` is `none` for the stylized/toon path and
 * `acesFilmic` for the photoreal path; `pixelFormat` is pinned for player
 * compatibility and reproducibility.
 *
 * @author Samchon
 */
export interface IMoticaRenderSpec {
  /** Id of the shot or sequence to render. */
  target: string;

  /** Output frame rate; sets the frame count and the sample times `t = i/fps`. */
  fps: number;

  /** Output width in pixels. */
  width: number;

  /** Output height in pixels. */
  height: number;

  /**
   * Tone mapping applied before sRGB encode. `none` for toon, `acesFilmic` for
   * photoreal.
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

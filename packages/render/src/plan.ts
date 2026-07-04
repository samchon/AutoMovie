import { IAutoMovieRenderSpec } from "@automovie/interface";

/**
 * The deterministic frame schedule for a clip of `durationSeconds` at `fps`: `N
 * = round(duration × fps)` frames sampled at `t = i / fps`.
 *
 * The times are computed as exact rationals (`i / fps`), never accumulated, so
 * the same spec yields the same sample instants on every machine — the property
 * that makes a automovie render reproducible (the whole point versus a
 * stochastic diffusion video). A non-finite or non-positive fps/duration yields
 * no frames.
 *
 * @author Samchon
 */
export const frameTimes = (fps: number, durationSeconds: number): number[] => {
  if (
    !Number.isFinite(fps) ||
    !Number.isFinite(durationSeconds) ||
    fps <= 0 ||
    durationSeconds <= 0
  )
    return [];
  const count = Math.round(durationSeconds * fps);
  return Array.from({ length: count }, (_, i) => i / fps);
};

/** Zero-padded frame filename, e.g. `frame_00042.png`, for an ffmpeg sequence. */
export const frameName = (index: number, ext = "png", pad = 5): string =>
  `frame_${String(index).padStart(pad, "0")}.${ext}`;

/** The glob-free ffmpeg `-i` pattern matching {@link frameName} (`%0{pad}d`). */
export const framePattern = (ext = "png", pad = 5): string =>
  `frame_%0${pad}d.${ext}`;

/**
 * The ffmpeg argument vector that encodes a {@link frameName} sequence into the
 * spec's video. Pinned for reproducible, broadly-playable output: H.264
 * (`libx264`) at the spec's `pixelFormat` and `crf`, with the input/output
 * frame rate fixed to `fps` and `+faststart` for progressive playback. Tone
 * mapping is applied upstream in the renderer (per
 * {@link IAutoMovieRenderSpec}), not here.
 *
 * @author Samchon
 */
export const ffmpegArgs = (
  spec: IAutoMovieRenderSpec,
  inputPattern: string,
  outputPath: string,
): string[] => [
  "-y",
  "-framerate",
  `${spec.fps}`,
  "-i",
  inputPattern,
  "-c:v",
  "libx264",
  "-pix_fmt",
  spec.pixelFormat,
  "-crf",
  `${spec.crf}`,
  "-r",
  `${spec.fps}`,
  "-movflags",
  "+faststart",
  outputPath,
];

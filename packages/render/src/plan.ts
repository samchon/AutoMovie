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
 * Windows reserved device names — reserved with ANY extension (`con.mp4` is
 * `con`), case-insensitive. A stem whose first dot-segment is one of these
 * would name a device, not a file.
 */
const WINDOWS_RESERVED_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

/**
 * A file-safe stem for default frame directories and output video names —
 * always exactly ONE safe path component. The character filter alone is not
 * enough: `.` and `..` are made of legal characters but mean self/parent
 * directory positionally, so `renders/${stem}` would escape the reserved
 * `renders/` dir (`renders/..` is the project root). This also neutralizes a
 * Windows reserved device name and a trailing dot or space, both of which
 * change the name Windows actually writes.
 */
export const renderPathStem = (target: string): string => {
  const cleaned = target
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    // Windows silently strips a trailing dot or space; strip it ourselves so the
    // name we compute is the name that lands on disk (this also collapses a bare
    // `.`/`..` to empty).
    .replace(/[ .]+$/, "");
  if (cleaned.length === 0) return "render";
  const base = cleaned.split(".")[0]!.toLowerCase();
  return WINDOWS_RESERVED_NAMES.has(base) ? `_${cleaned}` : cleaned;
};

/**
 * The ffmpeg argument vector that encodes a {@link frameName} sequence into the
 * spec's video. Pinned for reproducible, broadly-playable output: H.264
 * (`libx264`) at the spec's `pixelFormat` and `crf`, with the input/output
 * frame rate fixed to `fps` and `+faststart` for progressive playback. Tone
 * mapping is applied upstream in the renderer (per
 * {@link IAutoMovieRenderSpec}), not here.
 *
 * The output size is pinned to the spec with `-s {width}x{height}` (#1251): a
 * validated `width`/`height` that never reached the encoder made the rendered
 * aspect the host viewport's, silently disagreeing with the pose-keypoint
 * sidecar's `width/height` aspect (#1231). The dimensions must be even (the
 * spec is validated so before it reaches here), which `yuv420p` chroma
 * subsampling requires; pinning them here means the encoded frame size is the
 * requested one on every host regardless of the capture viewport.
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
  `${spec.frameFormat.fps}`,
  "-i",
  inputPattern,
  "-c:v",
  "libx264",
  "-pix_fmt",
  spec.pixelFormat,
  "-crf",
  `${spec.crf}`,
  "-r",
  `${spec.frameFormat.fps}`,
  "-s",
  `${spec.frameFormat.width}x${spec.frameFormat.height}`,
  "-movflags",
  "+faststart",
  outputPath,
];

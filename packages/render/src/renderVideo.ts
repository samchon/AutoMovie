import { IAutoMovieRenderSpec } from "@automovie/interface";

import { ffmpegArgs, frameName, framePattern, frameTimes } from "./plan";

/**
 * The host-supplied I/O a render needs. Kept as injected dependencies so the
 * orchestration ({@link renderVideo}) stays a pure, deterministic, testable
 * function while the environment-specific halves (a headless browser screenshot
 * and an ffmpeg spawn) live in the caller (the engine is renderer-agnostic;
 * this keeps the render pipeline the same way).
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderAdapters` keeps captured frame inputs and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderAdapters` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderAdapters {
  /**
   * Render the scene at clip-local `timeSeconds` and write frame `index` into
   * `dir` under its {@link frameName}. Returns the written path.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderAdapters.captureFrame` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderAdapters.captureFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  captureFrame: (
    timeSeconds: number,
    index: number,
    dir: string,
  ) => Promise<string>;

  /**
   * Run ffmpeg with `args` (from {@link ffmpegArgs}); resolve with `outputPath`.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderAdapters.encode` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderAdapters.encode` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  encode: (args: string[], outputPath: string) => Promise<string>;
}

/**
 * One captured frame artifact.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieCapturedFrame` keeps captured frame inputs and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieCapturedFrame` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieCapturedFrame {
  /**
   * Zero-based frame index.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieCapturedFrame.index` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieCapturedFrame.index` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  index: number;

  /**
   * Clip-local sample time in seconds.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieCapturedFrame.timeSeconds` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieCapturedFrame.timeSeconds` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  timeSeconds: number;

  /**
   * Host path returned by `captureFrame`.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieCapturedFrame.path` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieCapturedFrame.path` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  path: string;
}

/**
 * The outcome of a render: encoded video plus frame metadata an agent can
 * inspect without inferring paths from the ffmpeg pattern.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderResult` keeps captured frame inputs and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderResult` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderResult {
  /**
   * Path to the encoded video (the adapter's `encode` output).
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderResult.output` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderResult.output` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  output: string;

  /**
   * Number of frames captured and encoded.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderResult.frameCount` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderResult.frameCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameCount: number;

  /**
   * The clip-local sample instants, one per frame (`t = i / fps`).
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderResult.times` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderResult.times` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  times: number[];

  /**
   * Captured frame artifacts in encode order.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderResult.frames` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderResult.frames` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frames: IAutoMovieCapturedFrame[];

  /**
   * Directory passed to each `captureFrame` call.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderResult.frameDir` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderResult.frameDir` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameDir: string;

  /**
   * Ffmpeg input pattern used to encode the frame sequence.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderResult.inputPattern` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderResult.inputPattern` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  inputPattern: string;

  /**
   * Exact ffmpeg argument vector handed to the encode adapter.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieRenderResult.ffmpegArgs` keeps captured frame inputs and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieRenderResult.ffmpegArgs` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  ffmpegArgs: string[];
}

/**
 * Render a clip of `durationSeconds` into a video, deterministically: compute
 * the frame schedule, capture each frame through the host adapter at its exact
 * `t = i / fps`, then encode the sequence with the pinned ffmpeg args.
 *
 * This is the spine of automovie's "frames → video" path and its
 * reproducibility guarantee: pure control flow over injected I/O, so the same
 * spec drives the same frames in the same order every time.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `renderVideo` keeps captured frame inputs and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `renderVideo` exposes that responsibility through the package-independent system contract.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-boundary-convention Captures the start-inclusive frame grid and rejects a duration that produces no frame.
 * @evidence requirements/rendering/frame-schedules-and-sampling.md#rendering-frame-number-time Calls the capture adapter once at each deterministic `i / fps` sample.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-frame-schedule Executes the planned frame order without a hidden wall clock.
 * @evidenceExclude requirements/rendering/README.md#rendering-요구사항 Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-codec-container-facts Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-atomic-output Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-refusal Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-retry Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-stream-selection Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/encoding-and-multiplexing.md#rendering-encode-timestamps Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-audio-cues Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-schedule-refusal Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-shutter-samples Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-state-sampling Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/frame-schedules-and-sampling.md#rendering-subrange-stability Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-compile-render-distinction Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-deterministic-lane Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-missing-artifact-refusal Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-partial-artifact Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude requirements/rendering/scope-and-artifact-identity.md#rendering-product-scope Render execution captures and encodes the supplied plan; compilation, artifact lifecycle, and unrelated schedule policy remain upstream.
 * @evidenceExclude specifications/editorial-render-and-delivery/README.md#editorial-render와-delivery-system-specifications Render execution closes capture and encode inputs; artifact lifecycle and headless recovery remain separate systems.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-validation Render execution closes capture and encode inputs; artifact lifecycle and headless recovery remain separate systems.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-headless-platform Render execution closes capture and encode inputs; artifact lifecycle and headless recovery remain separate systems.
 * @evidenceExclude specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Render execution closes capture and encode inputs; artifact lifecycle and headless recovery remain separate systems.
 * @author Samchon
 */
export const renderVideo = async (
  spec: IAutoMovieRenderSpec,
  durationSeconds: number,
  dir: string,
  outputPath: string,
  adapters: IAutoMovieRenderAdapters,
): Promise<IAutoMovieRenderResult> => {
  const times = frameTimes(spec.frameFormat.fps, durationSeconds);
  if (times.length === 0)
    throw new Error(
      `renderVideo requires at least one frame; fps ${spec.frameFormat.fps} and duration ${durationSeconds} produced zero frames`,
    );

  const frames: string[] = [];
  for (let i = 0; i < times.length; ++i)
    frames.push(await adapters.captureFrame(times[i]!, i, dir));
  const inputPattern = `${dir}/${framePattern()}`;
  const args = ffmpegArgs(spec, inputPattern, outputPath);
  const output = await adapters.encode(args, outputPath);
  return {
    output,
    frameCount: frames.length,
    times,
    frames: frames.map((path, index) => ({
      index,
      timeSeconds: times[index]!,
      path,
    })),
    frameDir: dir,
    inputPattern,
    ffmpegArgs: args,
  };
};

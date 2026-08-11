import {
  IAutoMovieRenderSpec,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";

import {
  IAutoMovieSequenceRenderFrame,
  IAutoMovieSequenceRenderPlan,
  planSequenceRender,
} from "./sequenceRenderPlan";

/**
 * Host I/O for sequence rendering. The capture adapter receives the resolved
 * sequence frame sample, including the live shot local time and optional
 * outgoing blend tail; drawing pixels remains the host's job.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAdapters` keeps captured sequence frames and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAdapters` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderAdapters {
  /**
   * Capture one resolved sequence frame and return the written frame path.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAdapters.captureFrame` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAdapters.captureFrame` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  captureFrame: (
    frame: IAutoMovieSequenceRenderFrame,
    plan: IAutoMovieSequenceRenderPlan,
  ) => Promise<string>;

  /**
   * Encode the captured frame sequence and return the encoded output path.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAdapters.encode` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAdapters.encode` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  encode: (args: string[], outputPath: string) => Promise<string>;
}

/**
 * The outcome of rendering a sequence through injected host I/O.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult` keeps captured sequence frames and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderResult {
  /**
   * Path to the encoded video.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult.output` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult.output` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  output: string;

  /**
   * Number of captured frames.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult.frameCount` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult.frameCount` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameCount: number;

  /**
   * Global output sample times.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult.times` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult.times` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  times: number[];

  /**
   * Captured frame samples in encode order.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult.frames` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult.frames` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frames: IAutoMovieSequenceRenderFrame[];

  /**
   * Directory passed through the manifest for frame files.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult.frameDir` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult.frameDir` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameDir: string;

  /**
   * Ffmpeg input pattern for the captured frame sequence.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult.inputPattern` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult.inputPattern` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  inputPattern: string;

  /**
   * Exact ffmpeg argument vector handed to the encode adapter.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult.ffmpegArgs` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult.ffmpegArgs` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  ffmpegArgs: string[];

  /**
   * The deterministic sequence manifest that drove capture.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderResult.plan` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderResult.plan` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  plan: IAutoMovieSequenceRenderPlan;
}

/**
 * Host-supplied request for building a sequence manifest and rendering it.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeRequest` keeps captured sequence frames and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeRequest` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderAndSeeRequest {
  /**
   * Sequence being rendered.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeRequest.sequence` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeRequest.sequence` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  sequence: IAutoMovieSequence;

  /**
   * Committed shots referenced by the sequence.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeRequest.shots` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeRequest.shots` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  shots: IAutoMovieShot[];

  /**
   * Render parameters whose target must equal `sequence.id`.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeRequest.spec` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeRequest.spec` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  spec: IAutoMovieRenderSpec;

  /**
   * Directory where captured frames are written.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeRequest.frameDir` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeRequest.frameDir` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameDir: string;

  /**
   * Requested encoded video path.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeRequest.outputPath` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeRequest.outputPath` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  outputPath: string;

  /**
   * Capture and encode adapters owned by the host.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeRequest.adapters` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeRequest.adapters` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  adapters: IAutoMovieSequenceRenderAdapters;
}

/**
 * JSON-friendly sequence render artifact.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeResult` keeps captured sequence frames and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeResult` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieSequenceRenderAndSeeResult extends IAutoMovieSequenceRenderResult {
  /**
   * Render spec snapshot used for the sequence render.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeResult.spec` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeResult.spec` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  spec: IAutoMovieRenderSpec;

  /**
   * Sequence identity and authored fps snapshot.
   *
   * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `IAutoMovieSequenceRenderAndSeeResult.sequence` keeps captured sequence frames and encode invocation explicit.
   * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `IAutoMovieSequenceRenderAndSeeResult.sequence` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  sequence: { id: string; fps: number };
}

/**
 * Render a prepared sequence manifest: capture each resolved frame sample in
 * order, then encode the planned frame sequence with the planned ffmpeg args.
 * This is the sequence-level analogue of `renderVideo`, but the capture host
 * gets sequence semantics rather than only a clip-local second.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `renderSequenceVideo` keeps captured sequence frames and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `renderSequenceVideo` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const renderSequenceVideo = async (
  plan: IAutoMovieSequenceRenderPlan,
  adapters: IAutoMovieSequenceRenderAdapters,
): Promise<IAutoMovieSequenceRenderResult> => {
  const frames: IAutoMovieSequenceRenderFrame[] = [];
  for (const frame of plan.frames)
    frames.push({
      ...frame,
      path: await adapters.captureFrame(frame, plan),
    });
  const output = await adapters.encode(plan.ffmpegArgs, plan.outputPath);
  return {
    output,
    frameCount: frames.length,
    times: plan.times,
    frames,
    frameDir: plan.frameDir,
    inputPattern: plan.inputPattern,
    ffmpegArgs: plan.ffmpegArgs,
    plan,
  };
};

/**
 * Build a sequence render manifest, execute it through host adapters, and
 * return an artifact an agent can inspect without recomputing the cut.
 *
 * @evidence requirements/rendering/encoding-and-multiplexing.md#rendering-encode-input-closure `renderSequenceAndSee` keeps captured sequence frames and encode invocation explicit.
 * @evidence specifications/editorial-render-and-delivery/render-encoding-and-validation.md#spec-render-encode-probe `renderSequenceAndSee` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export const renderSequenceAndSee = async (
  request: IAutoMovieSequenceRenderAndSeeRequest,
): Promise<IAutoMovieSequenceRenderAndSeeResult> => {
  const plan = planSequenceRender({
    sequence: request.sequence,
    shots: request.shots,
    spec: request.spec,
    frameDir: request.frameDir,
    outputPath: request.outputPath,
  });
  return {
    spec: { ...request.spec },
    sequence: { id: request.sequence.id, fps: request.sequence.fps },
    ...(await renderSequenceVideo(plan, request.adapters)),
  };
};

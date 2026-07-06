import { IAutoMovieRenderSpec } from "@automovie/interface";

import {
  IAutoMovieRenderAdapters,
  IAutoMovieRenderResult,
  renderVideo,
} from "./renderVideo";

/**
 * Host-supplied request for rendering a clip and returning inspectable
 * artifacts.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderAndSeeRequest {
  /** Render spec for the target shot or sequence. */
  spec: IAutoMovieRenderSpec;

  /** Target duration in seconds. */
  durationSeconds: number;

  /** Directory where captured frames are written. */
  frameDir: string;

  /** Requested encoded video path. */
  outputPath: string;

  /** Capture and encode adapters owned by the host. */
  adapters: IAutoMovieRenderAdapters;
}

/**
 * JSON-friendly render artifact returned to an agent or host.
 *
 * @author Samchon
 */
export interface IAutoMovieRenderAndSeeResult extends IAutoMovieRenderResult {
  /** Render spec snapshot used for the capture. */
  spec: IAutoMovieRenderSpec;

  /** Target duration in seconds. */
  durationSeconds: number;
}

/**
 * Render a clip and return the encoded output plus explicit frame artifacts.
 * The function still performs only deterministic orchestration over injected
 * host I/O; its value is the metadata contract that lets an agent inspect what
 * was captured without guessing paths or sample times.
 *
 * @author Samchon
 */
export const renderAndSee = async (
  request: IAutoMovieRenderAndSeeRequest,
): Promise<IAutoMovieRenderAndSeeResult> => ({
  spec: { ...request.spec },
  durationSeconds: request.durationSeconds,
  ...(await renderVideo(
    request.spec,
    request.durationSeconds,
    request.frameDir,
    request.outputPath,
    request.adapters,
  )),
});

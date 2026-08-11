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
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeRequest` keeps requested, planned, and materialized render facts explicit.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeRequest` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderAndSeeRequest {
  /**
   * Render spec for the target shot or sequence.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeRequest.spec` keeps requested, planned, and materialized render facts explicit.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeRequest.spec` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  spec: IAutoMovieRenderSpec;

  /**
   * Target duration in seconds.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeRequest.durationSeconds` keeps requested, planned, and materialized render facts explicit.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeRequest.durationSeconds` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  durationSeconds: number;

  /**
   * Directory where captured frames are written.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeRequest.frameDir` keeps requested, planned, and materialized render facts explicit.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeRequest.frameDir` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  frameDir: string;

  /**
   * Requested encoded video path.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeRequest.outputPath` keeps requested, planned, and materialized render facts explicit.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeRequest.outputPath` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  outputPath: string;

  /**
   * Capture and encode adapters owned by the host.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeRequest.adapters` keeps requested, planned, and materialized render facts explicit.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeRequest.adapters` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  adapters: IAutoMovieRenderAdapters;
}

/**
 * JSON-friendly render artifact returned to an agent or host.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeResult` keeps requested, planned, and materialized render facts explicit.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeResult` exposes that responsibility through the package-independent system contract.
 * @author Samchon
 */
export interface IAutoMovieRenderAndSeeResult extends IAutoMovieRenderResult {
  /**
   * Render spec snapshot used for the capture.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeResult.spec` keeps requested, planned, and materialized render facts explicit.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeResult.spec` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  spec: IAutoMovieRenderSpec;

  /**
   * Target duration in seconds.
   *
   * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `IAutoMovieRenderAndSeeResult.durationSeconds` keeps requested, planned, and materialized render facts explicit.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `IAutoMovieRenderAndSeeResult.durationSeconds` exposes that responsibility through the package-independent system contract.
   * @author Samchon
   */
  durationSeconds: number;
}

/**
 * Render a clip and return the encoded output plus explicit frame artifacts.
 * The function still performs only deterministic orchestration over injected
 * host I/O; its value is the metadata contract that lets an agent inspect what
 * was captured without guessing paths or sample times.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-planned-materialized `renderAndSee` keeps requested, planned, and materialized render facts explicit.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-artifact-lifecycle `renderAndSee` exposes that responsibility through the package-independent system contract.
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

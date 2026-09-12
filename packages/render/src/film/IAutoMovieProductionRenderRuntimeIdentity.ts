import type {
  AutoMovieContentDigest,
  IAutoMovieCaptureRuntimeIdentity,
} from "@automovie/interface";

import type { IAutoMovieProductionEncoderIdentity } from "./IAutoMovieProductionEncoderIdentity";

/**
 * Capture and encoder identity for one homogeneous render job.
 */
export interface IAutoMovieProductionRenderRuntimeIdentity {
  /**
   * Render-runtime identity schema.
   */
  protocolVersion: "automovie.production-render-runtime.v3";
  /**
   * Digest of declared viewer, capture, asset, and package input bytes.
   */
  sourceDigest: AutoMovieContentDigest;
  /**
   * Final-byte dialogue and viseme runtime installed for every capture, or null
   * when the planned production is deliberately silent.
   *
   */
  dialogueRuntimeIdentity: AutoMovieContentDigest | null;
  /**
   * Package-owned browser and graphics identity.
   */
  capture: IAutoMovieCaptureRuntimeIdentity;
  /**
   * Package-owned encoder binary and argument identity.
   */
  encoder: IAutoMovieProductionEncoderIdentity;
}

import type { AutoMovieContentDigest } from "@automovie/interface";

/**
 * Package-owned encoder identity fenced into every chunk.
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-encoding-tool-identity Records the encoder identity beside every encoded deliverable so output from a different tool is re-verified instead of trusted by command text.
 */
export interface IAutoMovieProductionEncoderIdentity {
  /**
   * Exact installed package name.
   */
  package: string;
  /**
   * Exact installed package version.
   */
  version: string;
  /**
   * Canonical digest of the complete installed executable closure.
   */
  closureDigest: AutoMovieContentDigest;
  /**
   * Closed codec family emitted by the foundation adapter.
   */
  codec: "h264";
  /**
   * Every encoder argument that can affect output bytes.
   */
  arguments: {
    /** Constant-rate-factor analogue accepted by the package encoder. */
    quantizationParameter: number;
    /** Package encoder speed setting. */
    speed: number;
    /** Key-frame period in frames. */
    groupOfPictures: number;
  };
}

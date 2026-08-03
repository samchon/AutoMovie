import { AutoMovieGuidePass } from "../cinematics";
import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";
import {
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieRenderBundleManifest,
} from "./IAutoMovieProductionOracle";
import {
  IAutoMovieRepaintParameters,
  IAutoMovieRepaintRuntimeIdentity,
} from "./application/IAutoMovieRepaintShot";

/** Host input for one structure-preserving shot repaint. */
export interface IAutoMovieProductionRepaintInput {
  /** Active project root. */
  projectRoot: string;
  /** Active production namespace. */
  productionId: string;
  /** Current compiler-owned registry fingerprint. */
  compileFingerprint: AutoMovieContentDigest;
  /** Exact compiled shot id. */
  shot: string;
  /** Verified deterministic source identity and bytes. */
  source: {
    /** Project-relative content-addressed source bundle. */
    bundle: string;
    /** Verified source bundle manifest. */
    manifest: IAutoMovieRenderBundleManifest;
    /** Digest over the verified manifest and frame bytes. */
    fingerprint: AutoMovieContentDigest;
    /** Current decoded source frames. */
    frames: Array<{
      /** Frame index. */
      index: number;
      /** Frame time. */
      time: number;
      /** Beauty or structural pass. */
      pass: AutoMovieGuidePass;
      /** Exact PNG digest. */
      digest: AutoMovieContentDigest;
      /** Raw verified PNG bytes. */
      bytes: Uint8Array;
    }>;
    /** Capture runtime that produced the deterministic controls. */
    captureRuntime: IAutoMovieCaptureRuntimeIdentity;
  };
  /** Verified fixed reference bytes. */
  references: Array<{
    /** Style or character role. */
    role: "style" | "character";
    /** Project-relative asset-manifest path. */
    path: string;
    /** Current digest. */
    digest: AutoMovieContentDigest;
    /** Current bytes. */
    bytes: Uint8Array;
  }>;
  /** Exact generation controls. */
  parameters: IAutoMovieRepaintParameters;
}

/** Host-owned optional diffusion adapter. */
export type AutoMovieProductionShotRepaint = (
  input: IAutoMovieProductionRepaintInput,
) => Promise<{
  /** Actual encoded rendition bytes. */
  bytes: Uint8Array;
  /** Required video media type. */
  mediaType: "video/mp4";
  /** Structured provider/model identity. */
  runtimeIdentity: IAutoMovieRepaintRuntimeIdentity;
}>;

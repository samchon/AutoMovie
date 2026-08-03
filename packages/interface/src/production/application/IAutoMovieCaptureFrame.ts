import { AutoMovieGuidePass } from "../../cinematics";
import {
  IAutoMovieDiagnostic,
  IAutoMovieReviewTarget,
} from "../IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "../IAutoMovieProductionDesign";

/** One compiler-registry target accepted by the evidence capture tool. */
export type AutoMovieCaptureTarget =
  | {
      /** Current compiled shot frame. */
      kind: "shot";
      /** Exact production namespace owning the compiled shot. */
      productionId: string;
      /** Registry-owned shot id. */
      id: string;
      /** Finite non-negative shot-local time in seconds. */
      time: number;
      /** Requested beauty or structural render pass. */
      pass?: AutoMovieGuidePass;
    }
  | {
      /** Current compiled asset turntable frame. */
      kind: "asset";
      /** Optional production namespace; required when the host has no default. */
      productionId?: string;
      /** Registry-owned asset id. */
      id: string;
      /** Finite turntable azimuth in degrees. */
      angleDeg: number;
      /** Finite camera elevation in degrees, zero by default. */
      elevationDeg?: number;
      /** Rest or extreme-range rig pose, rest by default. */
      pose?: "rest" | "rom-extremes";
      /** Requested beauty or structural render pass. */
      pass?: AutoMovieGuidePass;
    };

/** Persisted provenance returned for one verified capture. */
export interface IAutoMovieCaptureReceipt {
  /** Receipt format. */
  version: 1;
  /** Production namespace used to resolve the registry target. */
  productionId: string;
  /** Exact evidence target. */
  target: AutoMovieCaptureTarget;
  /** Current compiler-owned target registry fingerprint. */
  compileFingerprint: AutoMovieContentDigest;
  /** Target-local render fingerprint from the verified bundle manifest. */
  targetFingerprint: AutoMovieContentDigest;
  /** Canonical structured capture-runtime identity. */
  rendererIdentity: string;
  /** Content-addressed project-relative render bundle. */
  bundle: string;
  /** Verified PNG digest. */
  outputDigest: AutoMovieContentDigest;
}

/** Result of producing one actual current evidence frame. */
export interface IAutoMovieCaptureFrame {
  /** True only after decoded pixels and their receipt are atomically committed. */
  captured: boolean;
  /** Production namespace used for the attempt. */
  productionId: string;
  /** Review surface whose current evidence changed, when captured. */
  reviewTarget: IAutoMovieReviewTarget | null;
  /** Verified receipt, or null on refusal. */
  receipt: IAutoMovieCaptureReceipt | null;
  /** Verified current PNG, or null on refusal. */
  frame: {
    /** Snapped frame index. */
    index: number;
    /** Snapped time in seconds. */
    time: number;
    /** Captured pass. */
    pass: AutoMovieGuidePass;
    /** Project-relative PNG path. */
    path: string;
    /** Exact PNG digest. */
    digest: AutoMovieContentDigest;
    /** Decoded pixel width. */
    width: number;
    /** Decoded pixel height. */
    height: number;
  } | null;
  /** Exact refusal diagnostics, empty on success. */
  diagnostics: IAutoMovieDiagnostic[];
}

export namespace IAutoMovieCaptureFrame {
  /** One actual evidence-frame request. */
  export interface IProps {
    /** Compiler-registry target and its frame identity. */
    target: AutoMovieCaptureTarget;
    /** Optional positive integer width no larger than production width. */
    width?: number;
    /** Optional positive integer height no larger than production height. */
    height?: number;
  }
}

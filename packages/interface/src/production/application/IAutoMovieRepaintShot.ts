import { AutoMovieGuidePass } from "../../cinematics";
import {
  IAutoMovieDiagnostic,
  IAutoMovieProductionMediaProbe,
} from "../IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "../IAutoMovieProductionDesign";

/** One fixed style or character reference consumed by repaint. */
export interface IAutoMovieRepaintReferenceInput {
  /** How the adapter must use this reference. */
  role: "style" | "character";
  /** Exact project-relative asset-manifest path. */
  path: string;
}

/** Stable, serializable diffusion controls stored in the receipt. */
export interface IAutoMovieRepaintParameters {
  /** Non-blank positive prompt. */
  prompt: string;
  /** Optional negative prompt. */
  negativePrompt?: string;
  /** Explicit deterministic request seed. */
  seed: number;
  /** Finite structural-preservation strength in [0, 1]. */
  strength: number;
  /** Additional adapter-defined scalar controls. */
  controls?: Record<string, string | number | boolean>;
}

/** Structured identity of the host repaint implementation. */
export interface IAutoMovieRepaintRuntimeIdentity {
  /** Identity protocol. */
  protocolVersion: "automovie.repaint-runtime.v1";
  /** Adapter/provider family. */
  provider: string;
  /** Exact model id. */
  model: string;
  /** Exact model or deployment version. */
  version: string;
  /** Local, API, or another explicit execution boundary. */
  execution: "local" | "api" | "other";
}

/** Immutable provenance for one accepted repaint rendition. */
export interface IAutoMovieRepaintReceipt {
  /** Receipt format. */
  version: 1;
  /** Owning production namespace. */
  productionId: string;
  /** Exact compiled shot id. */
  shot: string;
  /** Current compiler registry fingerprint. */
  compileFingerprint: AutoMovieContentDigest;
  /** Digest over deterministic source manifest and frame bytes. */
  sourceRenderFingerprint: AutoMovieContentDigest;
  /** Current completed deterministic shot-review fingerprint. */
  sourceReviewFingerprint: AutoMovieContentDigest;
  /** Content-addressed deterministic source bundle. */
  sourceBundle: string;
  /** Structural passes supplied to the adapter. */
  controls: Array<{
    /** Structural pass name. */
    pass: Exclude<AutoMovieGuidePass, "beauty">;
    /** Ordered source-frame digests for this pass. */
    frameDigests: AutoMovieContentDigest[];
  }>;
  /** Fixed reference identities supplied to the adapter. */
  references: Array<{
    /** Style or character role. */
    role: "style" | "character";
    /** Project-relative manifest path. */
    path: string;
    /** Current byte digest. */
    digest: AutoMovieContentDigest;
  }>;
  /** Canonical structured adapter/model identity. */
  adapterIdentity: string;
  /** Exact generation parameters. */
  parameters: IAutoMovieRepaintParameters;
  /** Verified rendition output. */
  output: {
    /** Render-root-relative content-addressed path. */
    path: string;
    /** Exact output bytes digest. */
    digest: AutoMovieContentDigest;
    /** Exact output byte length. */
    bytes: number;
    /** Parsed media facts. */
    probe: IAutoMovieProductionMediaProbe;
  };
}

/** Result of one optional diffusion rendition request. */
export interface IAutoMovieRepaintShot {
  /** True only after media parsing and atomic receipt commit. */
  repainted: boolean;
  /** Current production namespace. */
  productionId: string;
  /** Compiled shot id. */
  shot: string;
  /** Accepted receipt, or null on refusal. */
  receipt: IAutoMovieRepaintReceipt | null;
  /** Provisioning or evidence diagnostics, empty on success. */
  diagnostics: IAutoMovieDiagnostic[];
}

export namespace IAutoMovieRepaintShot {
  /** One structure-preserving shot rendition request. */
  export interface IProps {
    /** Exact production namespace owning the shot. */
    productionId: string;
    /** Exact current compiler-registry shot id. */
    shot: string;
    /** Fixed style and character references from the asset manifest. */
    references: IAutoMovieRepaintReferenceInput[];
    /** Exact adapter controls stored in the rendition receipt. */
    parameters: IAutoMovieRepaintParameters;
  }
}

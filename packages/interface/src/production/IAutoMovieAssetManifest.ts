import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";

/** License identity shipped with one distributable project asset. */
export interface IAutoMovieAssetLicense {
  /** Non-blank SPDX expression or stable license identifier. */
  identifier: string;
  /** Source page containing the applicable license terms. */
  url: string;
  /** Required attribution or distribution notice, when applicable. */
  notice?: string;
}

/** One reproducible transformation applied after acquiring original bytes. */
export interface IAutoMovieAssetProcessingStep {
  /** Executable or tool identity, including a version when it affects output. */
  tool: string;
  /** Exact command or operation name. */
  command: string;
  /** Stable serializable parameters needed to reproduce the transformation. */
  parameters: Record<string, string | number | boolean | null>;
}

/** One downstream purpose that makes an asset part of the production. */
export interface IAutoMovieAssetUse {
  /** Consumer family. */
  kind: "audio" | "model" | "texture" | "font" | "other";
  /** Stable shot, timeline cue, recipe, surface, or deliverable identity. */
  target: string;
  /** Why this production needs the asset. */
  reason: string;
}

/** Explicit ingest and proxy choices for an external 3D model. */
export interface IAutoMovieExternalModelProvenance {
  /** Stable ingest normalization profile applied to the source model. */
  ingestProfile: string;
  /** Explicit LOD members rather than an inferred filename convention. */
  lod: Array<{
    /** Stable level identity such as hero, near, or far. */
    level: string;
    /** Manifest-owned asset path providing this level. */
    asset: string;
  }>;
  /** Chosen collision-proxy asset or deterministic generation recipe id. */
  collisionProxy: string;
  /** Chosen measurement-proxy asset or deterministic generation recipe id. */
  measurementProxy: string;
}

/** Byte-exact provenance record for one project-owned distributable asset. */
export interface IAutoMovieAssetProvenance {
  /** Canonical project-relative current asset path. */
  path: string;
  /** SHA-256 of the current bytes at {@link path}. */
  digest: AutoMovieContentDigest;
  /** Acquisition identity before any local processing. */
  original: {
    /** Current source URL verified when the asset was acquired. */
    url: string;
    /** SHA-256 of the acquired original bytes. */
    digest: AutoMovieContentDigest;
  };
  /** Distribution terms that apply to the current bytes. */
  license: IAutoMovieAssetLicense;
  /** Ordered transformation chain; empty only when current equals original. */
  processing: IAutoMovieAssetProcessingStep[];
  /** Non-empty production usage ledger. */
  uses: IAutoMovieAssetUse[];
  /**
   * Required ingest/LOD/proxy ledger for external glTF, GLB, or VRM assets.
   *
   * Non-model assets omit it.
   */
  model?: IAutoMovieExternalModelProvenance;
}

/** Project-global asset provenance and license ledger. */
export interface IAutoMovieAssetManifest {
  /** Asset-manifest format. */
  version: 1;
  /** Every distributable project asset, ordered by canonical path. */
  assets: IAutoMovieAssetProvenance[];
}

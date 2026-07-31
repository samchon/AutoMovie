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

/** One typed consumer that can own an asset use in a production graph. */
export type IAutoMovieAssetConsumer =
  | {
      /** Film audio cue whose `asset` field names this path. */
      kind: "audio-cue";
      /** Exact audio cue id. */
      id: string;
    }
  | {
      /** Model recipe whose registered appearance consumes this model asset. */
      kind: "model-recipe";
      /** Exact model recipe id. */
      id: string;
    }
  | {
      /** Fixed style or character reference consumed by one repaint shot. */
      kind: "rendition-reference";
      /** Exact shot id. */
      id: string;
    };

/** One downstream purpose that makes an asset part of one production. */
export interface IAutoMovieAssetUse {
  /** Exact production id; project-global assets repeat uses when shared. */
  production: string;
  /** Typed, addressable consumer inside that production. */
  consumer: IAutoMovieAssetConsumer;
  /** Why this production needs the asset. */
  reason: string;
}

/** A deterministic proxy reference with no inferred fallback. */
export type IAutoMovieModelProxyReference =
  | {
      /** Manifest-owned proxy bytes. */
      kind: "asset";
      /** Exact path of another asset entry in this manifest. */
      asset: string;
    }
  | {
      /** Compiler-owned deterministic proxy recipe. */
      kind: "generated";
      /** Closed supported recipe identity. */
      recipe: "capsule-v1" | "box-v1" | "humanoid-landmarks-v1";
      /** Explicit finite inputs to the selected recipe. */
      parameters: Record<string, number>;
    };

/** Explicit ingest and proxy choices for an external 3D model. */
export interface IAutoMovieExternalModelProvenance {
  /** Stable ingest normalization profile applied to the source model. */
  ingestProfile: string;
  /** Explicit LOD members rather than an inferred filename convention. */
  lod: Array<{
    /** Closed near-to-far level identity. */
    level: "hero" | "near" | "far";
    /** Manifest-owned asset path providing this level. */
    asset: string;
  }>;
  /** Chosen collision proxy; absence never falls back to mesh inference. */
  collisionProxy: IAutoMovieModelProxyReference;
  /** Chosen measurement proxy; absence never falls back to mesh inference. */
  measurementProxy: IAutoMovieModelProxyReference;
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

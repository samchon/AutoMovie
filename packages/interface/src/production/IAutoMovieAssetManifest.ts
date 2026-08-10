import { IAutoMovieGeneratedAcquisition } from "../architecture/IAutoMovieDesignReference";
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
      /** Sidecar or LOD bytes owned by one external-model asset. */
      kind: "model-resource";
      /** Exact path of the owning hero model asset. */
      id: string;
    }
  | {
      /** Byte-authored deterministic proxy owned by one external model. */
      kind: "model-proxy";
      /** Exact path of the owning hero model asset. */
      id: string;
    }
  | {
      /** Fixed style or character reference consumed by one repaint shot. */
      kind: "rendition-reference";
      /** Exact shot id. */
      id: string;
    }
  | {
      /**
       * Image bound by one compiled material's PBR texture slots.
       *
       * The consumer is the MODEL, not the material or the slot: one image
       * routinely serves several slots of several materials of one model (an
       * ORM map is occlusion, roughness and metalness at once), and a ledger
       * keyed per slot would demand one entry per use of the same bytes for the
       * same reason.
       */
      kind: "material-texture";
      /** Exact compiled model id whose materials bind this image. */
      id: string;
    }
  | {
      /** Equirectangular image lighting the scene of one compiled shot. */
      kind: "scene-environment";
      /** Exact shot id whose scene environment names this image. */
      id: string;
    }
  | {
      /**
       * Observed plan, section, elevation, detail, or generated design study.
       *
       * The consumer is the observation DOCUMENT, not the building it informs:
       * one sheet is routinely read by several buildings, and the reading — not
       * the building — is what the bytes justify. Registering the use never
       * converts the image into design; it only authorizes an observation
       * document to cite these exact bytes as evidence.
       */
      kind: "design-reference";
      /** Exact design-reference document id observing these bytes. */
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

/** Closed compiler-owned collision proxy parameters. */
export type IAutoMovieGeneratedCollisionProxy =
  | {
      /** Capsule used by deterministic collision and mass queries. */
      recipe: "capsule-v1";
      /** Positive radius and cylindrical-body height in production meters. */
      parameters: { radius: number; height: number };
    }
  | {
      /** Axis-aligned box used by deterministic collision and mass queries. */
      recipe: "box-v1";
      /** Positive full extents in production meters. */
      parameters: { width: number; height: number; depth: number };
    };

/** Closed compiler-owned measurement proxy parameters. */
export type IAutoMovieGeneratedMeasurementProxy =
  | {
      /** Axis-aligned box used by distance and projected-size queries. */
      recipe: "box-v1";
      /** Positive full extents in production meters. */
      parameters: { width: number; height: number; depth: number };
    }
  | {
      /** Humanoid landmark envelope used by reach and stature queries. */
      recipe: "humanoid-landmarks-v1";
      /** Positive stature, shoulder width and hip width in production meters. */
      parameters: {
        height: number;
        shoulderWidth: number;
        hipWidth: number;
      };
    };

/** A deterministic collision proxy reference with no inferred fallback. */
export type IAutoMovieCollisionProxyReference =
  | {
      /** Manifest-owned proxy bytes. */
      kind: "asset";
      /** Exact path of a typed JSON proxy asset in this manifest. */
      asset: string;
    }
  | ({
      /** Compiler-owned deterministic proxy recipe. */
      kind: "generated";
    } & IAutoMovieGeneratedCollisionProxy);

/** A deterministic measurement proxy reference with no inferred fallback. */
export type IAutoMovieMeasurementProxyReference =
  | {
      /** Manifest-owned proxy bytes. */
      kind: "asset";
      /** Exact path of a typed JSON proxy asset in this manifest. */
      asset: string;
    }
  | ({
      /** Compiler-owned deterministic proxy recipe. */
      kind: "generated";
    } & IAutoMovieGeneratedMeasurementProxy);

/** Manifest-owned deterministic proxy data. */
export interface IAutoMovieModelProxyAsset {
  /** Proxy asset schema. */
  version: 1;
  /** Optional collision shape when cited as a collision proxy. */
  collision?: IAutoMovieGeneratedCollisionProxy;
  /** Optional measurement envelope when cited as a measurement proxy. */
  measurement?: IAutoMovieGeneratedMeasurementProxy;
}

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
  collisionProxy: IAutoMovieCollisionProxyReference;
  /** Chosen measurement proxy; absence never falls back to mesh inference. */
  measurementProxy: IAutoMovieMeasurementProxyReference;
}

/** Byte-exact provenance record for one project-owned distributable asset. */
export interface IAutoMovieAssetProvenance {
  /** Canonical project-relative current asset path. */
  path: string;
  /** SHA-256 of the current bytes at {@link path}. */
  digest: AutoMovieContentDigest;
  /**
   * Acquisition identity before any local processing, for bytes some source
   * served.
   *
   * Exactly one of {@link original} and {@link generated} is present. Every
   * manifest written before generated assets existed carries this one, so
   * making it optional reads those ledgers unchanged.
   */
  original?: {
    /** Current source URL verified when the asset was acquired. */
    url: string;
    /** SHA-256 of the acquired original bytes. */
    digest: AutoMovieContentDigest;
  };
  /**
   * Generation identity, for bytes nothing ever served.
   *
   * An image-generation result has no acquisition URL. Recording the provider,
   * model, request, instruction and returned digest states what actually
   * happened; inventing a URL or a replay seed to satisfy {@link original} would
   * not.
   */
  generated?: IAutoMovieGeneratedAcquisition;
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

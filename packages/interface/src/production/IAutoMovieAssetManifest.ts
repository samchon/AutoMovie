import { IAutoMovieGeneratedAcquisition } from "../architecture/IAutoMovieDesignReference";
import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";
import type { IAutoMovieSkeleton } from "../skeleton/IAutoMovieSkeleton";
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
    }
  | {
      /**
       * Explicit external-motion adoption that consumes this source asset.
       *
       * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption Registers motion bytes only after the production names their downstream adoption.
       * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Makes the selected adoption, rather than a provider convention, the consumer identity.
       */
      kind: "motion-adoption";
      /**
       * Exact adoption id declared by the production.
       *
       * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Joins asset provenance to the user's explicit adoption choice.
       * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Identifies the decision record that consumes these bytes.
       */
      id: string;
    };

/**
 * One inspected animation take addressable inside an external motion asset.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes exact takes so the user or authoring agent can choose one without filename inference.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Carries inspected media facts without selecting a take.
 */
export interface IAutoMovieExternalMotionTake {
  /**
   * Stable take id within this asset record.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Makes each inspected source member independently selectable.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Preserves source-order member identity without selecting it.
   */
  id: string;
  /**
   * Zero-based glTF animation index.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Addresses the exact source animation rather than guessing by name.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Reports the inspected container member address.
   */
  animationIndex: number;
  /**
   * Source-authored animation name, or null when unnamed.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Retains source metadata without requiring it for identity.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Distinguishes an unnamed member from an invented label.
   */
  sourceName: string | null;
  /**
   * Inspected finite duration in seconds.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes the take's source time extent before adoption.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Records inspected timing without conforming it.
   */
  durationSeconds: number;
}

/**
 * Byte-grounded motion facts recorded for an external animation asset.
 *
 * This is an inventory, not a take or retarget decision. Those choices remain
 * in {@link IAutoMovieExternalMotionAdoption}.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption Makes external motion bytes declarable and digest-bound.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Records the deterministic ingest identity and inspected take set.
 */
export interface IAutoMovieExternalMotionProvenance {
  /**
   * Versioned ingest normalization profile selected for these bytes.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Declares how the motion container was inspected.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Binds inspected facts to one deterministic conversion profile.
   */
  ingestProfile: "gltf-motion-v1";
  /**
   * Inspected animation takes in source index order.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption Makes all eligible source members visible before user selection.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Retains the canonical inspected result set.
   */
  takes: IAutoMovieExternalMotionTake[];
}

/**
 * User-owned decision to adopt one external motion take in one shot.
 *
 * The engine validates and applies this record. It does not select the asset,
 * take, target actor, adoption mode, or retarget mapping.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes native use and retargeting explicit user choices.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Carries the selected source member, target, and composition mode.
 */
export interface IAutoMovieExternalMotionAdoption {
  /**
   * Stable adoption identity.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Gives the adoption a production-owned receipt identity.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Identifies this exact source-to-target decision.
   */
  id: string;
  /**
   * Manifest-owned external motion asset path.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption Joins the decision to digest-bound source bytes.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Names the adopted source identity.
   */
  asset: string;
  /**
   * Take id from the asset's inspected motion record.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes source-member selection explicit.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Selects one inspected member without provider inference.
   */
  take: string;
  /**
   * Shot contract in which the adoption is available.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Bounds use to one authored shot decision.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Identifies the composition scope.
   */
  shot: string;
  /**
   * Actor participant that performs the adopted take.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Leaves target selection to the production.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Identifies the selected target participant.
   */
  actor: string;
  /**
   * Stable clip id exposed to the shot source after successful adoption.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Gives downstream composition a stable adopted-result identity.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-identity-source-selection Preserves motion identity at the source boundary.
   */
  clip: string;
  /**
   * Inspected source hierarchy and rest transforms used for channel mapping.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Provides the source rig basis needed to interpret imported node tracks.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Carries source rest hierarchy for native compatibility and retarget characterization.
   */
  sourceRig: IAutoMovieSkeleton;
  /**
   * Explicit source-node to target-semantic-bone mappings.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Makes imported channel interpretation explicit in both adoption modes.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Carries the characterized node-to-semantic mapping.
   */
  mapping: Array<{
    /**
     * Source rig bone name.
     *
     * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Identifies the exact source channel owner.
     * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Names the characterized source joint.
     */
    source: string;
    /**
     * Target humanoid bone.
     *
     * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Records the explicit semantic mapping target.
     * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Names the semantic destination joint.
     */
    target: AutoMovieHumanoidBone;
  }>;
  /**
   * Explicit native or humanoid-retarget adoption decision.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Prevents the engine from choosing retargeting on the user's behalf.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Records the selected adoption mode and its parameters.
   */
  mode:
    | {
        /**
         * Use source channels without skeletal retargeting.
         *
         * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Represents the user's native-use choice.
         * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-adoption-decision-identity Keeps native adoption distinct from retargeting.
         */
        kind: "native";
      }
    | {
        /**
         * Apply an explicit humanoid mapping.
         *
         * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Represents the user's retarget choice.
         * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Selects characterized retargeting rather than native playback.
         */
        kind: "humanoid-retarget";
        /**
         * Explicit finite positive translation scale.
         *
         * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Makes spatial conversion an authored decision.
         * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Carries the retarget scale characterization.
         */
        translationScale: number;
      };
}

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
  /**
   * Inspected motion facts when these bytes are adopted as animation input.
   * Omitted for non-motion assets; presence never selects a take.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-inputs-adoption Brings motion bytes into the manifest's digest and provenance boundary.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Records the deterministic ingest identity without making an adoption decision.
   */
  motion?: IAutoMovieExternalMotionProvenance;
}

/** Project-global asset provenance and license ledger. */
export interface IAutoMovieAssetManifest {
  /** Asset-manifest format. */
  version: 1;
  /** Every distributable project asset, ordered by canonical path. */
  assets: IAutoMovieAssetProvenance[];
}

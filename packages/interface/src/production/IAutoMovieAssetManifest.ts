import { IAutoMovieGeneratedAcquisition } from "../architecture/IAutoMovieDesignReference";
import type { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";
import type { IAutoMovieSkeleton } from "../skeleton/IAutoMovieSkeleton";
import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";

/**
 * License identity shipped with one distributable project asset.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-replacement Exposes `IAutoMovieAssetLicense` as the portable data boundary for the asset external replacement requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-identity-failure-compatibility Types `IAutoMovieAssetLicense` for the asset spec identity failure compatibility system contract.
 */
export interface IAutoMovieAssetLicense {
  /**
   * Non-blank SPDX expression or stable license identifier.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-replacement Exposes `identifier` as the portable data boundary for the asset external replacement requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-identity-failure-compatibility Types `identifier` for the asset spec identity failure compatibility system contract.
   */
  identifier: string;
  /**
   * Source page containing the applicable license terms.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-replacement Exposes `url` as the portable data boundary for the asset external replacement requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-identity-failure-compatibility Types `url` for the asset spec identity failure compatibility system contract.
   */
  url: string;
  /**
   * Required attribution or distribution notice, when applicable.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-replacement Exposes `notice` as the portable data boundary for the asset external replacement requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-identity-failure-compatibility Types `notice` for the asset spec identity failure compatibility system contract.
   */
  notice?: string;
}

/**
 * One reproducible transformation applied after acquiring original bytes.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `IAutoMovieAssetProcessingStep` as the portable data boundary for the asset semantic enrichment requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `IAutoMovieAssetProcessingStep` for the asset spec element consumer links system contract.
 */
export interface IAutoMovieAssetProcessingStep {
  /**
   * Executable or tool identity, including a version when it affects output.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `tool` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `tool` for the asset spec element consumer links system contract.
   */
  tool: string;
  /**
   * Exact command or operation name.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `command` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `command` for the asset spec element consumer links system contract.
   */
  command: string;
  /**
   * Stable serializable parameters needed to reproduce the transformation.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `parameters` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `parameters` for the asset spec element consumer links system contract.
   */
  parameters: Record<string, string | number | boolean | null>;
}

/**
 * Sidecar bytes owned by one manifest-declared external motion asset.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Keeps every dependency byte in the external motion source closure.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the sidecar-to-source ownership needed by the non-destructive adoption receipt.
 * @author Samchon
 */
export interface IAutoMovieMotionResourceConsumer {
  /**
   * External motion sidecar consumer discriminator.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Distinguishes dependency closure from the adoption that later consumes it.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Identifies this use as source-resource ownership in the adoption receipt.
   */
  kind: "motion-resource";
  /**
   * Exact manifest path of the owning external motion asset.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Binds the sidecar to the preserved source asset identity.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Joins this dependency byte to the source digest closure.
   */
  id: string;
}

/**
 * Explicit production adoption that consumes one external motion source.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Keeps source selection and adoption mode under production authority.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the source-to-adoption consumer edge recorded by the receipt.
 * @author Samchon
 */
export interface IAutoMovieMotionAdoptionConsumer {
  /**
   * External motion adoption consumer discriminator.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Distinguishes a chosen adoption from passive source-resource ownership.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Identifies this use as a production adoption decision.
   */
  kind: "motion-adoption";
  /**
   * Exact production-declared adoption identity.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Binds source use to the user's explicit adoption decision.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Joins the source bytes to the selected adoption receipt.
   */
  id: string;
}

/**
 * One typed consumer that can own an asset use in a production graph.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `IAutoMovieAssetConsumer` as the portable data boundary for the asset semantic enrichment requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `IAutoMovieAssetConsumer` for the asset spec element consumer links system contract.
 */
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
      /** Fixed non-collapsible role-specific reference for one repaint shot. */
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
  | IAutoMovieMotionResourceConsumer
  | IAutoMovieMotionAdoptionConsumer;

/**
 * One inspected animation take addressable inside an external motion asset.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes exact takes so the user or authoring agent can choose one without filename inference.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Carries inspected media facts without selecting a take.
 *
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `IAutoMovieExternalMotionTake` for the performance motion external adoption receipt system contract.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionTake {
  /**
   * Stable take id within this asset record.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Makes each inspected source member independently selectable.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Preserves source-order member identity without selecting it.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `id` for the performance motion external adoption receipt system contract.
   */
  id: string;
  /**
   * Zero-based glTF animation index.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Addresses the exact source animation rather than guessing by name.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Reports the inspected container member address.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `animationIndex` for the performance motion external adoption receipt system contract.
   */
  animationIndex: number;
  /**
   * Source-authored animation name, or null when unnamed.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Retains source metadata without requiring it for identity.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Distinguishes an unnamed member from an invented label.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `sourceName` for the performance motion external adoption receipt system contract.
   */
  sourceName: string | null;
  /**
   * Inspected finite duration in seconds.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes the take's source time extent before adoption.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-motion-inspection Records inspected timing without conforming it.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `durationSeconds` for the performance motion external adoption receipt system contract.
   */
  durationSeconds: number;
}

/**
 * One node basis inspected directly from external motion source bytes.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Requires source hierarchy and rest transforms before an adoption decision.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the byte-grounded node facts retained by the external motion receipt.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionBasisNode {
  /**
   * Zero-based node index in the inspected glTF scene.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Addresses the exact source node without display-name inference.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Preserves the source container address in the receipt basis.
   */
  nodeIndex: number;
  /**
   * Stable normalized node identity used by motion channels and parent links.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Gives each source skeleton member a stable identity.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Carries the normalized source node identity into mapping and compatibility checks.
   */
  id: string;
  /**
   * Source-authored node name, or null when the node is unnamed.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes source metadata without treating name similarity as mapping authority.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Retains the observed label separately from stable node identity.
   */
  sourceName: string | null;
  /**
   * Parent normalized node identity, or null for a source root.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Records the inspected source skeleton hierarchy.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Binds each source node to its byte-grounded parent relation.
   */
  parent: string | null;
  /**
   * Normalized parent-local rest transform inspected from the source node.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Records the rest basis used to interpret source animation channels.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Carries the normalized local rest transform into compatibility and retarget receipts.
   */
  localRest: IAutoMovieTransform;
}

/**
 * Canonical byte-grounded coordinate and hierarchy basis for external motion.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Requires units, axes, handedness, hierarchy, and rest basis to be inspected before selection.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the normalized source basis sealed into the adoption receipt.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionBasis {
  /**
   * Versioned canonical basis profile.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Makes basis interpretation explicit and versioned.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Identifies the deterministic normalization protocol used by the receipt.
   */
  profile: "gltf-motion-basis-v1";
  /**
   * Canonical length unit of normalized translations.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Declares the source motion unit instead of inferring scale downstream.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Seals meter normalization into the source basis.
   */
  lengthUnit: "meter";
  /**
   * Canonical coordinate handedness.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Declares coordinate handedness before mapping or retargeting.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Seals right-handed interpretation into the source basis.
   */
  handedness: "right-handed";
  /**
   * Canonical vertical axis.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Declares the source up axis before channel interpretation.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Seals Y-up normalization into the source basis.
   */
  upAxis: "Y-up";
  /**
   * Inspected nodes in stable source index order.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes the complete source hierarchy and local rest basis.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Carries byte-grounded nodes into compatibility, mapping, and result receipts.
   */
  nodes: IAutoMovieExternalMotionBasisNode[];
}

/**
 * Byte-grounded motion facts recorded for an external animation asset.
 *
 * This is an inventory, not a take or retarget decision. Those choices remain
 * in {@link IAutoMovieExternalMotionAdoption}.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes external motion bytes declarable and digest-bound.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Records the deterministic ingest identity and inspected take set.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `IAutoMovieExternalMotionProvenance` as the portable data boundary for the motion external adoption receipt requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `IAutoMovieExternalMotionProvenance` for the performance motion external adoption receipt system contract.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionProvenance {
  /**
   * Versioned ingest normalization profile selected for these bytes.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Declares how the motion container was inspected.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Binds inspected facts to one deterministic conversion profile.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `ingestProfile` as the portable data boundary for the motion external adoption receipt requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `ingestProfile` for the performance motion external adoption receipt system contract.
   */
  ingestProfile: "gltf-motion-v1";
  /**
   * Canonical hierarchy and rest basis inspected from the resident source
   * bytes.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Grounds channel interpretation in observed node hierarchy, units, axes, and rest transforms.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Retains the normalized byte basis beside source takes and digests.
   */
  basis: IAutoMovieExternalMotionBasis;
  /**
   * Inspected animation takes in source index order.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes all eligible source members visible before user selection.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Retains the canonical inspected result set.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `takes` as the portable data boundary for the motion external adoption receipt requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `takes` for the performance motion external adoption receipt system contract.
   */
  takes: IAutoMovieExternalMotionTake[];
}

/**
 * Explicit source-node to target-semantic-bone mapping entry.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Makes automatic or authored mapping inspectable and overridable.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the mapping decision retained by external motion adoption receipts.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionMappingEntry {
  /**
   * Stable source node identity from the inspected byte basis.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Identifies the exact source node participating in the reviewed mapping.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Joins one byte-grounded source node to the retained mapping decision.
   */
  source: string;
  /**
   * Target normalized humanoid bone.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Exposes the selected target control for user review or override.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Records the semantic target selected for the source node.
   */
  target: AutoMovieHumanoidBone;
}

/**
 * Native external motion use without skeletal retargeting.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes native channel use an explicit production decision.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the native mode retained by the external motion receipt.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionNativeMode {
  /**
   * Native adoption discriminator.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Prevents silent substitution of retargeting for native use.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Records native channel preservation as the selected mode.
   */
  kind: "native";
}

/**
 * Explicit humanoid retargeting of external motion.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes retargeting and its scale an explicit production decision.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the retarget mode retained by the external motion receipt.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionHumanoidRetargetMode {
  /**
   * Humanoid-retarget adoption discriminator.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Prevents silent substitution of native use for retargeting.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Records humanoid retargeting as the selected mode.
   */
  kind: "humanoid-retarget";
  /**
   * Explicit finite positive root-translation scale.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Makes automatic scale correction reviewable and overridable.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Retains the selected translation conversion in the receipt.
   */
  translationScale: number;
}

/**
 * Closed authored choice between native use and humanoid retargeting.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Requires the user-selected adoption mode to remain explicit.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the mode union serialized by the adoption decision.
 * @author Samchon
 */
export type IAutoMovieExternalMotionAdoptionMode =
  | IAutoMovieExternalMotionNativeMode
  | IAutoMovieExternalMotionHumanoidRetargetMode;

/**
 * User-owned decision to adopt one external motion take in one shot.
 *
 * The engine validates and applies this record. It does not select the asset,
 * take, target actor, adoption mode, or retarget mapping.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes native use and retargeting explicit user choices.
 * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Carries the selected source member, target, and composition mode.
 *
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `IAutoMovieExternalMotionAdoption` for the performance motion external adoption receipt system contract.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionAdoption {
  /**
   * Stable adoption identity.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Gives the adoption a production-owned receipt identity.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Identifies this exact source-to-target decision.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Exposes `id` as the portable data boundary for the motion external adoption mode requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `id` for the performance motion external adoption receipt system contract.
   */
  id: string;
  /**
   * Manifest-owned external motion asset path.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Joins the decision to digest-bound source bytes.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Names the adopted source identity.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `asset` for the performance motion external adoption receipt system contract.
   */
  asset: string;
  /**
   * Take id from the asset's inspected motion record.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes source-member selection explicit.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Selects one inspected member without provider inference.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `take` for the performance motion external adoption receipt system contract.
   */
  take: string;
  /**
   * Shot contract in which the adoption is available.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Bounds use to one authored shot decision.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Identifies the composition scope.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `shot` for the performance motion external adoption receipt system contract.
   */
  shot: string;
  /**
   * Actor participant that performs the adopted take.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Leaves target selection to the production.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Identifies the selected target participant.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `actor` for the performance motion external adoption receipt system contract.
   */
  actor: string;
  /**
   * Stable clip id exposed to the shot source after successful adoption.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Gives downstream composition a stable adopted-result identity.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Preserves motion identity at the source boundary.
   */
  clip: string;
  /**
   * Authored semantic source rig reconciled with the byte-inspected basis.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Provides the source rig basis needed to interpret imported node tracks.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Carries source rest hierarchy for native compatibility and retarget characterization.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Exposes `sourceRig` as the portable data boundary for the motion external adoption mode requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `sourceRig` for the performance motion external adoption receipt system contract.
   */
  sourceRig: IAutoMovieSkeleton;
  /**
   * Explicit source-node to target-semantic-bone mappings.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Makes imported channel interpretation explicit in both adoption modes.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-external-adoption-retarget-characterization Carries the characterized node-to-semantic mapping.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Exposes `mapping` as the portable data boundary for the motion external adoption mode requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `mapping` for the performance motion external adoption receipt system contract.
   */
  mapping: IAutoMovieExternalMotionMappingEntry[];
  /**
   * Explicit native or humanoid-retarget adoption decision.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Prevents the engine from choosing retargeting on the user's behalf.
   * @evidence specifications/interchange-and-adoption/adoption-decisions-and-composition.md#interchange-selection-override-resolution Records the selected adoption mode and its parameters.
   *
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `mode` for the performance motion external adoption receipt system contract.
   */
  mode: IAutoMovieExternalMotionAdoptionMode;
}

/**
 * One downstream purpose that makes an asset part of one production.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `IAutoMovieAssetUse` as the portable data boundary for the asset semantic enrichment requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `IAutoMovieAssetUse` for the asset spec element consumer links system contract.
 */
export interface IAutoMovieAssetUse {
  /**
   * Exact production id; project-global assets repeat uses when shared.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `production` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `production` for the asset spec element consumer links system contract.
   */
  production: string;
  /**
   * Typed, addressable consumer inside that production.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `consumer` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `consumer` for the asset spec element consumer links system contract.
   */
  consumer: IAutoMovieAssetConsumer;
  /**
   * Why this production needs the asset.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `reason` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `reason` for the asset spec element consumer links system contract.
   */
  reason: string;
}

/**
 * Closed compiler-owned collision proxy parameters.
 *
 * @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-generated-source Exposes `IAutoMovieGeneratedCollisionProxy` as the portable data boundary for the third party generated source requirement.
 * @evidence specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md#evp-generated-provider-provenance Types `IAutoMovieGeneratedCollisionProxy` for the evp generated provider provenance system contract.
 */
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

/**
 * Closed compiler-owned measurement proxy parameters.
 *
 * @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-generated-source Exposes `IAutoMovieGeneratedMeasurementProxy` as the portable data boundary for the third party generated source requirement.
 * @evidence specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md#evp-generated-provider-provenance Types `IAutoMovieGeneratedMeasurementProxy` for the evp generated provider provenance system contract.
 */
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

/**
 * A deterministic collision proxy reference with no inferred fallback.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `IAutoMovieCollisionProxyReference` as the portable data boundary for the asset semantic enrichment requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `IAutoMovieCollisionProxyReference` for the asset spec element consumer links system contract.
 */
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

/**
 * A deterministic measurement proxy reference with no inferred fallback.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `IAutoMovieMeasurementProxyReference` as the portable data boundary for the asset semantic enrichment requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `IAutoMovieMeasurementProxyReference` for the asset spec element consumer links system contract.
 */
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

/**
 * Manifest-owned deterministic proxy data.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `IAutoMovieModelProxyAsset` as the portable data boundary for the asset semantic enrichment requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `IAutoMovieModelProxyAsset` for the asset spec element consumer links system contract.
 */
export interface IAutoMovieModelProxyAsset {
  /**
   * Proxy asset schema.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `version` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `version` for the asset spec element consumer links system contract.
   */
  version: 1;
  /**
   * Optional collision shape when cited as a collision proxy.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `collision` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `collision` for the asset spec element consumer links system contract.
   */
  collision?: IAutoMovieGeneratedCollisionProxy;
  /**
   * Optional measurement envelope when cited as a measurement proxy.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-semantic-enrichment Exposes `measurement` as the portable data boundary for the asset semantic enrichment requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-element-consumer-links Types `measurement` for the asset spec element consumer links system contract.
   */
  measurement?: IAutoMovieGeneratedMeasurementProxy;
}

/**
 * Explicit ingest and proxy choices for an external 3D model.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `IAutoMovieExternalModelProvenance` as the portable data boundary for the asset external provenance digest requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `IAutoMovieExternalModelProvenance` for the performance motion external adoption receipt system contract.
 * @author Samchon
 */
export interface IAutoMovieExternalModelProvenance {
  /**
   * Stable model-only normalization profile applied to the source model.
   *
   * Motion-only `gltf-motion-v1` provenance belongs to
   * {@link IAutoMovieExternalMotionProvenance} and cannot enter this record.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-adoption-mode Keeps external model adoption distinct from motion adoption.
   * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-gltf-glb-inspection Restricts model provenance to the supported glTF/VRM scene inspection profiles.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `ingestProfile` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `ingestProfile` for the performance motion external adoption receipt system contract.
   */
  ingestProfile: "gltf-static-v1" | "gltf-humanoid-v1" | "vrm-humanoid-v1";
  /**
   * Explicit LOD members rather than an inferred filename convention.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `lod` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `lod` for the performance motion external adoption receipt system contract.
   */
  lod: Array<{
    /** Closed near-to-far level identity. */
    level: "hero" | "near" | "far";
    /** Manifest-owned asset path providing this level. */
    asset: string;
  }>;
  /**
   * Chosen collision proxy; absence never falls back to mesh inference.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `collisionProxy` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `collisionProxy` for the performance motion external adoption receipt system contract.
   */
  collisionProxy: IAutoMovieCollisionProxyReference;
  /**
   * Chosen measurement proxy; absence never falls back to mesh inference.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `measurementProxy` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `measurementProxy` for the performance motion external adoption receipt system contract.
   */
  measurementProxy: IAutoMovieMeasurementProxyReference;
}

/**
 * Byte-exact provenance record for one project-owned distributable asset.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `IAutoMovieAssetProvenance` as the portable data boundary for the asset external provenance digest requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `IAutoMovieAssetProvenance` for the asset spec adoption output system contract.
 */
export interface IAutoMovieAssetProvenance {
  /**
   * Canonical project-relative current asset path.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `path` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `path` for the asset spec adoption output system contract.
   */
  path: string;
  /**
   * SHA-256 of the current bytes at {@link path}.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `digest` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `digest` for the asset spec adoption output system contract.
   */
  digest: AutoMovieContentDigest;
  /**
   * Acquisition identity before any local processing, for bytes some source
   * served.
   *
   * Exactly one of {@link original} and {@link generated} is present. Every
   * manifest written before generated assets existed carries this one, so
   * making it optional reads those ledgers unchanged.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `original` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `original` for the asset spec adoption output system contract.
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
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `generated` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `generated` for the asset spec adoption output system contract.
   */
  generated?: IAutoMovieGeneratedAcquisition;
  /**
   * Distribution terms that apply to the current bytes.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `license` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `license` for the asset spec adoption output system contract.
   */
  license: IAutoMovieAssetLicense;
  /**
   * Ordered transformation chain; empty only when current equals original.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `processing` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `processing` for the asset spec adoption output system contract.
   */
  processing: IAutoMovieAssetProcessingStep[];
  /**
   * Non-empty production usage ledger.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `uses` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `uses` for the asset spec adoption output system contract.
   */
  uses: IAutoMovieAssetUse[];
  /**
   * Required ingest/LOD/proxy ledger for external glTF, GLB, or VRM assets.
   *
   * Non-model assets omit it.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `model` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `model` for the asset spec adoption output system contract.
   */
  model?: IAutoMovieExternalModelProvenance;
  /**
   * Inspected motion facts when these bytes are adopted as animation input.
   * Omitted for non-motion assets; presence never selects a take.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Brings motion bytes into the manifest's digest and provenance boundary.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Records the deterministic ingest identity without making an adoption decision.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `motion` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `motion` for the asset spec adoption output system contract.
   */
  motion?: IAutoMovieExternalMotionProvenance;
}

/**
 * Project-global asset provenance and license ledger.
 *
 * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `IAutoMovieAssetManifest` as the portable data boundary for the asset external provenance digest requirement.
 * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `IAutoMovieAssetManifest` for the asset spec adoption output system contract.
 */
export interface IAutoMovieAssetManifest {
  /**
   * Asset-manifest format.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `version` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `version` for the asset spec adoption output system contract.
   */
  version: 1;
  /**
   * Every distributable project asset, ordered by canonical path.
   *
   * @evidence requirements/asset-authoring/external-assets.md#asset-external-provenance-digest Exposes `assets` as the portable data boundary for the asset external provenance digest requirement.
   * @evidence specifications/asset-and-representation/identity-resources-and-lifecycle.md#asset-spec-adoption-output Types `assets` for the asset spec adoption output system contract.
   */
  assets: IAutoMovieAssetProvenance[];
}

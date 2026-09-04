import {
  IAutoMovieBuiltEnvironment,
  IAutoMovieDesignEvidence,
  IAutoMovieDesignLineage,
  IAutoMovieDesignReference,
} from "../architecture";
import {
  IAutoMovieDefinedShot,
  IAutoMovieShotProgram,
} from "../authoring/IAutoMovieAuthoring";
import { IAutoMovieShot } from "../cinematics";
import { IAutoMovieClip } from "../core";
import { IAutoMovieFluidDomain, IAutoMovieWaterFeature } from "../fluid";
import {
  IAutoMovieQuaternion,
  IAutoMovieTransform,
  IAutoMovieVector3,
} from "../geometry";
import { IAutoMoviePropSpec } from "../harness";
import { IAutoMovieModel } from "../model";
import { IAutoMovieMotion } from "../motion";
import {
  IAutoMovieCameraDepthPrecisionReport,
  IAutoMovieProductionLighting,
  IAutoMovieScene,
} from "../scene";
import { IAutoMovieServiceNetwork } from "../service";
import {
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMoviePlantingInstallation,
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftFurnishing,
} from "../soft";
import type {
  IAutoMovieExternalMotionAdoptionMode,
  IAutoMovieExternalMotionBasis,
  IAutoMovieExternalMotionMappingEntry,
  IAutoMovieExternalMotionTake,
} from "./IAutoMovieAssetManifest";
import type { IAutoMovieDerivedArtifactSource } from "./IAutoMovieDerivedArtifact";
import {
  AutoMovieContentDigest,
  AutoMovieFormationCapability,
  IAutoMovieCaptionGraphemeSegmentationIdentity,
  IAutoMovieDesignTarget,
  IAutoMovieEffectRecipe,
  IAutoMovieFormationDesign,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionDesign,
  IAutoMovieProductionFrameRate,
  IAutoMovieShotContract,
  IAutoMovieShotPredicate,
  IAutoMovieWorldDesign,
} from "./IAutoMovieProductionDesign";
import type {
  IAutoMovieCaptureRuntimeIdentity,
  IAutoMovieRenderBundleManifest,
} from "./IAutoMovieProductionOracle";
import type { IAutoMovieProductionSoundEvidence } from "./IAutoMovieProductionSound";
import type { IAutoMovieSubjectReviewTarget } from "./IAutoMovieSubjectReview";

/**
 * Closed diagnostic identities currently emitted by compiler and lint.
 *
 * This tuple is the canonical registry key set. A user-facing behavioral
 * catalog must exhaustively map it, and producers may not invent an unlisted
 * string. Update the tuple only together with that catalog.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Requires one enumerable code catalog shared by actual delivery.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Makes the shipped tuple the exhaustive key set for behavioral references.
 */
export const AUTOMOVIE_DIAGNOSTIC_CODES = [
  "acceptance-story-sync-failed",
  "asset-bytes-missing",
  "asset-digest-mismatch",
  "asset-manifest-invalid",
  "asset-manifest-missing",
  "asset-manifest-order",
  "asset-model-ingest-invalid",
  "asset-model-instancing-unsupported",
  "asset-model-lod-dangling",
  "asset-model-lod-incompatible",
  "asset-model-material-unsupported",
  "asset-model-provenance-missing",
  "asset-model-proxy-dangling",
  "asset-model-resource-unbound",
  "asset-model-rig-incompatible",
  "asset-motion-ingest-invalid",
  "asset-motion-provenance-missing",
  "asset-path-invalid",
  "asset-processing-missing",
  "asset-provenance-incomplete",
  "asset-texture-unclosed",
  "asset-use-dangling",
  "asset-use-duplicate",
  "asset-use-missing",
  "asset-use-stale",
  "blocking-invalid",
  "builder-failed",
  "capture-failed",
  "capture-host-unavailable",
  "capture-dialogue-identity-invalid",
  "capture-input-changed",
  "capture-png-blank",
  "capture-png-invalid",
  "capture-production-invalid",
  "capture-production-unregistered",
  "capture-receipt-invalid",
  "capture-registry-unavailable",
  "capture-renderer-identity-invalid",
  "capture-size-mismatch",
  "capture-target-missing",
  "compile-current-invalid",
  "compile-input-changed",
  "compile-missing",
  "content-input-unsafe",
  "contract-mismatch",
  "contract-realization-failed",
  "derived-artifact-basis-missing",
  "derived-artifact-basis-stale",
  "derived-artifact-external-collision",
  "derived-artifact-manifest-malformed",
  "derived-artifact-manifest-missing",
  "derived-artifact-output-malformed",
  "derived-artifact-output-missing",
  "derived-artifact-output-stale",
  "derived-artifact-path-unsafe",
  "design-attachment-unsupported",
  "design-budget-exceeded",
  "design-capability-duplicate",
  "design-capability-unsupported",
  "design-collection-cardinality-invalid",
  "design-collection-empty",
  "design-color-invalid",
  "design-deliverable-pass-invalid",
  "design-downstream-invalidated",
  "design-duplicate-id",
  "design-enum-invalid",
  "design-frame-clock-invalid",
  "design-id-collision",
  "design-id-reserved",
  "design-identity-mismatch",
  "design-lineage-unbound",
  "design-missing",
  "design-polygon-invalid",
  "design-quaternion-invalid",
  "design-range-invalid",
  "design-reference-active",
  "design-reference-asset-missing",
  "design-reference-duplicate",
  "design-reference-evidence-dangling",
  "design-reference-frame-bounds-mismatch",
  "design-reference-frame-page-missing",
  "design-reference-invalid",
  "design-reference-media-mismatch",
  "design-reference-media-unsupported",
  "design-reference-missing",
  "design-reference-stale",
  "design-reference-use-dangling",
  "design-reference-use-unbound",
  "design-repaint-feature-required",
  "design-route-invalid",
  "design-schema-invalid",
  "design-source-path-collision",
  "design-source-path-invalid",
  "design-story-clock-absent",
  "design-story-pin-missing",
  "design-story-sync-unsatisfiable",
  "design-target-invalid",
  "design-text-empty",
  "engine-validation-failed",
  "environment-context-invalid",
  "film-audio-cue-invalid",
  "film-caption-cue-invalid",
  "film-effect-cue-invalid",
  "film-global-order-invalid",
  "film-id-mismatch",
  "film-runtime-mismatch",
  "film-shot-accounting-invalid",
  "film-shot-not-compiled",
  "film-shot-unaccounted",
  "film-shot-unknown",
  "film-source-range-invalid",
  "film-state-handoff-mismatch",
  "film-state-handoff-unverifiable",
  "film-time-off-grid",
  "film-transition-handle-missing",
  "film-transition-invalid",
  "film-transition-mismatch",
  "film-video-empty",
  "generated-manifest-missing",
  "generated-manifest-stale",
  "generated-path-outside",
  "generated-stale",
  "generated-stale-output",
  "generated-tampered",
  "generated-unowned",
  "geometry-selector-invalid",
  "grammar-axis-crossed",
  "grammar-eyeline",
  "grammar-jump-cut",
  "grammar-pacing",
  "grammar-reestablish",
  "grammar-screen-direction",
  "grammar-shot-size",
  "grammar-style-intent-unmatched",
  "legacy-art-direction-defaulted",
  "legacy-asset-missing",
  "legacy-camera-subject-reconstruction-required",
  "legacy-design-reconstruction-required",
  "legacy-edit-reconstruction-required",
  "legacy-frame-format-defaulted",
  "legacy-source-unrecoverable",
  "model-archetype-unregistered",
  "model-lod-order-invalid",
  "model-parameter-invalid",
  "model-parameter-missing",
  "model-parameter-unsupported",
  "performance-invalid",
  "pipeline-failed",
  "preview-input-invalid",
  "preview-target-missing",
  "production-address-mismatch",
  "registration-invalid",
  "render-deliverable-incomplete",
  "render-deliverable-invalid",
  "render-deliverable-media-mismatch",
  "render-deliverable-missing",
  "render-deliverable-stale",
  "render-deliverable-unowned",
  "render-rendition-provenance-invalid",
  "repaint-commit-refused",
  "repaint-compile-stale",
  "repaint-delivery-disabled",
  "repaint-failed",
  "repaint-host-unavailable",
  "repaint-input-changed",
  "repaint-input-invalid",
  "repaint-output-invalid",
  "repaint-production-invalid",
  "repaint-production-unregistered",
  "repaint-reference-invalid",
  "repaint-reference-manifest-invalid",
  "repaint-reference-manifest-missing",
  "repaint-registry-unavailable",
  "repaint-source-evidence-invalid",
  "repaint-source-evidence-missing",
  "repaint-target-missing",
  "review-evidence-missing",
  "review-outcome-artifact-malformed",
  "review-outcome-artifact-missing",
  "review-outcome-contract-mismatch",
  "review-subject-viewpoint-unsupported",
  "screenplay-beat-id-repeated",
  "screenplay-beat-prose-repeated",
  "screenplay-beat-uncovered",
  "screenplay-beat-unnamed",
  "screenplay-beat-unwritten",
  "screenplay-catalog-claim-absent",
  "screenplay-catalog-repeated",
  "screenplay-catalog-scene-absent",
  "screenplay-catalog-ungrounded",
  "screenplay-catalog-unnamed",
  "screenplay-citation-claim-absent",
  "screenplay-citation-scene-absent",
  "screenplay-claim-misowned",
  "screenplay-claim-repeated",
  "screenplay-claim-scene-absent",
  "screenplay-claim-unfounded",
  "screenplay-cover-unpromised",
  "screenplay-cover-unreasoned",
  "screenplay-disposition-realized",
  "screenplay-document-absent",
  "screenplay-heading-absent",
  "screenplay-heading-repeated",
  "screenplay-heading-retitled",
  "screenplay-heading-unindexed",
  "screenplay-index-missing",
  "screenplay-lock-orphaned",
  "screenplay-lock-renumbered",
  "screenplay-lock-repeated",
  "screenplay-lock-unreasoned",
  "screenplay-scene-id-noncanonical",
  "screenplay-scene-id-repeated",
  "screenplay-scene-location-absent",
  "screenplay-scene-timing-unrealized",
  "screenplay-scene-unobserved",
  "screenplay-scene-unplaced",
  "screenplay-scene-unrealized",
  "screenplay-scene-untitled",
  "screenplay-scene-unwritten",
  "screenplay-scenes-empty",
  "screenplay-sequence-beatless",
  "screenplay-sequence-unnamed",
  "screenplay-tombstone-realized",
  "screenplay-tombstone-titled",
  "screenplay-treatment-empty",
  "source-actor-runtime-invalid",
  "source-capability-forbidden",
  "source-clip-invalid",
  "source-execution-failed",
  "source-execution-timeout",
  "source-export-invalid",
  "source-export-missing",
  "source-import-unresolved",
  "source-import-unsupported",
  "source-motion-adoption-invalid",
  "source-motion-retarget-invalid",
  "source-nondeterministic",
  "source-path-missing",
  "source-path-outside-root",
  "source-registration-mismatch",
  "source-scene-content-invalid",
  "source-scene-coverage-incomplete",
  "source-scene-physics-invalid",
  "source-shot-nondeterministic",
  "source-template-sentinel",
  "source-transpile-failed",
  "stage-invalid",
] as const;

/**
 * One code from the shipped diagnostic catalog.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Prevents producers from emitting codes absent from the enumerable catalog.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Lets catalog construction prove exhaustive code coverage.
 */
export type AutoMovieDiagnosticCode =
  (typeof AUTOMOVIE_DIAGNOSTIC_CODES)[number];

/**
 * Exactly one stable, versioned behavioral explanation for a diagnostic code.
 *
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Makes every emitted code resolve to one versioned user-facing reference.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Separates stable catalog identity from the concrete anchored knowledge path.
 * @author Samchon
 */
export interface IAutoMovieDiagnosticReference {
  /**
   * Positive catalog revision shipped with this reference set.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Detects stale code-to-reference joins across catalog revisions.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Carries the catalog revision used by actual delivery.
   */
  catalogRevision: number;
  /**
   * Stable behavioral-reference identity within the catalog revision.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Gives a diagnostic exactly one reference identity.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Keys the exhaustive catalog entry independently of prose location.
   */
  id: string;
  /**
   * User-facing Markdown path and stable anchor for the explanation.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Makes the behavioral reference resolvable by the user's knowledge surface.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Links the code to cause, affected parameter, impact, and correction guidance.
   */
  path: `${string}.md#${string}`;
}

/**
 * A stable production diagnostic returned by compiler and lint.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieDiagnostic` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieDiagnostic` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieDiagnostic {
  /**
   * Machine-readable diagnostic code from the shipped closed catalog.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Restricts actual delivery to one enumerable code set.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Uses the same key union the exhaustive catalog maps.
   */
  code: AutoMovieDiagnosticCode;
  /**
   * Whether the diagnostic blocks the current operation.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `category` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `category` for the asset spec generation provider choice system contract.
   */
  category: "error" | "warning";
  /**
   * Pipeline phase that owns the correction.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `phase` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `phase` for the asset spec generation provider choice system contract.
   */
  phase: "project" | "design" | "source" | "compile" | "review" | "render";
  /**
   * Stable target identity.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `target` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `target` for the asset spec generation provider choice system contract.
   */
  target: string;
  /**
   * Project-relative file or null when no one file owns it.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `path` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `path` for the asset spec generation provider choice system contract.
   */
  path: string | null;
  /**
   * Human-readable cause followed by the concrete correction owned by this
   * phase. Do not discard it and retry unchanged.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `message` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `message` for the asset spec generation provider choice system contract.
   */
  message: string;
}

/**
 * The tracked manifest for a coding-agent production repository.
 *
 * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `IAutoMovieProductionManifest` as the portable data boundary for the agent declared omission requirement.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary Draws the boundary in data: the manifest names the roots and files a project owns, and everything outside them belongs to the general capability AutoMovie ships.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility Types the project-declared inventory the system structures and validates rather than supplies.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `IAutoMovieProductionManifest` for the spec authoring partial target input system contract.
 */
export interface IAutoMovieProductionManifest {
  /**
   * Production format version.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `formatVersion` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `formatVersion` for the spec authoring partial target input system contract.
   */
  formatVersion: 2;
  /**
   * Repository-local project identity, excluded from content fingerprints.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `projectId` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `projectId` for the spec authoring partial target input system contract.
   */
  projectId: string;
  /**
   * Project-relative coding-agent-owned source directories. Shot modules must
   * resolve as real TypeScript files inside one of these roots.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `sourceRoots` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `sourceRoots` for the spec authoring partial target input system contract.
   */
  sourceRoots: string[];
  /**
   * Additional project-relative directories whose exact files affect compile
   * and render identity, such as viewer, scripts and public assets.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `contentRoots` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `contentRoots` for the spec authoring partial target input system contract.
   */
  contentRoots?: string[];
  /**
   * Additional project-relative files whose bytes affect compile identity.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `contentFiles` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `contentFiles` for the spec authoring partial target input system contract.
   */
  contentFiles?: string[];
  /**
   * Project-global asset provenance ledger.
   *
   * When declared, compiler asset references are restricted to the byte-exact
   * paths in this manifest.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `assetManifest` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `assetManifest` for the spec authoring partial target input system contract.
   */
  assetManifest?: "automovie/assets.json";
  /**
   * Project-owned deterministic precomputation ledger.
   *
   * When declared, every generator, input, and output byte is verified before
   * authored source executes, and only current artifacts enter source context.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Makes the tracked derived-artifact ledger an explicit compiler input.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-manifest Selects the one canonical project-relative ledger path.
   */
  derivedArtifactManifest?: "automovie/derived-artifacts.json";
  /**
   * Compiler-owned generated root.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `generatedRoot` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `generatedRoot` for the spec authoring partial target input system contract.
   */
  generatedRoot: string;
  /**
   * Content-addressed render root.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `renderRoot` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `renderRoot` for the spec authoring partial target input system contract.
   */
  renderRoot: string;
  /**
   * Optional non-destructive legacy import provenance.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `importedLegacy` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `importedLegacy` for the spec authoring partial target input system contract.
   */
  importedLegacy?: {
    /** Imported legacy project revision. */
    revision: number;
    /** Relative source directory containing the untouched legacy tree. */
    sourceRoot: string;
  };
}

/**
 * One source or dependency file sealed into an external motion receipt.
 *
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Requires raw source and dependency digests in the receipt input basis.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Types one path-and-digest member of the pinned source closure.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionReceiptResource {
  /**
   * Production-relative path of the pinned source byte file.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Requires each raw source or dependency to remain identifiable.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Normalizes source closure paths before receipt identity is computed.
   */
  path: string;
  /**
   * Content digest of the exact resident bytes.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Pins every source and dependency byte consumed by conversion.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Makes the source closure a digest-grounded deterministic input.
   */
  digest: AutoMovieContentDigest;
}

/**
 * Complete byte-grounded source basis consumed by one motion conversion.
 *
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Binds source closure, selection, basis, and interpretation to the result.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Types the pinned and normalized motion input basis.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionConversionSource {
  /**
   * Primary external motion asset and its exact content digest.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Requires the raw source identity in the receipt.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Pins the primary source bytes as a deterministic conversion input.
   */
  asset: IAutoMovieExternalMotionReceiptResource;
  /**
   * Ordered dependency files required to interpret the source asset.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Requires dependency digests beside the raw source.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Preserves the canonicalized source closure used by conversion.
   */
  closure: IAutoMovieExternalMotionReceiptResource[];
  /**
   * Exact animation take selected from the source bytes.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Requires the selected take to remain in the non-destructive receipt.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Binds conversion to the inspected source take and its range.
   */
  take: IAutoMovieExternalMotionTake;
  /**
   * Canonical coordinate, hierarchy, and local-rest basis inspected from bytes.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Requires the source skeleton, unit, axes, and rest basis before adoption.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Seals the byte-grounded basis into the conversion source.
   */
  basis: IAutoMovieExternalMotionBasis;
  /**
   * Canonical digest of the inspected source basis.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Binds the declared coordinate and unit interpretation to the result.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Makes basis equality part of deterministic receipt identity.
   */
  basisDigest: AutoMovieContentDigest;
}

/**
 * Actor-bound production decision that authorizes one motion conversion.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Keeps source use, target binding, mapping, and adoption mode explicit.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the authored decision retained by the external motion receipt.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionConversionDecision {
  /**
   * Production shot that owns the adopted motion.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Keeps external motion adoption attached to the authored performance context.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Records the shot-scoped destination of the conversion.
   */
  shot: string;
  /**
   * Actor identity that consumes the converted motion.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Makes the target performer part of the explicit adoption decision.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Binds the conversion result to one actor rather than an unowned clip.
   */
  actor: string;
  /**
   * Authored clip identity receiving the converted motion.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Keeps the selected adoption destination explicit.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Joins the result to the exact performance clip.
   */
  clip: string;
  /**
   * Native or humanoid-retarget conversion mode.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Prevents the compiler from silently changing the selected adoption technique.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Retains the selected mode as receipt data.
   */
  mode: IAutoMovieExternalMotionAdoptionMode["kind"];
  /**
   * Reviewed source-node to target-bone mapping.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Requires automatic mapping to remain inspectable and overridable.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Seals the accepted mapping separately from compatibility findings.
   */
  mapping: IAutoMovieExternalMotionMappingEntry[];
  /**
   * Explicit root-translation scale, or null for native adoption.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Makes automatic scale correction reviewable and overridable.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Records the chosen translation conversion without inferring it later.
   */
  translationScale: number | null;
}

/**
 * Target basis against which one external motion conversion was decided.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Requires compatibility to be evaluated against the chosen target controls and scale.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the target identity and basis sealed by the receipt.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionConversionTarget {
  /**
   * Target production model identity.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Requires compatibility findings to name the selected target.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Binds conversion to the exact target model.
   */
  model: string;
  /**
   * Target skeleton identity within the model.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Requires source and target control coverage to be compared explicitly.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Binds mapping and retargeting to the exact target skeleton.
   */
  skeleton: string;
  /**
   * Canonical digest of the target skeleton basis.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Requires meaningful target interpretation changes to invalidate the receipt.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Makes the target basis a pinned conversion input.
   */
  basisDigest: AutoMovieContentDigest;
}

/**
 * One ordered transformation applied while converting external motion.
 *
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Requires every coordinate, unit, time, resample, and retarget operation to be recorded.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-element-mapping Types one ordered activity in the transform ledger.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionTransformActivity {
  /**
   * Closed motion conversion activity discriminator.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Distinguishes the exact transformation performed on source elements.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-element-mapping Records normalization, retargeting, trimming, and channel conversion as explicit activities.
   */
  kind:
    | "basis-normalization"
    | "hierarchy-collapse"
    | "retarget"
    | "translation-scale"
    | "time-trim"
    | "channel-conversion"
    | "event-remap";
  /**
   * Stable source element identities consumed by this activity.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Requires source-to-result element correspondence to remain inspectable.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-element-mapping Carries the source side of one transform-ledger relation.
   */
  source: string[];
  /**
   * Stable result element identities produced by this activity.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Requires result identities, splits, and merges to be recorded.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-element-mapping Carries the result side of one transform-ledger relation.
   */
  target: string[];
  /**
   * Serializable parameters that fully characterize the activity.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Requires the applied coordinate, unit, time, and retarget facts in the receipt.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-element-mapping Makes every transform replayable from ordered activity data.
   */
  parameters: Record<string, string | number | boolean | null>;
}

/**
 * One source-level loss or approximation accepted by conversion.
 *
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-loss Requires every dropped, approximated, or precision-reduced source fact and consequence.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-loss-ledger Types one entry in the external conversion loss ledger.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionLossEntry {
  /**
   * Closed loss or approximation discriminator.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-loss Distinguishes omission, approximation, precision reduction, and semantic loss.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-loss-ledger Classifies the unsupported or altered source feature.
   */
  kind:
    | "channel-dropped"
    | "channel-approximated"
    | "precision-loss"
    | "semantic-loss";
  /**
   * Stable source elements affected by the loss.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-loss Requires loss to be attributed element by element.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-loss-ledger Binds a loss entry to its affected source support set.
   */
  source: string[];
  /**
   * Observable downstream consequence of the loss.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-loss Requires every loss to state its behavioral or fidelity consequence.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-loss-ledger Prevents successful output from implying preserved behavior.
   */
  consequence: string;
  /**
   * Whether the user explicitly accepted this loss.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Requires risky automatic corrections to remain reviewable, overridable, or rejectable.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Keeps user authorization distinct from the compatibility finding itself.
   */
  authorized: boolean;
}

/**
 * Compatibility characterization retained separately from the user decision.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Requires source-target findings to stay distinct from user overrides.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the compatibility characterization sealed beside the selected mapping.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionReceiptCharacterization {
  /**
   * Overall result of source-to-target compatibility analysis.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Requires target compatibility to be inspected before adoption.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Keeps failed compatibility distinct from an authorized risky adoption.
   */
  status: "compatible" | "override-required" | "incompatible";
  /**
   * Deterministically ordered source-to-target compatibility findings.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Requires control, range, scale, contact, event, and unsupported-channel findings.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Preserves the system findings independently of the chosen mapping and overrides.
   */
  findings: string[];
}

/**
 * Canonical converted motion result sealed by compiler-owned digests.
 *
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Requires the canonical receipt identity to bind the exact output bytes.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Types the motion identity, receipt digest, output path, and output digest relation.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionConversionResult {
  /**
   * Stable project-native motion identity assigned to the result.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Requires meaningful result identity changes to produce a distinct receipt.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Binds canonical receipt serialization to the adopted motion identity.
   */
  motionId: string;
  /**
   * Canonical digest of the project-native motion value.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Requires the adopted motion result digest to remain linked to its source.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Seals the converted motion identity independently of file placement.
   */
  motionDigest: AutoMovieContentDigest;
  /**
   * Production-relative compiler-owned result file path.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Requires path notation to be normalized in the canonical result.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Identifies the generated output inventoried by the compiler manifest.
   */
  outputPath: string;
  /**
   * Content digest of the exact generated output file bytes.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Requires the receipt to bind the exact output digest.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Couples receipt identity to the generated output inventory digest.
   */
  outputDigest: AutoMovieContentDigest;
}

/**
 * Compiler tool and protocol identity sealed into a motion conversion receipt.
 *
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Requires the conversion tool and version to remain bound to the receipt result.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Makes tool and profile versions part of deterministic receipt identity.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionConversionCompiler {
  /**
   * Exact compiler package version.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Records which conversion tool build interpreted the pinned source closure.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Invalidates receipt identity when the compiler implementation version changes.
   */
  packageVersion: string;
  /**
   * Exact compiler content-protocol version.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Records the conversion protocol governing settings and canonical output.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Invalidates receipt identity when the interpretation protocol changes.
   */
  protocolVersion: string;
}

/**
 * Compiler-sealed receipt for one external motion conversion.
 *
 * The compiler serializes this receipt as its own generated file and lists that
 * file in {@link IAutoMovieGeneratedManifest.files}; it does not mutate or embed
 * the preserved source bytes.
 *
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Requires a canonical receipt and output digest for every meaningful conversion result.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Types the compiler-owned receipt whose file identity is inventoried beside its output.
 * @author Samchon
 */
export interface IAutoMovieExternalMotionConversionReceipt {
  /**
   * External motion conversion receipt schema version.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Requires meaningful schema or version changes to change receipt identity.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Makes canonical serialization explicitly versioned.
   */
  version: 1;
  /**
   * Compiler tool and protocol identity that produced the conversion.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Requires the conversion tool and version to remain bound to the receipt result.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Makes tool and profile versions part of deterministic receipt identity.
   */
  compiler: IAutoMovieExternalMotionConversionCompiler;
  /**
   * Production-declared external motion adoption identity.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Keeps every conversion attached to the explicit non-destructive adoption.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Joins source, decision, characterization, and result to one adoption.
   */
  adoption: string;
  /**
   * Pinned source closure, take, and byte-inspected basis.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-inputs Requires the full input basis to remain bound to the result.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-input-basis Types the deterministic source input of the conversion receipt.
   */
  source: IAutoMovieExternalMotionConversionSource;
  /**
   * Actor-bound authored adoption decision.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-mode Keeps conversion mode and destination under production authority.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types the selected shot, actor, clip, mode, mapping, and scale.
   */
  decision: IAutoMovieExternalMotionConversionDecision;
  /**
   * Exact model and skeleton basis receiving the motion.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Grounds compatibility and mapping in the selected target controls.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Binds the decision to one target basis digest.
   */
  target: IAutoMovieExternalMotionConversionTarget;
  /**
   * Ordered compiler-performed transform ledger.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-mapping Requires all mapping and conversion facts in the receipt.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-element-mapping Preserves semantic transform order in canonical identity.
   */
  transforms: IAutoMovieExternalMotionTransformActivity[];
  /**
   * Ordered ledger of dropped, approximated, or altered source facts.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-loss Requires explicit element-level consequences for every loss.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-receipt-loss-ledger Types loss independently of successful result generation.
   */
  losses: IAutoMovieExternalMotionLossEntry[];
  /**
   * Source-to-target compatibility findings before user authorization.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-compatibility-override Keeps compatibility findings separate from overrides and mapping decisions.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Preserves the compiler's characterization beside the authored decision.
   */
  characterization: IAutoMovieExternalMotionReceiptCharacterization;
  /**
   * Canonical motion and generated output identities.
   *
   * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-conversion-receipt-canonical-result Requires the receipt to bind its adopted identity and output bytes.
   * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-canonical-receipt-result Seals result paths and digests into canonical receipt identity.
   */
  result: IAutoMovieExternalMotionConversionResult;
}

/**
 * One compiler-owned generated file.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `IAutoMovieGeneratedFile` as the portable data boundary for the asset generated adoption modes requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `IAutoMovieGeneratedFile` for the asset spec generation adoption output system contract.
 */
export interface IAutoMovieGeneratedFile {
  /**
   * Project-relative generated path.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `path` as the portable data boundary for the asset generated adoption modes requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `path` for the asset spec generation adoption output system contract.
   */
  path: string;
  /**
   * Ownership marker.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `owner` as the portable data boundary for the asset generated adoption modes requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `owner` for the asset spec generation adoption output system contract.
   */
  owner: "compiler";
  /**
   * File-byte digest.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `digest` as the portable data boundary for the asset generated adoption modes requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `digest` for the asset spec generation adoption output system contract.
   */
  digest: AutoMovieContentDigest;
  /**
   * Design or source targets that produced the file.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `sourceTargets` as the portable data boundary for the asset generated adoption modes requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `sourceTargets` for the asset spec generation adoption output system contract.
   */
  sourceTargets: string[];
}

/**
 * Manifest proving the identity and ownership of generated output.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `IAutoMovieGeneratedManifest` as the portable data boundary for the asset generated adoption modes requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `IAutoMovieGeneratedManifest` for the asset spec generation adoption output system contract.
 */
export interface IAutoMovieGeneratedManifest {
  /**
   * Generated-manifest format.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `version` as the portable data boundary for the asset generated adoption modes requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `version` for the asset spec generation adoption output system contract.
   */
  version: 1;
  /**
   * Compiler identity.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `compiler` as the portable data boundary for the asset generated adoption modes requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `compiler` for the asset spec generation adoption output system contract.
   */
  compiler: {
    /** Package version. */
    packageVersion: string;
    /** Content protocol version. */
    protocolVersion: string;
  };
  /**
   * Ordered design and source input fingerprint.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `inputFingerprint` as the portable data boundary for the asset generated adoption modes requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `inputFingerprint` for the asset spec generation adoption output system contract.
   */
  inputFingerprint: AutoMovieContentDigest;
  /**
   * Compiler-owned files.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes Exposes `files` as the portable data boundary for the asset generated adoption modes requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-adoption-output Types `files` for the asset spec generation adoption output system contract.
   */
  files: IAutoMovieGeneratedFile[];
}

/**
 * Compiler-owned registry of targets that evidence tools may resolve.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `IAutoMovieProductionRegistryManifest` as the portable data boundary for the agent narrowest valid check requirement.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `IAutoMovieProductionRegistryManifest` for the spec authoring partial verification invariant system contract.
 */
export interface IAutoMovieProductionRegistryManifest {
  /**
   * Registry format.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `version` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `version` for the spec authoring partial verification invariant system contract.
   */
  version: 2;
  /**
   * Compiler protocol that produced this registry.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `compiler` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `compiler` for the spec authoring partial verification invariant system contract.
   */
  compiler: string;
  /**
   * Exact production namespace.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `productionId` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `productionId` for the spec authoring partial verification invariant system contract.
   */
  productionId: string;
  /**
   * Current aggregate compiler input fingerprint.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `inputFingerprint` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `inputFingerprint` for the spec authoring partial verification invariant system contract.
   */
  inputFingerprint: AutoMovieContentDigest;
  /**
   * Built model/asset targets with their generated paths.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `assets` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `assets` for the spec authoring partial verification invariant system contract.
   */
  assets: Array<{
    /** Exact model recipe id. */
    id: string;
    /** Compiler-owned generated model path. */
    path: string;
  }>;
  /**
   * Built shot targets with their generated paths.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `shots` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `shots` for the spec authoring partial verification invariant system contract.
   */
  shots: Array<{
    /** Exact shot registration id. */
    id: string;
    /** Compiler-owned generated shot path. */
    path: string;
  }>;
  /**
   * Current compiler-owned film id, or null before film materialization.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `film` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `film` for the spec authoring partial verification invariant system contract.
   */
  film: string | null;
}

/**
 * One byte-exact file proving a final production deliverable.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieProductionDeliverableFile` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieProductionDeliverableFile` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieProductionDeliverableFile {
  /**
   * Render-root-relative regular file path.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `path` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `path` for the asset spec generation provider choice system contract.
   */
  path: string;
  /**
   * Exact file-byte digest.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `digest` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `digest` for the asset spec generation provider choice system contract.
   */
  digest: AutoMovieContentDigest;
  /**
   * Exact non-zero file size.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `bytes` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `bytes` for the asset spec generation provider choice system contract.
   */
  bytes: number;
  /**
   * Explicit media type, such as video/mp4 or text/vtt.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `mediaType` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `mediaType` for the asset spec generation provider choice system contract.
   */
  mediaType: string;
}

/**
 * One materialized production deliverable in the aggregate render ledger.
 *
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `IAutoMovieProductionRenderedDeliverable` as the portable data boundary for the rendering lowering ownership requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `IAutoMovieProductionRenderedDeliverable` for the spec render state isolation system contract.
 */
export interface IAutoMovieProductionRenderedDeliverable {
  /**
   * Exact id declared by production design.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `id` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `id` for the spec render state isolation system contract.
   */
  id: string;
  /**
   * Exact kind declared by production design.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `kind` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `kind` for the spec render state isolation system contract.
   */
  kind: IAutoMovieProductionDeliverable["kind"];
  /**
   * Byte-exact owned output files.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `files` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `files` for the spec render state isolation system contract.
   */
  files: IAutoMovieProductionDeliverableFile[];
  /**
   * Timeline duration, or null for a still-only deliverable.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `runtimeSeconds` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `runtimeSeconds` for the spec render state isolation system contract.
   */
  runtimeSeconds: number | null;
  /**
   * Rendered frame count, or null when the kind has no video frame clock.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `frameCount` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `frameCount` for the spec render state isolation system contract.
   */
  frameCount: number | null;
  /**
   * Actual codec name, or null for unencoded text/image artifacts.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `codec` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `codec` for the spec render state isolation system contract.
   */
  codec: string | null;
  /**
   * Repaint provenance when this feature was conformed from selected visual
   * renditions. Absent for deterministic delivery and non-feature outputs.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `rendition` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `rendition` for the spec render state isolation system contract.
   */
  rendition?: IAutoMovieProductionRenditionDelivery;
}

/**
 * One selected repaint output and its independent review chain.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `IAutoMovieProductionRenditionDeliveryShot` as the portable data boundary for the delivery caption readability profile requirement.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `IAutoMovieProductionRenditionDeliveryShot` for the spec delivery caption readability profile system contract.
 */
export interface IAutoMovieProductionRenditionDeliveryShot {
  /**
   * Exact compiled shot id.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `shot` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `shot` for the spec delivery caption readability profile system contract.
   */
  shot: string;
  /**
   * Render-root-relative immutable repaint output.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `path` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `path` for the spec delivery caption readability profile system contract.
   */
  path: string;
  /**
   * Exact current repaint output digest.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `digest` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `digest` for the spec delivery caption readability profile system contract.
   */
  digest: AutoMovieContentDigest;
  /**
   * Digest of the canonical immutable repaint receipt.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `receiptDigest` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `receiptDigest` for the spec delivery caption readability profile system contract.
   */
  receiptDigest: AutoMovieContentDigest;
}

/**
 * Review and receipt provenance for one repainted feature delivery.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `IAutoMovieProductionRenditionDelivery` as the portable data boundary for the delivery caption readability profile requirement.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `IAutoMovieProductionRenditionDelivery` for the spec delivery caption readability profile system contract.
 */
export interface IAutoMovieProductionRenditionDelivery {
  /**
   * Explicit selected visual layer.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `kind` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `kind` for the spec delivery caption readability profile system contract.
   */
  kind: "repainted";
  /**
   * Every shot rendition consumed by the current film timeline.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `shots` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `shots` for the spec delivery caption readability profile system contract.
   */
  shots: IAutoMovieProductionRenditionDeliveryShot[];
}

/**
 * Aggregate final-delivery ledger bound to one current compile.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `IAutoMovieProductionRenderManifest` as the portable data boundary for the delivery caption readability profile requirement.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `IAutoMovieProductionRenderManifest` for the spec delivery caption readability profile system contract.
 */
export interface IAutoMovieProductionPublicationIdentity {
  /** Closed identity protocol. */
  protocolVersion: "automovie.production-publication.v3";
  /** Production namespace whose plan produced the publication. */
  productionId: string;
  /** Exact compiler input used by the plan. */
  compileFingerprint: AutoMovieContentDigest;
  /** Exact compiler-owned edit used by the plan. */
  editFingerprint: AutoMovieContentDigest;
  /** Complete installed capture, dialogue, and encoder closure. */
  runtimeIdentity: {
    protocolVersion: "automovie.production-render-runtime.v3";
    sourceDigest: AutoMovieContentDigest;
    dialogueRuntimeIdentity: AutoMovieContentDigest | null;
    capture: IAutoMovieCaptureRuntimeIdentity;
    encoder: {
      package: string;
      version: string;
      closureDigest: AutoMovieContentDigest;
      codec: "h264";
      arguments: {
        quantizationParameter: number;
        speed: number;
        groupOfPictures: number;
      };
    };
  };
  /** Proxy or final policy, compared only with the same tier. */
  tier: {
    kind: "proxy" | "final";
    resolutionScale: number;
    frameStep: number;
  };
  /** Compiler-owned full-rate format. */
  sourceFrameFormat: IAutoMovieProductionDesign["frameFormat"];
  /** Exact tier output format. */
  frameFormat: IAutoMovieProductionDesign["frameFormat"];
  /** Tier output frame count. */
  totalFrames: number;
  /** Maximum planned chunk span. */
  chunkFrames: number;
  /** Canonical chunk identity projection in plan order. */
  chunks: Array<{
    slot: string;
    id: AutoMovieContentDigest;
    pass: string;
  }>;
  /** Canonical identities of every non-video publication track. */
  tracks: {
    captions: AutoMovieContentDigest;
    audio: AutoMovieContentDigest;
    audioAssets: AutoMovieContentDigest;
  };
  /** Digest of the canonical identity fields above. */
  fingerprint: AutoMovieContentDigest;
}

/**
 * Aggregate final-delivery ledger bound to one exact render-plan runtime.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Makes any plan or runtime-closure change invalidate the aggregate publication.
 * @evidence requirements/production-design/continuity-change-and-deliverables.md#production-design-deliverable-provenance Preserves the exact render-plan provenance beside delivered bytes.
 * @evidence specifications/editorial-render-and-delivery/delivery-package-provenance-and-publication.md#spec-delivery-provenance-integrity Carries a recomputable structured publication identity rather than trusting an opaque path.
 * @evidence specifications/execution-and-recovery/artifacts-and-atomic-publication.md#execution-publication-preconditions Supplies the exact candidate generation checked at the terminal commit boundary.
 */
export interface IAutoMovieProductionRenderManifest {
  /**
   * Aggregate manifest format.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `version` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `version` for the spec delivery caption readability profile system contract.
   */
  version: 2;
  /**
   * Exact compiler input that produced every listed output.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `compileFingerprint` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `compileFingerprint` for the spec delivery caption readability profile system contract.
   */
  compileFingerprint: AutoMovieContentDigest;
  /** Structured and self-verifying render-plan identity. */
  publication: IAutoMovieProductionPublicationIdentity;
  /**
   * Materialized required and optional deliverables.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `deliverables` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `deliverables` for the spec delivery caption readability profile system contract.
   */
  deliverables: IAutoMovieProductionRenderedDeliverable[];
}

/**
 * Decoded PNG color model.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-alpha-channels Distinguishes the exact decoded channel population.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Defines the closed picture-model vocabulary used by profile comparison.
 */
export type AutoMovieProductionPngColor =
  | "gray"
  | "gray-alpha"
  | "rgb"
  | "rgba"
  | "palette";

/**
 * Complete parser-observed PNG picture facts.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Preserves the decoded raster, channel, alpha, color, aspect, and orientation facts required for final picture verification.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed picture product compared fieldwise with the selected delivery profile.
 */
export interface IAutoMovieProductionPngPicture {
  /**
   * Decoded pixel width.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Preserves the decoded horizontal raster.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed width for profile comparison.
   */
  width: number;
  /**
   * Decoded pixel height.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Preserves the decoded vertical raster.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed height for profile comparison.
   */
  height: number;
  /**
   * Decoded sample precision.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Preserves the encoded channel precision.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed bit depth for profile comparison.
   */
  bitDepth: number;
  /**
   * Decoded channel population.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Distinguishes grayscale, palette, RGB, and alpha-bearing pictures.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed color model for profile comparison.
   */
  color: AutoMovieProductionPngColor;
  /**
   * Decoded alpha relation.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-alpha-channels Keeps opacity distinct from straight alpha.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed alpha fact for profile comparison.
   */
  alpha: "none" | "straight";
  /**
   * Decoded scan organization.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-image-sequences Preserves whether the picture is interlaced.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed interlace fact for profile comparison.
   */
  interlace: "none" | "adam7";
  /**
   * Color meaning explicitly carried by the datastream.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Refuses to infer missing picture color identity.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed color-space fact for profile comparison.
   */
  colorSpace: "srgb" | "icc" | "gamma" | "unidentified";
  /**
   * Implicit or explicit pixel aspect carried by the datastream.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Makes stretch-producing density metadata observable.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed aspect fact for profile comparison.
   */
  pixelAspect:
    | { kind: "square" }
    | { kind: "explicit"; x: number; y: number; unit: 0 | 1 };
  /**
   * Presence of orientation metadata that could transform presentation.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Keeps encoded orientation from being silently applied.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the observed orientation fact for profile comparison.
   */
  orientation: "upright" | "metadata-present";
}

/**
 * One canonical cue parsed from final WebVTT bytes.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-text-language Retains delivered cue identity, text, and exact millisecond boundaries for comparison with the current caption plan.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues Supplies the canonical delivered cue facts consumed by final caption verification.
 */
export interface IAutoMovieProductionWebVttCue {
  /**
   * Delivered cue identifier, if present.
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-text-language Preserves cue identity for current-plan comparison.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues Supplies the delivered cue id.
   */
  id: string | null;
  /**
   * Complete delivered cue payload.
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-text-language Preserves caption text and markup identity.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues Supplies the delivered cue text.
   */
  text: string;
  /**
   * Exact parsed cue-start millisecond.
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness Preserves the delivered start boundary.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues Supplies the delivered cue start.
   */
  startMilliseconds: number;
  /**
   * Exact parsed exclusive cue-end millisecond.
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-freshness Preserves the delivered end boundary.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-cues Supplies the delivered cue end.
   */
  endMilliseconds: number;
}

/**
 * Observed Opus sample-entry facts from final delivery bytes.
 *
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves the exact coded stream and channel facts used to validate a final audio deliverable.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Carries parser-observed codec configuration for fieldwise comparison with the selected delivery profile.
 */
export interface IAutoMovieProductionOpusDescription {
  /**
   * Closed parsed sample-entry family.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Identifies the encoded Opus stream.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the parsed sample-entry kind.
   */
  kind: "opus";
  /**
   * Parsed dOps version.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves codec-description version identity.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the parsed dOps version.
   */
  version: number;
  /**
   * Parsed output channel count.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Preserves the coded channel population.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the sample-entry channel count.
   */
  outputChannelCount: number;
  /**
   * Parsed decoder pre-skip in samples.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves the coded priming boundary.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the parsed pre-skip.
   */
  preSkip: number;
  /**
   * Parsed input sample rate.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves the Opus input clock.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the sample-entry rate.
   */
  inputSampleRate: number;
  /**
   * Parsed signed Q7.8 output gain.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-downmix Prevents hidden final-stream gain changes.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the parsed Opus gain.
   */
  outputGainQ7_8: number;
  /**
   * Parsed mapping-family, stream, and channel-order facts.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Preserves the complete coded channel mapping.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the parsed mapping structure.
   */
  channelMapping: {
    family: number;
    streamCount: number | null;
    coupledCount: number | null;
    mapping: number[];
    channelOrder: string[] | null;
  };
}

/**
 * Parser-observed audio track and presentation facts.
 *
 * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Makes final channel layout and sample-clock identity inspectable from the published stream.
 * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Binds the final audio inventory to its actual timebase, samples, and codec description.
 */
export interface IAutoMovieProductionAudioProbe {
  /**
   * Parsed media class.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Identifies one final audio track.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the audio inventory kind.
   */
  kind: "audio";
  /**
   * Parsed container family.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves the final audio container identity.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the audio inventory container.
   */
  container: "mp4";
  /**
   * Parsed codec string.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves the final stream codec.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the audio inventory codec.
   */
  codec: string;
  /**
   * Parsed presentation runtime.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves the stream presentation duration.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#audio-visual-duration-and-timebase-join Supplies the audio side of the duration join.
   */
  runtimeSeconds: number;
  /**
   * Parsed channel count.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Preserves the actual final channel population.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the final channel count.
   */
  channels: number;
  /**
   * Parsed media sample rate.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves the final audio clock.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the final sample rate.
   */
  sampleRate: number;
  /**
   * Parsed packet count.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Proves the final track has resident coded samples.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the coded packet population.
   */
  sampleCount: number;
  /**
   * Parsed decoder priming in samples.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-audio-streams-channels Preserves the presentation offset.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#audio-visual-duration-and-timebase-join Supplies the audio priming fact.
   */
  primingSamples: number;
  /**
   * Raw movie and media integer clocks.
   * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-stream-synchronization Preserves exact presentation and media timebases.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#audio-visual-duration-and-timebase-join Supplies the integer audio clock join.
   */
  timebase: {
    movieTimescale: number;
    mediaTimescale: number;
    movieDuration: number;
    mediaDuration: number;
  };
  /**
   * Complete parsed codec sample entry.
   * @evidence requirements/delivery-and-accessibility/audio-streams-and-channels.md#delivery-channel-layout Preserves channel mapping and gain beside track facts.
   * @evidence specifications/simulation-effects-and-sound/mix-stems-loudness-and-av-join.md#sound-delivery-stream-and-inventory Supplies the final codec description.
   */
  sampleEntry: IAutoMovieProductionOpusDescription;
}

/**
 * Parser-observed video track, presentation, and picture facts.
 *
 * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-codec-facts Retains the final container, coded-stream, timing, and presentation facts read from delivery bytes.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the observed facts compared fieldwise with the selected delivery profile.
 */
export interface IAutoMovieProductionVideoProbe {
  /**
   * Parsed media class.
   * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-codec-facts Identifies one final video track.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the video inventory kind.
   */
  kind: "video";
  /**
   * Parsed container family.
   * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-metadata Preserves the final container identity.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the parsed container.
   */
  container: "mp4";
  /**
   * Parsed coded-stream family.
   * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-codec-facts Preserves the final video codec.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the parsed codec.
   */
  codec: "h264";
  /**
   * Compatibility width projected from coded facts.
   * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-observed-media-facts Keeps the delivered raster observable.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the compatibility width.
   */
  width: number;
  /**
   * Compatibility height projected from coded facts.
   * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-observed-media-facts Keeps the delivered raster observable.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the compatibility height.
   */
  height: number;
  /**
   * Parsed presentation runtime.
   * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-stream-synchronization Preserves the final picture duration.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Supplies the picture runtime projection.
   */
  runtimeSeconds: number;
  /**
   * Parsed resident picture-sample count.
   * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-time-boundary-count Preserves the final frame population.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Supplies the parsed frame count.
   */
  frameCount: number;
  /**
   * Compatibility rate projected from the raw sample clock.
   * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-rational-frame-rate Keeps the legacy display rate beside its exact source facts.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Supplies the display-rate projection.
   */
  fps: number;
  /**
   * Canonical reduced rate parsed from the sample clock.
   * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-rational-frame-rate Preserves the exact final picture rate instead of only its decimal projection.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Supplies the canonical parsed numerator and denominator.
   */
  frameRate: IAutoMovieProductionFrameRate;
  /**
   * Parsed major and compatible brands.
   * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-container-metadata Preserves the final container brands.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the parsed brand set.
   */
  brands: { major: string; compatible: string[] };
  /**
   * Parsed coded sample-entry raster.
   * @evidence requirements/delivery-and-accessibility/containers-codecs-and-media-facts.md#delivery-observed-media-facts Preserves coded dimensions independently of display transforms.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-container-media-facts Supplies the coded raster.
   */
  coded: { width: number; height: number };
  /**
   * Parsed fixed-point track display raster.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Makes stretch-producing display metadata observable.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the track presentation raster.
   */
  trackDisplay: { width16_16: number; height16_16: number };
  /**
   * Parsed fixed-point track presentation matrix.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Makes rotation, reflection, and translation observable.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the complete track matrix.
   */
  trackMatrix: [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  /**
   * Parsed pixel-aspect declaration.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Makes non-square presentation metadata observable.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the pixel-aspect fact.
   */
  pixelAspect:
    | { kind: "implicit-square" }
    | { kind: "explicit"; hSpacing: number; vSpacing: number };
  /**
   * Raw movie/media clocks and edit list.
   * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-stream-synchronization Preserves the integer presentation timeline.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Supplies the exact presentation clock.
   */
  presentation: {
    movieTimescale: number;
    mediaTimescale: number;
    movieDuration: number;
    mediaDuration: number;
    edits: Array<{
      segmentDuration: number;
      mediaTime: number;
      mediaRateInteger: number;
      mediaRateFraction: number;
    }>;
  };
  /**
   * Raw constant-sample clock and boundary facts.
   * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-time-boundary-count Preserves the actual first, last, and exclusive sample boundary.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Supplies the exact media sample clock.
   */
  samples: {
    count: number;
    duration: number;
    timescale: number;
    firstDts: number;
    lastDts: number;
    firstCts: number;
    lastCts: number;
  };
  /**
   * Container-declared and resolved picture color identity.
   * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Refuses unidentified or conflicting color interpretation.
   * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Supplies the final color facts.
   */
  color: {
    container:
      | {
          kind: "nclx";
          primaries: number;
          transfer: number;
          matrix: number;
          fullRange: boolean;
        }
      | { kind: "absent" };
    resolved: { kind: "srgb"; source: "container" } | { kind: "absent" };
  };
}

/**
 * Parser-derived metadata for one renderer-owned output file.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `IAutoMovieProductionMediaProbe` as the portable data boundary for the diagnostics derived result finding requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `IAutoMovieProductionMediaProbe` for the validation derived result finding system contract.
 */
export type IAutoMovieProductionMediaProbe =
  | {
      /** Decoded PNG raster. */
      kind: "png";
      /** Actual pixel width. */
      width: number;
      /** Actual pixel height. */
      height: number;
      /** Complete decoded picture identity. */
      picture: IAutoMovieProductionPngPicture;
    }
  | IAutoMovieProductionVideoProbe
  | IAutoMovieProductionAudioProbe
  | {
      /** Parsed feature delivery with both picture and sound tracks. */
      kind: "feature";
      /** Final video track facts. */
      video: IAutoMovieProductionVideoProbe;
      /** Final audio track facts. */
      audio: IAutoMovieProductionAudioProbe;
    }
  | {
      /** Parsed WebVTT text. */
      kind: "webvtt";
      /** Number of syntactically valid, non-empty cue timing lines. */
      cueCount: number;
      /** Earliest parsed cue start in seconds. */
      firstCueSeconds: number;
      /** Latest parsed cue end in seconds. */
      lastCueSeconds: number;
      /** Canonical cue sequence in delivery order. */
      cues: IAutoMovieProductionWebVttCue[];
      /** Strict UTF-8 canonical WebVTT presentation. */
      text: string;
    }
  | {
      /** Parsed deterministic sound evidence JSON. */
      kind: "sound-evidence";
      /** Complete evidence bound to the current plan, PCM analysis, and audio bytes. */
      evidence: IAutoMovieProductionSoundEvidence;
    };

/**
 * One file record independently derived by the renderer-owned receipt gate.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `IAutoMovieProductionRenderReceiptFile` as the portable data boundary for the motion external adoption receipt requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `IAutoMovieProductionRenderReceiptFile` for the performance motion external adoption receipt system contract.
 */
export interface IAutoMovieProductionRenderReceiptFile extends IAutoMovieProductionDeliverableFile {
  /**
   * Deliverable that exclusively owns this path.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `deliverable` as the portable data boundary for the motion external adoption receipt requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `deliverable` for the performance motion external adoption receipt system contract.
   */
  deliverable: string;
  /**
   * Parser-derived media facts.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `probe` as the portable data boundary for the motion external adoption receipt requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `probe` for the performance motion external adoption receipt system contract.
   */
  probe: IAutoMovieProductionMediaProbe;
}

/**
 * Renderer-owned aggregate receipt bound to current output bytes.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `IAutoMovieProductionRenderReceipt` as the portable data boundary for the motion external adoption receipt requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `IAutoMovieProductionRenderReceipt` for the performance motion external adoption receipt system contract.
 */
export interface IAutoMovieProductionRenderReceipt {
  /**
   * Receipt format.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `version` as the portable data boundary for the motion external adoption receipt requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `version` for the performance motion external adoption receipt system contract.
   */
  version: 4;
  /**
   * Exact digest of the active production's tracked render manifest.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `manifestDigest` as the portable data boundary for the motion external adoption receipt requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `manifestDigest` for the performance motion external adoption receipt system contract.
   */
  manifestDigest: AutoMovieContentDigest;
  /** Exact recomputed publication identity carried by the manifest. */
  publicationFingerprint: AutoMovieContentDigest;
  /**
   * Exact byte and media probes in canonical path order.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-adoption-receipt Exposes `files` as the portable data boundary for the motion external adoption receipt requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `files` for the performance motion external adoption receipt system contract.
   */
  files: IAutoMovieProductionRenderReceiptFile[];
}

/**
 * Deterministic pure helpers exposed to a shot source builder.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieSourceOracle` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieSourceOracle` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieSourceOracle {
  /**
   * Euclidean distance between two points.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `distance` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `distance` for the spec authoring source derivation state system contract.
   */
  distance(
    left: { x: number; y: number; z: number },
    right: { x: number; y: number; z: number },
  ): number;
  /**
   * Height of the first matching world surface, or zero.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `groundHeight` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `groundHeight` for the spec authoring source derivation state system contract.
   */
  groundHeight(point: { x: number; z: number }): number;
  /**
   * Regenerate one exact compiler-owned formation slot without expanding it.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `formationSlot` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `formationSlot` for the spec authoring source derivation state system contract.
   */
  formationSlot(formation: string, slot: number): IAutoMovieFormationSlot;
  /**
   * Regenerate one exact compiler-owned general instance without expanding it.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `instanceSlot` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `instanceSlot` for the spec authoring source derivation state system contract.
   */
  instanceSlot(instanceSet: string, slot: number): IAutoMovieInstanceSlot;
}

/**
 * One non-negative film time authored as an exact frame or frame-grid second.
 *
 * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `AutoMovieFilmTime` as the portable data boundary for the formation nested frame clock requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `AutoMovieFilmTime` for the performance formation hierarchy membership command system contract.
 */
export type AutoMovieFilmTime =
  | {
      /** Zero-based production frame. */
      frame: number;
    }
  | {
      /** Seconds that must land exactly on the production frame clock. */
      seconds: number;
    };

/**
 * A cut or bounded transition at one side of a video edit.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieFilmTransition` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieFilmTransition` for the asset spec generation provider choice system contract.
 */
export type IAutoMovieFilmTransition =
  | {
      /** Zero-duration hard cut. */
      kind: "cut";
    }
  | {
      /** Cross-shot overlap using declared head and tail handles. */
      kind: "dissolve";
      /** Exact overlap duration. */
      duration: AutoMovieFilmTime;
    }
  | {
      /** In-segment fade without cross-shot overlap. */
      kind: "fade";
      /** Exact fade duration. */
      duration: AutoMovieFilmTime;
    };

/**
 * One source-shot placement on the finished-film video track.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieVideoEdit` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieVideoEdit` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieVideoEdit {
  /**
   * Current compiled shot id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `shot` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `shot` for the spec authoring source derivation state system contract.
   */
  shot: string;
  /**
   * Inclusive source frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `sourceIn` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `sourceIn` for the spec authoring source derivation state system contract.
   */
  sourceIn: AutoMovieFilmTime;
  /**
   * Exclusive source frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `sourceOut` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `sourceOut` for the spec authoring source derivation state system contract.
   */
  sourceOut: AutoMovieFilmTime;
  /**
   * Film-global inclusive start frame.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `start` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `start` for the spec authoring source derivation state system contract.
   */
  start: AutoMovieFilmTime;
  /**
   * Available transition material at each side of this placement.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `handles` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `handles` for the spec authoring source derivation state system contract.
   */
  handles: {
    /** Available incoming frames. */
    head: AutoMovieFilmTime;
    /** Available outgoing frames. */
    tail: AutoMovieFilmTime;
  };
  /**
   * Transition entering this placement.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `transitionIn` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `transitionIn` for the spec authoring source derivation state system contract.
   */
  transitionIn: IAutoMovieFilmTransition;
  /**
   * Transition leaving this placement.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `transitionOut` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `transitionOut` for the spec authoring source derivation state system contract.
   */
  transitionOut: IAutoMovieFilmTransition;
}

/**
 * One declared audio asset placement.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieAudioCue` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieAudioCue` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieAudioCue {
  /**
   * Stable cue id.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `id` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `id` for the asset spec generation provider choice system contract.
   */
  id: string;
  /**
   * Project-relative declared render-content asset.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `asset` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `asset` for the asset spec generation provider choice system contract.
   */
  asset: string;
  /**
   * Declared source duration used for bounded trim validation.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `sourceDuration` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `sourceDuration` for the asset spec generation provider choice system contract.
   */
  sourceDuration: AutoMovieFilmTime;
  /**
   * Source offset inside the asset.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `sourceOffset` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `sourceOffset` for the asset spec generation provider choice system contract.
   */
  sourceOffset: AutoMovieFilmTime;
  /**
   * Film-global cue start.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `start` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `start` for the asset spec generation provider choice system contract.
   */
  start: AutoMovieFilmTime;
  /**
   * Cue duration.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `duration` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `duration` for the asset spec generation provider choice system contract.
   */
  duration: AutoMovieFilmTime;
  /**
   * Linear gain from silence through a bounded boost.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `gain` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `gain` for the asset spec generation provider choice system contract.
   */
  gain: number;
  /**
   * Fade-in duration.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `fadeIn` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `fadeIn` for the asset spec generation provider choice system contract.
   */
  fadeIn: AutoMovieFilmTime;
  /**
   * Fade-out duration.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `fadeOut` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `fadeOut` for the asset spec generation provider choice system contract.
   */
  fadeOut: AutoMovieFilmTime;
  /**
   * Deterministic destination bus.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `bus` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `bus` for the asset spec generation provider choice system contract.
   */
  bus: "dialogue" | "music" | "effects" | "ambience";
}

/**
 * One plain-text caption cue from which renderers may derive WebVTT.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `IAutoMovieCaptionCue` as the portable data boundary for the delivery caption readability profile requirement.
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-text-language Preserves authored line presentation through measurement and selectable delivery.
 * @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-language-selection Carries one retained RFC 5646 display form with case-insensitive identity.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `IAutoMovieCaptionCue` for the spec delivery caption readability profile system contract.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-localization Applies one language identity across cue validation, lookup, and serialization.
 */
export interface IAutoMovieCaptionCue {
  /**
   * Stable cue id.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `id` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `id` for the spec delivery caption readability profile system contract.
   */
  id: string;
  /**
   * Non-blank plain text whose authored CR, LF, and CRLF line presentation is
   * preserved canonically by readability and selectable delivery.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `text` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-cue-text-language Keeps legal tab and authored line boundaries while prohibited controls are handled explicitly.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `text` for the spec delivery caption readability profile system contract.
   */
  text: string;
  /**
   * RFC 5646 well-formed language tag in retained display form.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `language` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence requirements/delivery-and-accessibility/localization-and-language-versions.md#delivery-language-selection Keeps case-insensitive language identity separate from authored display spelling.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `language` for the spec delivery caption readability profile system contract.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-localization Uses RFC 5646 syntax without registry canonicalization or inference.
   */
  language: string;
  /**
   * Optional speaker id.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `speaker` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `speaker` for the spec delivery caption readability profile system contract.
   */
  speaker?: string;
  /**
   * Film-global inclusive start.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `start` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `start` for the spec delivery caption readability profile system contract.
   */
  start: AutoMovieFilmTime;
  /**
   * Film-global exclusive end.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Exposes `end` as the portable data boundary for the delivery caption readability profile requirement.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Types `end` for the spec delivery caption readability profile system contract.
   */
  end: AutoMovieFilmTime;
}

/**
 * Effective readability measurements for one compiled caption cue.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports grapheme, line, duration, and gap facts even when no profile can judge them.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-measurement Carries actual measurement identity separately from the optional verdict.
 * @author Samchon
 */
export interface IAutoMovieCaptionReadabilityMeasurement {
  /**
   * Exact caption cue id.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Joins measurements to one authored cue.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Keeps per-cue outcomes traceable.
   */
  cue: string;
  /**
   * Canonical cue language.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Selects the production's language profile when present.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Separates language-specific measurement populations.
   */
  language: string;
  /**
   * Complete identity of the runtime that produced these measurements.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports the actual segmentation basis even when no profile can judge it.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-measurement Keeps requested and executed segmentation identities distinct.
   */
  segmentation: IAutoMovieCaptionGraphemeSegmentationIdentity;
  /**
   * Displayed grapheme-cluster count after markup removal.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports the effective text count used for rate checks.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Measures displayed clusters with the declared segmentation revision.
   */
  graphemes: number;
  /**
   * Authored line count.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports the cue's effective line population.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the line-count comparison input.
   */
  lines: number;
  /**
   * Largest displayed grapheme count among authored lines.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports the longest effective line.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the line-length comparison input.
   */
  maxLineGraphemes: number;
  /**
   * Exact cue duration on the production frame clock.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Measures duration on declared production time.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the frame-exact duration comparison input.
   */
  durationFrames: number;
  /**
   * Gap from the preceding cue in the same language, or null for the first.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports an inter-cue gap only when one exists.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Supplies the same-language gap comparison input.
   */
  gapBeforeFrames: number | null;
  /**
   * Displayed graphemes per second on the production frame clock.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports effective reading rate independent of a verdict.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Derives rate from displayed clusters and frame-exact duration.
   */
  graphemesPerSecond: number;
}

/**
 * Profile-backed verdict or explicit measure-only outcome for one caption cue.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Keeps missing profile separate from a passing verdict.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-measurement Evaluates only an exact requested-to-actual identity match and otherwise records `not-run`.
 */
export type IAutoMovieCaptionReadabilityOutcome =
  | {
      /** Profile-backed evaluation completed. */
      status: "evaluated";
      /** Exact production profile id. */
      profile: string;
      /** Complete segmentation identity selected by the production profile. */
      segmentation: IAutoMovieCaptionGraphemeSegmentationIdentity;
      /** Whether every profile-declared boundary passed. */
      passed: boolean;
      /** Stable names of boundaries exceeded by this cue. */
      breaches: Array<
        | "graphemes-per-second"
        | "lines-per-cue"
        | "graphemes-per-line"
        | "duration-frames"
        | "gap-frames"
      >;
    }
  | {
      /** No production profile judged the measurement. */
      status: "not-run";
      /** Requested segmentation identity, or null when no profile was declared. */
      segmentation: IAutoMovieCaptionGraphemeSegmentationIdentity | null;
      /** Exact reason a verdict was not computed. */
      reason:
        | "caption-readability-profile-not-declared"
        | "caption-grapheme-segmentation-unsupported";
    };

/**
 * Readability report kept outside the byte-stable compiled edit.
 *
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports metrics without modifying legacy caption output when no profile exists.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-measurement Joins each actual identity and measurement to its evaluated or not-run outcome.
 * @author Samchon
 */
export interface IAutoMovieCaptionReadabilityReport {
  /**
   * Caption-readability report schema.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Versions the measurement and outcome record.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Makes report interpretation explicit.
   */
  version: 2;
  /**
   * Cue reports in canonical film and cue order.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports every measured cue in deterministic order.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Joins measurements and outcomes without modifying the edit.
   */
  cues: Array<{
    /** Effective cue measurements. */
    measurement: IAutoMovieCaptionReadabilityMeasurement;
    /** Profile-backed verdict or explicit measure-only outcome. */
    outcome: IAutoMovieCaptionReadabilityOutcome;
  }>;
}

/**
 * One bounded reference to a registered deterministic world effect zone.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Exposes `IAutoMovieEffectCue` as the portable data boundary for the effects authoring control requirement.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Types `IAutoMovieEffectCue` for the effect tier state machine system contract.
 */
export interface IAutoMovieEffectCue {
  /**
   * Stable cue id.
   *
   * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Exposes `id` as the portable data boundary for the effects authoring control requirement.
   * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Types `id` for the effect tier state machine system contract.
   */
  id: string;
  /**
   * Supported compiler-owned recipe family.
   *
   * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Exposes `recipe` as the portable data boundary for the effects authoring control requirement.
   * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Types `recipe` for the effect tier state machine system contract.
   */
  recipe: "world-zone";
  /**
   * Existing world effect-zone id.
   *
   * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Exposes `zone` as the portable data boundary for the effects authoring control requirement.
   * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Types `zone` for the effect tier state machine system contract.
   */
  zone: string;
  /**
   * Film-global cue start.
   *
   * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Exposes `start` as the portable data boundary for the effects authoring control requirement.
   * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Types `start` for the effect tier state machine system contract.
   */
  start: AutoMovieFilmTime;
  /**
   * Cue duration.
   *
   * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Exposes `duration` as the portable data boundary for the effects authoring control requirement.
   * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Types `duration` for the effect tier state machine system contract.
   */
  duration: AutoMovieFilmTime;
  /**
   * Bounded normalized strength.
   *
   * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Exposes `intensity` as the portable data boundary for the effects authoring control requirement.
   * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Types `intensity` for the effect tier state machine system contract.
   */
  intensity: number;
}

/**
 * Explicit narrative-shot omission disposition.
 *
 * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `IAutoMovieFilmOmission` as the portable data boundary for the agent declared omission requirement.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-omission-failure Types `IAutoMovieFilmOmission` for the spec authoring partial omission failure system contract.
 */
export interface IAutoMovieFilmOmission {
  /**
   * Current shot contract intentionally absent from the edit.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `shot` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-omission-failure Types `shot` for the spec authoring partial omission failure system contract.
   */
  shot: string;
  /**
   * Auditable non-blank reason.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `reason` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-omission-failure Types `reason` for the spec authoring partial omission failure system contract.
   */
  reason: string;
}

/**
 * Coding-agent-authored finished-film edit before frame normalization.
 *
 * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `IAutoMovieFilmEdit` as the portable data boundary for the agent declared omission requirement.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `IAutoMovieFilmEdit` for the spec authoring partial target input system contract.
 */
export interface IAutoMovieFilmEdit {
  /**
   * Stable film id, equal to production id.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `id` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `id` for the spec authoring partial target input system contract.
   */
  id: string;
  /**
   * Explicit accounting for intentionally unused shot contracts.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `omissions` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `omissions` for the spec authoring partial target input system contract.
   */
  omissions: IAutoMovieFilmOmission[];
  /**
   * Narrow deterministic edit tracks.
   *
   * @evidence requirements/agent-authoring/partial-work.md#agent-declared-omission Exposes `tracks` as the portable data boundary for the agent declared omission requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-target-input Types `tracks` for the spec authoring partial target input system contract.
   */
  tracks: {
    /** Ordered source-shot placements. */
    video: IAutoMovieVideoEdit[];
    /** Ordered audio cues. */
    audio: IAutoMovieAudioCue[];
    /** Ordered caption cues. */
    captions: IAutoMovieCaptionCue[];
    /** Ordered supported-effect cues. */
    effects: IAutoMovieEffectCue[];
  };
}

/**
 * Frozen design and ownership facts available to the film source builder.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieFilmBuildContext` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieFilmBuildContext` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieFilmBuildContext {
  /**
   * Current production design.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `production` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `production` for the spec authoring source derivation state system contract.
   */
  production: IAutoMovieProductionDesign;
  /**
   * Current shot contracts keyed by id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `shots` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `shots` for the spec authoring source derivation state system contract.
   */
  shots: Readonly<Record<string, IAutoMovieShotContract>>;
  /**
   * Declared, present render-content paths.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `assets` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `assets` for the spec authoring source derivation state system contract.
   */
  assets: readonly string[];
  /**
   * Current verified deterministic artifacts keyed by canonical output path.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Publishes only artifacts whose live basis and output passed the pre-execution gate.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Carries verified text or base64 bytes through the JSON source boundary.
   */
  derivedArtifacts: Readonly<Record<string, IAutoMovieDerivedArtifactSource>>;
  /**
   * Current registered deterministic effect zones.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `effectZones` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `effectZones` for the spec authoring source derivation state system contract.
   */
  effectZones: Readonly<IAutoMovieWorldDesign["effectZones"]>;
}

/**
 * Coding-agent-owned deterministic film module export.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieFilmSource` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieFilmSource` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieFilmSource {
  /**
   * Build one finished-film edit from frozen compiler context.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `build` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `build` for the spec authoring source derivation state system contract.
   */
  build(context: IAutoMovieFilmBuildContext): IAutoMovieFilmEdit;
}

/**
 * Compiler-owned envelope preserving the exact validated authored edit.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `IAutoMovieCompiledFilmEdit` as the portable data boundary for the agent narrowest valid check requirement.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `IAutoMovieCompiledFilmEdit` for the spec authoring partial verification invariant system contract.
 */
export interface IAutoMovieCompiledFilmEdit {
  /**
   * Generated edit format.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `version` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `version` for the spec authoring partial verification invariant system contract.
   */
  version: 1;
  /**
   * Compiler protocol that validated the edit.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `compiler` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `compiler` for the spec authoring partial verification invariant system contract.
   */
  compiler: string;
  /**
   * Exact aggregate compile input.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `inputFingerprint` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `inputFingerprint` for the spec authoring partial verification invariant system contract.
   */
  inputFingerprint: AutoMovieContentDigest;
  /**
   * Film source provenance.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `source` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `source` for the spec authoring partial verification invariant system contract.
   */
  source: {
    /** Project-relative module path. */
    path: string;
    /** Named build export. */
    export: string;
    /** Digest of normalized TypeScript source. */
    digest: AutoMovieContentDigest;
  };
  /**
   * Strict authored edit returned by the deterministic sandbox.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Exposes `edit` as the portable data boundary for the agent narrowest valid check requirement.
   * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-verification-invariant Types `edit` for the spec authoring partial verification invariant system contract.
   */
  edit: IAutoMovieFilmEdit;
}

/**
 * One frame-normalized video segment in the canonical film timeline.
 *
 * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `IAutoMovieFilmTimelineSegment` as the portable data boundary for the formation nested frame clock requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `IAutoMovieFilmTimelineSegment` for the performance formation hierarchy membership command system contract.
 */
export interface IAutoMovieFilmTimelineSegment {
  /**
   * Current compiled shot id.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `shot` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `shot` for the performance formation hierarchy membership command system contract.
   */
  shot: string;
  /**
   * Inclusive source frame.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `sourceInFrame` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `sourceInFrame` for the performance formation hierarchy membership command system contract.
   */
  sourceInFrame: number;
  /**
   * Exclusive source frame.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `sourceOutFrame` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `sourceOutFrame` for the performance formation hierarchy membership command system contract.
   */
  sourceOutFrame: number;
  /**
   * Film-global inclusive start frame.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `startFrame` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `startFrame` for the performance formation hierarchy membership command system contract.
   */
  startFrame: number;
  /**
   * Film-global exclusive end frame.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `endFrame` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `endFrame` for the performance formation hierarchy membership command system contract.
   */
  endFrame: number;
  /**
   * Available incoming handle frames.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `headHandleFrames` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `headHandleFrames` for the performance formation hierarchy membership command system contract.
   */
  headHandleFrames: number;
  /**
   * Available outgoing handle frames.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `tailHandleFrames` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `tailHandleFrames` for the performance formation hierarchy membership command system contract.
   */
  tailHandleFrames: number;
  /**
   * Normalized incoming transition.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `transitionIn` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `transitionIn` for the performance formation hierarchy membership command system contract.
   */
  transitionIn:
    | { kind: "cut" }
    | { kind: "dissolve" | "fade"; durationFrames: number };
  /**
   * Normalized outgoing transition.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-nested-frame-clock Exposes `transitionOut` as the portable data boundary for the formation nested frame clock requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `transitionOut` for the performance formation hierarchy membership command system contract.
   */
  transitionOut:
    | { kind: "cut" }
    | { kind: "dissolve" | "fade"; durationFrames: number };
}

/**
 * Canonical global timeline consumed by review, oracle and render layers.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `IAutoMovieFilmTimeline` as the portable data boundary for the story time state review scope requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `IAutoMovieFilmTimeline` for the narrative intent temporal state handoff system contract.
 */
export interface IAutoMovieFilmTimeline {
  /**
   * Generated timeline format.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `version` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `version` for the narrative intent temporal state handoff system contract.
   */
  version: 1;
  /**
   * Compiler protocol that derived the timeline.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `compiler` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `compiler` for the narrative intent temporal state handoff system contract.
   */
  compiler: string;
  /**
   * Exact aggregate compile input.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `inputFingerprint` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `inputFingerprint` for the narrative intent temporal state handoff system contract.
   */
  inputFingerprint: AutoMovieContentDigest;
  /**
   * Digest of normalized `src/film.ts` bytes.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `sourceDigest` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `sourceDigest` for the narrative intent temporal state handoff system contract.
   */
  sourceDigest: AutoMovieContentDigest;
  /**
   * Stable finished-film id.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `id` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `id` for the narrative intent temporal state handoff system contract.
   */
  id: string;
  /**
   * Production frame rate.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `fps` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `fps` for the narrative intent temporal state handoff system contract.
   */
  fps: number;
  /**
   * Exact reduced production frame rate.
   *
   * Integer legacy timelines may omit this field and are interpreted as
   * `fps/1`; fractional timelines must preserve their explicit identity.
   *
   * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-rational-time-ranges Preserves the compiler-owned frame clock without a decimal reconstruction.
   * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Supplies the canonical rational clock to caption, sound, and delivery consumers.
   */
  frameRate?: IAutoMovieProductionFrameRate;
  /**
   * Exact target and derived timeline duration.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `totalFrames` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `totalFrames` for the narrative intent temporal state handoff system contract.
   */
  totalFrames: number;
  /**
   * Ordered global-to-shot mapping.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `segments` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `segments` for the narrative intent temporal state handoff system contract.
   */
  segments: IAutoMovieFilmTimelineSegment[];
  /**
   * Explicitly omitted current narrative shots.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `omissions` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `omissions` for the narrative intent temporal state handoff system contract.
   */
  omissions: IAutoMovieFilmOmission[];
  /**
   * Frame-normalized non-video tracks.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `tracks` as the portable data boundary for the story time state review scope requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `tracks` for the narrative intent temporal state handoff system contract.
   */
  tracks: {
    /** Ordered audio placements. */
    audio: Array<{
      id: string;
      asset: string;
      sourceDurationFrames: number;
      sourceOffsetFrame: number;
      startFrame: number;
      durationFrames: number;
      gain: number;
      fadeInFrames: number;
      fadeOutFrames: number;
      bus: IAutoMovieAudioCue["bus"];
    }>;
    /** Ordered caption placements. */
    captions: Array<{
      id: string;
      text: string;
      language: string;
      speaker?: string;
      startFrame: number;
      endFrame: number;
    }>;
    /** Ordered effect placements. */
    effects: Array<{
      id: string;
      recipe: IAutoMovieEffectCue["recipe"];
      zone: string;
      startFrame: number;
      durationFrames: number;
      intensity: number;
    }>;
  };
}

/**
 * Frozen input available to a coding-agent-owned shot source builder.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieShotBuildContext` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieShotBuildContext` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieShotBuildContext {
  /**
   * Current shot contract.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `contract` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `contract` for the spec authoring source derivation state system contract.
   */
  contract: IAutoMovieShotContract;
  /**
   * Current model recipes keyed by id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `models` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `models` for the spec authoring source derivation state system contract.
   */
  models: Readonly<Record<string, IAutoMovieModelRecipe>>;
  /**
   * Current verified deterministic artifacts keyed by canonical output path.
   *
   * @evidence requirements/agent-authoring/deterministic-precomputation.md#agent-precomputed-compile-refusal Publishes only artifacts whose live basis and output passed the pre-execution gate.
   * @evidence specifications/authoring-and-authority/deterministic-precomputed-artifacts.md#spec-authoring-precomputed-freshness Carries verified text or base64 bytes through the JSON source boundary.
   */
  derivedArtifacts: Readonly<Record<string, IAutoMovieDerivedArtifactSource>>;
  /**
   * The production's story-clock light sources, when it declares any.
   *
   * The source reads what the production is lit by at this shot's story moment
   * — its contract carries the pin — and states its own local light on top
   * through {@link IAutoMovieProductionShotProgram.lightMotions}. Absent when
   * the production declares no lighting, which is exactly the context a source
   * saw before the field existed.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `lighting` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `lighting` for the spec authoring source derivation state system contract.
   */
  lighting?: IAutoMovieProductionLighting;
  /**
   * Current world design.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `world` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `world` for the spec authoring source derivation state system contract.
   */
  world: IAutoMovieWorldDesign;
  /**
   * Current formations keyed by id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `formations` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `formations` for the spec authoring source derivation state system contract.
   */
  formations: Readonly<Record<string, IAutoMovieFormationDesign>>;
  /**
   * Compiler-generated primitive runtime models keyed by recipe id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `runtimeModels` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `runtimeModels` for the spec authoring source derivation state system contract.
   */
  runtimeModels: Readonly<Record<string, IAutoMovieModel>>;
  /**
   * Compact compiler-derived formation runtimes keyed by formation id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `formationRuntime` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `formationRuntime` for the spec authoring source derivation state system contract.
   */
  formationRuntime: Readonly<Record<string, IAutoMovieCompiledFormation>>;
  /**
   * Compact compiler-derived general instance runtimes keyed by set id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `instanceSetRuntime` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `instanceSetRuntime` for the spec authoring source derivation state system contract.
   */
  instanceSetRuntime: Readonly<Record<string, IAutoMovieCompiledInstanceSet>>;
  /**
   * Deterministic geometry helpers.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `engine` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `engine` for the spec authoring source derivation state system contract.
   */
  engine: IAutoMovieSourceOracle;
}

/**
 * One deterministic formation member materialized from compact design.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `IAutoMovieFormationSlot` as the portable data boundary for the formation slot identity requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `IAutoMovieFormationSlot` for the performance formation layout slot assignment system contract.
 */
export interface IAutoMovieFormationSlot {
  /**
   * Zero-based deterministic slot index.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `slot` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `slot` for the performance formation layout slot assignment system contract.
   */
  slot: number;
  /**
   * Compiler-owned scene-node id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `node` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `node` for the performance formation layout slot assignment system contract.
   */
  node: string;
  /**
   * Named hero actor at this slot, or null.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `actor` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `actor` for the performance formation layout slot assignment system contract.
   */
  actor: string | null;
  /**
   * Runtime model recipe id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `modelRecipe` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `modelRecipe` for the performance formation layout slot assignment system contract.
   */
  modelRecipe: string;
  /**
   * Compiler-derived world position in meters.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `position` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `position` for the performance formation layout slot assignment system contract.
   */
  position: IAutoMovieVector3;
  /**
   * Compiler-derived world-space heading in degrees.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `facingDeg` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `facingDeg` for the performance formation layout slot assignment system contract.
   */
  facingDeg: number;
  /**
   * Stable normalized phase used by bounded instance motion.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `motionPhase` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `motionPhase` for the performance formation layout slot assignment system contract.
   */
  motionPhase: number;
}

/**
 * Axis-aligned world-space bounds of a compact formation range.
 *
 * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `IAutoMovieFormationBounds` as the portable data boundary for the formation membership requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `IAutoMovieFormationBounds` for the performance formation hierarchy membership command system contract.
 */
export interface IAutoMovieFormationBounds {
  /**
   * Minimum world-space corner.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `min` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `min` for the performance formation hierarchy membership command system contract.
   */
  min: IAutoMovieVector3;
  /**
   * Maximum world-space corner.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `max` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `max` for the performance formation hierarchy membership command system contract.
   */
  max: IAutoMovieVector3;
}

/**
 * One bounded slot range regenerated independently by viewer workers.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `IAutoMovieFormationChunk` as the portable data boundary for the formation slot identity requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `IAutoMovieFormationChunk` for the performance formation layout slot assignment system contract.
 */
export interface IAutoMovieFormationChunk {
  /**
   * Zero-based stable chunk index.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `index` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `index` for the performance formation layout slot assignment system contract.
   */
  index: number;
  /**
   * Inclusive first slot.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `start` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `start` for the performance formation layout slot assignment system contract.
   */
  start: number;
  /**
   * Number of slots in this chunk.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `count` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `count` for the performance formation layout slot assignment system contract.
   */
  count: number;
  /**
   * Anonymous slots rendered through instancing after hero exclusion.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `anonymousCount` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `anonymousCount` for the performance formation layout slot assignment system contract.
   */
  anonymousCount: number;
  /**
   * Exact world-space range bounds.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `bounds` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `bounds` for the performance formation layout slot assignment system contract.
   */
  bounds: IAutoMovieFormationBounds;
  /**
   * Exact arithmetic centroid of the range.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `centroid` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `centroid` for the performance formation layout slot assignment system contract.
   */
  centroid: IAutoMovieVector3;
}

/**
 * One slot promoted out of anonymous batches into an explicit scene node.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `IAutoMovieCompiledFormationHero` as the portable data boundary for the formation slot identity requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `IAutoMovieCompiledFormationHero` for the performance formation layout slot assignment system contract.
 */
export interface IAutoMovieCompiledFormationHero {
  /**
   * Exact promoted slot.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `slot` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `slot` for the performance formation layout slot assignment system contract.
   */
  slot: number;
  /**
   * Named explicit scene-node id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `actor` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `actor` for the performance formation layout slot assignment system contract.
   */
  actor: string;
  /**
   * Compiler-owned base transform before source-authored performance.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `transform` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `transform` for the performance formation layout slot assignment system contract.
   */
  transform: IAutoMovieTransform;
}

/**
 * One camera-selected runtime representation for anonymous formation slots.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters Exposes `IAutoMovieCompiledFormationLod` as the portable data boundary for the formation layout selection parameters requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `IAutoMovieCompiledFormationLod` for the performance formation layout slot assignment system contract.
 */
export interface IAutoMovieCompiledFormationLod {
  /**
   * Semantic near-to-far tier.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters Exposes `tier` as the portable data boundary for the formation layout selection parameters requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `tier` for the performance formation layout slot assignment system contract.
   */
  tier: "hero" | "near" | "far";
  /**
   * Positive maximum distance, or null only for the final tier.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters Exposes `maxDistance` as the portable data boundary for the formation layout selection parameters requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `maxDistance` for the performance formation layout slot assignment system contract.
   */
  maxDistance: number | null;
  /**
   * Design recipe id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters Exposes `recipe` as the portable data boundary for the formation layout selection parameters requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `recipe` for the performance formation layout slot assignment system contract.
   */
  recipe: string;
  /**
   * Exact current recipe digest, including geometry and palette parameters.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters Exposes `recipeDigest` as the portable data boundary for the formation layout selection parameters requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `recipeDigest` for the performance formation layout slot assignment system contract.
   */
  recipeDigest: AutoMovieContentDigest;
  /**
   * Compiler-owned runtime model id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-layout-selection-parameters Exposes `model` as the portable data boundary for the formation layout selection parameters requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `model` for the performance formation layout slot assignment system contract.
   */
  model: string;
}

/**
 * Compact generated formation runtime; it never stores every anonymous slot.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `IAutoMovieCompiledFormation` as the portable data boundary for the formation slot identity requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `IAutoMovieCompiledFormation` for the performance formation layout slot assignment system contract.
 */
export interface IAutoMovieCompiledFormation {
  /**
   * Generated formation format.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `version` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `version` for the performance formation layout slot assignment system contract.
   */
  version: 1;
  /**
   * Stable formation design id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `id` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `id` for the performance formation layout slot assignment system contract.
   */
  id: string;
  /**
   * Exact designed slot count.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `count` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `count` for the performance formation layout slot assignment system contract.
   */
  count: number;
  /**
   * Count remaining in instance batches after hero exclusion.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `anonymousCount` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `anonymousCount` for the performance formation layout slot assignment system contract.
   */
  anonymousCount: number;
  /**
   * Base design recipe.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `modelRecipe` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `modelRecipe` for the performance formation layout slot assignment system contract.
   */
  modelRecipe: string;
  /**
   * Exact compact layout algorithm and parameters.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `layout` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `layout` for the performance formation layout slot assignment system contract.
   */
  layout: IAutoMovieFormationDesign["layout"];
  /**
   * World-space origin.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `anchor` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `anchor` for the performance formation layout slot assignment system contract.
   */
  anchor: IAutoMovieVector3;
  /**
   * World terrain under this formation, snapshotted at compile time.
   *
   * A member's height is the ground under that member, so the ground has to
   * travel with the formation: the viewer and the source oracle regenerate slot
   * heights from this snapshot without consulting mutable world design, exactly
   * as a compiled instance set carries the route it follows. Only the surfaces
   * whose extent reaches the formation's own footprint are kept, and their
   * declared order is preserved because the first surface containing a point is
   * the one a member stands on. Empty when the world declared no terrain under
   * the unit, which places every member at the anchor's height.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `ground` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `ground` for the performance formation layout slot assignment system contract.
   */
  ground: IAutoMovieWorldDesign["surfaces"];
  /**
   * World-space base heading in degrees.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `facingDeg` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `facingDeg` for the performance formation layout slot assignment system contract.
   */
  facingDeg: number;
  /**
   * Full safe-integer design seed.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `seed` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `seed` for the performance formation layout slot assignment system contract.
   */
  seed: number;
  /**
   * Exact bounds of all slots.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `bounds` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `bounds` for the performance formation layout slot assignment system contract.
   */
  bounds: IAutoMovieFormationBounds;
  /**
   * Exact arithmetic centroid of all slots.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `centroid` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `centroid` for the performance formation layout slot assignment system contract.
   */
  centroid: IAutoMovieVector3;
  /**
   * Compiler-derived representative member radius used by LOD projection.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `projectionRadius` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `projectionRadius` for the performance formation layout slot assignment system contract.
   */
  projectionRadius: number;
  /**
   * Bounded independently regenerable slot ranges.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `chunks` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `chunks` for the performance formation layout slot assignment system contract.
   */
  chunks: IAutoMovieFormationChunk[];
  /**
   * Explicit hero promotions, ordered by slot.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `heroes` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `heroes` for the performance formation layout slot assignment system contract.
   */
  heroes: IAutoMovieCompiledFormationHero[];
  /**
   * Ordered automatic LOD representations.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `lod` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `lod` for the performance formation layout slot assignment system contract.
   */
  lod: IAutoMovieCompiledFormationLod[];
  /**
   * Deterministic per-slot phase generator contract.
   *
   * Phase is where in its cycle one member stands, never how fast that cycle
   * runs: cadence follows the ground a member's own unit covers under its cues,
   * so a compiled cycle length would be a second answer to a question the cue
   * already answers, and a seeded one would be unrelated to what the unit
   * does.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `phase` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `phase` for the performance formation layout slot assignment system contract.
   */
  phase: {
    /** Domain-separated safe-integer seed. */
    seed: number;
  };
  /**
   * Digest of every field above except this digest.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `digest` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `digest` for the performance formation layout slot assignment system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * One exactly regenerated member of a non-formation instance set.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `IAutoMovieInstanceSlot` as the portable data boundary for the formation slot identity requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `IAutoMovieInstanceSlot` for the performance formation layout slot assignment system contract.
 */
export interface IAutoMovieInstanceSlot {
  /**
   * Zero-based deterministic slot index.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `slot` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `slot` for the performance formation layout slot assignment system contract.
   */
  slot: number;
  /**
   * Compiler-owned stable instance id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `node` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `node` for the performance formation layout slot assignment system contract.
   */
  node: string;
  /**
   * Runtime model recipe id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `modelRecipe` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `modelRecipe` for the performance formation layout slot assignment system contract.
   */
  modelRecipe: string;
  /**
   * Selected prototype id; omitted for a legacy single-prototype set.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `prototype` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `prototype` for the performance formation layout slot assignment system contract.
   */
  prototype?: string;
  /**
   * Compiler-derived world position in meters.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `position` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `position` for the performance formation layout slot assignment system contract.
   */
  position: IAutoMovieVector3;
  /**
   * Compiler-derived world-space heading in degrees.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `facingDeg` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `facingDeg` for the performance formation layout slot assignment system contract.
   */
  facingDeg: number;
  /**
   * Positive uniform scale.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `scale` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `scale` for the performance formation layout slot assignment system contract.
   */
  scale: number;
  /**
   * Exact full rotation for an enhanced set.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `rotation` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `rotation` for the performance formation layout slot assignment system contract.
   */
  rotation?: IAutoMovieQuaternion;
  /**
   * Exact non-uniform scale for an enhanced set.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `scale3` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `scale3` for the performance formation layout slot assignment system contract.
   */
  scale3?: IAutoMovieVector3;
  /**
   * Explicit or seeded visibility for an enhanced set.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `visible` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `visible` for the performance formation layout slot assignment system contract.
   */
  visible?: boolean;
  /**
   * Selected exact sRGB palette value.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `palette` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `palette` for the performance formation layout slot assignment system contract.
   */
  palette: string;
  /**
   * Seed-derived numeric traits keyed by declared name.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `traits` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `traits` for the performance formation layout slot assignment system contract.
   */
  traits: Record<string, number>;
}

/**
 * One independently regenerable range of a general instance set.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieInstanceChunk` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieInstanceChunk` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieInstanceChunk {
  /**
   * Zero-based stable chunk index.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `index` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `index` for the asset spec generation provider choice system contract.
   */
  index: number;
  /**
   * Inclusive first slot.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `start` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `start` for the asset spec generation provider choice system contract.
   */
  start: number;
  /**
   * Number of slots in this chunk.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `count` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `count` for the asset spec generation provider choice system contract.
   */
  count: number;
  /**
   * Exact world-space range bounds.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `bounds` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `bounds` for the asset spec generation provider choice system contract.
   */
  bounds: IAutoMovieFormationBounds;
  /**
   * Exact arithmetic centroid of the range.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `centroid` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `centroid` for the asset spec generation provider choice system contract.
   */
  centroid: IAutoMovieVector3;
}

/**
 * Compact generated runtime for a non-formation instance set.
 *
 * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `IAutoMovieCompiledInstanceSet` as the portable data boundary for the formation membership requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `IAutoMovieCompiledInstanceSet` for the performance formation hierarchy membership command system contract.
 */
export interface IAutoMovieCompiledInstanceSet {
  /**
   * Generated instance-set format.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `version` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `version` for the performance formation hierarchy membership command system contract.
   */
  version: 1;
  /**
   * Stable world-design id.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `id` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `id` for the performance formation hierarchy membership command system contract.
   */
  id: string;
  /**
   * Exact designed slot count.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `count` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `count` for the performance formation hierarchy membership command system contract.
   */
  count: number;
  /**
   * Base design recipe.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `modelRecipe` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `modelRecipe` for the performance formation hierarchy membership command system contract.
   */
  modelRecipe: string;
  /**
   * Resolved prototype runtimes; omitted for a legacy single-prototype set.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `prototypes` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `prototypes` for the performance formation hierarchy membership command system contract.
   */
  prototypes?: IAutoMovieCompiledInstancePrototype[];
  /**
   * Exact compact placement law.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `layout` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `layout` for the performance formation hierarchy membership command system contract.
   */
  layout: IAutoMovieInstanceSetDesign["layout"];
  /**
   * Resolved route geometry for `along-route`, or null for local layouts.
   *
   * The viewer and source oracle regenerate slots from this snapshot without
   * consulting mutable world design.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `route` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `route` for the performance formation hierarchy membership command system contract.
   */
  route: IAutoMovieWorldDesign["routes"][number] | null;
  /**
   * World-space origin for local layouts.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `anchor` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `anchor` for the performance formation hierarchy membership command system contract.
   */
  anchor: IAutoMovieVector3;
  /**
   * World-space base heading in degrees.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `facingDeg` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `facingDeg` for the performance formation hierarchy membership command system contract.
   */
  facingDeg: number;
  /**
   * Full safe-integer design seed.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `seed` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `seed` for the performance formation hierarchy membership command system contract.
   */
  seed: number;
  /**
   * Exact seed-derived visual and semantic variation law.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `variation` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `variation` for the performance formation hierarchy membership command system contract.
   */
  variation: IAutoMovieInstanceSetDesign["variation"];
  /**
   * Exact bounds of all generated slots.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `bounds` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `bounds` for the performance formation hierarchy membership command system contract.
   */
  bounds: IAutoMovieFormationBounds;
  /**
   * Exact arithmetic centroid of all generated slots.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `centroid` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `centroid` for the performance formation hierarchy membership command system contract.
   */
  centroid: IAutoMovieVector3;
  /**
   * Compiler-derived representative radius used by viewer culling.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `projectionRadius` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `projectionRadius` for the performance formation hierarchy membership command system contract.
   */
  projectionRadius: number;
  /**
   * Bounded independently regenerable slot ranges.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `chunks` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `chunks` for the performance formation hierarchy membership command system contract.
   */
  chunks: IAutoMovieInstanceChunk[];
  /**
   * Ordered automatic LOD representations.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `lod` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `lod` for the performance formation hierarchy membership command system contract.
   */
  lod: IAutoMovieCompiledFormationLod[];
  /**
   * Digest of every field above except this digest.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `digest` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `digest` for the performance formation hierarchy membership command system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * One compiler-resolved reusable prototype in a general instance set.
 *
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Exposes `IAutoMovieCompiledInstancePrototype` as the portable data boundary for the asset prototype and instance requirement.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Types `IAutoMovieCompiledInstancePrototype` for the asset prototype and instance system contract.
 */
export interface IAutoMovieCompiledInstancePrototype {
  /**
   * Stable source prototype id.
   *
   * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Exposes `id` as the portable data boundary for the asset prototype and instance requirement.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Types `id` for the asset prototype and instance system contract.
   */
  id: string;
  /**
   * Source model recipe.
   *
   * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Exposes `modelRecipe` as the portable data boundary for the asset prototype and instance requirement.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Types `modelRecipe` for the asset prototype and instance system contract.
   */
  modelRecipe: string;
  /**
   * Positive deterministic selection weight.
   *
   * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Exposes `weight` as the portable data boundary for the asset prototype and instance requirement.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Types `weight` for the asset prototype and instance system contract.
   */
  weight: number;
  /**
   * Ordered automatic LOD representations for this prototype.
   *
   * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Exposes `lod` as the portable data boundary for the asset prototype and instance requirement.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Types `lod` for the asset prototype and instance system contract.
   */
  lod: IAutoMovieCompiledFormationLod[];
  /**
   * Conservative source-model radius before per-slot scaling.
   *
   * @evidence requirements/asset-authoring/identity-and-instances.md#asset-prototype-instance Exposes `projectionRadius` as the portable data boundary for the asset prototype and instance requirement.
   * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-prototype-instance Types `projectionRadius` for the asset prototype and instance system contract.
   */
  projectionRadius: number;
}

/**
 * One compact formation-level transform state relative to its designed base.
 *
 * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `IAutoMovieFormationMotionState` as the portable data boundary for the formation membership requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `IAutoMovieFormationMotionState` for the performance formation hierarchy membership command system contract.
 */
export interface IAutoMovieFormationMotionState {
  /**
   * World-space translation added to the designed formation anchor.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `translation` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `translation` for the performance formation hierarchy membership command system contract.
   */
  translation: IAutoMovieVector3;
  /**
   * Heading offset added around the designed anchor, in degrees.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `facingOffsetDeg` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `facingOffsetDeg` for the performance formation hierarchy membership command system contract.
   */
  facingOffsetDeg: number;
  /**
   * Positive lateral and depth scale for bounded density deformation.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `spacingScale` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `spacingScale` for the performance formation hierarchy membership command system contract.
   */
  spacingScale: {
    /** Left-to-right spacing multiplier. */
    lateral: number;
    /** Front-to-back spacing multiplier. */
    depth: number;
  };
}

/**
 * One source-authored compact formation cue.
 *
 * Capability labels do not grant this motion. The source explicitly authors
 * each cue, while arbitrary per-slot curves remain outside the public shape.
 *
 * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `IAutoMovieFormationMotion` as the portable data boundary for the motion external source basis requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `IAutoMovieFormationMotion` for the performance motion external adoption receipt system contract.
 */
export interface IAutoMovieFormationMotion {
  /**
   * Stable cue id, unique inside one shot.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `id` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `id` for the performance motion external adoption receipt system contract.
   */
  id: string;
  /**
   * Participating compiled formation id.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `formation` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `formation` for the performance motion external adoption receipt system contract.
   */
  formation: string;
  /**
   * Review-facing action expressed by this exact cue.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `action` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `action` for the performance motion external adoption receipt system contract.
   */
  action: AutoMovieFormationCapability;
  /**
   * Which of the unit figure's declared gaits its members perform here.
   *
   * A cue says where a unit goes; this says what its members are doing while
   * they go there, and it is the whole of how one group holds, then moves, then
   * holds again inside a single shot. The name is the figure's own
   * (`IAutoMovieGait.name`), so the vocabulary belongs to whoever authored the
   * recipe rather than to a fixed list: a cycle a crowd can perform is a cycle
   * a cue can call for.
   *
   * Omitted, the cue's `action` label is tried as a gait name, and the figure's
   * first declared gait performs when nothing carries that name. A named gait
   * no figure of the unit declares is refused rather than silently replaced.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `gait` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `gait` for the performance motion external adoption receipt system contract.
   */
  gait?: string;

  /**
   * The arrangement this unit is in when the cue ends.
   *
   * A unit's `layout` is a design constant: it says how the unit is arranged,
   * once, for the whole production. That is the right unit for how a crowd is
   * built and the wrong one for a crowd that re-forms -- a line becoming a
   * column, a block falling into an arc, a scatter closing into ranks. Spacing
   * alone cannot say it: opening and closing an arrangement is not changing
   * it.
   *
   * Each member travels from its place in the design's arrangement to its place
   * in this one, in the unit's own frame, on this cue's declared easing. Any
   * two arrangements re-form into one another whatever their kinds, because
   * what is blended is where a member stands and not the parameters that put it
   * there.
   *
   * Omitted, the unit keeps the arrangement it is already in, and the compiled
   * cue is byte-identical to one authored before this channel existed.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `layout` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `layout` for the performance motion external adoption receipt system contract.
   */
  layout?: IAutoMovieFormationDesign["layout"];
  /**
   * Inclusive shot-local cue start.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `start` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `start` for the performance motion external adoption receipt system contract.
   */
  start: number;
  /**
   * Exclusive shot-local cue end.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `end` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `end` for the performance motion external adoption receipt system contract.
   */
  end: number;
  /**
   * State at cue start.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `from` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `from` for the performance motion external adoption receipt system contract.
   */
  from: IAutoMovieFormationMotionState;
  /**
   * State at cue end.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `to` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `to` for the performance motion external adoption receipt system contract.
   */
  to: IAutoMovieFormationMotionState;
  /**
   * Deterministic interpolation curve.
   *
   * @evidence requirements/motion/external-motion-inputs.md#motion-external-source-basis Exposes `easing` as the portable data boundary for the motion external source basis requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-external-adoption-receipt Types `easing` for the performance motion external adoption receipt system contract.
   */
  easing: "linear" | "easeIn" | "easeOut" | "easeInOut" | "step";
}

/**
 * One member-local deviation from the unit that member stands in.
 *
 * A group cue moves every member alike. This is what one named member does
 * differently: whether it is there at all, how far it has come off the place
 * its layout put it, and how far it has turned out of the heading its unit
 * holds. The offset and the heading are stated in the unit's own frame, so a
 * member that steps left keeps stepping left after its unit turns.
 *
 * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `IAutoMovieFormationSlotState` as the portable data boundary for the formation unit local variation requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `IAutoMovieFormationSlotState` for the performance formation hierarchy membership command system contract.
 */
export interface IAutoMovieFormationSlotState {
  /**
   * Whether this member is drawn, measured and counted at all.
   *
   * False is the whole of removal: the member stops being rendered, stops being
   * measured against the ground its shot staged, and stops being counted among
   * the drawn. Its unit's designed count, bounds and centroid are unchanged,
   * because those describe the unit that was designed rather than the members
   * standing at one instant.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `present` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `present` for the performance formation hierarchy membership command system contract.
   */
  present: boolean;
  /**
   * Displacement from the member's designed place, in unit-local meters.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `offset` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `offset` for the performance formation hierarchy membership command system contract.
   */
  offset: IAutoMovieVector3;
  /**
   * Heading added to the member's placed heading, in degrees.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-unit-local-variation Exposes `facingOffsetDeg` as the portable data boundary for the formation unit local variation requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `facingOffsetDeg` for the performance formation hierarchy membership command system contract.
   */
  facingOffsetDeg: number;
}

/**
 * One source-authored exception naming members inside one compiled formation.
 *
 * The unit-level channel is the whole of what a group does together, so nothing
 * can happen to one member of a crowd through it: a cue that moves a unit moves
 * every member of it. This is the sparse channel beside it. It names slots, not
 * members-in-general, and it costs the number of exceptions rather than the
 * size of the crowd, so three members of a hundred thousand cost three.
 *
 * Sampled exactly as {@link IAutoMovieFormationMotion} is: a member holds the
 * identity state before its first cue, interpolates inside a cue, and retains a
 * cue's `to` state after it ends. So a member removed at four seconds by a cue
 * whose `to` is absent stays absent for the rest of the shot without the author
 * restating it, and a member that falls stays down.
 *
 * A named slot stays an instanced member. Promotion to a named actor is the
 * other, dearer thing: it exists, it is capped, and this is deliberately not
 * it.
 *
 * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `IAutoMovieFormationSlotMotion` as the portable data boundary for the formation slot identity requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `IAutoMovieFormationSlotMotion` for the performance formation layout slot assignment system contract.
 */
export interface IAutoMovieFormationSlotMotion {
  /**
   * Stable cue id, unique inside one shot.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `id` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `id` for the performance formation layout slot assignment system contract.
   */
  id: string;
  /**
   * Participating compiled formation id.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `formation` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `formation` for the performance formation layout slot assignment system contract.
   */
  formation: string;
  /**
   * Zero-based slots this exception names, unique and below the unit's count.
   *
   * Several slots share one cue when the same thing happens to each of them at
   * the same time; a member that needs its own timing gets its own cue.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `slots` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `slots` for the performance formation layout slot assignment system contract.
   */
  slots: number[];
  /**
   * Inclusive shot-local cue start.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `start` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `start` for the performance formation layout slot assignment system contract.
   */
  start: number;
  /**
   * Exclusive shot-local cue end.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `end` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `end` for the performance formation layout slot assignment system contract.
   */
  end: number;
  /**
   * Member state at cue start.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `from` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `from` for the performance formation layout slot assignment system contract.
   */
  from: IAutoMovieFormationSlotState;
  /**
   * Member state at cue end.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `to` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `to` for the performance formation layout slot assignment system contract.
   */
  to: IAutoMovieFormationSlotState;
  /**
   * Deterministic interpolation curve.
   *
   * @evidence requirements/formations/layouts-and-slots.md#formation-slot-identity Exposes `easing` as the portable data boundary for the formation slot identity requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-layout-slot-assignment Types `easing` for the performance formation layout slot assignment system contract.
   */
  easing: IAutoMovieFormationMotion["easing"];
}

/**
 * One source-authored shot-local effect activation.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieShotEffectCue` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieShotEffectCue` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieShotEffectCue {
  /**
   * Stable cue id, unique inside one shot.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `id` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `id` for the spec authoring source derivation state system contract.
   */
  id: string;
  /**
   * Existing world effect-zone id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `zone` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `zone` for the spec authoring source derivation state system contract.
   */
  zone: string;
  /**
   * Inclusive shot-local start in seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `start` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `start` for the spec authoring source derivation state system contract.
   */
  start: number;
  /**
   * Exclusive shot-local end in seconds.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `end` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `end` for the spec authoring source derivation state system contract.
   */
  end: number;
  /**
   * Bounded intensity envelope.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `intensity` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `intensity` for the spec authoring source derivation state system contract.
   */
  intensity: {
    /** Intensity at cue start. */
    from: number;
    /** Intensity at cue end. */
    to: number;
  };
  /**
   * Optional authoritative shot event that must realize inside this cue.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `event` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `event` for the spec authoring source derivation state system contract.
   */
  event?: string;
}

/**
 * Compiler-owned deterministic effect runtime consumed by viewer and oracle.
 *
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `IAutoMovieCompiledEffect` as the portable data boundary for the rendering runtime build order requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `IAutoMovieCompiledEffect` for the spec render state isolation system contract.
 */
export interface IAutoMovieCompiledEffect {
  /**
   * Generated effect format.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `version` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `version` for the spec render state isolation system contract.
   */
  version: 1;
  /**
   * Stable source cue id.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `id` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `id` for the spec render state isolation system contract.
   */
  id: string;
  /**
   * Existing world zone id.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `zone` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `zone` for the spec render state isolation system contract.
   */
  zone: string;
  /**
   * Supported primitive effect family.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `kind` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `kind` for the spec render state isolation system contract.
   */
  kind: IAutoMovieEffectRecipe["kind"];
  /**
   * Exact world-space emitter bounds.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `bounds` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `bounds` for the spec render state isolation system contract.
   */
  bounds: IAutoMovieWorldDesign["effectZones"][number]["bounds"];
  /**
   * Domain-separated deterministic stream seed.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `seed` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `seed` for the spec render state isolation system contract.
   */
  seed: number;
  /**
   * Exact current recipe.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `recipe` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `recipe` for the spec render state isolation system contract.
   */
  recipe: IAutoMovieEffectRecipe;
  /**
   * Inclusive shot-local cue start.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `start` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `start` for the spec render state isolation system contract.
   */
  start: number;
  /**
   * Exclusive shot-local cue end.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `end` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `end` for the spec render state isolation system contract.
   */
  end: number;
  /**
   * Bounded cue intensity envelope.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `intensity` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `intensity` for the spec render state isolation system contract.
   */
  intensity: IAutoMovieShotEffectCue["intensity"];
  /**
   * Bound authoritative event, when present.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `event` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `event` for the spec render state isolation system contract.
   */
  event?: string;
  /**
   * Production frame-clock simulation step.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `fixedStepSeconds` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `fixedStepSeconds` for the spec render state isolation system contract.
   */
  fixedStepSeconds: number;
  /**
   * Digest of every field above except this digest.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-runtime-build-order Exposes `digest` as the portable data boundary for the rendering runtime build order requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `digest` for the spec render state isolation system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * Engine-compiled shot source before production materialization is added.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieShotSourceOutput` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieShotSourceOutput` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieShotSourceOutput {
  /**
   * Source-owned generated models retained for materialization and evidence.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `authoredModels` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `authoredModels` for the spec authoring source derivation state system contract.
   */
  authoredModels?: IAutoMovieModel[];
  /**
   * Source-owned production props retained with their semantic contracts.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `props` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `props` for the spec authoring source derivation state system contract.
   */
  props?: IAutoMoviePropSpec[];
  /**
   * Structured buildings retained for spatial queries and evidence.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `builtEnvironments` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `builtEnvironments` for the spec authoring source derivation state system contract.
   */
  builtEnvironments?: IAutoMovieBuiltEnvironment[];
  /**
   * Observation documents the building source read, kept as provenance.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `designReferences` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `designReferences` for the spec authoring source derivation state system contract.
   */
  designReferences?: IAutoMovieDesignReference[];
  /**
   * Citations from authored design members back to those observations.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `designEvidence` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `designEvidence` for the spec authoring source derivation state system contract.
   */
  designEvidence?: IAutoMovieDesignEvidence[];
  /**
   * Phase, alternative and change-impact lineage over those identities.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `designLineages` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `designLineages` for the spec authoring source derivation state system contract.
   */
  designLineages?: IAutoMovieDesignLineage[];
  /**
   * Independent deterministic fluid domains this shot's source declares.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `fluidDomains` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `fluidDomains` for the spec authoring source derivation state system contract.
   */
  fluidDomains?: IAutoMovieFluidDomain[];
  /**
   * Bindings that make those domains a building's own water features.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `waterFeatures` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `waterFeatures` for the spec authoring source derivation state system contract.
   */
  waterFeatures?: IAutoMovieWaterFeature[];
  /**
   * Cloth and cushion domains this shot's source declares.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `softBodyDomains` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `softBodyDomains` for the spec authoring source derivation state system contract.
   */
  softBodyDomains?: IAutoMovieSoftBodyDomain[];
  /**
   * Bindings that hang those domains on a building's own elements.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `softFurnishings` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `softFurnishings` for the spec authoring source derivation state system contract.
   */
  softFurnishings?: IAutoMovieSoftFurnishing[];
  /**
   * Growth recipes for the planting this shot's source declares.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `plantingDomains` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `plantingDomains` for the spec authoring source derivation state system contract.
   */
  plantingDomains?: IAutoMoviePlantingDomain[];
  /**
   * Arrangements those recipes are grown into.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `plantingClusters` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `plantingClusters` for the spec authoring source derivation state system contract.
   */
  plantingClusters?: IAutoMoviePlantingCluster[];
  /**
   * Bindings that plant those clusters in a building's own spaces.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `plantingInstallations` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `plantingInstallations` for the spec authoring source derivation state system contract.
   */
  plantingInstallations?: IAutoMoviePlantingInstallation[];
  /**
   * Port networks that serve the buildings this shot stages.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `serviceNetworks` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `serviceNetworks` for the spec authoring source derivation state system contract.
   */
  serviceNetworks?: IAutoMovieServiceNetwork[];
  /**
   * Event sample times selected inside authoritative event windows.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `eventSamples` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `eventSamples` for the spec authoring source derivation state system contract.
   */
  eventSamples: Array<{
    /** Exact event-contract id. */
    id: string;
    /** Shot-local time at which the compiler evaluates its predicates. */
    time: number;
  }>;
  /**
   * Scene derived by staging the source-authored program.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `scene` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `scene` for the spec authoring source derivation state system contract.
   */
  scene: IAutoMovieScene;
  /**
   * Deterministic motions synthesized and assembled by the engine.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `motions` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `motions` for the spec authoring source derivation state system contract.
   */
  motions: IAutoMovieMotion[];
  /**
   * Optional compact formation-level cues. The compiler materializes an empty
   * list when omitted; source never emits arbitrary per-member curves.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `formationMotions` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `formationMotions` for the spec authoring source derivation state system contract.
   */
  formationMotions?: IAutoMovieFormationMotion[];
  /**
   * Optional sparse per-member exceptions inside compact formations. The
   * compiler materializes an empty list when omitted; the cost is the number of
   * exceptions, never the number of members.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `formationSlotMotions` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `formationSlotMotions` for the spec authoring source derivation state system contract.
   */
  formationSlotMotions?: IAutoMovieFormationSlotMotion[];
  /**
   * Optional bounded shot-local deterministic effect cues.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `effectCues` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `effectCues` for the spec authoring source derivation state system contract.
   */
  effectCues?: IAutoMovieShotEffectCue[];
  /**
   * Engine-compiled shot choreography.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `shot` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `shot` for the spec authoring source derivation state system contract.
   */
  shot: IAutoMovieShot;
}

/**
 * Fully compiler-owned shot artifact consumed by render and oracle services.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieCompiledShotSource` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieCompiledShotSource` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieCompiledShotSource extends IAutoMovieShotSourceOutput {
  /**
   * Models required by this shot.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `models` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `models` for the spec authoring source derivation state system contract.
   */
  models: IAutoMovieModel[];
  /**
   * Compact formation runtimes required by this shot.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `formations` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `formations` for the spec authoring source derivation state system contract.
   */
  formations: IAutoMovieCompiledFormation[];
  /**
   * Compact general instance runtimes placed by the production world.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `instanceSets` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `instanceSets` for the spec authoring source derivation state system contract.
   */
  instanceSets: IAutoMovieCompiledInstanceSet[];
  /**
   * Validated compact formation-level cues, empty when source omitted them.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `formationMotions` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `formationMotions` for the spec authoring source derivation state system contract.
   */
  formationMotions: IAutoMovieFormationMotion[];
  /**
   * Validated sparse per-member exceptions, empty when source omitted them.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `formationSlotMotions` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `formationSlotMotions` for the spec authoring source derivation state system contract.
   */
  formationSlotMotions: IAutoMovieFormationSlotMotion[];
  /**
   * Compiler-owned deterministic effect runtimes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `effects` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `effects` for the spec authoring source derivation state system contract.
   */
  effects: IAutoMovieCompiledEffect[];
}

/**
 * One scalar predicate and the value measured by the compiler.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `IAutoMovieCompiledPredicateResult` as the portable data boundary for the diagnostics derived result finding requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `IAutoMovieCompiledPredicateResult` for the validation derived result finding system contract.
 */
export interface IAutoMovieCompiledPredicateResult {
  /**
   * Exact authoritative predicate.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `predicate` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `predicate` for the validation derived result finding system contract.
   */
  predicate: IAutoMovieShotPredicate;
  /**
   * Actual sampled value, or null when the operand could not be resolved.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `actual` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `actual` for the validation derived result finding system contract.
   */
  actual: number | null;
  /**
   * Whether the authoritative comparison passed.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `passed` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `passed` for the validation derived result finding system contract.
   */
  passed: boolean;
}

/**
 * Compiler-derived realization of one shot contract.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `IAutoMovieCompiledContractRealization` as the portable data boundary for the diagnostics derived result finding requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `IAutoMovieCompiledContractRealization` for the validation derived result finding system contract.
 */
export interface IAutoMovieCompiledContractRealization {
  /**
   * Realization format.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `version` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `version` for the validation derived result finding system contract.
   */
  version: 1;
  /**
   * Exact compiled shot id.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `shot` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `shot` for the validation derived result finding system contract.
   */
  shot: string;
  /**
   * Opening-state outcomes sampled at time zero.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `opening` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `opening` for the validation derived result finding system contract.
   */
  opening: Array<{
    /** Exact state id. */
    id: string;
    /** Compiler-owned predicate results. */
    predicates: IAutoMovieCompiledPredicateResult[];
    /** Whether every predicate passed. */
    passed: boolean;
  }>;
  /**
   * Closing-state outcomes sampled at the shot duration.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `closing` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `closing` for the validation derived result finding system contract.
   */
  closing: Array<{
    /** Exact state id. */
    id: string;
    /** Compiler-owned predicate results. */
    predicates: IAutoMovieCompiledPredicateResult[];
    /** Whether every predicate passed. */
    passed: boolean;
  }>;
  /**
   * Semantic event outcomes sampled inside their declared windows.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `events` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `events` for the validation derived result finding system contract.
   */
  events: Array<{
    /** Exact event id. */
    id: string;
    /** Compiler-checked event sample time. */
    time: number;
    /** Compiler-owned predicate results. */
    predicates: IAutoMovieCompiledPredicateResult[];
    /** Whether timing and every predicate passed. */
    passed: boolean;
  }>;
  /**
   * Camera required-bound projection checks at authoritative review times.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `camera` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `camera` for the validation derived result finding system contract.
   */
  camera: Array<{
    /** Shot-local sample time. */
    time: number;
    /**
     * World placement this sample measured, present only when the shot
     * compiled a camera move.
     *
     * A `frame` action solves the live camera's placement from the framing and
     * its subject, keeping the staged camera's bearing but replacing its
     * distance, so the staged `scene.cameras[i].transform` beside this record is
     * the solve's input rather than the placement that renders. Absent means the
     * two are the same camera and the staged transform is exact.
     */
    placement?: {
      /** Sampled camera origin in world space. */
      position: IAutoMovieVector3;
      /** Sampled camera orientation in world space. */
      rotation: IAutoMovieQuaternion;
    };
    /**
     * Required-range depth precision measured for this exact camera time.
     */
    depthPrecision: IAutoMovieCameraDepthPrecisionReport;
    /** Number of required subjects. */
    requiredSubjects: number;
    /** Number resolved in current compiled output. */
    resolvedSubjects: number;
    /** Number whose current bound intersects the clip range and frame. */
    readableSubjects: number;
    /** Whether every required current bound is readable at this sample. */
    passed: boolean;
  }>;
  /**
   * Compiler-materialized formation summaries.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `formations` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `formations` for the validation derived result finding system contract.
   */
  formations: Array<{
    /** Exact formation id. */
    id: string;
    /** Exact materialized slot count. */
    count: number;
    /** World-space minimum bound. */
    min: IAutoMovieVector3;
    /** World-space maximum bound. */
    max: IAutoMovieVector3;
    /** Whether count, slots, hero ids and placement passed. */
    passed: boolean;
  }>;
}

/**
 * One realized shot event placed on the production story clock.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `IAutoMovieStorySyncPoint` as the portable data boundary for the story simultaneous events requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `IAutoMovieStorySyncPoint` for the narrative intent story synchronization system contract.
 */
export interface IAutoMovieStorySyncPoint {
  /**
   * Owning shot id.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `shot` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `shot` for the narrative intent story synchronization system contract.
   */
  shot: string;
  /**
   * Exact event id.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `event` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `event` for the narrative intent story synchronization system contract.
   */
  event: string;
  /**
   * Compiler-realized shot-local time in seconds, or null when the owning shot
   * has no current realization for the event.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `localSeconds` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `localSeconds` for the narrative intent story synchronization system contract.
   */
  localSeconds: number | null;
  /**
   * Story-clock time in seconds, or null when the local time is unavailable or
   * the owning shot carries no story-clock pin.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `storySeconds` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `storySeconds` for the narrative intent story synchronization system contract.
   */
  storySeconds: number | null;
}

/**
 * Measured verdict of one cross-shot story-clock simultaneity claim.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `IAutoMovieStorySyncOutcome` as the portable data boundary for the story simultaneous events requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `IAutoMovieStorySyncOutcome` for the narrative intent story synchronization system contract.
 */
export interface IAutoMovieStorySyncOutcome {
  /**
   * Every addressed event and where it landed on the story clock.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `points` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `points` for the narrative intent story synchronization system contract.
   */
  points: IAutoMovieStorySyncPoint[];
  /**
   * Widest gap between two addressed story times in seconds, or null when any
   * operand failed to resolve.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `spreadSeconds` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `spreadSeconds` for the narrative intent story synchronization system contract.
   */
  spreadSeconds: number | null;
  /**
   * Required tolerance in story seconds.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `toleranceSeconds` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `toleranceSeconds` for the narrative intent story synchronization system contract.
   */
  toleranceSeconds: number;
  /**
   * Whether every point resolved and the widest gap is within tolerance.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `passed` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `passed` for the narrative intent story synchronization system contract.
   */
  passed: boolean;
  /**
   * Deterministic one-line account of the measurement, naming the two events
   * that produced the widest gap or the first operand that failed to resolve.
   *
   * @evidence requirements/story/story-clock-and-state.md#story-simultaneous-events Exposes `summary` as the portable data boundary for the story simultaneous events requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-story-synchronization Types `summary` for the narrative intent story synchronization system contract.
   */
  summary: string;
}

/**
 * Coding-agent-owned module export compiled in a deterministic sandbox.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `IAutoMovieShotSource` as the portable data boundary for the agent source result link requirement.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `IAutoMovieShotSource` for the spec authoring source derivation state system contract.
 */
export interface IAutoMovieShotSource {
  /**
   * Exact registered shot id selected by the design source pointer.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `id` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `id` for the spec authoring source derivation state system contract.
   */
  id: IAutoMovieDefinedShot<IAutoMovieShotBuildContext>["id"];
  /**
   * Exact staged-scene id the returned program must author.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `scene` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `scene` for the spec authoring source derivation state system contract.
   */
  scene: IAutoMovieDefinedShot<IAutoMovieShotBuildContext>["scene"];
  /**
   * Measurable source-owned contract, checked against the design contract.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `contract` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `contract` for the spec authoring source derivation state system contract.
   */
  contract: IAutoMovieDefinedShot<IAutoMovieShotBuildContext>["contract"];
  /**
   * Build a thin stage/block/performance program.
   *
   * The production host, not source code, supplies rig capabilities and runs
   * the engine pipeline that lowers this program into scene, motion, and shot
   * artifacts.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Exposes `build` as the portable data boundary for the agent source result link requirement.
   * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Types `build` for the spec authoring source derivation state system contract.
   */
  build(context: IAutoMovieShotBuildContext): IAutoMovieProductionShotProgram;
}

/**
 * Thin engine program plus production-only compact cues.
 *
 * Formation and effect cues remain declarative compiler inputs; dense actor
 * motion, scene, and shot artifacts are deliberately absent.
 *
 * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `IAutoMovieProductionShotProgram` as the portable data boundary for the formation membership requirement.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `IAutoMovieProductionShotProgram` for the performance formation hierarchy membership command system contract.
 */
export interface IAutoMovieProductionShotProgram extends IAutoMovieShotProgram {
  /**
   * Source-owned generated models assembled by ordinary TypeScript. Imported
   * assets remain compiler-owned production inputs rather than sandbox output.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `models` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `models` for the performance formation hierarchy membership command system contract.
   */
  models?: IAutoMovieModel[];
  /**
   * Source-owned semantic props whose model and behavior are validated.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `props` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `props` for the performance formation hierarchy membership command system contract.
   */
  props?: IAutoMoviePropSpec[];
  /**
   * Code-authored buildings used by the shot. They remain structured in the
   * compiled artifact; visible placements and support space are staged from the
   * same record rather than transcribed into a second design.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `builtEnvironments` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `builtEnvironments` for the performance formation hierarchy membership command system contract.
   */
  builtEnvironments?: IAutoMovieBuiltEnvironment[];
  /**
   * Observation documents the building source read, carried as provenance.
   *
   * A reading is never promoted into the design. They are here so the compiler
   * can hold each document against the bytes it claims to have observed and
   * refuse a citation whose file has moved on.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `designReferences` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `designReferences` for the performance formation hierarchy membership command system contract.
   */
  designReferences?: IAutoMovieDesignReference[];
  /**
   * Citations from authored design members back to those observations.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `designEvidence` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `designEvidence` for the performance formation hierarchy membership command system contract.
   */
  designEvidence?: IAutoMovieDesignEvidence[];
  /**
   * Phase, alternative and change-impact lineage over those identities.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `designLineages` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `designLineages` for the performance formation hierarchy membership command system contract.
   */
  designLineages?: IAutoMovieDesignLineage[];
  /**
   * Independent deterministic fluid domains this shot's source declares.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `fluidDomains` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `fluidDomains` for the performance formation hierarchy membership command system contract.
   */
  fluidDomains?: IAutoMovieFluidDomain[];
  /**
   * Bindings that make those domains a building's own water features.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `waterFeatures` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `waterFeatures` for the performance formation hierarchy membership command system contract.
   */
  waterFeatures?: IAutoMovieWaterFeature[];
  /**
   * Cloth and cushion domains this shot's source declares.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `softBodyDomains` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `softBodyDomains` for the performance formation hierarchy membership command system contract.
   */
  softBodyDomains?: IAutoMovieSoftBodyDomain[];
  /**
   * Bindings that hang those domains on a building's own elements.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `softFurnishings` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `softFurnishings` for the performance formation hierarchy membership command system contract.
   */
  softFurnishings?: IAutoMovieSoftFurnishing[];
  /**
   * Growth recipes for the planting this shot's source declares.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `plantingDomains` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `plantingDomains` for the performance formation hierarchy membership command system contract.
   */
  plantingDomains?: IAutoMoviePlantingDomain[];
  /**
   * Arrangements those recipes are grown into.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `plantingClusters` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `plantingClusters` for the performance formation hierarchy membership command system contract.
   */
  plantingClusters?: IAutoMoviePlantingCluster[];
  /**
   * Bindings that plant those clusters in a building's own spaces.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `plantingInstallations` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `plantingInstallations` for the performance formation hierarchy membership command system contract.
   */
  plantingInstallations?: IAutoMoviePlantingInstallation[];
  /**
   * Port networks that serve the buildings this shot stages.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `serviceNetworks` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `serviceNetworks` for the performance formation hierarchy membership command system contract.
   */
  serviceNetworks?: IAutoMovieServiceNetwork[];
  /**
   * Optional source-computed clips cited only by explicit `enact` actions.
   *
   * The host still masks, layers, ROM-checks, and assembles these clips through
   * `performShot`; they are not precompiled shot output.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `clips` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `clips` for the performance formation hierarchy membership command system contract.
   */
  clips?: IAutoMovieMotion[];
  /**
   * Optional clips moving this shot's staged lights over its own local clock.
   *
   * The shot-local half of production lighting: a lamp switched on inside this
   * beat, a candle blown out. Each track addresses one staged light by pointer
   * channel (`/lights/<id>/<property>`), the same grammar
   * {@link IAutoMovieProductionLighting.motions} uses on the story clock, and
   * the host carries them onto the compiled shot's `lightMotions`. Omitted, the
   * shot's lighting is constant and its compiled artifact is byte-identical to
   * one compiled before this field existed.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `lightMotions` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `lightMotions` for the performance formation hierarchy membership command system contract.
   */
  lightMotions?: IAutoMovieClip[];
  /**
   * Optional clips turning this shot's non-performing scene nodes over its own
   * local clock, carried onto the compiled shot's `objectMotions`.
   *
   * The moving half of a built world. A building's opening states where its
   * panels stand at each named configuration and a prop states the travel of
   * its own joints, and both were configurations rather than motion: every
   * entry on a compiled shot's `objectMotions` was baked by the engine from a
   * `launch` or an `attachTo`, so nothing a source authored could make a door
   * swing on screen. One channel serves both, because both are one node in the
   * staged graph turned over one clock: a panel is a staged set piece
   * (`<environment>/<element>`, the ids `builtOpeningPanelPlacements` answers
   * with) and a prop's leaf is a lowered articulation joint
   * (`<placement>/<joint>`).
   *
   * The host holds each track to the shot it belongs to: the node must be one
   * this shot staged or a joint a staged prop declares, it must not be a node a
   * performance or a baked clip already drives, its keys must land inside the
   * shot's own clock, and a driven prop joint must stay inside the travel that
   * prop's profile declares. Omitted, the compiled shot carries exactly the
   * clips the engine baked, as it always did.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `objectMotions` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `objectMotions` for the performance formation hierarchy membership command system contract.
   */
  objectMotions?: IAutoMovieClip[];
  /**
   * Optional compact formation-level cues.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `formationMotions` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `formationMotions` for the performance formation hierarchy membership command system contract.
   */
  formationMotions?: IAutoMovieFormationMotion[];
  /**
   * Optional sparse per-member exceptions inside compact formations.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `formationSlotMotions` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `formationSlotMotions` for the performance formation hierarchy membership command system contract.
   */
  formationSlotMotions?: IAutoMovieFormationSlotMotion[];
  /**
   * Optional bounded shot-local deterministic effect cues.
   *
   * @evidence requirements/formations/hierarchies-and-units.md#formation-membership Exposes `effectCues` as the portable data boundary for the formation membership requirement.
   * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-hierarchy-membership-command Types `effectCues` for the performance formation hierarchy membership command system contract.
   */
  effectCues?: IAutoMovieShotEffectCue[];
}

/**
 * Compact inventory returned by project inspection.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieProductionDesignInventory` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieProductionDesignInventory` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieProductionDesignInventory {
  /**
   * Whether the active production design exists.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `production` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `production` for the asset spec generation provider choice system contract.
   */
  production: boolean;
  /**
   * Model recipe ids.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `models` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `models` for the asset spec generation provider choice system contract.
   */
  models: string[];
  /**
   * Whether the project-shared world design exists.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `world` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `world` for the asset spec generation provider choice system contract.
   */
  world: boolean;
  /**
   * Formation ids.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `formations` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `formations` for the asset spec generation provider choice system contract.
   */
  formations: string[];
  /**
   * Shot contract ids.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `shots` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `shots` for the asset spec generation provider choice system contract.
   */
  shots: string[];
  /**
   * Acceptance scenario ids.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `acceptance` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `acceptance` for the asset spec generation provider choice system contract.
   */
  acceptance: string[];
}

/**
 * One discovered renderer-owned evidence bundle.
 *
 * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `IAutoMovieProductionRenderStatus` as the portable data boundary for the rendering lowering ownership requirement.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `IAutoMovieProductionRenderStatus` for the spec render state isolation system contract.
 */
export interface IAutoMovieProductionRenderStatus {
  /**
   * Project-relative bundle manifest.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `path` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `path` for the spec render state isolation system contract.
   */
  path: string;
  /**
   * Whether the bundle matches current target-local inputs.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `current` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `current` for the spec render state isolation system contract.
   */
  current: boolean;
  /**
   * What this bundle was rendered for, verbatim from its own manifest, or
   * `null` when that manifest cannot be read.
   *
   * The path already spells the target, and spelling is not addressing: a
   * consumer had to parse a shot id out of a directory name and diff it against
   * the compile manifest by hand. Handing back the manifest's own target makes
   * the same question one comparison.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `target` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `target` for the spec render state isolation system contract.
   */
  target: IAutoMovieRenderBundleManifest["target"] | null;
  /**
   * Whether the design still carries the target this bundle was rendered for.
   *
   * `current` alone conflates two states a reader must separate. Measured on one
   * production, 42 render entries held 39 `current: false` — 38 of them
   * superseded renders of shots that still exist, which is the ordinary debris
   * of iteration, and **one** the render of a shot the design no longer carries,
   * which is the only row anybody should act on. Nothing on the entry told them
   * apart.
   *
   * False is a claim, so it is made only where ownership was actually resolved:
   * a target whose manifest could not be read, or whose kind this cannot
   * resolve, reports `true` rather than accusing a bundle of being unowned on a
   * failure to look. Deletion stays the reader's decision either way; this
   * surface says what is there, and never removes it.
   *
   * @evidence requirements/rendering/scene-lowering-and-runtime-state.md#rendering-lowering-ownership Exposes `owned` as the portable data boundary for the rendering lowering ownership requirement.
   * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-state-isolation Types `owned` for the spec render state isolation system contract.
   */
  owned: boolean;
}

/**
 * Compact project status for CLI and lint consumers.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieProductionInspection` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieProductionInspection` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieProductionInspection {
  /**
   * Current project revision.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `revision` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `revision` for the asset spec generation provider choice system contract.
   */
  revision: number;
  /**
   * Typed design inventory.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `design` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `design` for the asset spec generation provider choice system contract.
   */
  design: IAutoMovieProductionDesignInventory;
  /**
   * Coding-agent and compiler ownership status.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `source` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `source` for the asset spec generation provider choice system contract.
   */
  source: {
    /** Bound source modules that currently exist. */
    bound: string[];
    /** Bound source modules that are missing or unsafe. */
    missing: string[];
    /** Files under generated absent from its manifest. */
    unownedGenerated: string[];
  };
  /**
   * Current structural and ownership diagnostics.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `diagnostics` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `diagnostics` for the asset spec generation provider choice system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
  /**
   * Discovered render manifests.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `renders` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `renders` for the asset spec generation provider choice system contract.
   */
  renders: IAutoMovieProductionRenderStatus[];
  /**
   * Current caption readability measurements and outcomes for the film edit.
   *
   * This report is outside the generated edit so a production declaring no
   * profile retains byte-identical compiled output while still exposing a
   * measure-only result.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports measurement without inventing a missing profile verdict.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Keeps measure-only status explicit at the inspection boundary.
   */
  captionReadability: IAutoMovieCaptionReadabilityReport;
  /**
   * Ordered concrete corrections.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `nextActions` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `nextActions` for the asset spec generation provider choice system contract.
   */
  nextActions: IAutoMovieProductionNextAction[];
}

/**
 * One action that moves the production toward a clean compile.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieProductionNextAction` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieProductionNextAction` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieProductionNextAction {
  /**
   * Owning surface.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `owner` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `owner` for the asset spec generation provider choice system contract.
   */
  owner: "design" | "source" | "compile" | "review" | "render";
  /**
   * Exact package API or coding-agent command to run.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `action` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `action` for the asset spec generation provider choice system contract.
   */
  action: string;
  /**
   * Exact target or artifact to correct.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `target` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `target` for the asset spec generation provider choice system contract.
   */
  target: string;
  /**
   * Why this action is next.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `reason` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `reason` for the asset spec generation provider choice system contract.
   */
  reason: string;
}

/**
 * Consequences computed before one design mutation is committed.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieDesignMutationConsequences` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieDesignMutationConsequences` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieDesignMutationConsequences {
  /**
   * Review targets that become stale.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `staleReviews` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `staleReviews` for the asset spec generation provider choice system contract.
   */
  staleReviews: IAutoMovieReviewTarget[];
  /**
   * Render bundle ids that become stale.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `staleRenders` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `staleRenders` for the asset spec generation provider choice system contract.
   */
  staleRenders: string[];
  /**
   * Generated paths invalidated by the mutation.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `removedGenerated` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `removedGenerated` for the asset spec generation provider choice system contract.
   */
  removedGenerated: string[];
}

/**
 * Result shared by the one-artifact design setters and eraser.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `IAutoMovieDesignMutationOutput` as the portable data boundary for the diagnostics derived result finding requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `IAutoMovieDesignMutationOutput` for the validation derived result finding system contract.
 */
export interface IAutoMovieDesignMutationOutput {
  /**
   * Whether the complete mutation was atomically committed.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `accepted` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `accepted` for the validation derived result finding system contract.
   */
  accepted: boolean;
  /**
   * Current monotonic project revision.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `revision` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `revision` for the validation derived result finding system contract.
   */
  revision: number;
  /**
   * Exact addressed target.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `target` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `target` for the validation derived result finding system contract.
   */
  target: IAutoMovieDesignTarget;
  /**
   * Current target digest, or null when refused or erased.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `fingerprint` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `fingerprint` for the validation derived result finding system contract.
   */
  fingerprint: AutoMovieContentDigest | null;
  /**
   * Downstream review, render and generated artifacts made stale or removed by
   * the accepted mutation, or predicted for a refused mutation.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `consequences` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `consequences` for the validation derived result finding system contract.
   */
  consequences: IAutoMovieDesignMutationConsequences;
  /**
   * Validation, reference and downstream diagnostics. A refused mutation never
   * changes tracked state; accepted warnings must be corrected before compile.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `diagnostics` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `diagnostics` for the validation derived result finding system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/**
 * One materialized compiler file and its write status.
 *
 * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `IAutoMovieMaterializedFile` as the portable data boundary for the asset generation provider independence requirement.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `IAutoMovieMaterializedFile` for the asset spec generation provider choice system contract.
 */
export interface IAutoMovieMaterializedFile extends IAutoMovieGeneratedFile {
  /**
   * Whether bytes were first created, updated, or already current.
   *
   * @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence Exposes `status` as the portable data boundary for the asset generation provider independence requirement.
   * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-generation-provider-choice Types `status` for the asset spec generation provider choice system contract.
   */
  status: "created" | "updated" | "unchanged";
}

/**
 * A compile request with progressively stricter gates.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Exposes `IAutoMovieCompileProjectInput` as the portable data boundary for the diagnostics input finding requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Types `IAutoMovieCompileProjectInput` for the validation input finding system contract.
 */
export interface IAutoMovieCompileProjectInput {
  /**
   * Highest atomic gate to enforce. `design` validates the tracked graph only;
   * `source` additionally compiles sandboxed TypeScript and materializes owned
   * generated artifacts; `review` additionally requires every current review
   * target complete; `final` additionally verifies required renderer-owned
   * deliverables, byte receipts and parsed media facts.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-input-finding Exposes `scope` as the portable data boundary for the diagnostics input finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-input-finding Types `scope` for the validation input finding system contract.
   */
  scope: "design" | "source" | "review" | "final";
}

/**
 * Result of an atomic production compile.
 *
 * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `IAutoMovieCompileProjectOutput` as the portable data boundary for the diagnostics derived result finding requirement.
 * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `IAutoMovieCompileProjectOutput` for the validation derived result finding system contract.
 */
export interface IAutoMovieCompileProjectOutput {
  /**
   * Whether every error-level check through the requested scope passed. False
   * means no partial generated publication occurred.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `success` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `success` for the validation derived result finding system contract.
   */
  success: boolean;
  /**
   * Current project revision.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `revision` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `revision` for the validation derived result finding system contract.
   */
  revision: number;
  /**
   * Compiler and input identity.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `compiler` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `compiler` for the validation derived result finding system contract.
   */
  compiler: {
    /** Compiler package version. */
    version: string;
    /** Current design and source fingerprint. */
    inputFingerprint: AutoMovieContentDigest;
  };
  /**
   * Ordered diagnostics.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `diagnostics` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `diagnostics` for the validation derived result finding system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
  /**
   * Compiler-owned files created, updated or already current. Empty for design
   * scope and for every refused atomic compile.
   *
   * @evidence requirements/diagnostics/input-and-result-classification.md#diagnostics-derived-result-finding Exposes `materialized` as the portable data boundary for the diagnostics derived result finding requirement.
   * @evidence specifications/validation-and-diagnostics/classification-and-causality.md#validation-derived-result-finding Types `materialized` for the validation derived result finding system contract.
   */
  materialized: IAutoMovieMaterializedFile[];
}

/**
 * Review target forward declaration kept here to avoid requiring callers to
 * import a second module for mutation consequences.
 *
 * @evidence requirements/story/story-clock-and-state.md#story-time-state-review-scope Exposes `IAutoMovieReviewTarget` as the portable data boundary for the story time state review scope requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-temporal-state-handoff Types `IAutoMovieReviewTarget` for the narrative intent temporal state handoff system contract.
 */
export type IAutoMovieReviewTarget =
  | {
      /** Consumed compiled model asset. */
      kind: "asset";
      /** Model-recipe id. */
      id: string;
    }
  | {
      /** Typed design target. */
      kind: "design";
      /** Exact design artifact. */
      design: IAutoMovieDesignTarget;
    }
  | {
      /** Coding-agent-owned source file. */
      kind: "source";
      /** Project-relative source path. */
      path: string;
    }
  | {
      /** Compiled shot. */
      kind: "shot";
      /** Shot id. */
      id: string;
    }
  | {
      /** Receipt-bound visual rendition of one compiled shot. */
      kind: "rendition";
      /** Exact compiled shot id. */
      id: string;
    }
  | {
      /** Authored treatment sequence. */
      kind: "sequence";
      /** Stable sequence id. */
      id: string;
    }
  | {
      /** Whole film. */
      kind: "film";
      /** Film id. */
      id: string;
    }
  | ({
      /**
       * One compiled subject observed as itself rather than at a film moment.
       *
       * The address is the compiled artifact plus the stable subject id, not a
       * frame, so a shot that happens to contain the subject never stands in
       * for this target.
       */
      kind: "subject";
    } & IAutoMovieSubjectReviewTarget);

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
import { IAutoMovieProductionLighting, IAutoMovieScene } from "../scene";
import { IAutoMovieServiceNetwork } from "../service";
import {
  IAutoMoviePlantingCluster,
  IAutoMoviePlantingDomain,
  IAutoMoviePlantingInstallation,
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftFurnishing,
} from "../soft";
import {
  AutoMovieContentDigest,
  AutoMovieFormationCapability,
  IAutoMovieDesignTarget,
  IAutoMovieEffectRecipe,
  IAutoMovieFormationDesign,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProductionDeliverable,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
  IAutoMovieShotPredicate,
  IAutoMovieWorldDesign,
} from "./IAutoMovieProductionDesign";

/**
 * Closed diagnostic identities currently emitted by compiler, lint, and MCP.
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
  "asset-review-incomplete",
  "asset-review-missing",
  "asset-review-revise",
  "asset-review-stale",
  "asset-texture-unclosed",
  "asset-use-dangling",
  "asset-use-duplicate",
  "asset-use-missing",
  "asset-use-stale",
  "blocking-invalid",
  "builder-failed",
  "capture-failed",
  "capture-host-unavailable",
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
  "render-bundle-invalid",
  "render-bundle-legacy",
  "render-bundle-unowned",
  "render-deliverable-incomplete",
  "render-deliverable-invalid",
  "render-deliverable-media-mismatch",
  "render-deliverable-missing",
  "render-deliverable-stale",
  "render-deliverable-unowned",
  "render-frame-invalid",
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
  "repaint-source-review-incomplete",
  "repaint-target-missing",
  "review-acceptance-coverage-incomplete",
  "review-acceptance-coverage-misplaced",
  "review-asset-view-coverage-incomplete",
  "review-checklist-incomplete",
  "review-completion-basis-empty",
  "review-completion-basis-incomplete",
  "review-correction-empty",
  "review-evidence-empty",
  "review-evidence-missing",
  "review-evidence-region-invalid",
  "review-evidence-reused",
  "review-evidence-selector-invalid",
  "review-evidence-stale",
  "review-evidence-target-mismatch",
  "review-high-risk-not-passed",
  "review-incomplete",
  "review-missing",
  "review-observation-copied",
  "review-observation-empty",
  "review-outcome-missing",
  "review-rendition-coverage-incomplete",
  "review-rendition-delivery-invalid",
  "review-rendition-missing",
  "review-rendition-source-unapproved",
  "review-required-criterion-not-passed",
  "review-revise",
  "review-selector-truncated",
  "review-self-contradiction",
  "review-source-compile-blocked",
  "review-source-missing",
  "review-stale",
  "review-target-missing",
  "review-target-raced",
  "review-worksheet-stale",
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
 * @author Samchon
 * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Makes every emitted code resolve to one versioned user-facing reference.
 * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Separates stable catalog identity from the concrete anchored knowledge path.
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

/** A stable production diagnostic returned by compiler, lint and MCP. */
export interface IAutoMovieDiagnostic {
  /**
   * Machine-readable diagnostic code from the shipped closed catalog.
   *
   * @evidence requirements/diagnostics/identity-path-and-context.md#diagnostics-code-catalog-reference Restricts actual delivery to one enumerable code set.
   * @evidence specifications/validation-and-diagnostics/diagnostic-identity-location-and-severity.md#validation-diagnostic-code-catalog-reference Uses the same key union the exhaustive catalog maps.
   */
  code: AutoMovieDiagnosticCode;
  /** Whether the diagnostic blocks the current operation. */
  category: "error" | "warning";
  /** Pipeline phase that owns the correction. */
  phase: "project" | "design" | "source" | "compile" | "review" | "render";
  /** Stable target identity. */
  target: string;
  /** Project-relative file or null when no one file owns it. */
  path: string | null;
  /**
   * Human-readable cause followed by the concrete correction owned by this
   * phase. Do not discard it and retry unchanged.
   */
  message: string;
}

/** The tracked manifest for a coding-agent production repository. */
export interface IAutoMovieProductionManifest {
  /** Production format version. */
  formatVersion: 2;
  /** Repository-local project identity, excluded from content fingerprints. */
  projectId: string;
  /**
   * Project-relative coding-agent-owned source directories. Shot modules must
   * resolve as real TypeScript files inside one of these roots.
   */
  sourceRoots: string[];
  /**
   * Additional project-relative directories whose exact files affect compile
   * and render identity, such as viewer, scripts and public assets.
   */
  contentRoots?: string[];
  /** Additional project-relative files whose bytes affect compile identity. */
  contentFiles?: string[];
  /**
   * Project-global asset provenance ledger.
   *
   * When declared, compiler asset references are restricted to the byte-exact
   * paths in this manifest.
   */
  assetManifest?: ".automovie/assets.json";
  /** Compiler-owned generated root. */
  generatedRoot: string;
  /** Content-addressed render root. */
  renderRoot: string;
  /** Optional non-destructive legacy import provenance. */
  importedLegacy?: {
    /** Imported legacy project revision. */
    revision: number;
    /** Relative source directory containing the untouched legacy tree. */
    sourceRoot: string;
  };
}

/** One compiler-owned generated file. */
export interface IAutoMovieGeneratedFile {
  /** Project-relative generated path. */
  path: string;
  /** Ownership marker. */
  owner: "compiler";
  /** File-byte digest. */
  digest: AutoMovieContentDigest;
  /** Design or source targets that produced the file. */
  sourceTargets: string[];
}

/** Manifest proving the identity and ownership of generated output. */
export interface IAutoMovieGeneratedManifest {
  /** Generated-manifest format. */
  version: 1;
  /** Compiler identity. */
  compiler: {
    /** Package version. */
    packageVersion: string;
    /** Content protocol version. */
    protocolVersion: string;
  };
  /** Ordered design and source input fingerprint. */
  inputFingerprint: AutoMovieContentDigest;
  /** Compiler-owned files. */
  files: IAutoMovieGeneratedFile[];
}

/** Compiler-owned registry of targets that evidence tools may resolve. */
export interface IAutoMovieProductionRegistryManifest {
  /** Registry format. */
  version: 2;
  /** Compiler protocol that produced this registry. */
  compiler: string;
  /** Exact production namespace. */
  productionId: string;
  /** Current aggregate compiler input fingerprint. */
  inputFingerprint: AutoMovieContentDigest;
  /** Built model/asset targets with their generated paths. */
  assets: Array<{
    /** Exact model recipe id. */
    id: string;
    /** Compiler-owned generated model path. */
    path: string;
  }>;
  /** Built shot targets with their generated paths. */
  shots: Array<{
    /** Exact shot registration id. */
    id: string;
    /** Compiler-owned generated shot path. */
    path: string;
  }>;
  /** Current compiler-owned film id, or null before film materialization. */
  film: string | null;
}

/** One byte-exact file proving a final production deliverable. */
export interface IAutoMovieProductionDeliverableFile {
  /** Render-root-relative regular file path. */
  path: string;
  /** Exact file-byte digest. */
  digest: AutoMovieContentDigest;
  /** Exact non-zero file size. */
  bytes: number;
  /** Explicit media type, such as video/mp4 or text/vtt. */
  mediaType: string;
}

/** One materialized production deliverable in the aggregate render ledger. */
export interface IAutoMovieProductionRenderedDeliverable {
  /** Exact id declared by production design. */
  id: string;
  /** Exact kind declared by production design. */
  kind: IAutoMovieProductionDeliverable["kind"];
  /** Byte-exact owned output files. */
  files: IAutoMovieProductionDeliverableFile[];
  /** Timeline duration, or null for a still-only deliverable. */
  runtimeSeconds: number | null;
  /** Rendered frame count, or null when the kind has no video frame clock. */
  frameCount: number | null;
  /** Actual codec name, or null for unencoded text/image artifacts. */
  codec: string | null;
  /**
   * Repaint provenance when this feature was conformed from selected visual
   * renditions. Absent for deterministic delivery and non-feature outputs.
   */
  rendition?: IAutoMovieProductionRenditionDelivery;
}

/** One selected repaint output and its independent review chain. */
export interface IAutoMovieProductionRenditionDeliveryShot {
  /** Exact compiled shot id. */
  shot: string;
  /** Render-root-relative immutable repaint output. */
  path: string;
  /** Exact current repaint output digest. */
  digest: AutoMovieContentDigest;
  /** Digest of the canonical immutable repaint receipt. */
  receiptDigest: AutoMovieContentDigest;
  /** Current completed deterministic source-shot review fingerprint. */
  sourceReviewFingerprint: AutoMovieContentDigest;
  /** Current completed visual-rendition review fingerprint. */
  renditionReviewFingerprint: AutoMovieContentDigest;
}

/** Review and receipt provenance for one repainted feature delivery. */
export interface IAutoMovieProductionRenditionDelivery {
  /** Explicit selected visual layer. */
  kind: "repainted";
  /** Every shot rendition consumed by the current film timeline. */
  shots: IAutoMovieProductionRenditionDeliveryShot[];
  /** Current completed sequence and film reviews of the selected renditions. */
  aggregateReviews: Array<{
    /** Aggregate review class. */
    kind: "sequence" | "film";
    /** Exact sequence or film id. */
    id: string;
    /** Current completed review fingerprint. */
    fingerprint: AutoMovieContentDigest;
  }>;
}

/** Aggregate final-delivery ledger bound to one current compile. */
export interface IAutoMovieProductionRenderManifest {
  /** Aggregate manifest format. */
  version: 1;
  /** Exact compiler input that produced every listed output. */
  compileFingerprint: AutoMovieContentDigest;
  /** Materialized required and optional deliverables. */
  deliverables: IAutoMovieProductionRenderedDeliverable[];
}

/** Parser-derived metadata for one renderer-owned output file. */
export type IAutoMovieProductionMediaProbe =
  | {
      /** Decoded PNG raster. */
      kind: "png";
      /** Actual pixel width. */
      width: number;
      /** Actual pixel height. */
      height: number;
    }
  | {
      /** Parsed ISO base-media video track. */
      kind: "video";
      /** Actual container family. */
      container: "mp4";
      /** Actual video codec family. */
      codec: "h264";
      /** Actual coded width. */
      width: number;
      /** Actual coded height. */
      height: number;
      /** Actual track duration in seconds. */
      runtimeSeconds: number;
      /** Actual video sample count. */
      frameCount: number;
      /** Actual constant frame rate. */
      fps: number;
    }
  | {
      /** Parsed ISO base-media audio track. */
      kind: "audio";
      /** Actual container family. */
      container: "mp4";
      /** Actual codec string reported by the container. */
      codec: string;
      /** Actual track duration in seconds. */
      runtimeSeconds: number;
      /** Actual audio channel count. */
      channels: number;
      /** Actual audio sample rate. */
      sampleRate: number;
      /** Number of non-empty resident coded packets. */
      sampleCount: number;
      /** Encoder priming discarded by the presentation timeline. */
      primingSamples: number;
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
    }
  | {
      /** Parsed deterministic sound evidence JSON. */
      kind: "sound-evidence";
      /** Number of semantic events in the sound plan. */
      eventCount: number;
      /** Number of locally synthesized dialogue receipts. */
      dialogueCount: number;
      /** Number of samples outside [-1, 1] in the final PCM. */
      clippingSamples: number;
      /** Whether every semantic event passed the frame-alignment gate. */
      eventAlignmentPassed: boolean;
    };

/** One file record independently derived by the renderer-owned receipt gate. */
export interface IAutoMovieProductionRenderReceiptFile extends IAutoMovieProductionDeliverableFile {
  /** Deliverable that exclusively owns this path. */
  deliverable: string;
  /** Parser-derived media facts. */
  probe: IAutoMovieProductionMediaProbe;
}

/** Renderer-owned aggregate receipt bound to current output bytes. */
export interface IAutoMovieProductionRenderReceipt {
  /** Receipt format. */
  version: 2;
  /** Exact digest of the active production's tracked render manifest. */
  manifestDigest: AutoMovieContentDigest;
  /** Exact byte and media probes in canonical path order. */
  files: IAutoMovieProductionRenderReceiptFile[];
}

/** Deterministic pure helpers exposed to a shot source builder. */
export interface IAutoMovieSourceOracle {
  /** Euclidean distance between two points. */
  distance(
    left: { x: number; y: number; z: number },
    right: { x: number; y: number; z: number },
  ): number;
  /** Height of the first matching world surface, or zero. */
  groundHeight(point: { x: number; z: number }): number;
  /** Regenerate one exact compiler-owned formation slot without expanding it. */
  formationSlot(formation: string, slot: number): IAutoMovieFormationSlot;
  /** Regenerate one exact compiler-owned general instance without expanding it. */
  instanceSlot(instanceSet: string, slot: number): IAutoMovieInstanceSlot;
}

/** One non-negative film time authored as an exact frame or frame-grid second. */
export type AutoMovieFilmTime =
  | {
      /** Zero-based production frame. */
      frame: number;
    }
  | {
      /** Seconds that must land exactly on the production frame clock. */
      seconds: number;
    };

/** A cut or bounded transition at one side of a video edit. */
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

/** One source-shot placement on the finished-film video track. */
export interface IAutoMovieVideoEdit {
  /** Current compiled shot id. */
  shot: string;
  /** Inclusive source frame. */
  sourceIn: AutoMovieFilmTime;
  /** Exclusive source frame. */
  sourceOut: AutoMovieFilmTime;
  /** Film-global inclusive start frame. */
  start: AutoMovieFilmTime;
  /** Available transition material at each side of this placement. */
  handles: {
    /** Available incoming frames. */
    head: AutoMovieFilmTime;
    /** Available outgoing frames. */
    tail: AutoMovieFilmTime;
  };
  /** Transition entering this placement. */
  transitionIn: IAutoMovieFilmTransition;
  /** Transition leaving this placement. */
  transitionOut: IAutoMovieFilmTransition;
}

/** One declared audio asset placement. */
export interface IAutoMovieAudioCue {
  /** Stable cue id. */
  id: string;
  /** Project-relative declared render-content asset. */
  asset: string;
  /** Declared source duration used for bounded trim validation. */
  sourceDuration: AutoMovieFilmTime;
  /** Source offset inside the asset. */
  sourceOffset: AutoMovieFilmTime;
  /** Film-global cue start. */
  start: AutoMovieFilmTime;
  /** Cue duration. */
  duration: AutoMovieFilmTime;
  /** Linear gain from silence through a bounded boost. */
  gain: number;
  /** Fade-in duration. */
  fadeIn: AutoMovieFilmTime;
  /** Fade-out duration. */
  fadeOut: AutoMovieFilmTime;
  /** Deterministic destination bus. */
  bus: "dialogue" | "music" | "effects" | "ambience";
}

/** One plain-text caption cue from which renderers may derive WebVTT. */
export interface IAutoMovieCaptionCue {
  /** Stable cue id. */
  id: string;
  /** Non-blank plain text. */
  text: string;
  /** Non-blank BCP-47-style language tag. */
  language: string;
  /** Optional speaker id. */
  speaker?: string;
  /** Film-global inclusive start. */
  start: AutoMovieFilmTime;
  /** Film-global exclusive end. */
  end: AutoMovieFilmTime;
}

/**
 * Effective readability measurements for one compiled caption cue.
 *
 * @author Samchon
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports grapheme, line, duration, and gap facts even when no profile can judge them.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Carries measurements separately from the optional verdict.
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
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Evaluates only a production-selected profile and otherwise records `not-run`.
 */
export type IAutoMovieCaptionReadabilityOutcome =
  | {
      /**
       * Profile-backed evaluation completed.
       *
       * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Distinguishes an evaluated cue from measure-only operation.
       * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Marks profile-backed comparison as completed.
       */
      status: "evaluated";
      /**
       * Exact production profile id.
       *
       * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Identifies the threshold set that judged the cue.
       * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Makes the verdict reproducible against one profile.
       */
      profile: string;
      /**
       * Requested segmentation algorithm and version used for measurement.
       *
       * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Binds the evaluated result to the selected segmentation identity.
       * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Makes the measurement algorithm and revision explicit in the report.
       */
      segmentation: {
        /**
         * Requested algorithm identity.
         *
         * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Carries the production-selected segmentation algorithm.
         * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Identifies the algorithm that produced grapheme measurements.
         */
        algorithm: string;
        /**
         * Requested algorithm or segmentation-data revision.
         *
         * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Carries the production-selected segmentation revision.
         * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Binds measurements to one algorithm revision.
         */
        version: string;
      };
      /**
       * Whether every profile-declared boundary passed.
       *
       * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports the aggregate result of declared comparisons.
       * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Does not infer success when evaluation was not run.
       */
      passed: boolean;
      /**
       * Stable names of boundaries exceeded by this cue.
       *
       * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Identifies which production-owned constraints need correction.
       * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Exposes per-boundary evaluation results.
       */
      breaches: Array<
        | "graphemes-per-second"
        | "lines-per-cue"
        | "graphemes-per-line"
        | "duration-frames"
        | "gap-frames"
      >;
    }
  | {
      /**
       * No production profile judged the measurement.
       *
       * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Prevents absent thresholds from becoming an implicit pass.
       * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Records measure-only operation explicitly.
       */
      status: "not-run";
      /**
       * Requested segmentation identity, or null when no profile was declared.
       *
       * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports the exact unsupported production choice without substituting a fallback.
       * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Preserves requested algorithm and revision on non-evaluation.
       */
      segmentation: {
        /**
         * Requested algorithm identity.
         *
         * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Identifies the unsupported production-selected algorithm.
         * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Prevents fallback algorithm inference.
         */
        algorithm: string;
        /**
         * Requested algorithm or segmentation-data revision.
         *
         * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Identifies the unsupported production-selected revision.
         * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Prevents fallback revision inference.
         */
        version: string;
      } | null;
      /**
       * Exact reason a verdict was not computed.
       *
       * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Explains profile absence instead of inventing a default.
       * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Makes the non-evaluation cause machine-readable.
       */
      reason:
        | "caption-readability-profile-not-declared"
        | "caption-grapheme-segmentation-unsupported";
    };

/**
 * Readability report kept outside the byte-stable compiled edit.
 *
 * @author Samchon
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports metrics without modifying legacy caption output when no profile exists.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Joins each measurement to its evaluated or not-run outcome.
 */
export interface IAutoMovieCaptionReadabilityReport {
  /**
   * Caption-readability report schema.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Versions the measurement and outcome record.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Makes report interpretation explicit.
   */
  version: 1;
  /**
   * Cue reports in canonical film and cue order.
   *
   * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Reports every measured cue in deterministic order.
   * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Joins measurements and outcomes without modifying the edit.
   */
  cues: Array<{
    /**
     * Effective cue measurements.
     *
     * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Preserves measured facts even without a profile.
     * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Keeps measurement separate from judgment.
     */
    measurement: IAutoMovieCaptionReadabilityMeasurement;
    /**
     * Profile-backed verdict or explicit measure-only outcome.
     *
     * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Distinguishes evaluated failure, evaluated pass, and profile absence.
     * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Joins each measurement to exactly one outcome state.
     */
    outcome: IAutoMovieCaptionReadabilityOutcome;
  }>;
}

/** One bounded reference to a registered deterministic world effect zone. */
export interface IAutoMovieEffectCue {
  /** Stable cue id. */
  id: string;
  /** Supported compiler-owned recipe family. */
  recipe: "world-zone";
  /** Existing world effect-zone id. */
  zone: string;
  /** Film-global cue start. */
  start: AutoMovieFilmTime;
  /** Cue duration. */
  duration: AutoMovieFilmTime;
  /** Bounded normalized strength. */
  intensity: number;
}

/** Explicit narrative-shot omission disposition. */
export interface IAutoMovieFilmOmission {
  /** Current shot contract intentionally absent from the edit. */
  shot: string;
  /** Auditable non-blank reason. */
  reason: string;
}

/** Coding-agent-authored finished-film edit before frame normalization. */
export interface IAutoMovieFilmEdit {
  /** Stable film id, equal to production id. */
  id: string;
  /** Explicit accounting for intentionally unused shot contracts. */
  omissions: IAutoMovieFilmOmission[];
  /** Narrow deterministic edit tracks. */
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

/** Frozen design and ownership facts available to the film source builder. */
export interface IAutoMovieFilmBuildContext {
  /** Current production design. */
  production: IAutoMovieProductionDesign;
  /** Current shot contracts keyed by id. */
  shots: Readonly<Record<string, IAutoMovieShotContract>>;
  /** Declared, present render-content paths. */
  assets: readonly string[];
  /** Current registered deterministic effect zones. */
  effectZones: Readonly<IAutoMovieWorldDesign["effectZones"]>;
}

/** Coding-agent-owned deterministic film module export. */
export interface IAutoMovieFilmSource {
  /** Build one finished-film edit from frozen compiler context. */
  build(context: IAutoMovieFilmBuildContext): IAutoMovieFilmEdit;
}

/** Compiler-owned envelope preserving the exact validated authored edit. */
export interface IAutoMovieCompiledFilmEdit {
  /** Generated edit format. */
  version: 1;
  /** Compiler protocol that validated the edit. */
  compiler: string;
  /** Exact aggregate compile input. */
  inputFingerprint: AutoMovieContentDigest;
  /** Film source provenance. */
  source: {
    /** Project-relative module path. */
    path: string;
    /** Named build export. */
    export: string;
    /** Digest of normalized TypeScript source. */
    digest: AutoMovieContentDigest;
  };
  /** Strict authored edit returned by the deterministic sandbox. */
  edit: IAutoMovieFilmEdit;
}

/** One frame-normalized video segment in the canonical film timeline. */
export interface IAutoMovieFilmTimelineSegment {
  /** Current compiled shot id. */
  shot: string;
  /** Inclusive source frame. */
  sourceInFrame: number;
  /** Exclusive source frame. */
  sourceOutFrame: number;
  /** Film-global inclusive start frame. */
  startFrame: number;
  /** Film-global exclusive end frame. */
  endFrame: number;
  /** Available incoming handle frames. */
  headHandleFrames: number;
  /** Available outgoing handle frames. */
  tailHandleFrames: number;
  /** Normalized incoming transition. */
  transitionIn:
    | { kind: "cut" }
    | { kind: "dissolve" | "fade"; durationFrames: number };
  /** Normalized outgoing transition. */
  transitionOut:
    | { kind: "cut" }
    | { kind: "dissolve" | "fade"; durationFrames: number };
}

/** Canonical global timeline consumed by review, oracle and render layers. */
export interface IAutoMovieFilmTimeline {
  /** Generated timeline format. */
  version: 1;
  /** Compiler protocol that derived the timeline. */
  compiler: string;
  /** Exact aggregate compile input. */
  inputFingerprint: AutoMovieContentDigest;
  /** Digest of normalized `src/film.ts` bytes. */
  sourceDigest: AutoMovieContentDigest;
  /** Stable finished-film id. */
  id: string;
  /** Production frame rate. */
  fps: number;
  /** Exact target and derived timeline duration. */
  totalFrames: number;
  /** Ordered global-to-shot mapping. */
  segments: IAutoMovieFilmTimelineSegment[];
  /** Explicitly omitted current narrative shots. */
  omissions: IAutoMovieFilmOmission[];
  /** Frame-normalized non-video tracks. */
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

/** Frozen input available to a coding-agent-owned shot source builder. */
export interface IAutoMovieShotBuildContext {
  /** Current shot contract. */
  contract: IAutoMovieShotContract;
  /** Current model recipes keyed by id. */
  models: Readonly<Record<string, IAutoMovieModelRecipe>>;
  /**
   * The production's story-clock light sources, when it declares any.
   *
   * The source reads what the production is lit by at this shot's story moment
   * — its contract carries the pin — and states its own local light on top
   * through {@link IAutoMovieProductionShotProgram.lightMotions}. Absent when
   * the production declares no lighting, which is exactly the context a source
   * saw before the field existed.
   */
  lighting?: IAutoMovieProductionLighting;
  /** Current world design. */
  world: IAutoMovieWorldDesign;
  /** Current formations keyed by id. */
  formations: Readonly<Record<string, IAutoMovieFormationDesign>>;
  /** Compiler-generated primitive runtime models keyed by recipe id. */
  runtimeModels: Readonly<Record<string, IAutoMovieModel>>;
  /** Compact compiler-derived formation runtimes keyed by formation id. */
  formationRuntime: Readonly<Record<string, IAutoMovieCompiledFormation>>;
  /** Compact compiler-derived general instance runtimes keyed by set id. */
  instanceSetRuntime: Readonly<Record<string, IAutoMovieCompiledInstanceSet>>;
  /** Deterministic geometry helpers. */
  engine: IAutoMovieSourceOracle;
}

/** One deterministic formation member materialized from compact design. */
export interface IAutoMovieFormationSlot {
  /** Zero-based deterministic slot index. */
  slot: number;
  /** Compiler-owned scene-node id. */
  node: string;
  /** Named hero actor at this slot, or null. */
  actor: string | null;
  /** Runtime model recipe id. */
  modelRecipe: string;
  /** Compiler-derived world position in meters. */
  position: IAutoMovieVector3;
  /** Compiler-derived world-space heading in degrees. */
  facingDeg: number;
  /** Stable normalized phase used by bounded instance motion. */
  motionPhase: number;
}

/** Axis-aligned world-space bounds of a compact formation range. */
export interface IAutoMovieFormationBounds {
  /** Minimum world-space corner. */
  min: IAutoMovieVector3;
  /** Maximum world-space corner. */
  max: IAutoMovieVector3;
}

/** One bounded slot range regenerated independently by viewer workers. */
export interface IAutoMovieFormationChunk {
  /** Zero-based stable chunk index. */
  index: number;
  /** Inclusive first slot. */
  start: number;
  /** Number of slots in this chunk. */
  count: number;
  /** Anonymous slots rendered through instancing after hero exclusion. */
  anonymousCount: number;
  /** Exact world-space range bounds. */
  bounds: IAutoMovieFormationBounds;
  /** Exact arithmetic centroid of the range. */
  centroid: IAutoMovieVector3;
}

/** One slot promoted out of anonymous batches into an explicit scene node. */
export interface IAutoMovieCompiledFormationHero {
  /** Exact promoted slot. */
  slot: number;
  /** Named explicit scene-node id. */
  actor: string;
  /** Compiler-owned base transform before source-authored performance. */
  transform: IAutoMovieTransform;
}

/** One camera-selected runtime representation for anonymous formation slots. */
export interface IAutoMovieCompiledFormationLod {
  /** Semantic near-to-far tier. */
  tier: "hero" | "near" | "far";
  /** Positive maximum distance, or null only for the final tier. */
  maxDistance: number | null;
  /** Design recipe id. */
  recipe: string;
  /** Exact current recipe digest, including geometry and palette parameters. */
  recipeDigest: AutoMovieContentDigest;
  /** Compiler-owned runtime model id. */
  model: string;
}

/** Compact generated formation runtime; it never stores every anonymous slot. */
export interface IAutoMovieCompiledFormation {
  /** Generated formation format. */
  version: 1;
  /** Stable formation design id. */
  id: string;
  /** Exact designed slot count. */
  count: number;
  /** Count remaining in instance batches after hero exclusion. */
  anonymousCount: number;
  /** Base design recipe. */
  modelRecipe: string;
  /** Exact compact layout algorithm and parameters. */
  layout: IAutoMovieFormationDesign["layout"];
  /** World-space origin. */
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
   */
  ground: IAutoMovieWorldDesign["surfaces"];
  /** World-space base heading in degrees. */
  facingDeg: number;
  /** Full safe-integer design seed. */
  seed: number;
  /** Exact bounds of all slots. */
  bounds: IAutoMovieFormationBounds;
  /** Exact arithmetic centroid of all slots. */
  centroid: IAutoMovieVector3;
  /** Compiler-derived representative member radius used by LOD projection. */
  projectionRadius: number;
  /** Bounded independently regenerable slot ranges. */
  chunks: IAutoMovieFormationChunk[];
  /** Explicit hero promotions, ordered by slot. */
  heroes: IAutoMovieCompiledFormationHero[];
  /** Ordered automatic LOD representations. */
  lod: IAutoMovieCompiledFormationLod[];
  /**
   * Deterministic per-slot phase generator contract.
   *
   * Phase is where in its cycle one member stands, never how fast that cycle
   * runs: cadence follows the ground a member's own unit covers under its cues,
   * so a compiled cycle length would be a second answer to a question the cue
   * already answers, and a seeded one would be unrelated to what the unit
   * does.
   */
  phase: {
    /** Domain-separated safe-integer seed. */
    seed: number;
  };
  /** Digest of every field above except this digest. */
  digest: AutoMovieContentDigest;
}

/** One exactly regenerated member of a non-formation instance set. */
export interface IAutoMovieInstanceSlot {
  /** Zero-based deterministic slot index. */
  slot: number;
  /** Compiler-owned stable instance id. */
  node: string;
  /** Runtime model recipe id. */
  modelRecipe: string;
  /** Selected prototype id; omitted for a legacy single-prototype set. */
  prototype?: string;
  /** Compiler-derived world position in meters. */
  position: IAutoMovieVector3;
  /** Compiler-derived world-space heading in degrees. */
  facingDeg: number;
  /** Positive uniform scale. */
  scale: number;
  /** Exact full rotation for an enhanced set. */
  rotation?: IAutoMovieQuaternion;
  /** Exact non-uniform scale for an enhanced set. */
  scale3?: IAutoMovieVector3;
  /** Explicit or seeded visibility for an enhanced set. */
  visible?: boolean;
  /** Selected exact sRGB palette value. */
  palette: string;
  /** Seed-derived numeric traits keyed by declared name. */
  traits: Record<string, number>;
}

/** One independently regenerable range of a general instance set. */
export interface IAutoMovieInstanceChunk {
  /** Zero-based stable chunk index. */
  index: number;
  /** Inclusive first slot. */
  start: number;
  /** Number of slots in this chunk. */
  count: number;
  /** Exact world-space range bounds. */
  bounds: IAutoMovieFormationBounds;
  /** Exact arithmetic centroid of the range. */
  centroid: IAutoMovieVector3;
}

/** Compact generated runtime for a non-formation instance set. */
export interface IAutoMovieCompiledInstanceSet {
  /** Generated instance-set format. */
  version: 1;
  /** Stable world-design id. */
  id: string;
  /** Exact designed slot count. */
  count: number;
  /** Base design recipe. */
  modelRecipe: string;
  /** Resolved prototype runtimes; omitted for a legacy single-prototype set. */
  prototypes?: IAutoMovieCompiledInstancePrototype[];
  /** Exact compact placement law. */
  layout: IAutoMovieInstanceSetDesign["layout"];
  /**
   * Resolved route geometry for `along-route`, or null for local layouts.
   *
   * The viewer and source oracle regenerate slots from this snapshot without
   * consulting mutable world design.
   */
  route: IAutoMovieWorldDesign["routes"][number] | null;
  /** World-space origin for local layouts. */
  anchor: IAutoMovieVector3;
  /** World-space base heading in degrees. */
  facingDeg: number;
  /** Full safe-integer design seed. */
  seed: number;
  /** Exact seed-derived visual and semantic variation law. */
  variation: IAutoMovieInstanceSetDesign["variation"];
  /** Exact bounds of all generated slots. */
  bounds: IAutoMovieFormationBounds;
  /** Exact arithmetic centroid of all generated slots. */
  centroid: IAutoMovieVector3;
  /** Compiler-derived representative radius used by viewer culling. */
  projectionRadius: number;
  /** Bounded independently regenerable slot ranges. */
  chunks: IAutoMovieInstanceChunk[];
  /** Ordered automatic LOD representations. */
  lod: IAutoMovieCompiledFormationLod[];
  /** Digest of every field above except this digest. */
  digest: AutoMovieContentDigest;
}

/** One compiler-resolved reusable prototype in a general instance set. */
export interface IAutoMovieCompiledInstancePrototype {
  /** Stable source prototype id. */
  id: string;
  /** Source model recipe. */
  modelRecipe: string;
  /** Positive deterministic selection weight. */
  weight: number;
  /** Ordered automatic LOD representations for this prototype. */
  lod: IAutoMovieCompiledFormationLod[];
  /** Conservative source-model radius before per-slot scaling. */
  projectionRadius: number;
}

/** One compact formation-level transform state relative to its designed base. */
export interface IAutoMovieFormationMotionState {
  /** World-space translation added to the designed formation anchor. */
  translation: IAutoMovieVector3;
  /** Heading offset added around the designed anchor, in degrees. */
  facingOffsetDeg: number;
  /** Positive lateral and depth scale for bounded density deformation. */
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
 */
export interface IAutoMovieFormationMotion {
  /** Stable cue id, unique inside one shot. */
  id: string;
  /** Participating compiled formation id. */
  formation: string;
  /** Review-facing action expressed by this exact cue. */
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
   */
  layout?: IAutoMovieFormationDesign["layout"];
  /** Inclusive shot-local cue start. */
  start: number;
  /** Exclusive shot-local cue end. */
  end: number;
  /** State at cue start. */
  from: IAutoMovieFormationMotionState;
  /** State at cue end. */
  to: IAutoMovieFormationMotionState;
  /** Deterministic interpolation curve. */
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
   */
  present: boolean;
  /** Displacement from the member's designed place, in unit-local meters. */
  offset: IAutoMovieVector3;
  /** Heading added to the member's placed heading, in degrees. */
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
 */
export interface IAutoMovieFormationSlotMotion {
  /** Stable cue id, unique inside one shot. */
  id: string;
  /** Participating compiled formation id. */
  formation: string;
  /**
   * Zero-based slots this exception names, unique and below the unit's count.
   *
   * Several slots share one cue when the same thing happens to each of them at
   * the same time; a member that needs its own timing gets its own cue.
   */
  slots: number[];
  /** Inclusive shot-local cue start. */
  start: number;
  /** Exclusive shot-local cue end. */
  end: number;
  /** Member state at cue start. */
  from: IAutoMovieFormationSlotState;
  /** Member state at cue end. */
  to: IAutoMovieFormationSlotState;
  /** Deterministic interpolation curve. */
  easing: IAutoMovieFormationMotion["easing"];
}

/** One source-authored shot-local effect activation. */
export interface IAutoMovieShotEffectCue {
  /** Stable cue id, unique inside one shot. */
  id: string;
  /** Existing world effect-zone id. */
  zone: string;
  /** Inclusive shot-local start in seconds. */
  start: number;
  /** Exclusive shot-local end in seconds. */
  end: number;
  /** Bounded intensity envelope. */
  intensity: {
    /** Intensity at cue start. */
    from: number;
    /** Intensity at cue end. */
    to: number;
  };
  /** Optional authoritative shot event that must realize inside this cue. */
  event?: string;
}

/** Compiler-owned deterministic effect runtime consumed by viewer and oracle. */
export interface IAutoMovieCompiledEffect {
  /** Generated effect format. */
  version: 1;
  /** Stable source cue id. */
  id: string;
  /** Existing world zone id. */
  zone: string;
  /** Supported primitive effect family. */
  kind: IAutoMovieEffectRecipe["kind"];
  /** Exact world-space emitter bounds. */
  bounds: IAutoMovieWorldDesign["effectZones"][number]["bounds"];
  /** Domain-separated deterministic stream seed. */
  seed: number;
  /** Exact current recipe. */
  recipe: IAutoMovieEffectRecipe;
  /** Inclusive shot-local cue start. */
  start: number;
  /** Exclusive shot-local cue end. */
  end: number;
  /** Bounded cue intensity envelope. */
  intensity: IAutoMovieShotEffectCue["intensity"];
  /** Bound authoritative event, when present. */
  event?: string;
  /** Production frame-clock simulation step. */
  fixedStepSeconds: number;
  /** Digest of every field above except this digest. */
  digest: AutoMovieContentDigest;
}

/** Engine-compiled shot source before production materialization is added. */
export interface IAutoMovieShotSourceOutput {
  /** Source-owned generated models retained for materialization and evidence. */
  authoredModels?: IAutoMovieModel[];
  /** Source-owned production props retained with their semantic contracts. */
  props?: IAutoMoviePropSpec[];
  /** Structured buildings retained for spatial queries and evidence. */
  builtEnvironments?: IAutoMovieBuiltEnvironment[];
  /** Observation documents the building source read, kept as provenance. */
  designReferences?: IAutoMovieDesignReference[];
  /** Citations from authored design members back to those observations. */
  designEvidence?: IAutoMovieDesignEvidence[];
  /** Phase, alternative and change-impact lineage over those identities. */
  designLineages?: IAutoMovieDesignLineage[];
  /** Independent deterministic fluid domains this shot's source declares. */
  fluidDomains?: IAutoMovieFluidDomain[];
  /** Bindings that make those domains a building's own water features. */
  waterFeatures?: IAutoMovieWaterFeature[];
  /** Cloth and cushion domains this shot's source declares. */
  softBodyDomains?: IAutoMovieSoftBodyDomain[];
  /** Bindings that hang those domains on a building's own elements. */
  softFurnishings?: IAutoMovieSoftFurnishing[];
  /** Growth recipes for the planting this shot's source declares. */
  plantingDomains?: IAutoMoviePlantingDomain[];
  /** Arrangements those recipes are grown into. */
  plantingClusters?: IAutoMoviePlantingCluster[];
  /** Bindings that plant those clusters in a building's own spaces. */
  plantingInstallations?: IAutoMoviePlantingInstallation[];
  /** Port networks that serve the buildings this shot stages. */
  serviceNetworks?: IAutoMovieServiceNetwork[];
  /** Event sample times selected inside authoritative event windows. */
  eventSamples: Array<{
    /** Exact event-contract id. */
    id: string;
    /** Shot-local time at which the compiler evaluates its predicates. */
    time: number;
  }>;
  /** Scene derived by staging the source-authored program. */
  scene: IAutoMovieScene;
  /** Deterministic motions synthesized and assembled by the engine. */
  motions: IAutoMovieMotion[];
  /**
   * Optional compact formation-level cues. The compiler materializes an empty
   * list when omitted; source never emits arbitrary per-member curves.
   */
  formationMotions?: IAutoMovieFormationMotion[];
  /**
   * Optional sparse per-member exceptions inside compact formations. The
   * compiler materializes an empty list when omitted; the cost is the number of
   * exceptions, never the number of members.
   */
  formationSlotMotions?: IAutoMovieFormationSlotMotion[];
  /** Optional bounded shot-local deterministic effect cues. */
  effectCues?: IAutoMovieShotEffectCue[];
  /** Engine-compiled shot choreography. */
  shot: IAutoMovieShot;
}

/** Fully compiler-owned shot artifact consumed by render and oracle services. */
export interface IAutoMovieCompiledShotSource extends IAutoMovieShotSourceOutput {
  /** Models required by this shot. */
  models: IAutoMovieModel[];
  /** Compact formation runtimes required by this shot. */
  formations: IAutoMovieCompiledFormation[];
  /** Compact general instance runtimes placed by the production world. */
  instanceSets: IAutoMovieCompiledInstanceSet[];
  /** Validated compact formation-level cues, empty when source omitted them. */
  formationMotions: IAutoMovieFormationMotion[];
  /** Validated sparse per-member exceptions, empty when source omitted them. */
  formationSlotMotions: IAutoMovieFormationSlotMotion[];
  /** Compiler-owned deterministic effect runtimes. */
  effects: IAutoMovieCompiledEffect[];
}

/** One scalar predicate and the value measured by the compiler. */
export interface IAutoMovieCompiledPredicateResult {
  /** Exact authoritative predicate. */
  predicate: IAutoMovieShotPredicate;
  /** Actual sampled value, or null when the operand could not be resolved. */
  actual: number | null;
  /** Whether the authoritative comparison passed. */
  passed: boolean;
}

/** Compiler-derived realization of one shot contract. */
export interface IAutoMovieCompiledContractRealization {
  /** Realization format. */
  version: 1;
  /** Exact compiled shot id. */
  shot: string;
  /** Opening-state outcomes sampled at time zero. */
  opening: Array<{
    /** Exact state id. */
    id: string;
    /** Compiler-owned predicate results. */
    predicates: IAutoMovieCompiledPredicateResult[];
    /** Whether every predicate passed. */
    passed: boolean;
  }>;
  /** Closing-state outcomes sampled at the shot duration. */
  closing: Array<{
    /** Exact state id. */
    id: string;
    /** Compiler-owned predicate results. */
    predicates: IAutoMovieCompiledPredicateResult[];
    /** Whether every predicate passed. */
    passed: boolean;
  }>;
  /** Semantic event outcomes sampled inside their declared windows. */
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
  /** Camera root-projection checks at authoritative review times. */
  camera: Array<{
    /** Shot-local sample time. */
    time: number;
    /** Number of required subjects. */
    requiredSubjects: number;
    /** Number resolved in current compiled output. */
    resolvedSubjects: number;
    /** Number whose root point is inside depth and frame bounds. */
    readableSubjects: number;
    /** Whether every required root point is readable. */
    passed: boolean;
  }>;
  /** Compiler-materialized formation summaries. */
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

/** One realized shot event placed on the production story clock. */
export interface IAutoMovieStorySyncPoint {
  /** Owning shot id. */
  shot: string;
  /** Exact event id. */
  event: string;
  /**
   * Compiler-realized shot-local time in seconds, or null when the owning shot
   * has no current realization for the event.
   */
  localSeconds: number | null;
  /**
   * Story-clock time in seconds, or null when the local time is unavailable or
   * the owning shot carries no story-clock pin.
   */
  storySeconds: number | null;
}

/** Measured verdict of one cross-shot story-clock simultaneity claim. */
export interface IAutoMovieStorySyncOutcome {
  /** Every addressed event and where it landed on the story clock. */
  points: IAutoMovieStorySyncPoint[];
  /**
   * Widest gap between two addressed story times in seconds, or null when any
   * operand failed to resolve.
   */
  spreadSeconds: number | null;
  /** Required tolerance in story seconds. */
  toleranceSeconds: number;
  /** Whether every point resolved and the widest gap is within tolerance. */
  passed: boolean;
  /**
   * Deterministic one-line account of the measurement, naming the two events
   * that produced the widest gap or the first operand that failed to resolve.
   */
  summary: string;
}

/** Coding-agent-owned module export compiled in a deterministic sandbox. */
export interface IAutoMovieShotSource {
  /** Exact registered shot id selected by the design source pointer. */
  id: IAutoMovieDefinedShot<IAutoMovieShotBuildContext>["id"];
  /** Exact staged-scene id the returned program must author. */
  scene: IAutoMovieDefinedShot<IAutoMovieShotBuildContext>["scene"];
  /** Measurable source-owned contract, checked against the design contract. */
  contract: IAutoMovieDefinedShot<IAutoMovieShotBuildContext>["contract"];
  /**
   * Build a thin stage/block/performance program.
   *
   * The production host, not source code, supplies rig capabilities and runs
   * the engine pipeline that lowers this program into scene, motion, and shot
   * artifacts.
   */
  build(context: IAutoMovieShotBuildContext): IAutoMovieProductionShotProgram;
}

/**
 * Thin engine program plus production-only compact cues.
 *
 * Formation and effect cues remain declarative compiler inputs; dense actor
 * motion, scene, and shot artifacts are deliberately absent.
 */
export interface IAutoMovieProductionShotProgram extends IAutoMovieShotProgram {
  /**
   * Source-owned generated models assembled by ordinary TypeScript. Imported
   * assets remain compiler-owned production inputs rather than sandbox output.
   */
  models?: IAutoMovieModel[];
  /** Source-owned semantic props whose model and behavior are validated. */
  props?: IAutoMoviePropSpec[];
  /**
   * Code-authored buildings used by the shot. They remain structured in the
   * compiled artifact; visible placements and support space are staged from the
   * same record rather than transcribed into a second design.
   */
  builtEnvironments?: IAutoMovieBuiltEnvironment[];
  /**
   * Observation documents the building source read, carried as provenance.
   *
   * A reading is never promoted into the design. They are here so the compiler
   * can hold each document against the bytes it claims to have observed and
   * refuse a citation whose file has moved on.
   */
  designReferences?: IAutoMovieDesignReference[];
  /** Citations from authored design members back to those observations. */
  designEvidence?: IAutoMovieDesignEvidence[];
  /** Phase, alternative and change-impact lineage over those identities. */
  designLineages?: IAutoMovieDesignLineage[];
  /** Independent deterministic fluid domains this shot's source declares. */
  fluidDomains?: IAutoMovieFluidDomain[];
  /** Bindings that make those domains a building's own water features. */
  waterFeatures?: IAutoMovieWaterFeature[];
  /** Cloth and cushion domains this shot's source declares. */
  softBodyDomains?: IAutoMovieSoftBodyDomain[];
  /** Bindings that hang those domains on a building's own elements. */
  softFurnishings?: IAutoMovieSoftFurnishing[];
  /** Growth recipes for the planting this shot's source declares. */
  plantingDomains?: IAutoMoviePlantingDomain[];
  /** Arrangements those recipes are grown into. */
  plantingClusters?: IAutoMoviePlantingCluster[];
  /** Bindings that plant those clusters in a building's own spaces. */
  plantingInstallations?: IAutoMoviePlantingInstallation[];
  /** Port networks that serve the buildings this shot stages. */
  serviceNetworks?: IAutoMovieServiceNetwork[];
  /**
   * Optional source-computed clips cited only by explicit `enact` actions.
   *
   * The host still masks, layers, ROM-checks, and assembles these clips through
   * `performShot`; they are not precompiled shot output.
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
   */
  objectMotions?: IAutoMovieClip[];
  /** Optional compact formation-level cues. */
  formationMotions?: IAutoMovieFormationMotion[];
  /** Optional sparse per-member exceptions inside compact formations. */
  formationSlotMotions?: IAutoMovieFormationSlotMotion[];
  /** Optional bounded shot-local deterministic effect cues. */
  effectCues?: IAutoMovieShotEffectCue[];
}

/** Compact inventory returned by project inspection. */
export interface IAutoMovieProductionDesignInventory {
  /** Whether the active production design exists. */
  production: boolean;
  /** Model recipe ids. */
  models: string[];
  /** Whether the project-shared world design exists. */
  world: boolean;
  /** Formation ids. */
  formations: string[];
  /** Shot contract ids. */
  shots: string[];
  /** Acceptance scenario ids. */
  acceptance: string[];
}

/** One discovered renderer-owned evidence bundle. */
export interface IAutoMovieProductionRenderStatus {
  /** Project-relative bundle manifest. */
  path: string;
  /** Whether the bundle matches current target-local inputs. */
  current: boolean;
}

/** Compact project status for CLI and lint consumers. */
export interface IAutoMovieProductionInspection {
  /** Current project revision. */
  revision: number;
  /** Typed design inventory. */
  design: IAutoMovieProductionDesignInventory;
  /** Coding-agent and compiler ownership status. */
  source: {
    /** Bound source modules that currently exist. */
    bound: string[];
    /** Bound source modules that are missing or unsafe. */
    missing: string[];
    /** Files under generated absent from its manifest. */
    unownedGenerated: string[];
  };
  /** Current structural and ownership diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
  /** Current review ledger projection. */
  reviews: IAutoMovieReviewQueue;
  /** Discovered render manifests. */
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
  /** Ordered concrete corrections. */
  nextActions: IAutoMovieProductionNextAction[];
}

/** One action that moves the production toward a clean compile. */
export interface IAutoMovieProductionNextAction {
  /** Owning surface. */
  owner: "design" | "source" | "compile" | "review" | "render";
  /** Exact package API or coding-agent command to run. */
  action: string;
  /** Exact target or artifact to correct. */
  target: string;
  /** Why this action is next. */
  reason: string;
}

/** Consequences computed before one design mutation is committed. */
export interface IAutoMovieDesignMutationConsequences {
  /** Review targets that become stale. */
  staleReviews: IAutoMovieReviewTarget[];
  /** Render bundle ids that become stale. */
  staleRenders: string[];
  /** Generated paths invalidated by the mutation. */
  removedGenerated: string[];
}

/** Result shared by the one-artifact design setters and eraser. */
export interface IAutoMovieDesignMutationOutput {
  /** Whether the complete mutation was atomically committed. */
  accepted: boolean;
  /** Current monotonic project revision. */
  revision: number;
  /** Exact addressed target. */
  target: IAutoMovieDesignTarget;
  /** Current target digest, or null when refused or erased. */
  fingerprint: AutoMovieContentDigest | null;
  /**
   * Downstream review, render and generated artifacts made stale or removed by
   * the accepted mutation, or predicted for a refused mutation.
   */
  consequences: IAutoMovieDesignMutationConsequences;
  /**
   * Validation, reference and downstream diagnostics. A refused mutation never
   * changes tracked state; accepted warnings must be corrected before compile.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/** One materialized compiler file and its write status. */
export interface IAutoMovieMaterializedFile extends IAutoMovieGeneratedFile {
  /** Whether bytes were first created, updated, or already current. */
  status: "created" | "updated" | "unchanged";
}

/** A compile request with progressively stricter gates. */
export interface IAutoMovieCompileProjectInput {
  /**
   * Highest atomic gate to enforce. `design` validates the tracked graph only;
   * `source` additionally compiles sandboxed TypeScript and materializes owned
   * generated artifacts; `review` additionally requires every current review
   * target complete; `final` additionally verifies required renderer-owned
   * deliverables, byte receipts and parsed media facts.
   */
  scope: "design" | "source" | "review" | "final";
}

/** Result of an atomic production compile. */
export interface IAutoMovieCompileProjectOutput {
  /**
   * Whether every error-level check through the requested scope passed. False
   * means no partial generated publication occurred.
   */
  success: boolean;
  /** Current project revision. */
  revision: number;
  /** Compiler and input identity. */
  compiler: {
    /** Compiler package version. */
    version: string;
    /** Current design and source fingerprint. */
    inputFingerprint: AutoMovieContentDigest;
  };
  /** Ordered diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
  /** Current review queue. */
  reviews: IAutoMovieReviewQueue;
  /**
   * Compiler-owned files created, updated or already current. Empty for design
   * scope and for every refused atomic compile.
   */
  materialized: IAutoMovieMaterializedFile[];
}

/**
 * Review target forward declaration kept here to avoid requiring callers to
 * import a second module for mutation consequences.
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
    };

/** One target and its derived review state. */
export interface IAutoMovieReviewQueueEntry {
  /** Review target. */
  target: IAutoMovieReviewTarget;
  /** Current queue state. */
  state: "missing" | "stale" | "incomplete" | "revise" | "complete";
  /** Current target fingerprint. */
  currentFingerprint: AutoMovieContentDigest | null;
  /** Stored review fingerprint when a record exists. */
  storedFingerprint: AutoMovieContentDigest | null;
}

/** Current review states in deterministic target order. */
export interface IAutoMovieReviewQueue {
  /** One entry per required review target. */
  entries: IAutoMovieReviewQueueEntry[];
}

import { AutoMovieGuidePass } from "../cinematics";
import {
  IAutoMovieCompiledContractRealization,
  IAutoMovieDiagnostic,
  IAutoMovieProductionMediaProbe,
  IAutoMovieReviewTarget,
  IAutoMovieStorySyncOutcome,
} from "./IAutoMovieProductionCompiler";
import {
  AutoMovieContentDigest,
  IAutoMovieDesignTarget,
} from "./IAutoMovieProductionDesign";
import type { IAutoMovieRenderBundleManifest } from "./IAutoMovieProductionOracle";
import type {
  IAutoMovieSubjectReviewCoverage,
  IAutoMovieSubjectReviewTarget,
  IAutoMovieSubjectReviewUnit,
} from "./IAutoMovieSubjectReview";
import type { IAutoMovieRepaintParameters } from "./application/IAutoMovieRepaintShot";

/**
 * A design or source selector that may be quoted in a review.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMovieReviewEvidenceSelector` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMovieReviewEvidenceSelector` for the review system execution status system contract.
 */
export type IAutoMovieReviewEvidenceSelector =
  | {
      /** Typed design value. */
      kind: "design";
      /** Exact design target. */
      target: IAutoMovieDesignTarget;
      /** RFC 6901 JSON pointer. */
      pointer: string;
    }
  | {
      /** Coding-agent-owned source line. */
      kind: "source";
      /** Project-relative source path. */
      path: string;
      /** One-based line number. */
      line: number;
    }
  | {
      /** Current compiler diagnostic. */
      kind: "diagnostic";
      /** Diagnostic code. */
      code: string;
      /** Diagnostic project path or empty string when none. */
      path: string;
    }
  | {
      /** Compiled subject description addressed as its own review unit. */
      kind: "subject";
      /** Exact compiled subject prepared for this review. */
      target: IAutoMovieSubjectReviewTarget;
      /** RFC 6901 JSON pointer into the compiled subject description. */
      pointer: string;
    };

/**
 * One current frame available as visual-review evidence.
 *
 * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `IAutoMovieFrameEvidenceReference` as the portable data boundary for the acceptance current historical evidence requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `IAutoMovieFrameEvidenceReference` for the acceptance system current historical evidence system contract.
 */
export interface IAutoMovieFrameEvidenceReference {
  /**
   * Exact rendered subject, including an asset's required view.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `target` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `target` for the acceptance system current historical evidence system contract.
   */
  target: IAutoMovieRenderBundleManifest["target"];
  /**
   * Authoritative review-frame contract id.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `reviewFrame` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `reviewFrame` for the acceptance system current historical evidence system contract.
   */
  reviewFrame: string;
  /**
   * Project-relative render bundle directory.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `bundle` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `bundle` for the acceptance system current historical evidence system contract.
   */
  bundle: string;
  /**
   * Zero-based frame index.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `frame` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `frame` for the acceptance system current historical evidence system contract.
   */
  frame: number;
  /**
   * Frame time in seconds.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `time` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `time` for the acceptance system current historical evidence system contract.
   */
  time: number;
  /**
   * Render pass.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `pass` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `pass` for the acceptance system current historical evidence system contract.
   */
  pass: AutoMovieGuidePass;
  /**
   * Raw PNG digest.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `digest` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `digest` for the acceptance system current historical evidence system contract.
   */
  digest: AutoMovieContentDigest;
  /**
   * Pixel width.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `width` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `width` for the acceptance system current historical evidence system contract.
   */
  width: number;
  /**
   * Pixel height.
   *
   * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `height` as the portable data boundary for the acceptance current historical evidence requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `height` for the acceptance system current historical evidence system contract.
   */
  height: number;
}

/**
 * One current receipt-bound repaint rendition available to visual review.
 *
 * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `IAutoMovieRenditionEvidenceReference` as the portable data boundary for the review verdict receipt requirement.
 * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `IAutoMovieRenditionEvidenceReference` for the review system verdict rationale receipt system contract.
 */
export interface IAutoMovieRenditionEvidenceReference {
  /**
   * Exact compiled shot id.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `shot` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `shot` for the review system verdict rationale receipt system contract.
   */
  shot: string;
  /**
   * Render-root-relative content-addressed MP4 path.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `path` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `path` for the review system verdict rationale receipt system contract.
   */
  path: string;
  /**
   * Exact current MP4 digest.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `digest` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `digest` for the review system verdict rationale receipt system contract.
   */
  digest: AutoMovieContentDigest;
  /**
   * Digest over the canonical immutable receipt.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `receiptDigest` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `receiptDigest` for the review system verdict rationale receipt system contract.
   */
  receiptDigest: AutoMovieContentDigest;
  /**
   * Digest over the deterministic source manifest and frame bytes.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `sourceRenderFingerprint` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `sourceRenderFingerprint` for the review system verdict rationale receipt system contract.
   */
  sourceRenderFingerprint: AutoMovieContentDigest;
  /**
   * Current completed deterministic shot-review fingerprint.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `sourceReviewFingerprint` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `sourceReviewFingerprint` for the review system verdict rationale receipt system contract.
   */
  sourceReviewFingerprint: AutoMovieContentDigest;
  /**
   * Exact structural controls bound by the current receipt.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `controls` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `controls` for the review system verdict rationale receipt system contract.
   */
  controls: Array<{
    /** Structural render pass. */
    pass: Exclude<AutoMovieGuidePass, "beauty">;
    /** Ordered deterministic source-frame digests. */
    frameDigests: AutoMovieContentDigest[];
  }>;
  /**
   * Exact fixed appearance references bound by the current receipt.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `references` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `references` for the review system verdict rationale receipt system contract.
   */
  references: Array<{
    /** Style or character role. */
    role: "style" | "character";
    /** Project-relative asset-manifest path. */
    path: string;
    /** Current resident asset digest. */
    digest: AutoMovieContentDigest;
  }>;
  /**
   * Canonical repaint adapter/model identity.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `adapterIdentity` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `adapterIdentity` for the review system verdict rationale receipt system contract.
   */
  adapterIdentity: string;
  /**
   * Exact generation parameters recorded by the receipt.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `parameters` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `parameters` for the review system verdict rationale receipt system contract.
   */
  parameters: IAutoMovieRepaintParameters;
  /**
   * Parser-derived current output facts.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `probe` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `probe` for the review system verdict rationale receipt system contract.
   */
  probe: IAutoMovieProductionMediaProbe;
}

/**
 * Current compiler/oracle outcome available to acceptance review.
 *
 * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `IAutoMovieAcceptanceOutcomeReference` as the portable data boundary for the acceptance current historical evidence requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `IAutoMovieAcceptanceOutcomeReference` for the acceptance system current historical evidence system contract.
 */
export type IAutoMovieAcceptanceOutcomeReference =
  | {
      /** Compiler-derived semantic event. */
      kind: "event";
      /** Exact acceptance scenario id. */
      scenario: string;
      /** Owning shot id. */
      shot: string;
      /** Exact event id. */
      event: string;
      /** Current compiler-owned realization. */
      realization: IAutoMovieCompiledContractRealization["events"][number];
      /** Whether the current compiler realization passes. */
      passed: boolean;
    }
  | {
      /** Compiler-derived runtime metric. */
      kind: "metric";
      /** Exact acceptance scenario id. */
      scenario: string;
      /** Supported metric id. */
      metric: "runtime-seconds";
      /** Actual current compiled runtime. */
      actual: number;
      /** Required operator. */
      operator: "<=" | ">=" | "==";
      /** Required threshold. */
      expected: number;
      /** Whether the current measurement passes. */
      passed: boolean;
    }
  | ({
      /**
       * Compiler-derived cross-shot comparison on the production story clock.
       *
       * The measurement reuses the same realized event times the per-shot event
       * outcomes cite, so a simultaneity claim and the events it names are
       * checked against one fact rather than two.
       */
      kind: "story-sync";
      /** Exact acceptance scenario id. */
      scenario: string;
    } & IAutoMovieStorySyncOutcome);

/**
 * Evidence whose exact value is rechecked against current project bytes.
 *
 * @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Exposes `IAutoMovieReviewEvidence` as the portable data boundary for the acceptance current historical evidence requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#acceptance-system-current-historical-evidence Types `IAutoMovieReviewEvidence` for the acceptance system current historical evidence system contract.
 */
export type IAutoMovieReviewEvidence =
  | {
      /** Typed design evidence. */
      kind: "design";
      /** Exact design target. */
      target: IAutoMovieDesignTarget;
      /** RFC 6901 JSON pointer. */
      pointer: string;
      /** Exact current value at the pointer. */
      exactValue: unknown;
    }
  | {
      /** Coding-agent-owned source evidence. */
      kind: "source";
      /** Project-relative source path. */
      path: string;
      /** One-based line number. */
      line: number;
      /** Non-blank exact line text. */
      exactText: string;
    }
  | {
      /** Current render-frame evidence. */
      kind: "frame";
      /** Exact rendered subject, including an asset's required view. */
      target: IAutoMovieRenderBundleManifest["target"];
      /** Authoritative review-frame contract id. */
      reviewFrame: string;
      /** Project-relative render bundle directory. */
      bundle: string;
      /** Zero-based frame index. */
      frame: number;
      /** Frame time in seconds. */
      time: number;
      /** Render pass. */
      pass: AutoMovieGuidePass;
      /** Raw PNG digest. */
      digest: AutoMovieContentDigest;
      /** Optional non-empty in-bounds review rectangle. */
      region?: {
        /** Left pixel. */
        x: number;
        /** Top pixel. */
        y: number;
        /** Rectangle width. */
        width: number;
        /** Rectangle height. */
        height: number;
      };
    }
  | ({
      /** Current receipt-bound repaint rendition evidence. */
      kind: "rendition";
    } & IAutoMovieRenditionEvidenceReference)
  | {
      /** Current compiler diagnostic evidence. */
      kind: "diagnostic";
      /** Diagnostic code. */
      code: string;
      /** Diagnostic path, or empty string when none. */
      path: string;
      /** Exact current value reported by the diagnostic. */
      actual: unknown;
    }
  | {
      /**
       * Structural evidence read from one compiled subject description.
       *
       * The discriminator is deliberately not `frame`: a delivered picture that
       * contains the subject is evidence about the picture, so it can never
       * discharge a subject criterion, and this receipt can never discharge a
       * frame one.
       */
      kind: "subject";
      /** Exact compiled subject prepared for this review. */
      target: IAutoMovieSubjectReviewTarget;
      /** RFC 6901 JSON pointer into the compiled subject description. */
      pointer: string;
      /** Exact current value at the pointer. */
      exactValue: unknown;
    }
  | {
      /** Current required acceptance-scenario contract. */
      kind: "acceptance";
      /** Exact acceptance scenario id. */
      scenario: string;
      /** Exact current scenario value. */
      exactValue: unknown;
    }
  | {
      /** Current compiler/oracle acceptance outcome. */
      kind: "outcome";
      /** Exact acceptance scenario id. */
      scenario: string;
      /** Exact prepared outcome value. */
      exactValue: IAutoMovieAcceptanceOutcomeReference;
    };

/**
 * One criterion verdict with observable evidence.
 *
 * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `IAutoMovieReviewCheck` as the portable data boundary for the review verdict receipt requirement.
 * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `IAutoMovieReviewCheck` for the review system verdict rationale receipt system contract.
 */
export interface IAutoMovieReviewCheck {
  /**
   * One id returned by `prepareReview.requiredCriteria`, in the exact canonical
   * order and present exactly once.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `criterion` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `criterion` for the review system verdict rationale receipt system contract.
   */
  criterion: string;
  /**
   * Axis-level conclusion. Every required criterion must be `pass` before
   * `complete` may be true; `not-applicable` cannot discharge a required item.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `verdict` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `verdict` for the review system verdict rationale receipt system contract.
   */
  verdict: "pass" | "revise" | "not-applicable";
  /**
   * Non-blank criterion-specific observation, distinct from every other check.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `observation` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `observation` for the review system verdict rationale receipt system contract.
   */
  observation: string;
  /**
   * At least one exact current item returned or addressable from the prepared
   * evidence inventory. Values and selectors are rechecked on submission.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `evidence` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `evidence` for the review system verdict rationale receipt system contract.
   */
  evidence: IAutoMovieReviewEvidence[];
  /**
   * Required acceptance scenario ids discharged by this criterion.
   *
   * Present only on `acceptance-scenarios`; the server requires the exact
   * current required set before a visual review can complete.
   *
   * @evidence requirements/review/records-and-completeness.md#review-verdict-receipt Exposes `acceptanceScenarios` as the portable data boundary for the review verdict receipt requirement.
   * @evidence specifications/review-and-acceptance/verdict-authority-and-dissent.md#review-system-verdict-rationale-receipt Types `acceptanceScenarios` for the review system verdict rationale receipt system contract.
   */
  acceptanceScenarios?: string[];
}

/**
 * One actionable correction owned by a production surface.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMovieReviewCorrection` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMovieReviewCorrection` for the review system execution status system contract.
 */
export interface IAutoMovieReviewCorrection {
  /**
   * Artifact owner.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `owner` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `owner` for the review system execution status system contract.
   */
  owner: "design" | "source" | "asset" | "render";
  /**
   * Non-blank exact artifact or selector to change.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `target` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `target` for the review system execution status system contract.
   */
  target: string;
  /**
   * Non-blank observable current problem.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `problem` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `problem` for the review system execution status system contract.
   */
  problem: string;
  /**
   * Non-blank observable corrected state for the next review round.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `expected` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `expected` for the review system execution status system contract.
   */
  expected: string;
}

/**
 * Request a current review worksheet for one target.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMoviePrepareReviewInput` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMoviePrepareReviewInput` for the review system execution status system contract.
 */
export interface IAutoMoviePrepareReviewInput {
  /**
   * Exact current dependency, deterministic visual, rendition, or aggregate
   * target. Deterministic visual targets require current frame evidence;
   * rendition targets require a completed source review and current receipt.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `target` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `target` for the review system execution status system contract.
   */
  target: IAutoMovieReviewTarget;
}

/**
 * Resolved subject unit and its inspection-owned viewpoint coverage.
 *
 * Subject coverage is reported on its own axis. It is never folded into the
 * frame, range, or whole-work coverage a time-axis review reports, and a
 * completeness claim on either axis leaves the other's unobserved range open.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-coverage Exposes planned and actually observed subject coverage as its own reported axis.
 * @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange Keeps subject coverage separate from the frame and range coverage reported beside it.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-coverage Types the coverage record returned with one prepared subject worksheet.
 */
export interface IAutoMovieSubjectReviewPreparation {
  /**
   * Compiled subject resolved from the target, with its revision.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-identity Carries the stable compiled identity the worksheet was prepared against.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-target-parity Types the observation unit a judgeable subject target resolves to.
   */
  unit: IAutoMovieSubjectReviewUnit;
  /**
   * Required viewpoints compared with current subject observations.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-evidence Reports not-run, partial, stale, and indeterminate subject observation instead of an implied pass.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-coverage Types the planned, observed, and unobserved subject sets of one worksheet.
   */
  coverage: IAutoMovieSubjectReviewCoverage;
}

/**
 * Current review worksheet and quotable evidence inventory.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMoviePrepareReviewOutput` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMoviePrepareReviewOutput` for the review system execution status system contract.
 */
export interface IAutoMoviePrepareReviewOutput {
  /**
   * Exact target.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `target` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `target` for the review system execution status system contract.
   */
  target: IAutoMovieReviewTarget;
  /**
   * Server-computed fingerprint of the target and every relevant dependency.
   * Any relevant edit invalidates a worksheet prepared from this identity.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `fingerprint` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `fingerprint` for the review system execution status system contract.
   */
  fingerprint: AutoMovieContentDigest;
  /**
   * Required criterion ids in canonical order.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `requiredCriteria` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `requiredCriteria` for the review system execution status system contract.
   */
  requiredCriteria: string[];
  /**
   * Current design, source and diagnostic selectors.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `quotable` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `quotable` for the review system execution status system contract.
   */
  quotable: IAutoMovieReviewEvidenceSelector[];
  /**
   * Current visual evidence inventory.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `frames` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `frames` for the review system execution status system contract.
   */
  frames: IAutoMovieFrameEvidenceReference[];
  /**
   * Current receipt-bound repaint inventory, empty for deterministic delivery.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `renditions` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `renditions` for the review system execution status system contract.
   */
  renditions: IAutoMovieRenditionEvidenceReference[];
  /**
   * Current compiler/oracle acceptance outcome inventory.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `outcomes` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `outcomes` for the review system execution status system contract.
   */
  outcomes: IAutoMovieAcceptanceOutcomeReference[];
  /**
   * Resolved subject unit and viewpoint coverage, null for every other target.
   *
   * @evidence requirements/review/subject-inspection.md#review-subject-inspection Makes the compiled subject, rather than a film moment, the prepared review unit.
   * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-target-parity Types the observation unit a resolved subject target is prepared as.
   */
  subjectReview: IAutoMovieSubjectReviewPreparation | null;
  /**
   * Blocking and warning diagnostics. Resolve errors and prepare again before
   * attempting a completion submission.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `diagnostics` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `diagnostics` for the review system execution status system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/**
 * Evidence-first external-agent review worksheet.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMovieSubmitReviewInput` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMovieSubmitReviewInput` for the review system execution status system contract.
 */
export interface IAutoMovieSubmitReviewInput {
  /**
   * Exact target used for the freshly prepared worksheet. Its current
   * dependency fingerprint is recomputed during submission.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `target` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `target` for the review system execution status system contract.
   */
  target: IAutoMovieReviewTarget;
  /**
   * Exact fingerprint returned by the `prepareReview` call whose worksheet is
   * being submitted. A changed target must be prepared and reviewed again; the
   * server never upgrades an older worksheet to a newer fingerprint.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `preparedFingerprint` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `preparedFingerprint` for the review system execution status system contract.
   */
  preparedFingerprint: AutoMovieContentDigest;
  /**
   * Non-blank overall findings about the exact current target.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `observations` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `observations` for the review system execution status system contract.
   */
  observations: string;
  /**
   * Every prepared required criterion exactly once and in canonical order, each
   * with a distinct observation and at least one current evidence item.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `checks` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `checks` for the review system execution status system contract.
   */
  checks: IAutoMovieReviewCheck[];
  /**
   * Actionable changes that prevent completion. This must be empty when
   * `complete` is true and non-empty when no revise verdict explains false.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `corrections` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `corrections` for the review system execution status system contract.
   */
  corrections: IAutoMovieReviewCorrection[];
  /**
   * Non-blank evidence-linked basis for the decision. A true completion must
   * explicitly name every target-specific high-risk criterion.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `completionBasis` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `completionBasis` for the review system execution status system contract.
   */
  completionBasis: string;
  /**
   * Final declaration, deliberately last. True is accepted only when all
   * required criteria and acceptance scenarios pass on fresh evidence, visual
   * targets cite a verified required frame, repainted targets cite every
   * addressed rendition, and no correction remains.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `complete` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `complete` for the review system execution status system contract.
   */
  complete: boolean;
}

/**
 * Result of validating and storing one external-agent review.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMovieSubmitReviewOutput` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMovieSubmitReviewOutput` for the review system execution status system contract.
 */
export interface IAutoMovieSubmitReviewOutput {
  /**
   * Whether the worksheet passed structural, freshness and evidence validation
   * and was stored. False never records a completion claim.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `accepted` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `accepted` for the review system execution status system contract.
   */
  accepted: boolean;
  /**
   * Exact target.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `target` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `target` for the review system execution status system contract.
   */
  target: IAutoMovieReviewTarget;
  /**
   * Stored current fingerprint, or null when refused.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `fingerprint` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `fingerprint` for the review system execution status system contract.
   */
  fingerprint: AutoMovieContentDigest | null;
  /**
   * Resulting review queue state. A refused worksheet reports `stale` when an
   * older stored review no longer matches the current target.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `state` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `state` for the review system execution status system contract.
   */
  state: "missing" | "stale" | "incomplete" | "revise" | "complete";
  /**
   * Exact refusal diagnostics and corrections, empty after accepted storage.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `diagnostics` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `diagnostics` for the review system execution status system contract.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/**
 * Versioned review record stored after the preparation fingerprint is consumed.
 *
 * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `IAutoMovieStoredReview` as the portable data boundary for the review execution status requirement.
 * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `IAutoMovieStoredReview` for the review system execution status system contract.
 */
export interface IAutoMovieStoredReview extends Omit<
  IAutoMovieSubmitReviewInput,
  "preparedFingerprint"
> {
  /**
   * Stored-review format.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `version` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `version` for the review system execution status system contract.
   */
  version: 1;
  /**
   * Server-computed target fingerprint.
   *
   * @evidence requirements/review/records-and-completeness.md#review-execution-status Exposes `fingerprint` as the portable data boundary for the review execution status requirement.
   * @evidence specifications/review-and-acceptance/evidence-freshness-and-completeness.md#review-system-execution-status Types `fingerprint` for the review system execution status system contract.
   */
  fingerprint: AutoMovieContentDigest;
}

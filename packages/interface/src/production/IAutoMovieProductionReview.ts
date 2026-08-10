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
import type { IAutoMovieRepaintParameters } from "./application/IAutoMovieRepaintShot";

/** A design or source selector that may be quoted in a review. */
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
    };

/** One current frame available as visual-review evidence. */
export interface IAutoMovieFrameEvidenceReference {
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
  /** Pixel width. */
  width: number;
  /** Pixel height. */
  height: number;
}

/** One current receipt-bound repaint rendition available to visual review. */
export interface IAutoMovieRenditionEvidenceReference {
  /** Exact compiled shot id. */
  shot: string;
  /** Render-root-relative content-addressed MP4 path. */
  path: string;
  /** Exact current MP4 digest. */
  digest: AutoMovieContentDigest;
  /** Digest over the canonical immutable receipt. */
  receiptDigest: AutoMovieContentDigest;
  /** Digest over the deterministic source manifest and frame bytes. */
  sourceRenderFingerprint: AutoMovieContentDigest;
  /** Current completed deterministic shot-review fingerprint. */
  sourceReviewFingerprint: AutoMovieContentDigest;
  /** Exact structural controls bound by the current receipt. */
  controls: Array<{
    /** Structural render pass. */
    pass: Exclude<AutoMovieGuidePass, "beauty">;
    /** Ordered deterministic source-frame digests. */
    frameDigests: AutoMovieContentDigest[];
  }>;
  /** Exact fixed appearance references bound by the current receipt. */
  references: Array<{
    /** Style or character role. */
    role: "style" | "character";
    /** Project-relative asset-manifest path. */
    path: string;
    /** Current resident asset digest. */
    digest: AutoMovieContentDigest;
  }>;
  /** Canonical repaint adapter/model identity. */
  adapterIdentity: string;
  /** Exact generation parameters recorded by the receipt. */
  parameters: IAutoMovieRepaintParameters;
  /** Parser-derived current output facts. */
  probe: IAutoMovieProductionMediaProbe;
}

/** Current compiler/oracle outcome available to acceptance review. */
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

/** Evidence whose exact value is rechecked against current project bytes. */
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

/** One criterion verdict with observable evidence. */
export interface IAutoMovieReviewCheck {
  /**
   * One id returned by `prepareReview.requiredCriteria`, in the exact canonical
   * order and present exactly once.
   */
  criterion: string;
  /**
   * Axis-level conclusion. Every required criterion must be `pass` before
   * `complete` may be true; `not-applicable` cannot discharge a required item.
   */
  verdict: "pass" | "revise" | "not-applicable";
  /** Non-blank criterion-specific observation, distinct from every other check. */
  observation: string;
  /**
   * At least one exact current item returned or addressable from the prepared
   * evidence inventory. Values and selectors are rechecked on submission.
   */
  evidence: IAutoMovieReviewEvidence[];
  /**
   * Required acceptance scenario ids discharged by this criterion.
   *
   * Present only on `acceptance-scenarios`; the server requires the exact
   * current required set before a visual review can complete.
   */
  acceptanceScenarios?: string[];
}

/** One actionable correction owned by a production surface. */
export interface IAutoMovieReviewCorrection {
  /** Artifact owner. */
  owner: "design" | "source" | "asset" | "render";
  /** Non-blank exact artifact or selector to change. */
  target: string;
  /** Non-blank observable current problem. */
  problem: string;
  /** Non-blank observable corrected state for the next review round. */
  expected: string;
}

/** Request a current review worksheet for one target. */
export interface IAutoMoviePrepareReviewInput {
  /**
   * Exact current dependency, deterministic visual, rendition, or aggregate
   * target. Deterministic visual targets require current frame evidence;
   * rendition targets require a completed source review and current receipt.
   */
  target: IAutoMovieReviewTarget;
}

/** Current review worksheet and quotable evidence inventory. */
export interface IAutoMoviePrepareReviewOutput {
  /** Exact target. */
  target: IAutoMovieReviewTarget;
  /**
   * Server-computed fingerprint of the target and every relevant dependency.
   * Any relevant edit invalidates a worksheet prepared from this identity.
   */
  fingerprint: AutoMovieContentDigest;
  /** Required criterion ids in canonical order. */
  requiredCriteria: string[];
  /** Current design, source and diagnostic selectors. */
  quotable: IAutoMovieReviewEvidenceSelector[];
  /** Current visual evidence inventory. */
  frames: IAutoMovieFrameEvidenceReference[];
  /** Current receipt-bound repaint inventory, empty for deterministic delivery. */
  renditions: IAutoMovieRenditionEvidenceReference[];
  /** Current compiler/oracle acceptance outcome inventory. */
  outcomes: IAutoMovieAcceptanceOutcomeReference[];
  /**
   * Blocking and warning diagnostics. Resolve errors and prepare again before
   * attempting a completion submission.
   */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Evidence-first external-agent review worksheet. */
export interface IAutoMovieSubmitReviewInput {
  /**
   * Exact target used for the freshly prepared worksheet. Its current
   * dependency fingerprint is recomputed during submission.
   */
  target: IAutoMovieReviewTarget;
  /**
   * Exact fingerprint returned by the `prepareReview` call whose worksheet is
   * being submitted. A changed target must be prepared and reviewed again; the
   * server never upgrades an older worksheet to a newer fingerprint.
   */
  preparedFingerprint: AutoMovieContentDigest;
  /** Non-blank overall findings about the exact current target. */
  observations: string;
  /**
   * Every prepared required criterion exactly once and in canonical order, each
   * with a distinct observation and at least one current evidence item.
   */
  checks: IAutoMovieReviewCheck[];
  /**
   * Actionable changes that prevent completion. This must be empty when
   * `complete` is true and non-empty when no revise verdict explains false.
   */
  corrections: IAutoMovieReviewCorrection[];
  /**
   * Non-blank evidence-linked basis for the decision. A true completion must
   * explicitly name every target-specific high-risk criterion.
   */
  completionBasis: string;
  /**
   * Final declaration, deliberately last. True is accepted only when all
   * required criteria and acceptance scenarios pass on fresh evidence, visual
   * targets cite a verified required frame, repainted targets cite every
   * addressed rendition, and no correction remains.
   */
  complete: boolean;
}

/** Result of validating and storing one external-agent review. */
export interface IAutoMovieSubmitReviewOutput {
  /**
   * Whether the worksheet passed structural, freshness and evidence validation
   * and was stored. False never records a completion claim.
   */
  accepted: boolean;
  /** Exact target. */
  target: IAutoMovieReviewTarget;
  /** Stored current fingerprint, or null when refused. */
  fingerprint: AutoMovieContentDigest | null;
  /**
   * Resulting review queue state. A refused worksheet reports `stale` when an
   * older stored review no longer matches the current target.
   */
  state: "missing" | "stale" | "incomplete" | "revise" | "complete";
  /** Exact refusal diagnostics and corrections, empty after accepted storage. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Versioned review record stored after the preparation fingerprint is consumed. */
export interface IAutoMovieStoredReview extends Omit<
  IAutoMovieSubmitReviewInput,
  "preparedFingerprint"
> {
  /** Stored-review format. */
  version: 1;
  /** Server-computed target fingerprint. */
  fingerprint: AutoMovieContentDigest;
}

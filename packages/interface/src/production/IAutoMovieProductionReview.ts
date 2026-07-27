import { AutoMovieGuidePass } from "../cinematics";
import {
  IAutoMovieDiagnostic,
  IAutoMovieReviewTarget,
} from "./IAutoMovieProductionCompiler";
import {
  AutoMovieContentDigest,
  IAutoMovieDesignTarget,
} from "./IAutoMovieProductionDesign";

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
  /** Owning shot id. */
  shot: string;
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
      /** Owning shot id. */
      shot: string;
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
    };

/** One criterion verdict with observable evidence. */
export interface IAutoMovieReviewCheck {
  /** Required criterion id. */
  criterion: string;
  /** Axis-level conclusion. */
  verdict: "pass" | "revise" | "not-applicable";
  /** Concrete observation for this criterion. */
  observation: string;
  /** Current project evidence supporting the observation. */
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
  /** Exact artifact or selector to change. */
  target: string;
  /** Observable problem. */
  problem: string;
  /** Observable corrected state. */
  expected: string;
}

/** Request a current review worksheet for one target. */
export interface IAutoMoviePrepareReviewInput {
  /** Exact target. */
  target: IAutoMovieReviewTarget;
}

/** Current review worksheet and quotable evidence inventory. */
export interface IAutoMoviePrepareReviewOutput {
  /** Exact target. */
  target: IAutoMovieReviewTarget;
  /** Server-computed current content fingerprint. */
  fingerprint: AutoMovieContentDigest;
  /** Required criterion ids in canonical order. */
  requiredCriteria: string[];
  /** Current design, source and diagnostic selectors. */
  quotable: IAutoMovieReviewEvidenceSelector[];
  /** Current visual evidence inventory. */
  frames: IAutoMovieFrameEvidenceReference[];
  /** Blocking and warning diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Evidence-first external-agent review worksheet. */
export interface IAutoMovieSubmitReviewInput {
  /** Exact current review target. */
  target: IAutoMovieReviewTarget;
  /** Overall observable findings. */
  observations: string;
  /** Every required criterion exactly once. */
  checks: IAutoMovieReviewCheck[];
  /** Actionable changes that prevent completion. */
  corrections: IAutoMovieReviewCorrection[];
  /** Evidence-linked basis for the completion decision. */
  completionBasis: string;
  /** Final completion declaration; it is deliberately the last field. */
  complete: boolean;
}

/** Result of validating and storing one external-agent review. */
export interface IAutoMovieSubmitReviewOutput {
  /** Whether the record passed structural and evidence validation. */
  accepted: boolean;
  /** Exact target. */
  target: IAutoMovieReviewTarget;
  /** Stored current fingerprint, or null when refused. */
  fingerprint: AutoMovieContentDigest | null;
  /** Resulting review queue state. */
  state: "missing" | "incomplete" | "revise" | "complete";
  /** Exact refusal or warning diagnostics. */
  diagnostics: IAutoMovieDiagnostic[];
}

/** Versioned review record stored in the project. */
export interface IAutoMovieStoredReview extends IAutoMovieSubmitReviewInput {
  /** Stored-review format. */
  version: 1;
  /** Server-computed target fingerprint. */
  fingerprint: AutoMovieContentDigest;
}

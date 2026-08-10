import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";

/**
 * Container families a design reference may declare.
 *
 * Declaring a family is not a claim that every analysis over it is implemented:
 * a raster plan and a vector plan are both registrable, while the source-space
 * extent of a PDF page or a DXF drawing is reported as `unsupported` rather
 * than guessed. The list is closed so an unregistrable container fails at the
 * type level in source and at validation in JSON.
 */
export type AutoMovieDesignReferenceMedia =
  | "image/png"
  | "image/jpeg"
  | "image/svg+xml"
  | "application/pdf"
  | "image/vnd.dxf";

/**
 * Generation identity of bytes that no external source ever served.
 *
 * An image-generation result has no acquisition URL, so recording one would be
 * a fabrication. It has instead a provider, a model, the exact instruction that
 * produced it, the references it was conditioned on, and the digest of the
 * bytes that came back. Sampling is usually irreproducible, and this record
 * states that as a fact rather than repairing it with an invented seed.
 */
export interface IAutoMovieGeneratedAcquisition {
  /** Service or tool identity that produced the bytes. */
  provider: string;
  /** Exact model identity, including a version when it changes output. */
  model: string;
  /** Provider-side request identity, or null when the provider issues none. */
  request: string | null;
  /** Verbatim instruction, or null when only its digest may be published. */
  prompt: string | null;
  /** SHA-256 of the exact instruction bytes, always recorded. */
  promptDigest: AutoMovieContentDigest;
  /**
   * Manifest asset paths this request was conditioned on, in request order.
   * Empty for a text-only request.
   */
  inputs: string[];
  /** SHA-256 of the exact bytes the generator returned. */
  outputDigest: AutoMovieContentDigest;
  /**
   * Whether replaying provider, model, prompt and inputs reproduces
   * {@link outputDigest}. `false` is the honest answer for sampled image
   * generation and is never repaired by inventing a replay handle.
   */
  reproducible: boolean;
  /** Provider-reported seed, or null when the provider exposes none. */
  seed: number | null;
}

/** One reading of how long a source unit is on the ground. */
export interface IAutoMovieDesignScaleCandidate {
  /** Stable candidate identity within the frame. */
  id: string;
  /** Metres per one source unit; strictly positive. */
  metersPerUnit: number;
  /** Inclusive `[0, 1]` confidence in this reading. */
  confidence: number;
  /** Where the reading came from, such as `scale-bar` or `dimension-string`. */
  basis: string;
}

/**
 * One page, sheet, or image of a design reference and how its own coordinates
 * are read as world coordinates.
 *
 * The frame owns the mapping, not the observation: a primitive is always
 * recorded in the source's own units, so a corrected scale or a corrected north
 * never rewrites what was seen. A frame whose {@link scale} is null has an
 * unsettled scale, and nothing read through it can become metric geometry.
 */
export interface IAutoMovieDesignSourceFrame {
  /** Stable frame identity within the document. */
  id: string;
  /** One-based page or image index inside the asset. */
  page: number;
  /** Drawing family this frame shows. */
  view: "plan" | "section" | "elevation" | "detail" | "perspective";
  /** Storey or datum label this frame belongs to, or null. */
  level: string | null;
  /** Source-space extent: pixels for raster, user units for vector. */
  bounds: {
    /** Strictly positive width in source units. */
    width: number;
    /** Strictly positive height in source units. */
    height: number;
  };
  /** Source-space point that maps onto {@link origin}. */
  anchor: {
    /** Finite source-space x, inside `[0, bounds.width]`. */
    x: number;
    /** Finite source-space y, inside `[0, bounds.height]`. */
    y: number;
  };
  /** Every scale reading; more than one means the scale is not settled. */
  scaleCandidates: IAutoMovieDesignScaleCandidate[];
  /** Chosen scale candidate id, or null while the scale is unknown. */
  scale: string | null;
  /** World direction the frame's own +x axis points along; non-zero. */
  axisX: IAutoMovieVector3;
  /** World direction the frame's own +y axis points along; non-zero. */
  axisY: IAutoMovieVector3;
  /** World position of {@link anchor}, in metres. */
  origin: IAutoMovieVector3;
  /** World direction the drawing calls up; non-zero. */
  up: IAutoMovieVector3;
  /** World direction the drawing calls north, or null when unmarked. */
  north: IAutoMovieVector3 | null;
  /** Extra world placement applied after the axis mapping, or null. */
  transform: IAutoMovieTransform | null;
}

/** One point in a frame's own source coordinates. */
export interface IAutoMovieDesignPoint {
  /** Finite source-space x. */
  x: number;
  /** Finite source-space y, growing the way the source grows it. */
  y: number;
}

/**
 * One raw mark read from a frame, before any interpretation.
 *
 * A primitive says what is on the sheet, never what it means. Two readers who
 * disagree about a wall still agree about the two lines they both saw, which is
 * what keeps the disagreement recoverable.
 */
export interface IAutoMovieObservedPrimitive {
  /** Stable primitive identity within the document. */
  id: string;
  /** Frame this mark was read from. */
  frame: string;
  /** Raw geometry family exactly as read. */
  kind: "line" | "arc" | "polyline" | "region" | "text" | "level-marker";
  /**
   * Source-space points. A `line` carries exactly two, an `arc` carries start,
   * through and end, a `polyline` at least two, a closed `region` at least
   * three, and a `text` or `level-marker` exactly one anchor.
   */
  points: IAutoMovieDesignPoint[];
  /** Literal text for `text` and `level-marker`, otherwise null. */
  text: string | null;
}

/**
 * One semantic reading proposed over raw primitives.
 *
 * A candidate is a proposal, never a conclusion. Competing readings of the same
 * marks cite each other in {@link alternatives}, and anything still undecided is
 * named in {@link issues}; both keep a reading from silently hardening into the
 * design.
 */
export interface IAutoMovieObservedCandidate {
  /** Stable candidate identity within the document. */
  id: string;
  /** Open semantic label such as `wall-centerline`, `opening`, `storey-datum`. */
  semantic: string;
  /** Primitive ids this reading is built from; at least one. */
  primitives: string[];
  /** Inclusive `[0, 1]` confidence in this reading. */
  confidence: number;
  /** Competing candidate ids reading the same marks differently. */
  alternatives: string[];
  /** Issue ids that block promotion while open. */
  issues: string[];
}

/** Something still undecided about a reference, and what it blocks. */
export interface IAutoMovieDesignIssue {
  /** Stable issue identity within the document. */
  id: string;
  /** Closed reason family that keeps a reading unsettled. */
  kind:
    | "unknown-scale"
    | "ambiguous-geometry"
    | "occluded"
    | "illegible"
    | "conflicting-dimension"
    | "other";
  /** Primitive or candidate ids this issue is about; at least one. */
  subjects: string[];
  /** What a human still has to decide. */
  detail: string;
  /** Whether the issue is still open. */
  open: boolean;
}

/**
 * What one attempted reading of a frame actually produced.
 *
 * `observed` is the only outcome that carries readings. An analysis this host
 * cannot perform is `unsupported`, and one that was simply never executed is
 * `not-run`; both carry a reason and no candidates, so an absent reading is
 * never mistaken for a clean sheet.
 */
export type IAutoMovieDesignAnalysisOutcome =
  | {
      /** The reading ran and produced candidates. */
      status: "observed";
      /** Candidate ids this analysis produced; at least one. */
      candidates: string[];
    }
  | {
      /** This host cannot perform the reading at all. */
      status: "unsupported";
      /** Non-blank statement of what is missing. */
      reason: string;
    }
  | {
      /** The reading is possible but was not executed. */
      status: "not-run";
      /** Non-blank statement of why it was skipped. */
      reason: string;
    };

/** One attempted reading of one frame. */
export interface IAutoMovieDesignAnalysis {
  /** Stable analysis identity within the document. */
  id: string;
  /** Frame this analysis read. */
  frame: string;
  /** Open label of the reading attempted, such as `wall-centerline`. */
  subject: string;
  /** Honest outcome of the attempt. */
  outcome: IAutoMovieDesignAnalysisOutcome;
}

/**
 * One observed design reference: the bytes, how they are read, what was seen,
 * what was proposed, and what remains undecided.
 *
 * This record is evidence and only evidence. The design source of truth stays
 * the TypeScript building source; a reference is cited by it through
 * {@link IAutoMovieDesignEvidence} and never merged into it. A plan image
 * therefore cannot quietly become a wall, because nothing here is a wall.
 */
export interface IAutoMovieDesignReference {
  /** Schema version. */
  version: 1;
  /** Stable document identity within the production. */
  id: string;
  /** Project-relative manifest asset holding the exact observed bytes. */
  asset: string;
  /** SHA-256 of those bytes at the moment the observation was made. */
  digest: AutoMovieContentDigest;
  /** Container family the asset bytes are declared to be. */
  media: AutoMovieDesignReferenceMedia;
  /** Pages, sheets, or images read from the asset; at least one. */
  frames: IAutoMovieDesignSourceFrame[];
  /** Raw marks read from those frames. */
  primitives: IAutoMovieObservedPrimitive[];
  /** Every attempted reading, including the ones that produced nothing. */
  analyses: IAutoMovieDesignAnalysis[];
  /** Semantic proposals over the raw marks. */
  candidates: IAutoMovieObservedCandidate[];
  /** Everything still undecided. */
  issues: IAutoMovieDesignIssue[];
}

/**
 * One authored citation from a normalized design element to the observation it
 * was decided from.
 *
 * The arrow points from design to evidence, never back. The author states which
 * reading was chosen and why it beat the recorded alternatives; the observation
 * itself is left exactly as it was read.
 */
export interface IAutoMovieDesignEvidence {
  /** Normalized design element, space, or boundary id this citation justifies. */
  subject: string;
  /** Design-reference document id. */
  document: string;
  /** Candidate ids cited as the basis of the authored decision; at least one. */
  candidates: string[];
  /** Why the author chose this reading over the recorded alternatives. */
  rationale: string;
}

/** One reading settled enough to become authored metric geometry. */
export interface IAutoMovieDesignPromotedReading {
  /** Candidate that produced it. */
  candidate: string;
  /** The candidate's own semantic label. */
  semantic: string;
  /**
   * One world-space polyline in metres per primitive the candidate reads, in
   * the candidate's own primitive order and each in source point order.
   *
   * They stay separate rather than concatenated because a candidate built from
   * two disjoint marks is two runs, and a single flattened list would join them
   * with a segment nobody drew.
   */
  outlines: IAutoMovieVector3[][];
}

/** One reading deliberately left as observation, and why. */
export interface IAutoMovieDesignWithholding {
  /** Candidate that stays an observation. */
  candidate: string;
  /** Closed reason family that kept it unpromoted. */
  reason:
    | "unobserved"
    | "unknown-scale"
    | "ambiguous-candidate"
    | "open-issue"
    | "low-confidence"
    | "unsupported-geometry";
  /** Human-readable statement of what would have to change. */
  detail: string;
}

/** One reading that produced nothing, reported rather than omitted. */
export interface IAutoMovieDesignSkippedAnalysis {
  /** Analysis that produced no reading. */
  analysis: string;
  /** Which kind of nothing it produced. */
  status: "unsupported" | "not-run";
  /** The analysis' own reason, carried through verbatim. */
  reason: string;
}

/**
 * The complete, deterministic outcome of asking a reference for metric
 * geometry.
 *
 * Every candidate lands in exactly one of {@link promoted} or {@link withheld},
 * and every analysis that produced nothing is named in {@link skipped}. There is
 * no fourth pile, so a caller cannot mistake silence for agreement.
 */
export interface IAutoMovieDesignPromotion {
  /** Readings settled enough to become metric geometry. */
  promoted: IAutoMovieDesignPromotedReading[];
  /** Readings left as observation, each with its blocking reason. */
  withheld: IAutoMovieDesignWithholding[];
  /** Analyses that were unsupported or never run. */
  skipped: IAutoMovieDesignSkippedAnalysis[];
}

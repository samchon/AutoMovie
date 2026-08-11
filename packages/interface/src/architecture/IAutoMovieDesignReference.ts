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
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-unsupported-incomplete Exposes `AutoMovieDesignReferenceMedia` as the portable data boundary for the production design reference unsupported incomplete requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-authority-replacement Types `AutoMovieDesignReferenceMedia` for the narrative intent reference authority replacement system contract.
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
 *
 * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `IAutoMovieGeneratedAcquisition` as the portable data boundary for the external source acquisition failure requirement.
 * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `IAutoMovieGeneratedAcquisition` for the interchange acquisition failure envelope system contract.
 */
export interface IAutoMovieGeneratedAcquisition {
  /**
   * Service or tool identity that produced the bytes.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `provider` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `provider` for the interchange acquisition failure envelope system contract.
   */
  provider: string;
  /**
   * Exact model identity, including a version when it changes output.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `model` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `model` for the interchange acquisition failure envelope system contract.
   */
  model: string;
  /**
   * Provider-side request identity, or null when the provider issues none.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `request` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `request` for the interchange acquisition failure envelope system contract.
   */
  request: string | null;
  /**
   * Verbatim instruction, or null when only its digest may be published.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `prompt` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `prompt` for the interchange acquisition failure envelope system contract.
   */
  prompt: string | null;
  /**
   * SHA-256 of the exact instruction bytes, always recorded.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `promptDigest` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `promptDigest` for the interchange acquisition failure envelope system contract.
   */
  promptDigest: AutoMovieContentDigest;
  /**
   * Manifest asset paths this request was conditioned on, in request order.
   * Empty for a text-only request.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `inputs` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `inputs` for the interchange acquisition failure envelope system contract.
   */
  inputs: string[];
  /**
   * SHA-256 of the exact bytes the generator returned.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `outputDigest` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `outputDigest` for the interchange acquisition failure envelope system contract.
   */
  outputDigest: AutoMovieContentDigest;
  /**
   * Whether replaying provider, model, prompt and inputs reproduces
   * {@link outputDigest}. `false` is the honest answer for sampled image
   * generation and is never repaired by inventing a replay handle.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `reproducible` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `reproducible` for the interchange acquisition failure envelope system contract.
   */
  reproducible: boolean;
  /**
   * Provider-reported seed, or null when the provider exposes none.
   *
   * A recorded seed is a whole number small enough to survive being written
   * down: a fractional, non-finite, or beyond-2^53 value is not the number the
   * provider used, so replaying it would reproduce nothing.
   *
   * @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Exposes `seed` as the portable data boundary for the external source acquisition failure requirement.
   * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-acquisition-failure-envelope Types `seed` for the interchange acquisition failure envelope system contract.
   */
  seed: number | null;
}

/**
 * One reading of how long a source unit is on the ground.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignScaleCandidate` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignScaleCandidate` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignScaleCandidate {
  /**
   * Stable candidate identity within the frame.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Metres per one source unit; strictly positive.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `metersPerUnit` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `metersPerUnit` for the narrative intent reference lineage system contract.
   */
  metersPerUnit: number;
  /**
   * Inclusive `[0, 1]` confidence in this reading.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `confidence` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `confidence` for the narrative intent reference lineage system contract.
   */
  confidence: number;
  /**
   * Where the reading came from, such as `scale-bar` or `dimension-string`.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `basis` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `basis` for the narrative intent reference lineage system contract.
   */
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
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignSourceFrame` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignSourceFrame` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignSourceFrame {
  /**
   * Stable frame identity within the document.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * One-based page or image index inside the asset.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `page` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `page` for the narrative intent reference lineage system contract.
   */
  page: number;
  /**
   * Drawing family this frame shows.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `view` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `view` for the narrative intent reference lineage system contract.
   */
  view: "plan" | "section" | "elevation" | "detail" | "perspective";
  /**
   * Storey or datum label this frame belongs to, or null.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `level` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `level` for the narrative intent reference lineage system contract.
   */
  level: string | null;
  /**
   * Source-space extent: pixels for raster, user units for vector.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `bounds` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `bounds` for the narrative intent reference lineage system contract.
   */
  bounds: {
    /** Strictly positive width in source units. */
    width: number;
    /** Strictly positive height in source units. */
    height: number;
  };
  /**
   * Source-space point that maps onto {@link origin}.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `anchor` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `anchor` for the narrative intent reference lineage system contract.
   */
  anchor: {
    /** Finite source-space x, inside `[0, bounds.width]`. */
    x: number;
    /** Finite source-space y, inside `[0, bounds.height]`. */
    y: number;
  };
  /**
   * Every scale reading; more than one means the scale is not settled.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `scaleCandidates` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `scaleCandidates` for the narrative intent reference lineage system contract.
   */
  scaleCandidates: IAutoMovieDesignScaleCandidate[];
  /**
   * Chosen scale candidate id, or null while the scale is unknown.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `scale` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `scale` for the narrative intent reference lineage system contract.
   */
  scale: string | null;
  /**
   * World direction the frame's own +x axis points along; non-zero.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `axisX` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `axisX` for the narrative intent reference lineage system contract.
   */
  axisX: IAutoMovieVector3;
  /**
   * World direction the frame's own +y axis points along; non-zero.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `axisY` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `axisY` for the narrative intent reference lineage system contract.
   */
  axisY: IAutoMovieVector3;
  /**
   * World position of {@link anchor}, in metres.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `origin` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `origin` for the narrative intent reference lineage system contract.
   */
  origin: IAutoMovieVector3;
  /**
   * World direction the drawing calls up; non-zero.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `up` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `up` for the narrative intent reference lineage system contract.
   */
  up: IAutoMovieVector3;
  /**
   * World direction the drawing calls north, or null when unmarked.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `north` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `north` for the narrative intent reference lineage system contract.
   */
  north: IAutoMovieVector3 | null;
  /**
   * Extra world placement applied after the axis mapping, or null.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `transform` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `transform` for the narrative intent reference lineage system contract.
   */
  transform: IAutoMovieTransform | null;
}

/**
 * One point in a frame's own source coordinates.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignPoint` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignPoint` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignPoint {
  /**
   * Finite source-space x.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `x` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `x` for the narrative intent reference lineage system contract.
   */
  x: number;
  /**
   * Finite source-space y, growing the way the source grows it.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `y` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `y` for the narrative intent reference lineage system contract.
   */
  y: number;
}

/**
 * One raw mark read from a frame, before any interpretation.
 *
 * A primitive says what is on the sheet, never what it means. Two readers who
 * disagree about a wall still agree about the two lines they both saw, which is
 * what keeps the disagreement recoverable.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieObservedPrimitive` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieObservedPrimitive` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieObservedPrimitive {
  /**
   * Stable primitive identity within the document.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Frame this mark was read from.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `frame` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `frame` for the narrative intent reference lineage system contract.
   */
  frame: string;
  /**
   * Raw geometry family exactly as read.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `kind` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `kind` for the narrative intent reference lineage system contract.
   */
  kind: "line" | "arc" | "polyline" | "region" | "text" | "level-marker";
  /**
   * Source-space points. A `line` carries exactly two, an `arc` carries start,
   * through and end, a `polyline` at least two, a closed `region` at least
   * three, and a `text` or `level-marker` exactly one anchor.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `points` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `points` for the narrative intent reference lineage system contract.
   */
  points: IAutoMovieDesignPoint[];
  /**
   * Literal text for `text` and `level-marker`, otherwise null.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `text` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `text` for the narrative intent reference lineage system contract.
   */
  text: string | null;
}

/**
 * One semantic reading proposed over raw primitives.
 *
 * A candidate is a proposal, never a conclusion. Competing readings of the same
 * marks cite each other in {@link alternatives}, and anything still undecided is
 * named in {@link issues}; both keep a reading from silently hardening into the
 * design.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieObservedCandidate` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieObservedCandidate` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieObservedCandidate {
  /**
   * Stable candidate identity within the document.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Open semantic label such as `wall-centerline`, `opening`, `storey-datum`.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `semantic` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `semantic` for the narrative intent reference lineage system contract.
   */
  semantic: string;
  /**
   * Primitive ids this reading is built from; at least one.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `primitives` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `primitives` for the narrative intent reference lineage system contract.
   */
  primitives: string[];
  /**
   * Inclusive `[0, 1]` confidence in this reading.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `confidence` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `confidence` for the narrative intent reference lineage system contract.
   */
  confidence: number;
  /**
   * Competing candidate ids reading the same marks differently; distinct.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `alternatives` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `alternatives` for the narrative intent reference lineage system contract.
   */
  alternatives: string[];
  /**
   * Issue ids that block promotion while open; distinct.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `issues` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `issues` for the narrative intent reference lineage system contract.
   */
  issues: string[];
}

/**
 * Something still undecided about a reference, and what it blocks.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignIssue` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignIssue` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignIssue {
  /**
   * Stable issue identity within the document.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Closed reason family that keeps a reading unsettled.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `kind` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `kind` for the narrative intent reference lineage system contract.
   */
  kind:
    | "unknown-scale"
    | "ambiguous-geometry"
    | "occluded"
    | "illegible"
    | "conflicting-dimension"
    | "other";
  /**
   * Primitive or candidate ids this issue is about; at least one, distinct.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `subjects` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `subjects` for the narrative intent reference lineage system contract.
   */
  subjects: string[];
  /**
   * What a human still has to decide.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `detail` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `detail` for the narrative intent reference lineage system contract.
   */
  detail: string;
  /**
   * Whether the issue is still open.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `open` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `open` for the narrative intent reference lineage system contract.
   */
  open: boolean;
}

/**
 * What one attempted reading of a frame actually produced.
 *
 * `observed` is the only outcome that carries readings. An analysis this host
 * cannot perform is `unsupported`, and one that was simply never executed is
 * `not-run`; both carry a reason and no candidates, so an absent reading is
 * never mistaken for a clean sheet.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-unsupported-incomplete Exposes `IAutoMovieDesignAnalysisOutcome` as the portable data boundary for the production design reference unsupported incomplete requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-authority-replacement Types `IAutoMovieDesignAnalysisOutcome` for the narrative intent reference authority replacement system contract.
 */
export type IAutoMovieDesignAnalysisOutcome =
  | {
      /** The reading ran and produced candidates. */
      status: "observed";
      /**
       * Candidate ids this analysis produced; at least one, each named once.
       *
       * An analysis reads one frame, so every candidate here is built from
       * marks on that same frame. Correlating two sheets is the authored
       * building's job through {@link IAutoMovieDesignEvidence}, which may cite
       * candidates from any frame of any document.
       */
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

/**
 * One attempted reading of one frame.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignAnalysis` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignAnalysis` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignAnalysis {
  /**
   * Stable analysis identity within the document.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Frame this analysis read.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `frame` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `frame` for the narrative intent reference lineage system contract.
   */
  frame: string;
  /**
   * Open label of the reading attempted, such as `wall-centerline`.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `subject` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `subject` for the narrative intent reference lineage system contract.
   */
  subject: string;
  /**
   * Honest outcome of the attempt.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `outcome` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `outcome` for the narrative intent reference lineage system contract.
   */
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
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignReference` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignReference` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignReference {
  /**
   * Schema version.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `version` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `version` for the narrative intent reference lineage system contract.
   */
  version: 1;
  /**
   * Stable document identity within the production.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `id` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `id` for the narrative intent reference lineage system contract.
   */
  id: string;
  /**
   * Project-relative manifest asset holding the exact observed bytes.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `asset` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `asset` for the narrative intent reference lineage system contract.
   */
  asset: string;
  /**
   * SHA-256 of those bytes at the moment the observation was made.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `digest` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `digest` for the narrative intent reference lineage system contract.
   */
  digest: AutoMovieContentDigest;
  /**
   * Container family the asset bytes are declared to be.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `media` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `media` for the narrative intent reference lineage system contract.
   */
  media: AutoMovieDesignReferenceMedia;
  /**
   * Pages, sheets, or images read from the asset; at least one.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `frames` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `frames` for the narrative intent reference lineage system contract.
   */
  frames: IAutoMovieDesignSourceFrame[];
  /**
   * Raw marks read from those frames.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `primitives` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `primitives` for the narrative intent reference lineage system contract.
   */
  primitives: IAutoMovieObservedPrimitive[];
  /**
   * Every attempted reading, including the ones that produced nothing.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `analyses` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `analyses` for the narrative intent reference lineage system contract.
   */
  analyses: IAutoMovieDesignAnalysis[];
  /**
   * Semantic proposals over the raw marks.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `candidates` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `candidates` for the narrative intent reference lineage system contract.
   */
  candidates: IAutoMovieObservedCandidate[];
  /**
   * Everything still undecided.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `issues` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `issues` for the narrative intent reference lineage system contract.
   */
  issues: IAutoMovieDesignIssue[];
}

/**
 * One authored citation from a normalized design element to the observation it
 * was decided from.
 *
 * The arrow points from design to evidence, never back. The author states which
 * reading was chosen and why it beat the recorded alternatives; the observation
 * itself is left exactly as it was read.
 *
 * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observation-conditions Exposes `IAutoMovieDesignEvidence` as the portable data boundary for the evidence observation conditions requirement.
 * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-observation-record-contract Types `IAutoMovieDesignEvidence` for the evp observation record contract system contract.
 */
export interface IAutoMovieDesignEvidence {
  /**
   * Normalized design element, space, or boundary id this citation justifies.
   *
   * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observation-conditions Exposes `subject` as the portable data boundary for the evidence observation conditions requirement.
   * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-observation-record-contract Types `subject` for the evp observation record contract system contract.
   */
  subject: string;
  /**
   * Design-reference document id.
   *
   * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observation-conditions Exposes `document` as the portable data boundary for the evidence observation conditions requirement.
   * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-observation-record-contract Types `document` for the evp observation record contract system contract.
   */
  document: string;
  /**
   * Candidate ids cited as the basis of the authored decision; at least one.
   *
   * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observation-conditions Exposes `candidates` as the portable data boundary for the evidence observation conditions requirement.
   * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-observation-record-contract Types `candidates` for the evp observation record contract system contract.
   */
  candidates: string[];
  /**
   * Why the author chose this reading over the recorded alternatives.
   *
   * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observation-conditions Exposes `rationale` as the portable data boundary for the evidence observation conditions requirement.
   * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-observation-record-contract Types `rationale` for the evp observation record contract system contract.
   */
  rationale: string;
}

/**
 * One reading settled enough to become authored metric geometry.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignPromotedReading` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignPromotedReading` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignPromotedReading {
  /**
   * Candidate that produced it.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `candidate` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `candidate` for the narrative intent reference lineage system contract.
   */
  candidate: string;
  /**
   * The candidate's own semantic label.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `semantic` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `semantic` for the narrative intent reference lineage system contract.
   */
  semantic: string;
  /**
   * One world-space polyline in metres per primitive the candidate reads, in
   * the candidate's own primitive order and each in source point order.
   *
   * They stay separate rather than concatenated because a candidate built from
   * two disjoint marks is two runs, and a single flattened list would join them
   * with a segment nobody drew.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `outlines` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `outlines` for the narrative intent reference lineage system contract.
   */
  outlines: IAutoMovieVector3[][];
}

/**
 * One reading deliberately left as observation, and why.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignWithholding` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignWithholding` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignWithholding {
  /**
   * Candidate that stays an observation.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `candidate` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `candidate` for the narrative intent reference lineage system contract.
   */
  candidate: string;
  /**
   * Closed reason family that kept it unpromoted.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `reason` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `reason` for the narrative intent reference lineage system contract.
   */
  reason:
    | "unobserved"
    | "unknown-scale"
    | "ambiguous-candidate"
    | "open-issue"
    | "low-confidence"
    | "unsupported-geometry";
  /**
   * Human-readable statement of what would have to change.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `detail` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `detail` for the narrative intent reference lineage system contract.
   */
  detail: string;
}

/**
 * One reading that produced nothing, reported rather than omitted.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignSkippedAnalysis` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignSkippedAnalysis` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignSkippedAnalysis {
  /**
   * Analysis that produced no reading.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `analysis` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `analysis` for the narrative intent reference lineage system contract.
   */
  analysis: string;
  /**
   * Which kind of nothing it produced.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `status` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `status` for the narrative intent reference lineage system contract.
   */
  status: "unsupported" | "not-run";
  /**
   * The analysis' own reason, carried through verbatim.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `reason` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `reason` for the narrative intent reference lineage system contract.
   */
  reason: string;
}

/**
 * The complete, deterministic outcome of asking a reference for metric
 * geometry.
 *
 * Every candidate lands in exactly one of {@link promoted} or {@link withheld},
 * and every analysis that produced nothing is named in {@link skipped}. There is
 * no fourth pile, so a caller cannot mistake silence for agreement.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `IAutoMovieDesignPromotion` as the portable data boundary for the production design generated reference requirement.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `IAutoMovieDesignPromotion` for the narrative intent reference lineage system contract.
 */
export interface IAutoMovieDesignPromotion {
  /**
   * Readings settled enough to become metric geometry.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `promoted` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `promoted` for the narrative intent reference lineage system contract.
   */
  promoted: IAutoMovieDesignPromotedReading[];
  /**
   * Readings left as observation, each with its blocking reason.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `withheld` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `withheld` for the narrative intent reference lineage system contract.
   */
  withheld: IAutoMovieDesignWithholding[];
  /**
   * Analyses that were unsupported or never run.
   *
   * @evidence requirements/production-design/references-and-provenance.md#production-design-generated-reference Exposes `skipped` as the portable data boundary for the production design generated reference requirement.
   * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-lineage Types `skipped` for the narrative intent reference lineage system contract.
   */
  skipped: IAutoMovieDesignSkippedAnalysis[];
}

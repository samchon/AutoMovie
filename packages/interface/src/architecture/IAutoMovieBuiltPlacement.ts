import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * An addressable placed body whose current world bounds a building query can
 * derive without expanding authored repetition.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Gives project source a stable element-or-population subject for the promised placement-support query.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Types the two body identities whose current world bounds the support contract can resolve.
 * @author Samchon
 */
export type AutoMovieBuiltPlacementBodyLocator =
  | {
      /** Address an individual visible building element. */
      kind: "element";
      /** Stable element identity inside the queried built environment. */
      id: string;
    }
  | {
      /** Address one compact repeated population without expanding its members. */
      kind: "population";
      /** Stable instance-set identity inside the queried built environment. */
      id: string;
    };

/**
 * A named target against which a building body's support can be checked.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Lets a declared support name an element, compact population, or authored support surface instead of guessing one from proximity.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Types every support identity the bearing and suspension query is allowed to resolve.
 * @author Samchon
 */
export type AutoMovieBuiltPlacementSupportLocator =
  | AutoMovieBuiltPlacementBodyLocator
  | {
      /** Address an authored support surface and its height rule. */
      kind: "surface";
      /** Stable surface identity inside the queried built environment. */
      id: string;
    };

/**
 * One project-authored claim about how a placed building body is supported.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Expresses the promised named bearing or legitimate suspension relation in ordinary project TypeScript.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Supplies the subject, support, relation kind, and numeric tolerance consumed by the deterministic query.
 * @author Samchon
 */
export interface IAutoMovieBuiltSupportQuery {
  /** The element or compact population whose placement is being reviewed. */
  subject: AutoMovieBuiltPlacementBodyLocator;
  /** The named body or surface claimed to support the subject. */
  support: AutoMovieBuiltPlacementSupportLocator;
  /** Whether the subject bears on the support or intentionally hangs from it. */
  kind: "bearing" | "suspended";
  /**
   * Finite, non-negative contact tolerance in metres: how far off the support
   * a member may sit and still count as resting. Omission uses the engine's
   * deterministic placement epsilon; a negative or non-finite value is refused
   * rather than defaulted, because it withdraws the meaning of contact instead
   * of adjusting it.
   */
  tolerance?: number;
}

/**
 * How a resolved placement quantity was measured.
 *
 * A placement answer is only as good as the extent it was taken from, so the
 * basis travels with every result. `element-geometry-bounds` measured the same
 * vertices the renderer draws. `population-placement-bounds` is the
 * conservative envelope of a compact repeated field, never its expanded
 * members. `surface-height-rule` evaluated an authored support surface exactly.
 * `element-origin-point` measured no extent at all: the building record states
 * where the body stands but carries no vertices for it, as with a runtime model
 * reference, so the box is that single stated world origin and an overlap or
 * gap taken from it is a claim about a point rather than about a volume.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Keeps a query's visual-support basis visible instead of presenting it as structural engineering.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Distinguishes exact authored surface rules from element geometry, conservative compact-population bounds, and an extent-free stated origin.
 * @author Samchon
 */
export type AutoMovieBuiltPlacementBasis =
  | "element-geometry-bounds"
  | "element-origin-point"
  | "population-placement-bounds"
  | "surface-height-rule";

/**
 * The deterministic answer to one authored building-support claim.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Reports resting, floating, sunk, off-support, legitimate suspension, or unresolved placement without claiming capacity or safety.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Carries the classified gap, unresolved side, and measurement basis required by the support output contract.
 * @author Samchon
 */
export interface IAutoMovieBuiltSupportResult {
  /** The classified relationship between the subject and its named support. */
  status:
    | "resting"
    | "floating"
    | "sunk"
    | "not-over-support"
    | "suspended"
    | "unresolved";
  /**
   * Signed underside gap in metres for a resolved bearing relation, or null
   * when no bearing sample exists, the relation is suspended, or either side
   * is unresolved.
   */
  gap: number | null;
  /** Unresolved inputs, empty for every conclusive result. */
  unresolved: ("subject" | "support")[];
  /** Subject measurement basis, or null when its bounds cannot be resolved. */
  subjectBasis: AutoMovieBuiltPlacementBasis | null;
  /** Support measurement basis, or null when its face cannot be resolved. */
  supportBasis: AutoMovieBuiltPlacementBasis | null;
}

/**
 * The deterministic broad-phase answer for two named building bodies.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Lets project source ask whether a placed element or population intrudes on one named neighbour.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Carries positive-volume bounds overlap, unresolved sides, and each operand's measurement basis.
 * @author Samchon
 */
export interface IAutoMovieBuiltPlacementOverlapResult {
  /** Whether the resolved world boxes overlap by positive volume. */
  status: "overlapping" | "separate" | "unresolved";
  /** Unresolved operands, empty when overlap was measured. */
  unresolved: ("left" | "right")[];
  /** Left operand's measurement basis, or null when unresolved. */
  leftBasis: AutoMovieBuiltPlacementBasis | null;
  /** Right operand's measurement basis, or null when unresolved. */
  rightBasis: AutoMovieBuiltPlacementBasis | null;
}

/**
 * One world-axis-aligned placement box with the basis that produced it.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Exposes the measurable placement extent project source needs before it can review support or overlap.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Preserves whether element geometry, a compact population placement, or an extent-free stated origin produced the box.
 * @author Samchon
 */
export interface IAutoMovieBuiltPlacementBounds {
  /** Inclusive world-space minimum corner, in metres. */
  min: IAutoMovieVector3;
  /** Inclusive world-space maximum corner, in metres. */
  max: IAutoMovieVector3;
  /**
   * The derivation used to obtain this box. `element-origin-point` marks a box
   * with no extent, so read it before treating the corners as a volume.
   */
  basis: Exclude<AutoMovieBuiltPlacementBasis, "surface-height-rule">;
}

/**
 * One body the whole-building sweep found nothing under.
 *
 * The requirement asks for two different capabilities in one sentence: express
 * what supports what, and be able to FIND the floating or disconnected elements.
 * A named-pair query answers the first and cannot answer the second, because a
 * body you have to name is a body you already suspect. This is the second half,
 * and it makes no claim about a support relation: it reports what the record
 * measures under a body, which is a measurement rather than an inferred bearing.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Finds a floating or disconnected placed body without a project-authored relation naming it first.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Carries the signed clearance to the nearest measurable body below and the basis both extents were taken from.
 * @author Samchon
 */
export interface IAutoMovieBuiltFloatingBody {
  /** The element or compact population nothing supports at its underside. */
  body: AutoMovieBuiltPlacementBodyLocator;
  /** The derivation this body's own extent came from. */
  basis: Exclude<AutoMovieBuiltPlacementBasis, "surface-height-rule">;
  /**
   * The highest measurable body under this one and the clearance to it in
   * metres, or `null` when the sweep found nothing under this body at all. A
   * clearance is always greater than the tolerance, since a body within it is
   * reported as supported instead.
   */
  below: {
    /** The nearest measurable body below. */
    body: AutoMovieBuiltPlacementBodyLocator;
    /** Positive vertical clearance from that body's top to this one's underside. */
    clearance: number;
  } | null;
}

/**
 * What one whole-building support sweep measured, not only what it found.
 *
 * The census is part of the answer. An empty finding list from a sweep that
 * resolved nothing reads exactly like a clean building, which is the failure a
 * measurement script in this repository has already shipped once, so the counts
 * travel beside the findings and a caller compares them.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Reports the whole population a support sweep judged beside the floating bodies it found.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Separates measured, ground-borne, body-borne, floating, and unresolved outcomes instead of collapsing them into one list.
 * @author Samchon
 */
export interface IAutoMovieBuiltSupportSweepReport {
  /** Bodies whose extent resolved and were therefore judged. */
  measured: number;
  /**
   * Candidate inspections performed after pruning, the sweep's own cost.
   *
   * It belongs in the answer for the same reason the overlap sweep's does: a
   * caller deciding whether to run this every round needs the number, and a cost
   * measured once in a document is a cost nobody can re-measure.
   */
  compared: number;
  /** Bodies whose underside meets the stated ground plane within tolerance. */
  grounded: number;
  /** Bodies resting on another body's top within tolerance. */
  borne: number;
  /** Every body with clear air under it, in stable record order. */
  floating: IAutoMovieBuiltFloatingBody[];
  /** Bodies whose extent the record does not resolve, so nothing was judged. */
  unresolved: AutoMovieBuiltPlacementBodyLocator[];
}

/**
 * Two bodies of one building whose volumes intersect, and by how much.
 *
 * Exact face contact is not intersection, so joined construction that merely
 * meets is absent from a sweep rather than filling it. What remains is graded:
 * a quoin toothed one centimetre into its wall and a column standing entirely
 * inside one are both intersections and are not the same finding, so the shared
 * volume travels with the pair and the fraction says how much of the smaller
 * body is inside the larger.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Finds intruding placed bodies across a whole building rather than one named neighbour at a time.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Carries the shared volume, its share of the smaller body, and both measurement bases with every reported pair.
 * @author Samchon
 */
export interface IAutoMovieBuiltPlacementOverlapPair {
  /** The body that appears first in record order. */
  left: AutoMovieBuiltPlacementBodyLocator;
  /** The body that appears later in record order. */
  right: AutoMovieBuiltPlacementBodyLocator;
  /** Derivation of the left body's extent. */
  leftBasis: Exclude<AutoMovieBuiltPlacementBasis, "surface-height-rule">;
  /** Derivation of the right body's extent. */
  rightBasis: Exclude<AutoMovieBuiltPlacementBasis, "surface-height-rule">;
  /** Shared volume in cubic metres, always greater than zero. */
  volume: number;
  /**
   * Shared volume over the smaller body's own volume, within `[0, 1]`. It is
   * `0` when that body measures no volume, which an `element-origin-point`
   * basis explains and which cannot intersect anything in the first place.
   */
  fraction: number;
}

/**
 * What one whole-building overlap sweep measured, and what it cost.
 *
 * `compared` is the number of pair tests the sweep actually performed, which is
 * the honest way to state the cost of a check whose naive form is quadratic. It
 * belongs in the answer rather than in a benchmark somebody runs separately,
 * because a caller deciding whether to run this every round needs it.
 *
 * @evidence requirements/building-exterior/structure-and-envelope.md#building-structural-support Reports every intruding pair in a building beside the population and the work the sweep did.
 * @evidence specifications/building-envelope/structure-envelope-and-materials.md#building-envelope-structural-support-input-output Separates the measured population, the performed comparisons, the found pairs, and the unresolved bodies.
 * @author Samchon
 */
export interface IAutoMovieBuiltPlacementOverlapReport {
  /** Bodies whose extent resolved and were therefore compared. */
  measured: number;
  /** Pair tests performed after pruning, the sweep's own cost. */
  compared: number;
  /** Every intersecting pair, deepest share of the smaller body first. */
  pairs: IAutoMovieBuiltPlacementOverlapPair[];
  /** Bodies whose extent the record does not resolve, so nothing compared them. */
  unresolved: AutoMovieBuiltPlacementBodyLocator[];
}

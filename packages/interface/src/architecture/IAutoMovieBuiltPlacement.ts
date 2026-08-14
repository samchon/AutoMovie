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

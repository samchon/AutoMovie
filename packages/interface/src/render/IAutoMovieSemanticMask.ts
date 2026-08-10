import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";

/**
 * The closed family of things a semantic mask can address.
 *
 * `label` on an entry carries the open architectural word (`storey`, `room`,
 * `door`, `window`), so this stays a small computational classification while
 * the vocabulary of a building stays free.
 */
export type AutoMovieSemanticKind =
  | "building"
  | "space"
  | "boundary"
  | "opening"
  | "element"
  | "node"
  | "instance-set"
  | "instance-slot"
  | "water-body"
  | "soft-body"
  | "planting";

/**
 * A segmentation palette keyed by stable semantic identity, plus the sidecar
 * that reads a rendered color back to the thing it named.
 *
 * The mask pass this replaces coloured the Nth top-level scene child with the
 * Nth colour of a golden-angle ramp. Two things were wrong with that, and both
 * are why a mask could not be used as evidence. A whole building collapsed into
 * one colour, so a room, a wall, an opening and a repeated window slot were
 * indistinguishable in the very image that exists to distinguish them. And the
 * colour was an ARRAY INDEX, so inserting an unrelated node ahead of a building
 * repainted the building: two masks of the same design disagreed about what
 * they had segmented, and neither was wrong.
 *
 * Here a colour is a pure function of the entity's stable semantic id. Scene
 * order, insertion order, and the presence of unrelated entities do not enter
 * the derivation, so reordering the scene reproduces a byte-identical mask and
 * adding an unrelated node leaves every existing colour untouched. Two ids that
 * hash to the same colour are separated deterministically by comparing the ids
 * themselves rather than by their position, so the tie-break is a property of
 * the pair and not of the scene around them.
 *
 * The palette is exact 8-bit-per-channel RGB, so a PNG readback recovers the
 * authored value with no tolerance, and `#000000` is reserved for background
 * and never assigned.
 *
 * @author Samchon
 */
export interface IAutoMovieSemanticMask {
  /** Mask format. */
  version: 1;

  /** Versioned palette-derivation protocol. */
  protocol: "automovie.semantic-mask.v1";

  /** Reserved background colour, never assigned to an entry. */
  background: "#000000";

  /** Entries in ascending semantic-id order. */
  entries: IAutoMovieSemanticMaskEntry[];

  /**
   * Instance sets whose per-slot colours were not allocated, and why.
   *
   * A mask is bounded evidence: it cannot carry one entry per slot for an
   * arbitrarily large instanced set. A set listed here is still addressable as
   * a whole through its `instance-set` entry; only per-slot identity is absent,
   * and it is reported rather than quietly approximated.
   */
  unaddressed: IAutoMovieSemanticMaskGap[];

  /** Digest over the protocol and every entry's id, kind and colour. */
  digest: AutoMovieContentDigest;
}

/** One addressable entity and the flat colour the mask pass paints it. */
export interface IAutoMovieSemanticMaskEntry {
  /**
   * Stable semantic id, of the form `<kind>:<path>`.
   *
   * Examples: `building:tower/unit-a`, `space:tower/level-2`,
   * `opening:tower/door-12`, `node:hero-actor`, `instance-slot:windows#417`.
   */
  id: string;

  /** Computational classification. */
  kind: AutoMovieSemanticKind;

  /**
   * The open architectural word the design used (`storey`, `room`, `door`), or
   * `null` for a kind that carries none.
   */
  label: string | null;

  /** Exact opaque `#RRGGBB` colour, uppercase hexadecimal. */
  color: string;

  /** Semantic id of the owning entity, or `null` for a root. */
  owner: string | null;

  /**
   * Scene node ids that draw this entity, ascending.
   *
   * This is the join between the semantic graph and the built scene: the viewer
   * resolves a mesh to its top-level node and finds its colour here, so the
   * mask pass needs no knowledge of architecture.
   */
  nodes: string[];

  /** Owning instance set and zero-based slot, or `null` for every other kind. */
  slot: IAutoMovieSemanticMaskSlot | null;
}

/** The instanced slot one entry addresses. */
export interface IAutoMovieSemanticMaskSlot {
  /** Compiled instance-set id. */
  instanceSet: string;

  /** Zero-based deterministic slot index inside that set. */
  index: number;
}

/** One instance set whose per-slot colours were not allocated. */
export interface IAutoMovieSemanticMaskGap {
  /** Compiled instance-set id. */
  instanceSet: string;

  /** Slots that went unaddressed. */
  slots: number;

  /** Exactly why they were not allocated. */
  reason: string;

  /** Exactly what would allocate them. */
  remedy: string;
}

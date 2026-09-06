import { AutoMovieContentDigest } from "../production/IAutoMovieProductionDesign";

/**
 * The closed family of things a semantic mask can address.
 *
 * `label` on an entry carries the open architectural word (`storey`, `room`,
 * `door`, `window`), so this stays a small computational classification while
 * the vocabulary of a building stays free.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `AutoMovieSemanticKind` as the portable data boundary for the rendering identity mask channels requirement.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `AutoMovieSemanticKind` for the spec render pass products system contract.
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
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `IAutoMovieSemanticMask` as the portable data boundary for the rendering identity mask channels requirement.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `IAutoMovieSemanticMask` for the spec render pass products system contract.
 * @author Samchon
 */
export interface IAutoMovieSemanticMask {
  /**
   * Mask format.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `version` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `version` for the spec render pass products system contract.
   */
  version: 2;

  /**
   * Versioned palette-derivation protocol.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `protocol` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `protocol` for the spec render pass products system contract.
   */
  protocol: "automovie.semantic-mask.v2";

  /**
   * Reserved background colour, never assigned to an entry.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `background` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `background` for the spec render pass products system contract.
   */
  background: "#000000";

  /**
   * Entries in ascending semantic-id order.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `entries` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `entries` for the spec render pass products system contract.
   */
  entries: IAutoMovieSemanticMaskEntry[];

  /**
   * Instance sets whose per-slot colours were not allocated, and why.
   *
   * A mask is bounded evidence: it cannot carry one entry per slot for an
   * arbitrarily large instanced set. A set listed here is still addressable as
   * a whole through its `instance-set` entry; only per-slot identity is absent,
   * and it is reported rather than quietly approximated.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `unaddressed` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `unaddressed` for the spec render pass products system contract.
   */
  unaddressed: IAutoMovieSemanticMaskGap[];

  /**
   * Digest over the complete canonical versioned payload except this field.
   * It therefore seals background, every entry field, and every bounded gap.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `digest` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `digest` for the spec render pass products system contract.
   */
  digest: AutoMovieContentDigest;
}

/**
 * Runtime agreement between a semantic palette and the scene actually drawn.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `IAutoMovieSemanticMaskCoverage` as the portable data boundary for complete structural evidence.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `IAutoMovieSemanticMaskCoverage` for the semantic render-product closure.
 */
export interface IAutoMovieSemanticMaskCoverage {
  /** Declared drawable ids absent from the built scene, in ascending order. */
  unresolved: string[];
  /** Built meshes that the palette could not name. */
  unaddressed: number;
}

/**
 * One shot's palette and runtime coverage captured as one indivisible fact.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `IAutoMovieSemanticMaskEvidence` as the portable data boundary for same-frame palette and coverage evidence.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `IAutoMovieSemanticMaskEvidence` for the semantic render-product closure.
 */
export interface IAutoMovieSemanticMaskEvidence {
  /** Evidence envelope schema. */
  version: 1;
  /** Exact compiled shot whose drawn scene was audited. */
  shot: string;
  /** Verified current semantic palette. */
  mask: IAutoMovieSemanticMask;
  /** Coverage observed from the same built frame. */
  coverage: IAutoMovieSemanticMaskCoverage;
}

/**
 * Resident semantic dependency of one mask image.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `IAutoMovieSemanticMaskReceipt` as the portable data boundary for content-addressed semantic evidence.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `IAutoMovieSemanticMaskReceipt` for reopening a semantic render product.
 */
export interface IAutoMovieSemanticMaskReceipt {
  /** Receipt record schema. */
  version: 1;
  /** Frame identity inside the owning bundle or chunk. */
  frame: number;
  /** Structural product this record accompanies. */
  pass: "mask";
  /** Exact compiled shot represented by the product. */
  shot: string;
  /** Canonical sidecar resident beside the image. */
  sidecar: {
    /** Portable owner-relative path. */
    path: string;
    /** Digest of the exact resident UTF-8 bytes. */
    digest: AutoMovieContentDigest;
    /** Positive resident byte count. */
    bytes: number;
  };
  /** Digest of the canonical semantic payload inside the sidecar. */
  semanticDigest: AutoMovieContentDigest;
  /** Runtime coverage preserved without normalizing gaps away. */
  coverage: IAutoMovieSemanticMaskCoverage;
}

/**
 * One addressable entity and the flat colour the mask pass paints it.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `IAutoMovieSemanticMaskEntry` as the portable data boundary for the rendering identity mask channels requirement.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `IAutoMovieSemanticMaskEntry` for the spec render pass products system contract.
 */
export interface IAutoMovieSemanticMaskEntry {
  /**
   * Stable semantic id, of the form `<kind>:<path>`.
   *
   * Examples: `building:tower/unit-a`, `space:tower/level-2`,
   * `opening:tower/door-12`, `node:hero-actor`, `instance-slot:windows#417`.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `id` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `id` for the spec render pass products system contract.
   */
  id: string;

  /**
   * Computational classification.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `kind` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `kind` for the spec render pass products system contract.
   */
  kind: AutoMovieSemanticKind;

  /**
   * The open architectural word the design used (`storey`, `room`, `door`), or
   * `null` for a kind that carries none.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `label` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `label` for the spec render pass products system contract.
   */
  label: string | null;

  /**
   * Exact opaque `#RRGGBB` colour, uppercase hexadecimal.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `color` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `color` for the spec render pass products system contract.
   */
  color: string;

  /**
   * Semantic id of the owning entity, or `null` for a root.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `owner` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `owner` for the spec render pass products system contract.
   */
  owner: string | null;

  /**
   * Scene node ids that draw this entity, ascending.
   *
   * This is the join between the semantic graph and the built scene: the viewer
   * resolves a mesh to its top-level node and finds its colour here, so the
   * mask pass needs no knowledge of architecture.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `nodes` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `nodes` for the spec render pass products system contract.
   */
  nodes: string[];

  /**
   * Owning instance set and zero-based slot, or `null` for every other kind.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `slot` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `slot` for the spec render pass products system contract.
   */
  slot: IAutoMovieSemanticMaskSlot | null;
}

/**
 * The instanced slot one entry addresses.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `IAutoMovieSemanticMaskSlot` as the portable data boundary for the rendering identity mask channels requirement.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `IAutoMovieSemanticMaskSlot` for the spec render pass products system contract.
 */
export interface IAutoMovieSemanticMaskSlot {
  /**
   * Compiled instance-set id.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `instanceSet` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `instanceSet` for the spec render pass products system contract.
   */
  instanceSet: string;

  /**
   * Zero-based deterministic slot index inside that set.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `index` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `index` for the spec render pass products system contract.
   */
  index: number;
}

/**
 * One instance set whose per-slot colours were not allocated.
 *
 * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `IAutoMovieSemanticMaskGap` as the portable data boundary for the rendering identity mask channels requirement.
 * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `IAutoMovieSemanticMaskGap` for the spec render pass products system contract.
 */
export interface IAutoMovieSemanticMaskGap {
  /**
   * Compiled instance-set id.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `instanceSet` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `instanceSet` for the spec render pass products system contract.
   */
  instanceSet: string;

  /**
   * Slots that went unaddressed.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `slots` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `slots` for the spec render pass products system contract.
   */
  slots: number;

  /**
   * Exactly why they were not allocated.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `reason` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `reason` for the spec render pass products system contract.
   */
  reason: string;

  /**
   * Exactly what would allocate them.
   *
   * @evidence requirements/rendering/passes-channels-and-products.md#rendering-identity-mask-channels Exposes `remedy` as the portable data boundary for the rendering identity mask channels requirement.
   * @evidence specifications/editorial-render-and-delivery/render-products-visibility-and-color.md#spec-render-pass-products Types `remedy` for the spec render pass products system contract.
   */
  remedy: string;
}

import { IAutoMovieNode } from "../core/IAutoMovieNode";
import {
  IAutoMovieProfile,
  IAutoMovieProfileBinding,
} from "../core/IAutoMovieProfile";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieModel } from "../model/IAutoMovieModel";

/**
 * The self-declared articulation of a prop: the internal joint nodes (a door's
 * hinge, a drawer's slide) plus the profile that constrains and drives them,
 * all as data.
 *
 * This is the object-side counterpart of a character's skeleton+ROM: the nodes
 * are the prop's own node-graph joints, the profile's limits bound them
 * (`resolveFrame`'s CONSTRAIN stage clamps and reports through
 * {@link bindProfile}), and its drivers couple them (a handle that mirrors the
 * hinge). A prop with no moving parts leaves the whole articulation `null`.
 *
 * @author Samchon
 */
export interface IAutoMoviePropArticulation {
  /**
   * The prop's internal joint nodes: the subtree the profile binds onto.
   * Parents must resolve within this list (`null` = the prop's own root); the
   * scene bridge (`sceneToNodes`'s `props` registry) parents the subtree under
   * the prop's scene node with the placement prefix, so the profile binds with
   * the same prefix (`bindProfile`'s `nodePrefix`).
   *
   * A joint's {@link IAutoMovieNode.mesh} names the part of
   * {@link IAutoMoviePropSpec.model} that rides it, and that reference is what
   * makes a declared joint visible: a hinge with no part named turns an empty
   * frame while the leaf stands still. `forgeProp` requires the name to be one
   * of this prop's own parts and refuses a part claimed by two joints, since a
   * part rides one frame. A joint that only positions other joints leaves it
   * `null`.
   */
  nodes: IAutoMovieNode[];

  /** The declared capability: limits and drivers over the joint nodes. */
  profile: IAutoMovieProfile;

  /**
   * The application of that profile onto this prop's nodes: every semantic key
   * the profile references maps to one of {@link nodes} via `boneMap`.
   */
  binding: IAutoMovieProfileBinding;
}

/**
 * One authored prop, a crude primitive proxy with rich meaning: the geometry
 * stays simple boxes and cylinders, while the physics body
 * ({@link IAutoMovieModel.body}), the contact semantics
 * ({@link IAutoMovieModel.affordances}), and the self-declared articulation
 * carry everything the engine validates and simulates.
 *
 * The spec is what the FORGE stage's object side (`forgeProp`) gates: the model
 * must be a skeleton-less prop whose id equals `node` (the staged scene joins
 * on it, exactly as a forged cast member does), generated unless
 * {@link modelRef} names the registration its imported bytes came from, and the
 * articulation, when present, must bind its profile onto the declared nodes
 * without a dangling reference.
 *
 * @author Samchon
 */
export interface IAutoMoviePropSpec {
  /** The scene node this prop will occupy (the staging join key). */
  node: string;

  /**
   * The prop model: `skeleton: null` (a riggable actor goes through `forgeCast`
   * instead), primitive parts, optional body and affordances. `origin` is
   * `"generated"` for a prop drawn from those parts and `"imported"` for one
   * drawing a registered external appearance, which {@link modelRef} names and
   * gates.
   */
  model: IAutoMovieModel;

  /** Self-declared moving parts, or `null` for a rigid prop. */
  articulation: IAutoMoviePropArticulation | null;

  /**
   * Optional semantic placement constraints checked beside the staged node.
   * Omission preserves the original prop contract: the prop is forged and
   * staged without claiming a building relation or a keep-out volume.
   */
  placement?: IAutoMoviePropPlacement;

  /**
   * The compiler-owned model registration whose imported bytes draw this prop,
   * or absent / `null` for a prop drawn from its own generated parts.
   *
   * This is the escape hatch to an external asset, and it deliberately buys the
   * appearance alone. A manufacturer's chair arrives as a mesh with no mass, no
   * seat face, no hinge and no keep-out volume, so a prop that cited one and
   * nothing else would be a picture standing where furniture should be. Stating
   * the reference therefore moves no meaning out of this spec: {@link model}'s
   * parts stay the deterministic proxy every geometric judgment is made against
   * (occupancy, bearing on a support, clearance, containment, passage
   * intrusion), its `body` and `affordances` stay the contact semantics, and
   * {@link articulation} and {@link placement} stay the prop's own. That is the
   * same split the compiler already makes when it materializes a registered
   * external appearance: the visible primitives become one registered collision
   * proxy and the imported bytes are kept for the viewer.
   *
   * So this does not repeal "crude primitive proxy, rich meaning" (D011). That
   * principle never said the pixels have to be ours; it said the meaning has to
   * be in the record rather than inferred from a mesh, which is exactly why the
   * proxy survives the reference instead of being replaced by it. What the
   * reference does repeal is the accident that the one category where free-form
   * geometry actually lives, furniture and fixtures and ironmongery, was also
   * the only category forbidden to bring any in.
   *
   * The reference is itself the classification the hatch demands, in the sense
   * Revit's DirectShape demands a category: free geometry is admitted, but only
   * under a registration it can be found and filtered by, so a blank reference
   * is refused. No second label rides along, because a per-prop category
   * nothing in this repository schedules or filters on would be decoration, and
   * the meaning a prop is classified by is already the affordances, body, and
   * relations it declares.
   *
   * The value names a registration the compiler owns, a model recipe id or the
   * runtime model id it materializes, exactly as a built environment's
   * `modelReferences` entries do. It is not the spelling a cast member's
   * `modelRef` uses. There, a reference means "do not forge me", because an
   * imported rig carries the bones a performer is driven through; here it means
   * "forge me as an imported appearance", because nothing a prop means can be
   * imported at all.
   *
   * Stating it is what opens `forgeProp`'s origin gate, and it opens it exactly
   * as far as the record can be checked: `origin` must be `"imported"`, `asset`
   * must name the bytes, and the compiler-sealed `imported` closure must be a
   * rigid `gltf-static-v1` appearance whose hero LOD binds those bytes under a
   * well-formed digest its own ledger covers. A humanoid appearance is a
   * performer and goes through `forgeCast`. Whether those digests match bytes
   * on disk, and whether the reference resolves to a registration at all, are
   * the compiler's own gates, where the registry and the files are.
   */
  modelRef?: string | null;
}

/**
 * Stable building relations and model-local proxies for one prop.
 *
 * These references name the architecture graph and other prop specifications;
 * they never copy their geometry. The engine resolves the complete prop
 * registry before checking them, so a relation may cite a prop declared later
 * without changing the result. A staged set piece supplies the prop's world
 * TRS, and every model-local box below is read through that same transform.
 *
 * @author Samchon
 */
export interface IAutoMoviePropPlacement {
  /**
   * Typed spatial relations this prop claims, in authored order.
   *
   * Order never changes the outcome. At most one `in-space` and at most one
   * `fill-opening` relation may be declared, because a prop occupies one
   * logical space and fills one passage; every other kind may repeat (a cabinet
   * standing against two walls, a rail socketed into three posts).
   */
  relations: IAutoMoviePropRelation[];

  /**
   * Model-local occupancy box, or `null` to derive it from visible geometry.
   *
   * A declared footprint is what other props must not intrude on and what the
   * occupied space must contain. Deriving is the honest default: it is the
   * exact bound of the prop's own parts. Declaring one states a use volume the
   * geometry does not show (a chair needs the room its seat sweeps back into)
   * or trims a decorative overhang that is not really in the way.
   */
  footprint: IAutoMoviePropBox | null;

  /** Model-local keep-out boxes for doors, drawers, service, and use. */
  clearance: IAutoMovieClearanceBox[];
}

/**
 * What a prop claims about where it sits, as one typed relation.
 *
 * The six kinds are the contact semantics the architecture graph can answer
 * for, and each one restricts which targets it accepts:
 *
 * - `"in-space"`: the prop is contained by a logical space (`space` target).
 * - `"on-support"`: it rests on a support patch or another prop's `stack-top`
 *   affordance (`surface` or `prop-affordance` target).
 * - `"against-boundary"`: it stands against a wall, floor, or ceiling separation
 *   (`boundary` target).
 * - `"fill-opening"`: it is the leaf, sash, or gate filling a passage cut through
 *   a boundary (`opening` target).
 * - `"attached"`: it is fixed to a building element or plugged into another
 *   prop's `socket` affordance (`element` or `prop-affordance` target).
 * - `"suspended"`: it hangs from a building element or from another prop's `hook`
 *   affordance (`element` or `prop-affordance` target).
 *
 * Three of the six are measured, not merely resolved. `"on-support"` is
 * measured as contact: a support patch and a `stack-top` both state a face, so
 * a prop claiming to rest on one is refused when it floats above it, sinks into
 * it, or does not stand over it at all. `"in-space"` and `"fill-opening"` are
 * measured as containment, inside the occupied space's own cells and inside the
 * reveal of the element filling the passage. The remaining three cite records
 * that state no contact geometry of their own, a boundary, a building element,
 * a socket or a hook, so they are checked as citations and left unmeasured
 * rather than judged against a frame that never said where the contact is.
 *
 * @author Samchon
 */
export interface IAutoMoviePropRelation {
  /** Which contact semantics this relation asserts. */
  kind: AutoMoviePropRelationKind;
  /** The stable spatial, element, or affordance id the relation cites. */
  target: IAutoMoviePropRelationTarget;
}

/** The closed set of contact semantics a prop placement can assert. */
export type AutoMoviePropRelationKind =
  | "in-space"
  | "on-support"
  | "against-boundary"
  | "fill-opening"
  | "attached"
  | "suspended";

/**
 * What a placement relation points at.
 *
 * Every arm cites an existing stable id rather than restating geometry: the
 * building graph owns spaces, elements, boundaries, openings, and support
 * patches, and a prop spec owns its affordances.
 *
 * @author Samchon
 */
export type IAutoMoviePropRelationTarget =
  | IAutoMoviePropRelationTarget.ISpace
  | IAutoMoviePropRelationTarget.IElement
  | IAutoMoviePropRelationTarget.IBoundary
  | IAutoMoviePropRelationTarget.IOpening
  | IAutoMoviePropRelationTarget.ISurface
  | IAutoMoviePropRelationTarget.IPropAffordance;
export namespace IAutoMoviePropRelationTarget {
  /** A logical space of a built environment. */
  export interface ISpace {
    /** Discriminator. */
    kind: "space";
    /** Built environment id. */
    environment: string;
    /** Logical space id inside that environment. */
    space: string;
  }

  /** A visible or grouping element of a built environment. */
  export interface IElement {
    /** Discriminator. */
    kind: "element";
    /** Built environment id. */
    environment: string;
    /** Element id inside that environment. */
    element: string;
  }

  /** A separation between spaces, such as a wall, floor, or ceiling. */
  export interface IBoundary {
    /** Discriminator. */
    kind: "boundary";
    /** Built environment id. */
    environment: string;
    /** Boundary id inside that environment. */
    boundary: string;
  }

  /** A passage cut through a boundary. */
  export interface IOpening {
    /** Discriminator. */
    kind: "opening";
    /** Built environment id. */
    environment: string;
    /** Opening id inside that environment. */
    opening: string;
  }

  /** A support patch assigned to a logical space. */
  export interface ISurface {
    /** Discriminator. */
    kind: "surface";
    /** Built environment id. */
    environment: string;
    /** Support surface id inside that environment. */
    surface: string;
  }

  /** A contact point declared by another prop's model. */
  export interface IPropAffordance {
    /** Discriminator. */
    kind: "prop-affordance";
    /** Scene node id of the supporting or hosting prop. */
    prop: string;
    /** Affordance id declared by that prop's model. */
    affordance: string;
  }
}

/**
 * One axis-aligned model-local volume.
 *
 * The engine transforms all eight corners by the prop's full staged TRS
 * (translation, unit quaternion, per-axis scale) and takes the world bounds of
 * the result, so a rotated box widens rather than being silently re-fitted.
 *
 * @author Samchon
 */
export interface IAutoMoviePropBox {
  /** Local minimum corner. */
  min: IAutoMovieVector3;
  /** Local maximum corner, strictly greater on every axis. */
  max: IAutoMovieVector3;
}

/**
 * One axis-aligned model-local volume another prop may not occupy.
 *
 * The validator compares the transformed keep-out volume against the
 * transformed occupancy of every other uniquely staged, valid prop.
 *
 * @author Samchon
 */
export interface IAutoMovieClearanceBox extends IAutoMoviePropBox {
  /** Stable clearance identity, unique within the prop. */
  id: string;
}

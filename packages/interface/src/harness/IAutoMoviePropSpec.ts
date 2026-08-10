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
 * must be a generated, skeleton-less prop whose id equals `node` (the staged
 * scene joins on it, exactly as a forged cast member does), and the
 * articulation, when present, must bind its profile onto the declared nodes
 * without a dangling reference.
 *
 * @author Samchon
 */
export interface IAutoMoviePropSpec {
  /** The scene node this prop will occupy (the staging join key). */
  node: string;

  /**
   * The prop model: `origin: "generated"`, `skeleton: null` (a riggable actor
   * goes through `forgeCast` instead), primitive parts, optional body and
   * affordances.
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

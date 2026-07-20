import { IAutoMovieNode } from "../core/IAutoMovieNode";
import {
  IAutoMovieProfile,
  IAutoMovieProfileBinding,
} from "../core/IAutoMovieProfile";
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
 * One authored prop, a crude primitive proxy with rich meaning: the
 * geometry stays simple boxes and cylinders, while the physics body
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
}

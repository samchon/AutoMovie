import { AutoMovieChannelValueType } from "./AutoMovieChannelValueType";

/**
 * A channel: a typed, addressable animatable value, the universal target that
 * tracks animate, drivers compute, and constraints clamp.
 *
 * Modelled on glTF animation targets generalized by KHR_animation_pointer. Two
 * forms:
 *
 * - {@link IAutoMovieNodeChannel}: a node's TRS or morph weights, the glTF-core
 *   path that every loader supports (and the cheap, common case).
 * - {@link IAutoMoviePointerChannel}: an arbitrary property addressed by an
 *   RFC-6901 JSON pointer (a light's intensity, a material factor, a camera
 *   FOV, a rig DOF). This is the form that lets automovie address "any value,
 *   not just node TRS"; today the driver graph and a shot's `lightMotions`
 *   consume it.
 *
 * A node-TRS channel is sugar for the pointer `/nodes/{id}/{path}`; the engine
 * treats both as the same kind of addressable lvalue.
 *
 * @author Samchon
 */
export type IAutoMovieChannel =
  | IAutoMovieNodeChannel
  | IAutoMoviePointerChannel;

/**
 * A channel addressing a node's transform component or morph weights (glTF
 * core).
 */
export interface IAutoMovieNodeChannel {
  /** Discriminator. */
  kind: "node";

  /** Id of the targeted node. */
  node: string;

  /**
   * Which animatable property of the node. `weights` targets the node's morph
   * target weights (a variable-width vector); the others are the TRS
   * components.
   */
  path: "translation" | "rotation" | "scale" | "weights";
}

/**
 * A channel addressing an arbitrary property by RFC-6901 JSON pointer. Honored
 * by the DRIVER graph (a prop profile's `source`/`output`, a channel limit) and
 * by a shot's `lightMotions` (`/lights/<id>/<property>`).
 *
 * A shot field admits exactly the targets its own applier writes, so
 * `cameraMotion` and `objectMotions` refuse one: those are applied node-by-node
 * and a pointer track there would validate and then do nothing (#1339). A
 * pointer no applier resolves is refused on every shot clip until one lands.
 */
export interface IAutoMoviePointerChannel {
  /** Discriminator. */
  kind: "pointer";

  /**
   * RFC-6901 JSON pointer to the target property, e.g. `/materials/3/baseColor`
   * or `/cameras/0/fovY`. `~0`/`~1` escaping applies.
   */
  pointer: string;

  /**
   * The value width this pointer resolves to (a pointer carries no implicit
   * type).
   */
  valueType: AutoMovieChannelValueType;
}

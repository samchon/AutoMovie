import { MoticaChannelValueType } from "./MoticaChannelValueType";

/**
 * A channel: a typed, addressable animatable value — the universal target that
 * tracks animate, drivers compute, and constraints clamp.
 *
 * Modelled on glTF animation targets generalized by KHR_animation_pointer. Two
 * forms:
 *
 * - {@link IMoticaNodeChannel} — a node's TRS or morph weights, the glTF-core path
 *   that every loader supports (and the cheap, common case).
 * - {@link IMoticaPointerChannel} — an arbitrary property addressed by an RFC-6901
 *   JSON pointer (material factor, camera FOV, light intensity, a rig DOF).
 *   This is what lets motica "animate any value, not just node TRS".
 *
 * A node-TRS channel is sugar for the pointer `/nodes/{id}/{path}`; the engine
 * treats both as the same kind of addressable lvalue.
 *
 * @author Samchon
 */
export type IMoticaChannel = IMoticaNodeChannel | IMoticaPointerChannel;

/**
 * A channel addressing a node's transform component or morph weights (glTF
 * core).
 */
export interface IMoticaNodeChannel {
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

/** A channel addressing an arbitrary property by RFC-6901 JSON pointer. */
export interface IMoticaPointerChannel {
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
  valueType: MoticaChannelValueType;
}

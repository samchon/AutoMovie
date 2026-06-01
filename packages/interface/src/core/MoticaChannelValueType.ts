/**
 * The value shape a {@link IMoticaChannel} resolves to, mirroring the element
 * types glTF / KHR_animation_pointer animate.
 *
 * A channel is a typed, addressable value (an "lvalue"): the engine samples a
 * track, runs drivers, and clamps constraints all against a channel whose width
 * is known from this tag. `quaternion` is a `vec4` whose interpolation is slerp
 * (not lerp), so it is distinguished from a plain `vec4`. `weights` is a
 * variable-width `float[]` (one per morph target), the only non-fixed-width
 * kind.
 *
 * @author Samchon
 */
export type MoticaChannelValueType =
  | "scalar"
  | "vec2"
  | "vec3"
  | "vec4"
  | "quaternion"
  | "weights";

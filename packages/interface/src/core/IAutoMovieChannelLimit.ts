import { IAutoMovieChannel } from "./IAutoMovieChannel";

/**
 * A constraint: a value-domain restriction on one channel, the generalized
 * range of motion. The engine clamps the channel to these bounds during
 * resolution and, crucially, _reports_ any violation (the same `[min, max]`
 * that clamps the pose also feeds the harness's `// ❌` correction), so
 * constraint resolution and validation are one computation.
 *
 * Bounds are per-component vectors matching the channel's width (a `scalar` rig
 * DOF has length-1 bounds; a `vec3` translation has length-3). A `null` side,
 * or a `null` component within a side, means that direction is unconstrained.
 *
 * This is the general form. Humanoid anatomical ROM keeps its dedicated
 * semantic representation ({@link IAutoMovieJointConstraint},
 * flexion/abduction/twist) as the humanoid profile's specialization; this
 * channel limit covers scalar rig DOFs, group/node rotations, weights, and
 * generic object channels.
 *
 * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-contract Exposes `IAutoMovieChannelLimit` as the portable data boundary for the motion channel contract requirement.
 * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `IAutoMovieChannelLimit` for the performance motion clip keytime interpolation system contract.
 * @author Samchon
 */
export interface IAutoMovieChannelLimit {
  /**
   * The channel whose value is constrained.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-contract Exposes `channel` as the portable data boundary for the motion channel contract requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `channel` for the performance motion clip keytime interpolation system contract.
   */
  channel: IAutoMovieChannel;

  /**
   * Lower bounds, one per channel component (e.g. `[xMin, yMin, zMin]`). `null`
   * = no lower bound on the channel; a `null` component = that axis is free.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-contract Exposes `min` as the portable data boundary for the motion channel contract requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `min` for the performance motion clip keytime interpolation system contract.
   */
  min: (number | null)[] | null;

  /**
   * Upper bounds, one per channel component. `null` semantics as for `min`.
   *
   * @evidence requirements/motion/channels-controls-and-drivers.md#motion-channel-contract Exposes `max` as the portable data boundary for the motion channel contract requirement.
   * @evidence specifications/performance-motion-and-staging/motion-sampling-and-composition.md#performance-motion-clip-keytime-interpolation Types `max` for the performance motion clip keytime interpolation system contract.
   */
  max: (number | null)[] | null;
}

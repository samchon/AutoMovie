import { IMoticaChannel } from "./IMoticaChannel";

/**
 * A constraint: a value-domain restriction on one channel — the generalized
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
 * semantic representation ({@link IMoticaJointConstraint},
 * flexion/abduction/twist) as the humanoid profile's specialization; this
 * channel limit covers scalar rig DOFs, group/node rotations, weights, and
 * generic object channels.
 *
 * @author Samchon
 */
export interface IMoticaChannelLimit {
  /** The channel whose value is constrained. */
  channel: IMoticaChannel;

  /**
   * Lower bounds, one per channel component (e.g. `[xMin, yMin, zMin]`). `null`
   * = no lower bound on the channel; a `null` component = that axis is free.
   */
  min: (number | null)[] | null;

  /** Upper bounds, one per channel component. `null` semantics as for `min`. */
  max: (number | null)[] | null;
}

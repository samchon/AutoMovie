import { IAutoMovieActionTarget } from "./IAutoMovieActionCall";

/**
 * A reach-query target the geometry context can resolve successfully.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieReachTarget` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieReachTarget` for the clv focus diagnostics refusal system contract.
 */
export type IAutoMovieReachTarget = Extract<
  IAutoMovieActionTarget,
  { kind: "node" | "bone" | "point" | "group" }
>;

/**
 * Engine query: can `actor`, from where it stands, **reach** `target`? The
 * engine answers with the gap against the actor's rig metrics (shoulder + arm
 * span, stride), so the agent stages a strike/grab at a distance that
 * _connects_ instead of miming at air: the classic failure, here as a
 * deterministic precondition the agent can query before committing. A bone
 * target is sampled from its actor's resolved pose at `t`, optionally under the
 * resident beat's performed shot.
 *
 * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `IAutoMovieGetReachRequest` as the portable data boundary for the camera target refusal requirement.
 * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `IAutoMovieGetReachRequest` for the clv focus diagnostics refusal system contract.
 * @author Samchon
 */
export interface IAutoMovieGetReachRequest {
  /**
   * Selects the geometric reachability query.
   *
   * @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-reachability This discriminator identifies the cited read-only query contract.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph This discriminator identifies the cited read-only query contract.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `type` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `type` for the clv focus diagnostics refusal system contract.
   */
  type: "getReach";

  /**
   * The actor reaching.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `actor` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `actor` for the clv focus diagnostics refusal system contract.
   */
  actor: string;

  /**
   * What it reaches for: a placement, live bone, literal point, or group.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `target` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `target` for the clv focus diagnostics refusal system contract.
   */
  target: IAutoMovieReachTarget;

  /**
   * Optional resident beat selecting the target actor's performed motion.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `beat` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `beat` for the clv focus diagnostics refusal system contract.
   */
  beat?: string;

  /**
   * Shot-local seconds at which a live bone is sampled. Defaults to 0.
   *
   * @evidence requirements/camera/targets-focus-and-depth-boundary.md#camera-target-refusal Exposes `t` as the portable data boundary for the camera target refusal requirement.
   * @evidence specifications/camera-light-and-visibility/target-focus-exposure-and-sampling.md#clv-focus-diagnostics-refusal Types `t` for the clv focus diagnostics refusal system contract.
   */
  t?: number;
}

/**
 * Per-axis state a {@link dampedSpring} threads across frames.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Separates the solver-owned evolving state from the author's target.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Carries the bounded state needed by the selected live secondary-motion path.
 * @author Samchon
 */
export interface ISpringStep {
  /**
   * The sprung value this step.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Reports the solver result without rewriting the authored target.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Exposes the live channel value produced at the fixed step.
   */
  value: number;
  /**
   * Velocity carried into the next step.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Keeps solver history explicit rather than hidden in global playback state.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Supplies the bounded continuation state for the next live step.
   */
  velocity: number;
}

/**
 * Stiffness (pull toward target) and damping (energy bleed) of a spring.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Keeps the author-selected response law distinct from solver state.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Declares the parameters of the selected bounded spring response.
 * @author Samchon
 */
export interface ISpringParams {
  /**
   * How hard the spring pulls toward the target. Higher = snappier.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Lets the author control target attraction while the solver performs integration.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Parameterizes the live secondary response without changing its fixed-step law.
   */
  stiffness: number;
  /**
   * How fast oscillation decays. Higher = less overshoot.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Lets the author bound energy loss while the solver owns the evolving velocity.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Controls settlement of the chosen live spring path.
   */
  damping: number;
}

const assertFinite = (label: string, value: number): void => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
};

/**
 * Advance a one-dimensional damped spring one fixed timestep (semi-implicit
 * Euler): a generic numeric integrator for **secondary motion**, a value that
 * lags, overshoots, and settles toward a moving target instead of snapping to
 * it. Driving a tail or ear joint's angle through this off the animated target
 * gives the follow-through a physics joint produces, while staying a pure,
 * deterministic function (same inputs → same output, replayable
 * frame-for-frame).
 *
 * `force = stiffness·(target − current) − damping·velocity`, integrated as
 * `velocity += force·dt; value += velocity·dt`. Unlike the world-space
 * {@link stepSpring} (VRM SpringBone, for the Node/Channel core), this works in
 * the humanoid pose path's angle space.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver Integrates the declared response parameters into explicit value and velocity state.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Executes one deterministic fixed step of the live secondary-motion choice.
 * @author Samchon
 */
export const dampedSpring = (
  current: number,
  velocity: number,
  target: number,
  params: ISpringParams,
  dt: number,
): ISpringStep => {
  assertFinite("spring current", current);
  assertFinite("spring velocity", velocity);
  assertFinite("spring target", target);
  assertFinite("spring stiffness", params.stiffness);
  assertFinite("spring damping", params.damping);
  assertFinite("spring dt", dt);
  if (params.stiffness < 0)
    throw new Error("spring stiffness must be non-negative");
  if (params.damping < 0)
    throw new Error("spring damping must be non-negative");
  if (dt <= 0) throw new Error("spring dt must be positive");

  const force =
    params.stiffness * (target - current) - params.damping * velocity;
  const nextVelocity = velocity + force * dt;
  return { value: current + nextVelocity * dt, velocity: nextVelocity };
};

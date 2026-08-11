import { AutoMovieExpressionPreset } from "./AutoMovieExpressionPreset";
import { IAutoMovieBlendshapeChannel } from "./IAutoMovieBlendshapeChannel";

/**
 * A facial expression at one instant: coarse preset intent plus optional
 * fine-grained ARKit overrides.
 *
 * AutoMovie offers two registration levels so the model can work at whatever
 * resolution the task needs:
 *
 * - `preset` + `intensity`: the **coarse, most reliable** handle. "Look happy at
 *   0.8." Portable across every VRM avatar.
 * - `blendshapes`: **fine-grained** ARKit channel overrides for precise lip
 *   shapes, asymmetric expressions, or audio-driven lip-sync, layered on top of
 *   the preset. `null` when the preset alone is enough.
 *
 * This split keeps the common case tiny (one preset + one number) while still
 * allowing the full 52-channel vector when needed, and both are validated the
 * same way (closed names, `[0, 1]` weights).
 *
 * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Exposes `IAutoMovieExpression` as the portable data boundary for the actor expression channels requirement.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `IAutoMovieExpression` for the performance actor pose gaze expression state system contract.
 * @author Samchon
 */
export interface IAutoMovieExpression {
  /**
   * Coarse emotion / viseme intent.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Exposes `preset` as the portable data boundary for the actor expression channels requirement.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `preset` for the performance actor pose gaze expression state system contract.
   */
  preset: AutoMovieExpressionPreset;

  /**
   * How strongly to apply `preset`, `[0, 1]`.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Exposes `intensity` as the portable data boundary for the actor expression channels requirement.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `intensity` for the performance actor pose gaze expression state system contract.
   */
  intensity: number;

  /**
   * Optional fine-grained ARKit channel overrides layered on top of `preset`.
   * `null` when the preset alone suffices. Each channel should appear at most
   * once.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Exposes `blendshapes` as the portable data boundary for the actor expression channels requirement.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `blendshapes` for the performance actor pose gaze expression state system contract.
   */
  blendshapes: IAutoMovieBlendshapeChannel[] | null;
}

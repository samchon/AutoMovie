import { AutoMovieArkitChannel } from "./AutoMovieArkitChannel";

/**
 * One ARKit blendshape channel set to a weight.
 *
 * The pair of a closed channel name and a `[0, 1]` weight is the fine-grained
 * facial control atom. A list of these is a fully-specified facial expression
 * at ARKit resolution: what Audio2Face streams and what an LLM can emit
 * directly because the space is named, bounded, and only 52-wide.
 *
 * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Exposes `IAutoMovieBlendshapeChannel` as the portable data boundary for the actor expression channels requirement.
 * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `IAutoMovieBlendshapeChannel` for the performance actor pose gaze expression state system contract.
 * @author Samchon
 */
export interface IAutoMovieBlendshapeChannel {
  /**
   * Which ARKit channel, from the closed 52-name menu.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Exposes `channel` as the portable data boundary for the actor expression channels requirement.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `channel` for the performance actor pose gaze expression state system contract.
   */
  channel: AutoMovieArkitChannel;

  /**
   * Activation weight, `[0, 1]`. `0` = inactive, `1` = full.
   *
   * @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels Exposes `weight` as the portable data boundary for the actor expression channels requirement.
   * @evidence specifications/performance-motion-and-staging/actor-identity-state-and-fidelity.md#performance-actor-pose-gaze-expression-state Types `weight` for the performance actor pose gaze expression state system contract.
   */
  weight: number;
}

/**
 * The reaction the engine applies to whatever a projectile is detected
 * striking, carried on an {@link IAutoMovieLaunchAction} so the model says
 * "shoot him off his horse" and the engine schedules the target's recoil at the
 * _computed_ contact time, not a hand-timed one.
 *
 * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `IAutoMovieOnHitReaction` as the portable data boundary for the story action reaction requirement.
 * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `IAutoMovieOnHitReaction` for the narrative intent action reaction knowledge system contract.
 * @author Samchon
 */
export interface IAutoMovieOnHitReaction {
  /**
   * Impulse strength the engine scales the recoil by.
   *
   * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `force` as the portable data boundary for the story action reaction requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `force` for the narrative intent action reaction knowledge system contract.
   */
  force: number;

  /**
   * Whether the hit unseats / floors the target (a fall within ROM + balance).
   *
   * @evidence requirements/story/beats-and-causality.md#story-action-reaction Exposes `unbalance` as the portable data boundary for the story action reaction requirement.
   * @evidence specifications/narrative-and-intent/events-causality-and-time.md#narrative-intent-action-reaction-knowledge Types `unbalance` for the narrative intent action reaction knowledge system contract.
   */
  unbalance?: boolean;
}

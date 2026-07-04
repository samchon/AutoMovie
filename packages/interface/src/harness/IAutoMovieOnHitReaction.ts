/**
 * The reaction the engine applies to whatever a projectile is detected striking
 * ??carried on an {@link IautomovieLaunchAction} so the model says "shoot him off
 * his horse" and the engine schedules the target's recoil at the _computed_
 * contact time, not a hand-timed one.
 *
 * @author Samchon
 */
export interface IautomovieOnHitReaction {
  /** Impulse strength the engine scales the recoil by. */
  force: number;

  /** Whether the hit unseats / floors the target (a fall within ROM + balance). */
  unbalance?: boolean;
}

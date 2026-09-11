/**
 * One shot-owned effect interval projected onto the film clock.
 *
 * The builder supplies these intervals only to prove that one world zone has
 * one effect owner at every realized film frame. They are not substituted for
 * film-owned runtime effects.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Keeps shot and film ownership explicit before runtime materialization.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Refuses overlapping owners instead of selecting a last writer.
 * @author Samchon
 */
export interface IAutoMovieShotEffectFilmInterval {
  /** Stable shot-owned cue id. */
  cue: string;
  /** Stable shot id that owns the cue. */
  shot: string;
  /** Existing world effect-zone id. */
  zone: string;
  /** Inclusive film-global frame. */
  startFrame: number;
  /** Exclusive film-global frame. */
  endFrame: number;
}

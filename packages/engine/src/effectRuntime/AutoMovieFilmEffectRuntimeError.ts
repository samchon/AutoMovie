/**
 * A named refusal at the film-effect owner and identity boundary.
 *
 * Every refusal carries a closed code so a builder diagnostic, a render plan,
 * and a viewer classify the same failure without parsing its message.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-scope-refusal Names the missing zone, recipe, owner, or bound instead of running an unbounded or silently empty effect.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#clock-seek-failure-and-recovery Returns an explicit refused state rather than a remapped clock or a downgraded fallback.
 */
export class AutoMovieFilmEffectRuntimeError extends Error {
  public constructor(
    /** Closed refusal class shared by every film-effect consumer. */
    public readonly code:
      | "film-effect-input-invalid"
      | "film-effect-owner-conflict"
      | "film-effect-recipe-missing"
      | "film-effect-runtime-invalid"
      | "film-effect-runtime-stale"
      | "film-effect-zone-missing",
    message: string,
  ) {
    super(message);
    this.name = "AutoMovieFilmEffectRuntimeError";
  }
}

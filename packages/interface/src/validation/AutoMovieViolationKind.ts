/**
 * The category of a deterministic constraint violation, aligned with the
 * engine's validator tiers.
 *
 * The kind is not cosmetic: it routes a failure to the right corrector and
 * orders cheap checks before expensive ones (principle 6, "compiler tiers"). A
 * `type` failure is caught in microseconds before any `physics` check runs, and
 * a `rom` failure is fed back with anatomical context a generic type error
 * could not carry.
 *
 * @author Samchon
 */
export type AutoMovieViolationKind =
  /** Tier 1: wrong type, bad enum value, missing required field. */
  | "type"
  /** Tier 1: numeric value outside a declared `[min, max]`. */
  | "range"
  /** Tier 2: joint angle outside its anatomical range of motion. */
  | "rom"
  /**
   * Tier 3: physically impossible (self-intersection, ground penetration,
   * off-balance).
   */
  | "physics"
  /**
   * Tier 4: temporal incoherence (non-monotonic time, excessive angular
   * velocity).
   */
  | "temporal"
  /** Tier 5: invalid generated mesh topology (non-manifold, etc.). */
  | "topology"
  /**
   * Procedural: a required item was left unaddressed (exhaustive-review
   * coverage gap).
   */
  | "coverage";

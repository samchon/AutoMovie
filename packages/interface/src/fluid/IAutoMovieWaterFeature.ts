/**
 * The binding that makes an independent fluid domain a building's water
 * feature.
 *
 * This record, not the fluid domain, is the building-owned half. The domain
 * stays a free-standing computational unit; the feature says _this building
 * unit's logical space is the basin that domain fills, and this is the rim it
 * is held by_. A production world with no building at all places the same
 * domain by simply not writing one of these.
 *
 * Nothing here re-states geometry. The basin's extent is the architecture's
 * logical space, the lattice's extent is the domain's grid, and the engine
 * checks that the binding actually resolves rather than trusting a name.
 */
export interface IAutoMovieWaterFeature {
  /** Stable feature identity within the production. */
  id: string;

  /** Id of the `IAutoMovieBuiltEnvironment` that owns the feature. */
  environment: string;

  /** Id of the logical space inside that environment acting as the basin. */
  space: string;

  /** Id of the independent fluid domain filling the basin. */
  domain: string;

  /** Semantic label; it selects nothing in the solver. */
  kind: AutoMovieWaterFeatureKind;

  /**
   * How the feature is evaluated over shot time.
   *
   * - `static`: always the authored step-0 state. A mirror pool that must read
   *   identically in every frame of a cut.
   * - `flowing`: the simulated state, and the renderer is told to scroll ripples
   *   along the solved velocity field.
   * - `simulated`: the simulated state with no additional surface animation.
   */
  mode: AutoMovieWaterFeatureMode;

  /**
   * Ids of the environment's boundaries forming the rim that retains the water,
   * such as the coping of a basin or the parapet of a roof pool. May be empty
   * for a feature retained by its own bed alone.
   */
  boundaries: string[];

  /** Id of the material the surface is drawn with, or `null` for the default. */
  material: string | null;
}

/** Open-ended enough to name a feature, closed enough to validate. */
export type AutoMovieWaterFeatureKind =
  | "pond"
  | "channel"
  | "fountain"
  | "waterfall"
  | "reservoir"
  | "other";

/** How a bound feature is evaluated over shot time. */
export type AutoMovieWaterFeatureMode = "static" | "flowing" | "simulated";

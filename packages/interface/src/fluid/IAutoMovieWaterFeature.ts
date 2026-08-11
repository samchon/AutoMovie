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
 *
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `IAutoMovieWaterFeature` as the portable data boundary for the interior fluid initial boundary record requirement.
 * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `IAutoMovieWaterFeature` for the interior space water feature fluid domain system contract.
 */
export interface IAutoMovieWaterFeature {
  /**
   * Stable feature identity within the production.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `id` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `id` for the interior space water feature fluid domain system contract.
   */
  id: string;

  /**
   * Id of the `IAutoMovieBuiltEnvironment` that owns the feature.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `environment` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `environment` for the interior space water feature fluid domain system contract.
   */
  environment: string;

  /**
   * Id of the logical space inside that environment acting as the basin.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `space` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `space` for the interior space water feature fluid domain system contract.
   */
  space: string;

  /**
   * Id of the independent fluid domain filling the basin.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `domain` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `domain` for the interior space water feature fluid domain system contract.
   */
  domain: string;

  /**
   * Semantic label; it selects nothing in the solver.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `kind` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `kind` for the interior space water feature fluid domain system contract.
   */
  kind: AutoMovieWaterFeatureKind;

  /**
   * How the feature is evaluated over shot time.
   *
   * - `static`: always the authored step-0 state. A mirror pool that must read
   *   identically in every frame of a cut.
   * - `flowing`: the simulated state, and the renderer is told to scroll ripples
   *   along the solved velocity field.
   * - `simulated`: the simulated state with no additional surface animation.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `mode` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `mode` for the interior space water feature fluid domain system contract.
   */
  mode: AutoMovieWaterFeatureMode;

  /**
   * Ids of the environment's boundaries forming the rim that retains the water,
   * such as the coping of a basin or the parapet of a roof pool. May be empty
   * for a feature retained by its own bed alone.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `boundaries` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `boundaries` for the interior space water feature fluid domain system contract.
   */
  boundaries: string[];

  /**
   * Id of the material the surface is drawn with, or `null` for the default.
   *
   * `null` is how "the renderer's own water" is spelled, so the id itself must
   * name something: a blank string is a citation of a material nobody can find,
   * and it is refused rather than read as the default.
   *
   * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-initial-boundary-record Exposes `material` as the portable data boundary for the interior fluid initial boundary record requirement.
   * @evidence specifications/interior-space/services-wet-and-fluid.md#interior-space-water-feature-fluid-domain Types `material` for the interior space water feature fluid domain system contract.
   */
  material: string | null;
}

/**
 * Open-ended enough to name a feature, closed enough to validate.
 *
 * @evidence requirements/map/rivers-and-inland-water.md#map-water-boundary-volume Exposes `AutoMovieWaterFeatureKind` as the portable data boundary for the map water boundary volume requirement.
 * @evidence specifications/world-and-site/hydrology-coast-and-groundwater.md#world-site-watershed-water-boundary-input Types `AutoMovieWaterFeatureKind` for the world site watershed water boundary input system contract.
 */
export type AutoMovieWaterFeatureKind =
  | "pond"
  | "channel"
  | "fountain"
  | "waterfall"
  | "reservoir"
  | "other";

/**
 * How a bound feature is evaluated over shot time.
 *
 * @evidence requirements/map/rivers-and-inland-water.md#map-water-boundary-volume Exposes `AutoMovieWaterFeatureMode` as the portable data boundary for the map water boundary volume requirement.
 * @evidence specifications/world-and-site/hydrology-coast-and-groundwater.md#world-site-watershed-water-boundary-input Types `AutoMovieWaterFeatureMode` for the world site watershed water boundary input system contract.
 */
export type AutoMovieWaterFeatureMode = "static" | "flowing" | "simulated";

/**
 * The binding that makes an independent soft-body domain a building's
 * furnishing.
 *
 * This record, not the soft-body domain, is the building-owned half. The domain
 * stays a free-standing computational unit; the furnishing says _this building
 * unit's logical space is the room that panel hangs in, and these are the
 * elements it is fixed to_. A production world with no building at all places
 * the same domain by simply not writing one of these.
 *
 * Nothing here re-states geometry. The room's extent is the architecture's
 * logical space, the panel's extent is the domain's rest mesh, and the engine
 * checks that the binding actually resolves rather than trusting a name.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `IAutoMovieSoftFurnishing` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `IAutoMovieSoftFurnishing` for the interior space soft furnishing planting system contract.
 */
export interface IAutoMovieSoftFurnishing {
  /**
   * Stable furnishing identity within the production.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `id` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `id` for the interior space soft furnishing planting system contract.
   */
  id: string;

  /**
   * Id of the `IAutoMovieBuiltEnvironment` that owns the furnishing.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `environment` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `environment` for the interior space soft furnishing planting system contract.
   */
  environment: string;

  /**
   * Id of the logical space inside that environment holding the panel.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `space` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `space` for the interior space soft furnishing planting system contract.
   */
  space: string;

  /**
   * Id of the independent soft-body domain this furnishing draws.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `domain` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `domain` for the interior space soft furnishing planting system contract.
   */
  domain: string;

  /**
   * Semantic label; it selects nothing in the solver.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `kind` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `kind` for the interior space soft furnishing planting system contract.
   */
  kind: AutoMovieSoftFurnishingKind;

  /**
   * How the furnishing is evaluated over shot time.
   *
   * - `rest`: always the authored rest configuration, reported as such. A rug
   *   that must read identically in every frame of a cut.
   * - `simulated`: the fixed-step solve at that second.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `mode` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `mode` for the interior space soft furnishing planting system contract.
   */
  mode: AutoMovieSoftFurnishingMode;

  /**
   * Id of the domain's named anchor state to hold, or `null` for the anchors'
   * own declared positions. This is where `open` and `closed` are chosen: the
   * furnishing selects a boundary condition, and the solver finds the folds.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `state` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `state` for the interior space soft furnishing planting system contract.
   */
  state: string | null;

  /**
   * Ids of the environment's elements the panel is fixed to: a curtain track, a
   * pelmet, a wall hook, the bed the linen lies on. May be empty for a panel
   * held only by its own anchors.
   *
   * The list is a stated dependency, not a source of geometry: moving a track
   * invalidates the panel bound to it, which is exactly what a change-impact
   * pass needs and what a silently duplicated coordinate could never give.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `supports` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `supports` for the interior space soft furnishing planting system contract.
   */
  supports: string[];

  /**
   * Id of the material the panel is drawn with, or `null` for the default.
   *
   * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `material` as the portable data boundary for the interior soft anchor host requirement.
   * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `material` for the interior space soft furnishing planting system contract.
   */
  material: string | null;
}

/**
 * Open-ended enough to name a furnishing, closed enough to validate.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-anchor-host Exposes `AutoMovieSoftFurnishingKind` as the portable data boundary for the interior soft anchor host requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `AutoMovieSoftFurnishingKind` for the interior space soft furnishing planting system contract.
 */
export type AutoMovieSoftFurnishingKind =
  | "curtain"
  | "blind"
  | "rug"
  | "cushion"
  | "bed-linen"
  | "membrane"
  | "other";

/**
 * How a bound furnishing is evaluated over shot time.
 *
 * @evidence requirements/interior/soft-materials-plants-and-deformation.md#interior-soft-simulation-bound Exposes `AutoMovieSoftFurnishingMode` as the portable data boundary for the interior soft simulation bound requirement.
 * @evidence specifications/interior-space/elements-furnishing-and-clearance.md#interior-space-soft-furnishing-planting Types `AutoMovieSoftFurnishingMode` for the interior space soft furnishing planting system contract.
 */
export type AutoMovieSoftFurnishingMode = "rest" | "simulated";

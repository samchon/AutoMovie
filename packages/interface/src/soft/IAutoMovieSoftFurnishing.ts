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
 */
export interface IAutoMovieSoftFurnishing {
  /** Stable furnishing identity within the production. */
  id: string;

  /** Id of the `IAutoMovieBuiltEnvironment` that owns the furnishing. */
  environment: string;

  /** Id of the logical space inside that environment holding the panel. */
  space: string;

  /** Id of the independent soft-body domain this furnishing draws. */
  domain: string;

  /** Semantic label; it selects nothing in the solver. */
  kind: AutoMovieSoftFurnishingKind;

  /**
   * How the furnishing is evaluated over shot time.
   *
   * - `rest`: always the authored rest configuration, reported as such. A rug
   *   that must read identically in every frame of a cut.
   * - `simulated`: the fixed-step solve at that second.
   */
  mode: AutoMovieSoftFurnishingMode;

  /**
   * Id of the domain's named anchor state to hold, or `null` for the anchors'
   * own declared positions. This is where `open` and `closed` are chosen: the
   * furnishing selects a boundary condition, and the solver finds the folds.
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
   */
  supports: string[];

  /** Id of the material the panel is drawn with, or `null` for the default. */
  material: string | null;
}

/** Open-ended enough to name a furnishing, closed enough to validate. */
export type AutoMovieSoftFurnishingKind =
  | "curtain"
  | "blind"
  | "rug"
  | "cushion"
  | "bed-linen"
  | "membrane"
  | "other";

/** How a bound furnishing is evaluated over shot time. */
export type AutoMovieSoftFurnishingMode = "rest" | "simulated";

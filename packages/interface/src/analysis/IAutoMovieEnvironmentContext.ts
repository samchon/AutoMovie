import { IAutoMovieHalfSpacePlane } from "../architecture/IAutoMovieBuiltEnvironment";
import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * The read-only world a building is analysed against.
 *
 * Sun, sky, season, orientation, reference ground and neighbouring occluder
 * masses are conditions the building reads; they are never things it owns. That
 * separation is the whole reason this record exists apart from
 * {@link IAutoMovieBuiltEnvironment}: an analysis may read a neighbour's mass to
 * decide that a window is in shadow, but no lowering, no scene graph and no
 * quantity take-off may ever emit that mass as part of the work. The engine
 * enforces it by refusing a context whose ids collide with building-owned ids,
 * so "the neighbour is now our tower" cannot happen by a copy-paste.
 *
 * Nothing here is a shipped library. A production declares its own instants,
 * its own illuminance, its own outdoor air; this package ships the contract
 * they are declared in and the solvers that read them, never a catalogue of
 * climates or places.
 *
 * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `IAutoMovieEnvironmentContext` as the portable data boundary for the lighting environment geometry trace requirement.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `IAutoMovieEnvironmentContext` for the clv environment image spatial variation system contract.
 * @author Samchon
 */
export interface IAutoMovieEnvironmentContext {
  /**
   * Schema version.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `version` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `version` for the clv environment image spatial variation system contract.
   */
  version: 1;
  /**
   * Stable context identity within the production.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `id` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `id` for the clv environment image spatial variation system contract.
   */
  id: string;
  /**
   * All authored dimensions are measured in metres.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `units` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `units` for the clv environment image spatial variation system contract.
   */
  units: "meter";
  /**
   * World direction the site calls north; non-zero, need not be normalized.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `north` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `north` for the clv environment image spatial variation system contract.
   */
  north: IAutoMovieVector3;
  /**
   * Datum plane every sky ray is measured against.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `ground` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `ground` for the clv environment image spatial variation system contract.
   */
  ground: IAutoMovieReferenceGround;
  /**
   * Declared environmental instants, strictly increasing in
   * {@link IAutoMovieEnvironmentInstant.time}.
   *
   * An instant is one moment the production wants answered, not a sampled year:
   * a solstice noon, an overcast winter morning, a night with the lights on.
   * Ordering is a contract rather than a convenience, because two runs of the
   * same design must produce the same artifacts in the same order.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-time-sampling Carries the declared instants that make environment sampling explicit on the production clock.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-sampling-claims Supplies the ordered environment samples consumed at declared production times.
   */
  instants: IAutoMovieEnvironmentInstant[];
  /**
   * Neighbouring masses that block light; read-only, never owned geometry.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `occluders` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `occluders` for the clv environment image spatial variation system contract.
   */
  occluders: IAutoMovieContextOccluder[];
}

/**
 * The reference ground as one plane.
 *
 * A ray that leaves a sample below this plane sees ground, not sky. The plane
 * is the datum an analysis measures the horizon against, and deliberately not a
 * terrain: landscape, roads and natural water are outside the building scope.
 *
 * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `IAutoMovieReferenceGround` as the portable data boundary for the lighting environment geometry trace requirement.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `IAutoMovieReferenceGround` for the clv environment image spatial variation system contract.
 */
export interface IAutoMovieReferenceGround {
  /**
   * World direction pointing from the ground into the sky; non-zero.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `up` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `up` for the clv environment image spatial variation system contract.
   */
  up: IAutoMovieVector3;
  /**
   * Plane constant in metres, read as `dot(normalize(up), point) = elevation`.
   * A point is above ground when its projection exceeds this value.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `elevation` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `elevation` for the clv environment image spatial variation system contract.
   */
  elevation: number;
}

/**
 * One moment of sun and sky, exactly as the production declares it.
 *
 * The sun direction is an input, not a computation. A repository that derived
 * it from a place and a calendar would be shipping named locations and climate
 * data as content; what the product owes is the contract and the solvers, so a
 * production states the direction and the illuminance it wants answered and
 * keeps its own sources.
 *
 * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-time-sampling Represents one explicitly timed environment sample rather than an inferred climate state.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-sampling-claims Carries the authored environment state evaluated at one declared production instant.
 */
export interface IAutoMovieEnvironmentInstant {
  /**
   * Stable instant identity within the context.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-time-sampling Identifies the exact authored environment sample on the production timeline.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-sampling-claims Gives each sampled environment state a stable identity.
   */
  id: string;
  /**
   * Open label such as `summer-solstice-1400` or `overcast-morning`.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-time-sampling Retains the production's authored label for the sampled environment alternative.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-sampling-claims Names the sampled state without inventing a location or climate catalogue.
   */
  label: string;
  /**
   * Ordering key in seconds from the production's own epoch; finite.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-time-sampling Places this environment state on the production's explicit time basis.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-sampling-claims Supplies the deterministic ordering and lookup key for environment sampling.
   */
  time: number;
  /**
   * World direction from the site toward the sun; non-zero.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-declared-sun Carries the production-declared sun direction without implying an unrecorded location or solar calculation.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `sun` for the clv environment image spatial variation system contract.
   */
  sun: IAutoMovieVector3;
  /**
   * Illuminance on a surface facing the sun directly, in lux; at or above zero.
   * A sun at or below the horizon must declare zero, because a source under the
   * ground plane delivers no beam.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-declared-sun Carries the declared direct solar illuminance used with the authored sun direction.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `directNormalIlluminance` for the clv environment image spatial variation system contract.
   */
  directNormalIlluminance: number;
  /**
   * Diffuse sky illuminance on an unobstructed horizontal plane, in lux.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-declared-sun Separates the declared diffuse sky contribution from direct solar illuminance.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `diffuseHorizontalIlluminance` for the clv environment image spatial variation system contract.
   */
  diffuseHorizontalIlluminance: number;
  /**
   * Outdoor dry-bulb air temperature in degrees Celsius, or null.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-spatial-variation Carries the production's local outdoor-air condition as an optional environment state.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `outdoorAirTemperature` for the clv environment image spatial variation system contract.
   */
  outdoorAirTemperature: number | null;
  /**
   * Outdoor relative humidity as a `[0, 1]` fraction, or null.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-spatial-variation Carries the production's local humidity condition without promoting a global climate default.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `outdoorRelativeHumidity` for the clv environment image spatial variation system contract.
   */
  outdoorRelativeHumidity: number | null;
}

/**
 * One neighbouring mass, as the intersection of its half-spaces.
 *
 * A convex mass is all a shading study needs and all this record allows. It is
 * a blocker, so it carries no material, no interior and no ownership: a
 * neighbour that could carry those would be a second building this work does
 * not own.
 *
 * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `IAutoMovieContextOccluder` as the portable data boundary for the lighting environment geometry trace requirement.
 * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `IAutoMovieContextOccluder` for the clv environment image spatial variation system contract.
 */
export interface IAutoMovieContextOccluder {
  /**
   * Stable occluder identity within the context.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `id` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `id` for the clv environment image spatial variation system contract.
   */
  id: string;
  /**
   * Open semantic label such as `neighbour-tower` or `boundary-wall`.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `kind` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `kind` for the clv environment image spatial variation system contract.
   */
  kind: string;
  /**
   * Half-spaces whose intersection is the mass; at least four, since fewer
   * cannot bound a solid in three dimensions.
   *
   * @evidence requirements/lighting/sun-sky-and-environment.md#lighting-environment-geometry-trace Exposes `planes` as the portable data boundary for the lighting environment geometry trace requirement.
   * @evidence specifications/camera-light-and-visibility/light-source-photometry-and-environment.md#clv-environment-image-spatial-variation Types `planes` for the clv environment image spatial variation system contract.
   */
  planes: IAutoMovieHalfSpacePlane[];
}

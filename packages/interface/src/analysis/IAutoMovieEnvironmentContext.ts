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
 * @author Samchon
 */
export interface IAutoMovieEnvironmentContext {
  /** Schema version. */
  version: 1;
  /** Stable context identity within the production. */
  id: string;
  /** All authored dimensions are measured in metres. */
  units: "meter";
  /** World direction the site calls north; non-zero, need not be normalized. */
  north: IAutoMovieVector3;
  /** Datum plane every sky ray is measured against. */
  ground: IAutoMovieReferenceGround;
  /**
   * Declared environmental instants, strictly increasing in
   * {@link IAutoMovieEnvironmentInstant.time}.
   *
   * An instant is one moment the production wants answered, not a sampled year:
   * a solstice noon, an overcast winter morning, a night with the lights on.
   * Ordering is a contract rather than a convenience, because two runs of the
   * same design must produce the same artifacts in the same order.
   */
  instants: IAutoMovieEnvironmentInstant[];
  /** Neighbouring masses that block light; read-only, never owned geometry. */
  occluders: IAutoMovieContextOccluder[];
}

/**
 * The reference ground as one plane.
 *
 * A ray that leaves a sample below this plane sees ground, not sky. The plane
 * is the datum an analysis measures the horizon against, and deliberately not a
 * terrain: landscape, roads and natural water are outside the building scope.
 */
export interface IAutoMovieReferenceGround {
  /** World direction pointing from the ground into the sky; non-zero. */
  up: IAutoMovieVector3;
  /**
   * Plane constant in metres, read as `dot(normalize(up), point) = elevation`.
   * A point is above ground when its projection exceeds this value.
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
 */
export interface IAutoMovieEnvironmentInstant {
  /** Stable instant identity within the context. */
  id: string;
  /** Open label such as `summer-solstice-1400` or `overcast-morning`. */
  label: string;
  /** Ordering key in seconds from the production's own epoch; finite. */
  time: number;
  /** World direction from the site toward the sun; non-zero. */
  sun: IAutoMovieVector3;
  /**
   * Illuminance on a surface facing the sun directly, in lux; at or above zero.
   * A sun at or below the horizon must declare zero, because a source under the
   * ground plane delivers no beam.
   */
  directNormalIlluminance: number;
  /** Diffuse sky illuminance on an unobstructed horizontal plane, in lux. */
  diffuseHorizontalIlluminance: number;
  /** Outdoor dry-bulb air temperature in degrees Celsius, or null. */
  outdoorAirTemperature: number | null;
  /** Outdoor relative humidity as a `[0, 1]` fraction, or null. */
  outdoorRelativeHumidity: number | null;
}

/**
 * One neighbouring mass, as the intersection of its half-spaces.
 *
 * A convex mass is all a shading study needs and all this record allows. It is
 * a blocker, so it carries no material, no interior and no ownership: a
 * neighbour that could carry those would be a second building this work does
 * not own.
 */
export interface IAutoMovieContextOccluder {
  /** Stable occluder identity within the context. */
  id: string;
  /** Open semantic label such as `neighbour-tower` or `boundary-wall`. */
  kind: string;
  /**
   * Half-spaces whose intersection is the mass; at least four, since fewer
   * cannot bound a solid in three dimensions.
   */
  planes: IAutoMovieHalfSpacePlane[];
}

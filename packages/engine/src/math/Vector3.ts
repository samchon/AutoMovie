import { IAutoMovieVector3 } from "@automovie/interface";

/**
 * Pure-function vector math over {@link IAutoMovieVector3} (`{ x, y, z }`).
 *
 * Stateless helpers: every operation returns a fresh object and never mutates
 * its inputs. The engine keeps its own tiny math layer (rather than depending
 * on `three.js`) so it stays renderer-agnostic and runnable headless.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Provides renderer-independent vector operations for measurable prototype geometry and spatial relations.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Provides renderer-independent vector operations for measurable prototype geometry and spatial relations.
 * @author Samchon
 */
export namespace Vector3 {
  /**
   * Create a vector from its three components.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Constructs the explicit three-coordinate value used by engine geometry calculations.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Constructs the explicit three-coordinate value used by engine geometry calculations.
   */
  export const create = (x = 0, y = 0, z = 0): IAutoMovieVector3 => ({
    x,
    y,
    z,
  });

  /**
   * Add two vectors component by component.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Combines declared positions or offsets component by component without hidden scene state.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Combines declared positions or offsets component by component without hidden scene state.
   */
  export const add = (
    a: IAutoMovieVector3,
    b: IAutoMovieVector3,
  ): IAutoMovieVector3 => ({
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  });

  /**
   * Subtract `b` from `a` component by component.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Derives the displacement between two declared points for spatial measurement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Derives the displacement between two declared points for spatial measurement.
   */
  export const subtract = (
    a: IAutoMovieVector3,
    b: IAutoMovieVector3,
  ): IAutoMovieVector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

  /**
   * Multiply every vector component by a scalar.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Applies a declared scalar to a vector while preserving its coordinate basis.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Applies a declared scalar to a vector while preserving its coordinate basis.
   */
  export const scale = (
    a: IAutoMovieVector3,
    s: number,
  ): IAutoMovieVector3 => ({
    x: a.x * s,
    y: a.y * s,
    z: a.z * s,
  });

  /**
   * Dot product of two vectors.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Measures directional alignment used by geometric and visibility predicates.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Measures directional alignment used by geometric and visibility predicates.
   */
  export const dot = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
    a.x * b.x + a.y * b.y + a.z * b.z;

  /**
   * Right-handed cross product of two vectors.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Derives the right-handed perpendicular used by normals and orientation tests.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Derives the right-handed perpendicular used by normals and orientation tests.
   */
  export const cross = (
    a: IAutoMovieVector3,
    b: IAutoMovieVector3,
  ): IAutoMovieVector3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });

  /**
   * Euclidean vector magnitude.
   * Ordinary components retain the established dot/square-root arithmetic.
   * Extreme finite components use hypot so a representable magnitude does not
   * overflow or underflow merely because its square is unrepresentable.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Measures Euclidean distance from explicit vector components.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Measures Euclidean distance from explicit vector components.
   */
  export const length = (a: IAutoMovieVector3): number =>
    normalizationScale(a) === 0
      ? Math.sqrt(dot(a, a))
      : Math.hypot(a.x, a.y, a.z);

  /**
   * Return a unit-length copy, or the zero vector for zero length.
   * Extreme finite vectors are reduced before measuring and dividing, allowing
   * even subnormal components and an overflowing total magnitude to retain
   * their direction. Ordinary vectors preserve their existing arithmetic.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Produces a unit direction, with a finite zero-vector result for the degenerate case.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Produces a unit direction, with a finite zero-vector result for the degenerate case.
   */
  export const normalize = (a: IAutoMovieVector3): IAutoMovieVector3 => {
    const divisor = normalizationScale(a);
    const value =
      divisor === 0
        ? a
        : { x: a.x / divisor, y: a.y / divisor, z: a.z / divisor };
    const len = length(value);
    return len === 0 ? create(0, 0, 0) : scale(value, 1 / len);
  };

  /**
   * Select a scale only outside the safe squared-component range. At magnitude
   * 2^-511 the largest component's square is normal; three squares of 2^511 still
   * fit Float64. These are arithmetic thresholds, not restrictions on vector
   * input. Returning zero keeps ordinary, zero and nonfinite legacy paths.
   */
  const normalizationScale = (a: IAutoMovieVector3): number => {
    const largest = Math.max(Math.abs(a.x), Math.abs(a.y), Math.abs(a.z));
    return Number.isFinite(largest) &&
      largest > 0 &&
      (largest < 2 ** -511 || largest > 2 ** 511)
      ? largest
      : 0;
  };

  /**
   * Component-wise linear interpolation, `t` in `[0, 1]`.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Samples a point between two explicit vectors at the declared interpolation fraction.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Samples a point between two explicit vectors at the declared interpolation fraction.
   */
  export const lerp = (
    a: IAutoMovieVector3,
    b: IAutoMovieVector3,
    t: number,
  ): IAutoMovieVector3 => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  });
}

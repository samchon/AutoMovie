/**
 * A 3D vector in automovie space (y-up, right-handed; see the package README
 * coordinate convention).
 *
 * Used both for positions / translations (in meters) and for unitless
 * directions (axes, normals). Which one a given field means is documented at
 * that field; the engine range-checks positions where it matters.
 *
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `IAutoMovieVector3` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `IAutoMovieVector3` within the declared spatial transform chain.
 * @author Samchon
 */
export interface IAutoMovieVector3 {
  /**
   * X: toward the character's left (+) / right (−).
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `x` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `x` within the declared spatial transform chain.
   */
  x: number;

  /**
   * Y: up (+) / down (−).
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `y` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `y` within the declared spatial transform chain.
   */
  y: number;

  /**
   * Z: toward the character's front (+) / back (−).
   *
   * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units Represents `z` in the explicit spatial-coordinate and unit boundary shared by imported and authored state.
   * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain Types `z` within the declared spatial transform chain.
   */
  z: number;
}

import type { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * A compact ellipsoidal deformation of an existing surface. The field has zero
 * influence outside its radii and fades with a continuous derivative at the
 * boundary, so neighbouring anatomy remains part of one deformation function.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-composable-geometry-operations Describes a spatial displacement and stretch that can be composed over resident mesh geometry.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-operations-topology Carries the local frame and metric support of a deformation that retains mesh connectivity and transforms its normal field.
 * @author Samchon
 */
export interface IAutoMovieMeshDeformationField {
  /** Centre in mesh-local metres. All coordinates must be finite. */
  center: IAutoMovieVector3;
  /** Strictly positive support radii in mesh-local metres. */
  radius: IAutoMovieVector3;
  /** Translation at the field centre, in metres; zero is neutral. */
  displacement: IAutoMovieVector3;
  /** Per-axis local stretch offsets; zero is neutral, 0.1 adds ten percent. */
  stretch: IAutoMovieVector3;
}

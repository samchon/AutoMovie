import type { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";

/**
 * A compact ellipsoidal deformation of an existing surface. The field has zero
 * influence outside its radii and fades with a continuous derivative at the
 * boundary, so neighbouring anatomy remains part of one deformation function.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Defines displacement and stretch inputs for shaping authored resident freeform geometry.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Carries mesh-local metric centres, support radii, translation and dimensionless stretch as explicit geometry inputs.
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

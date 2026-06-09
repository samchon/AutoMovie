/**
 * Where a model's geometry came from — assembled by autofilm, or imported by
 * the user.
 *
 * This gates the pipeline. A `generated` model is built by autofilm's geometry
 * phase, typically as assembled parametric primitives
 * ({@link AutoFilmPrimitiveShape}). An `imported` model is a mesh the user
 * supplied (glTF / VRM / FBX) and the ingest package normalized; autofilm then
 * only drives motion and expression on it, skipping geometry generation.
 * Recording the origin as a discriminated value keeps that branch explicit
 * rather than inferred from whether a mesh happens to be present.
 *
 * @author Samchon
 */
export type AutoFilmAssetOrigin =
  /** Geometry assembled by autofilm's generation phase. */
  | "generated"
  /** Mesh supplied by the user (glTF / VRM / FBX), normalized by ingest. */
  | "imported";

/**
 * Where a model's geometry came from — assembled by motica, or imported by the
 * user.
 *
 * This gates the pipeline. A `generated` model is built by motica's geometry
 * phase, typically as assembled parametric primitives
 * ({@link "./MoticaPrimitiveShape"}). An `imported` model is a mesh the user
 * supplied (glTF / VRM / FBX) and the ingest package normalized; motica then
 * only drives motion and expression on it, skipping geometry generation.
 * Recording the origin as a discriminated value keeps that branch explicit
 * rather than inferred from whether a mesh happens to be present.
 *
 * @author Samchon
 */
export type MoticaAssetOrigin =
  /** Geometry assembled by motica's generation phase. */
  | "generated"
  /** Mesh supplied by the user (glTF / VRM / FBX), normalized by ingest. */
  | "imported";

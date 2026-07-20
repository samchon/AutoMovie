import { AutoMoviePrimitiveShape } from "./AutoMoviePrimitiveShape";
import { IAutoMovieMesh } from "./IAutoMovieMesh";

/**
 * The geometry of one model part: either an LLM-authored parametric primitive
 * or imported/baked raw mesh data.
 *
 * Discriminated on `type` so the two paths the project cares about are
 * explicit: `primitive` is what a generation phase emits (bounded, named
 * dimensions a model can reliably produce), `mesh` is what ingest yields from a
 * user's uploaded asset. Both render to the same triangles downstream; the
 * union keeps "generated vs imported" honest at the geometry level, mirroring
 * {@link AutoMovieAssetOrigin} at the model level.
 *
 * @author Samchon
 */
export type IAutoMovieGeometry =
  | IAutoMoviePrimitiveGeometry
  | IAutoMovieMeshGeometry;

/** Geometry defined by a parametric primitive shape. */
export interface IAutoMoviePrimitiveGeometry {
  /** Discriminator. */
  type: "primitive";

  /** The parametric shape and its dimensions. */
  shape: AutoMoviePrimitiveShape;
}

/** Geometry defined by raw triangle-mesh data. */
export interface IAutoMovieMeshGeometry {
  /** Discriminator. */
  type: "mesh";

  /** The vertex data. */
  mesh: IAutoMovieMesh;
}

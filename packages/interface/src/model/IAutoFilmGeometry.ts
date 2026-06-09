import { AutoFilmPrimitiveShape } from "./AutoFilmPrimitiveShape";
import { IAutoFilmMesh } from "./IAutoFilmMesh";

/**
 * The geometry of one model part — either an LLM-authored parametric primitive
 * or imported/baked raw mesh data.
 *
 * Discriminated on `type` so the two paths the project cares about are
 * explicit: `primitive` is what a generation phase emits (bounded, named
 * dimensions a model can reliably produce), `mesh` is what ingest yields from a
 * user's uploaded asset. Both render to the same triangles downstream; the
 * union keeps "generated vs imported" honest at the geometry level, mirroring
 * {@link AutoFilmAssetOrigin} at the model level.
 *
 * @author Samchon
 */
export type IAutoFilmGeometry =
  | IAutoFilmPrimitiveGeometry
  | IAutoFilmMeshGeometry;

/** Geometry defined by a parametric primitive shape. */
export interface IAutoFilmPrimitiveGeometry {
  /** Discriminator. */
  type: "primitive";

  /** The parametric shape and its dimensions. */
  shape: AutoFilmPrimitiveShape;
}

/** Geometry defined by raw triangle-mesh data. */
export interface IAutoFilmMeshGeometry {
  /** Discriminator. */
  type: "mesh";

  /** The vertex data. */
  mesh: IAutoFilmMesh;
}

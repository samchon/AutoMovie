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
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieGeometry` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieGeometry` for the asset spec geometry inputs system contract.
 * @author Samchon
 */
export type IAutoMovieGeometry =
  | IAutoMoviePrimitiveGeometry
  | IAutoMovieMeshGeometry;

/**
 * Geometry defined by a parametric primitive shape.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMoviePrimitiveGeometry` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMoviePrimitiveGeometry` for the asset spec geometry inputs system contract.
 */
export interface IAutoMoviePrimitiveGeometry {
  /**
   * Discriminator.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `type` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `type` for the asset spec geometry inputs system contract.
   */
  type: "primitive";

  /**
   * The parametric shape and its dimensions.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `shape` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `shape` for the asset spec geometry inputs system contract.
   */
  shape: AutoMoviePrimitiveShape;
}

/**
 * Geometry defined by raw triangle-mesh data.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieMeshGeometry` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieMeshGeometry` for the asset spec geometry inputs system contract.
 */
export interface IAutoMovieMeshGeometry {
  /**
   * Discriminator.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `type` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `type` for the asset spec geometry inputs system contract.
   */
  type: "mesh";

  /**
   * The vertex data.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `mesh` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `mesh` for the asset spec geometry inputs system contract.
   */
  mesh: IAutoMovieMesh;
}

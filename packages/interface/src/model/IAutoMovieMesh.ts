import { AutoMovieHumanoidBone } from "../skeleton/AutoMovieHumanoidBone";

/**
 * Raw triangle-mesh geometry: the **imported / baked** path.
 *
 * Unlike a {@link AutoMoviePrimitiveShape} (a few LLM-emittable dimensions), a
 * mesh is bulk vertex data: it is produced by the ingest package when a user
 * imports a glTF/VRM/FBX, or baked by the engine, and consumed by the renderer.
 * A language model never authors these arrays; they live in the interface so
 * imported geometry has a typed home, the same way bone rest transforms do.
 *
 * Attributes follow the glTF convention of parallel flat arrays indexed by
 * vertex: `positions` is `[x0,y0,z0, x1,y1,z1, ...]`, so `positions.length` is
 * `3 × vertexCount`. `normals` and `uvs` (when present) align to the same
 * vertex order. `skin` binds vertices to skeleton bones for deformation.
 *
 * Reference: glTF 2.0 mesh primitive attributes.
 *
 * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `IAutoMovieMesh` as the portable data boundary for the asset primitive freeform geometry requirement.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `IAutoMovieMesh` for the asset spec geometry inputs system contract.
 * @author Samchon
 */
export interface IAutoMovieMesh {
  /**
   * Flat vertex positions `[x,y,z,...]` in meters. Length is `3 × vertexCount`.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `positions` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `positions` for the asset spec geometry inputs system contract.
   */
  positions: number[];

  /**
   * Flat vertex normals `[x,y,z,...]`, aligned to `positions`. `null` if
   * absent.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `normals` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `normals` for the asset spec geometry inputs system contract.
   */
  normals: number[] | null;

  /**
   * Flat texture coordinates `[u,v,...]`, aligned to `positions`. `null` if
   * absent.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `uvs` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `uvs` for the asset spec geometry inputs system contract.
   */
  uvs: number[] | null;

  /**
   * Triangle indices into the vertex arrays (every 3 form one triangle). `null`
   * for a non-indexed mesh (vertices taken in order).
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `indices` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `indices` for the asset spec geometry inputs system contract.
   */
  indices: number[] | null;

  /**
   * Skeletal binding for deformation, or `null` for rigid/static geometry.
   *
   * @evidence requirements/asset-authoring/geometry.md#asset-primitive-freeform-geometry Exposes `skin` as the portable data boundary for the asset primitive freeform geometry requirement.
   * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-geometry-inputs Types `skin` for the asset spec geometry inputs system contract.
   */
  skin: IAutoMovieMeshSkin | null;
}

/**
 * Per-vertex skeletal binding: which bones influence each vertex and by how
 * much. Drives mesh deformation when the skeleton poses.
 *
 * Both arrays are grouped in fours per vertex (glTF's 4-influences-per-vertex
 * convention): vertex `i` is influenced by `bones[4i .. 4i+3]` with normalized
 * `weights[4i .. 4i+3]`.
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis Exposes `IAutoMovieMeshSkin` as the portable data boundary for the asset derived deformation basis requirement.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-derived-deformation-staleness Types `IAutoMovieMeshSkin` for the asset spec derived deformation staleness system contract.
 * @author Samchon
 */
export interface IAutoMovieMeshSkin {
  /**
   * The bones any vertex may be bound to (the skin's joint set).
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis Exposes `joints` as the portable data boundary for the asset derived deformation basis requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-derived-deformation-staleness Types `joints` for the asset spec derived deformation staleness system contract.
   */
  joints: AutoMovieHumanoidBone[];

  /**
   * Per-vertex bone indices into `joints`, grouped in fours.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis Exposes `boneIndices` as the portable data boundary for the asset derived deformation basis requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-derived-deformation-staleness Types `boneIndices` for the asset spec derived deformation staleness system contract.
   */
  boneIndices: number[];

  /**
   * Per-vertex influence weights in `[0,1]`, grouped in fours, summing to 1.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-derived-deformation-basis Exposes `weights` as the portable data boundary for the asset derived deformation basis requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-derived-deformation-staleness Types `weights` for the asset spec derived deformation staleness system contract.
   */
  weights: number[];
}

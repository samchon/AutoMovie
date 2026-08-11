import { IAutoMovieTransform } from "../geometry/IAutoMovieTransform";
import { AutoMovieNodeKind } from "./AutoMovieNodeKind";

/**
 * A node in the scene graph: the universal transformable element. Characters,
 * props, bones, cameras, and lights are all nodes; this is the spine the whole
 * core model hangs from (glTF node = USD prim).
 *
 * A node is a local TRS transform plus an optional payload referenced by id
 * (mirroring glTF's `node.mesh` / `node.camera` etc., so it round-trips). The
 * hierarchy is by `parent` reference; the engine derives children and walks
 * parent-before-child. **A group is simply a node with children**
 * ({@link AutoMovieNodeKind} `group`): its TRS moves the subtree, its local
 * frame is the rotation pivot, and a {@link IAutoMovieChannelLimit} on its
 * rotation is a group-level ROM; no separate grouping concept exists.
 *
 * Transform is parent-local TRS (never a matrix, so it stays animatable and
 * decomposed). Cross-node relationships (a sword following a hand) are
 * expressed as {@link IAutoMovieDriver}s, not multi-parenting, since the graph
 * is a strict tree on export.
 *
 * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `IAutoMovieNode` as the portable data boundary for the asset rig basis controls requirement.
 * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `IAutoMovieNode` for the asset spec rig inputs system contract.
 * @author Samchon
 */
export interface IAutoMovieNode {
  /**
   * Stable id; channels, drivers, skins, and scene structure cite the node by
   * this.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `id` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `id` for the asset spec rig inputs system contract.
   */
  id: string;

  /**
   * Human / LLM readable name. Null if unnamed.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `name` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `name` for the asset spec rig inputs system contract.
   */
  name: string | null;

  /**
   * Parent node id, or `null` for a root. Defines the space `transform` is in.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `parent` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `parent` for the asset spec rig inputs system contract.
   */
  parent: string | null;

  /**
   * What payload (if any) this node carries.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `kind` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `kind` for the asset spec rig inputs system contract.
   */
  kind: AutoMovieNodeKind;

  /**
   * Local TRS relative to `parent`.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `transform` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `transform` for the asset spec rig inputs system contract.
   */
  transform: IAutoMovieTransform;

  /**
   * Id of an attached mesh, or `null`.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `mesh` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `mesh` for the asset spec rig inputs system contract.
   */
  mesh: string | null;

  /**
   * Id of an attached camera, or `null`.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `camera` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `camera` for the asset spec rig inputs system contract.
   */
  camera: string | null;

  /**
   * Id of an attached light, or `null`.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `light` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `light` for the asset spec rig inputs system contract.
   */
  light: string | null;

  /**
   * Id of the skin that binds this mesh to a skeleton, or `null`.
   *
   * @evidence requirements/asset-authoring/rig-and-state.md#asset-rig-basis-controls Exposes `skin` as the portable data boundary for the asset rig basis controls requirement.
   * @evidence specifications/asset-and-representation/rig-deformation-and-state.md#asset-spec-rig-inputs Types `skin` for the asset spec rig inputs system contract.
   */
  skin: string | null;
}

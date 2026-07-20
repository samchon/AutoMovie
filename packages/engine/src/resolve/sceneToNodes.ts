import {
  IAutoMovieModel,
  IAutoMovieNode,
  IAutoMoviePropArticulation,
  IAutoMoviePropSpec,
  IAutoMovieScene,
} from "@automovie/interface";

import { lowerSkeletonNodes } from "./skeletonNodes";

/**
 * Lower the specialized {@link IAutoMovieScene} onto the general
 * {@link IAutoMovieNode} graph, slice S3 of the core wiring: the same scene the
 * film pipeline stages becomes the flat node list {@link composeScene} composes,
 * so scene placement, cameras, lights, and (when models are supplied) every
 * actor's bone hierarchy all live in ONE graph the general Clip path can
 * animate.
 *
 * **Structure, not state.** The bridge lowers the scene's REST structure: each
 * scene node becomes a `group` node at its world placement, each camera/light a
 * `camera`/`light` node carrying its id as the payload ref. What a node is
 * _doing_ (a running motion, a held pose) arrives as `composeScene`
 * overrides, exactly how the general pipeline animates everything else: bake
 * the motion (or a constant-pose motion) through `motionToClip` with
 * `nodePrefix: "<placementId>/"` and feed the clip to `resolveFrame` over these
 * nodes.
 *
 * **Naming.** A placed model's subtree is prefixed `${sceneNode.id}/` (root
 * `${id}/root`, bones `${id}/${bone}`), so two actors sharing bone names stay
 * distinct in the one graph, the same prefix the actor's clip channels must
 * carry ({@link motionToClip}'s `nodePrefix`). A placed prop's articulation
 * lowers the same way (`${id}/hinge`), and its profile binds with the same
 * prefix (`bindProfile`'s `nodePrefix`).
 *
 * **Guards.** When either registry is supplied, every placed `model` ref must
 * resolve in their union: a lossless bridge refuses silent drops; omit both
 * for a placements-only lowering (no subtrees). An id present in BOTH
 * registries throws: the registries contradict, and a forged prop already
 * carries its own model, so it never needs a `models` entry. A skeleton-less
 * model lowers no subtree; a rigid prop (`articulation: null`) lowers none
 * either. Duplicate node ids and dangling parents are rejected downstream by
 * `composeScene`'s index guard. This bridge does not duplicate that gate.
 *
 * @author Samchon
 */
export const sceneToNodes = (props: {
  /** The staged scene to lower. */
  scene: IAutoMovieScene;
  /** Placed models by model id; omit for a placements-only lowering. */
  models?: Record<string, IAutoMovieModel>;
  /**
   * Forged props by prop node id (= model id, the staging join `forgeProp`
   * gates). A placement resolving here lowers its articulation joints under the
   * placement group, the placement pass `IAutoMoviePropSpec` promises.
   */
  props?: Record<string, IAutoMoviePropSpec>;
}): IAutoMovieNode[] => {
  const { scene, models, props: propSpecs } = props;
  const nodes: IAutoMovieNode[] = [];

  for (const placement of scene.nodes) {
    nodes.push({
      id: placement.id,
      name: null,
      parent: null,
      kind: "group",
      transform: placement.transform,
      mesh: null,
      camera: null,
      light: null,
      skin: null,
    });
    if (models === undefined && propSpecs === undefined) continue;
    const spec = propSpecs?.[placement.model];
    const model = models?.[placement.model];
    if (spec !== undefined && model !== undefined)
      throw new Error(
        `sceneToNodes scene "${scene.id}" resolves model "${placement.model}" at node "${placement.id}" in BOTH the props and models registries: the registries contradict (a forged prop carries its own model)`,
      );
    if (spec !== undefined) {
      if (spec.articulation !== null)
        nodes.push(
          ...lowerArticulationNodes(
            spec.articulation,
            `${placement.id}/`,
            placement.id,
          ),
        );
      continue;
    }
    if (model === undefined)
      throw new Error(
        `sceneToNodes scene "${scene.id}" places model "${placement.model}" at node "${placement.id}" but the registry has no such model`,
      );
    if (model.skeleton === null) continue;
    nodes.push(
      ...lowerSkeletonNodes({
        skeleton: model.skeleton,
        prefix: `${placement.id}/`,
        rootParent: placement.id,
      }),
    );
  }

  for (const camera of scene.cameras)
    nodes.push({
      id: camera.id,
      name: null,
      parent: null,
      kind: "camera",
      transform: camera.transform,
      mesh: null,
      camera: camera.id,
      light: null,
      skin: null,
    });

  for (const light of scene.lights)
    nodes.push({
      id: light.id,
      name: null,
      parent: null,
      kind: "light",
      transform: light.transform,
      mesh: null,
      camera: null,
      light: light.id,
      skin: null,
    });

  return nodes;
};

/**
 * Lower a prop's articulation joints under its placement: ids and parent refs
 * take the placement prefix, a `null` parent seats directly under the placement
 * group (props declare their own root joint: no synthetic root is added,
 * unlike the skeleton lowering), and every other node field (kind, transform,
 * payload refs) carries verbatim (`forgeProp` already gated well-formedness).
 */
const lowerArticulationNodes = (
  articulation: IAutoMoviePropArticulation,
  prefix: string,
  rootParent: string,
): IAutoMovieNode[] =>
  articulation.nodes.map((node) => ({
    ...node,
    id: `${prefix}${node.id}`,
    parent: node.parent === null ? rootParent : `${prefix}${node.parent}`,
  }));

import {
  IAutoMovieModel,
  IAutoMovieNode,
  IAutoMovieScene,
} from "@automovie/interface";

import { lowerSkeletonNodes } from "./skeletonNodes";

/**
 * Lower the specialized {@link IAutoMovieScene} onto the general
 * {@link IAutoMovieNode} graph — slice S3 of the core wiring: the same scene the
 * film pipeline stages becomes the flat node list {@link composeScene} composes,
 * so scene placement, cameras, lights, and (when models are supplied) every
 * actor's bone hierarchy all live in ONE graph the general Clip path can
 * animate.
 *
 * **Structure, not state.** The bridge lowers the scene's REST structure: each
 * scene node becomes a `group` node at its world placement, each camera/light a
 * `camera`/`light` node carrying its id as the payload ref. What a node is
 * _doing_ — a running motion, a held pose — arrives as `composeScene`
 * overrides, exactly how the general pipeline animates everything else: bake
 * the motion (or a constant-pose motion) through `motionToClip` with
 * `nodePrefix: "<placementId>/"` and feed the clip to `resolveFrame` over these
 * nodes.
 *
 * **Naming.** A placed model's subtree is prefixed `${sceneNode.id}/` (root
 * `${id}/root`, bones `${id}/${bone}`), so two actors sharing bone names stay
 * distinct in the one graph — the same prefix the actor's clip channels must
 * carry ({@link motionToClip}'s `nodePrefix`).
 *
 * **Guards.** When the `models` registry is supplied, every placed `model` ref
 * must resolve — a lossless bridge refuses silent drops; omit the registry for
 * a placements-only lowering (no bone subtrees). A skeleton-less model (a prop)
 * lowers no subtree either way. Duplicate node ids and dangling parents are
 * rejected downstream by `composeScene`'s index guard — this bridge does not
 * duplicate that gate.
 *
 * @author Samchon
 */
export const sceneToNodes = (props: {
  /** The staged scene to lower. */
  scene: IAutoMovieScene;
  /** Placed models by model id; omit for a placements-only lowering. */
  models?: Record<string, IAutoMovieModel>;
}): IAutoMovieNode[] => {
  const { scene, models } = props;
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
    if (models === undefined) continue;
    const model = models[placement.model];
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

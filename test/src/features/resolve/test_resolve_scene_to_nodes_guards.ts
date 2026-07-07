import {
  composeScene,
  lowerSkeletonNodes,
  sceneToNodes,
} from "@automovie/engine";
import { IAutoMovieScene } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const scene = (nodeId: string, modelRef: string): IAutoMovieScene => ({
  id: "scene-g",
  name: null,
  nodes: [
    {
      id: nodeId,
      model: modelRef,
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      motion: null,
      pose: null,
    },
  ],
  cameras: [],
  lights: [],
});

/**
 * `sceneToNodes` is a lossless bridge: with a model registry supplied every
 * placed ref must resolve; without one it lowers placements only. Duplicate
 * node ids are rejected downstream by `composeScene`'s index guard — the bridge
 * does not duplicate that gate, so the downstream contract is pinned here.
 *
 * Scenarios:
 *
 * 1. Registry omitted → placements-only lowering: no bone subtree, no throw.
 * 2. Registry supplied and the ref resolves → the subtree lowers (the positive
 *    twin of the throw).
 * 3. Registry supplied but the placed model is missing → throws naming the scene,
 *    model, and node.
 * 4. A crafted id collision (a placement literally named like a lowered bone node)
 *    passes the bridge and is rejected by `composeScene` downstream — the
 *    documented division of guard labor.
 * 5. `lowerSkeletonNodes` defaults: no prefix → the bare S1 names, no `rootParent`
 *    → the synthetic root is a graph root (the twin of the bridge paths, which
 *    always pass both).
 */
export const test_resolve_scene_to_nodes_guards = (): void => {
  const model = { ...createModel(), id: "hero" };

  const bare = sceneToNodes({ scene: scene("actor", "hero") });
  TestValidator.equals(
    "registry omitted lowers placements only",
    bare.length,
    1,
  );

  const lowered = sceneToNodes({
    scene: scene("actor", "hero"),
    models: { hero: model },
  });
  TestValidator.predicate(
    "resolving ref lowers the subtree",
    lowered.some((node) => node.id === "actor/hips"),
  );

  TestValidator.predicate(
    "missing model ref throws",
    throwsError(
      () =>
        sceneToNodes({
          scene: scene("actor", "ghost"),
          models: { hero: model },
        }),
      ["ghost", "actor", "scene-g"],
    ),
  );

  // A placement literally named like the actor's lowered hip bone node.
  const colliding: IAutoMovieScene = {
    ...scene("actor", "hero"),
    nodes: [
      ...scene("actor", "hero").nodes,
      ...scene("actor/hips", "hero").nodes,
    ],
  };
  const nodes = sceneToNodes({ scene: colliding, models: { hero: model } });
  TestValidator.predicate(
    "id collisions are rejected downstream by composeScene",
    throwsError(() => composeScene(nodes), ["duplicated"]),
  );

  const defaults = lowerSkeletonNodes({ skeleton: model.skeleton! });
  TestValidator.predicate(
    "lowerSkeletonNodes defaults to bare names and a graph root",
    defaults.some((node) => node.id === "root" && node.parent === null) &&
      defaults.some((node) => node.id === "hips"),
  );
};

import { sceneToNodes } from "@automovie/engine";
import { IAutoMovieScene } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createDoorPropSpec } from "../film/test_film_forge_prop";
import { vclose } from "../internal/predicates";

const placedScene = (): IAutoMovieScene => ({
  id: "scene-p",
  name: null,
  nodes: [
    {
      id: "frontDoor",
      model: "door",
      transform: {
        translation: { x: 5, y: 0, z: 2 },
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
 * A placed prop's articulation lowers under its placement group exactly the way
 * a skeleton does — prefixed ids and parents, a `null` parent seating directly
 * under the placement (props declare their own root joint; no synthetic root is
 * added), every other node field verbatim. A rigid prop lowers nothing extra.
 *
 * Scenarios:
 *
 * 1. The forged door's three joints lower as `frontDoor/root` (parent
 *    `frontDoor`), `frontDoor/hinge` and `frontDoor/handleMirror` (parents
 *    `frontDoor/root`).
 * 2. Transforms carry verbatim — the hinge keeps its authored `(0, 1, 0)` local
 *    translation — and the node kind carries too.
 * 3. A rigid prop (`articulation: null`) lowers only its placement group — the
 *    negative twin of the subtree.
 */
export const test_resolve_scene_prop_lowering = (): void => {
  const base = createDoorPropSpec();
  // Give the hinge a distinctive local translation so "verbatim" is provable
  // (the fixture's joints are all identity, which any zeroing bug would mimic).
  const spec = {
    ...base,
    articulation: {
      ...base.articulation!,
      nodes: base.articulation!.nodes.map((node) =>
        node.id === "hinge"
          ? {
              ...node,
              transform: {
                ...node.transform,
                translation: { x: 0, y: 1, z: 0 },
              },
            }
          : node,
      ),
    },
  };
  const nodes = sceneToNodes({
    scene: placedScene(),
    props: { door: spec },
  });

  const byId = new Map(nodes.map((node) => [node.id, node]));
  TestValidator.equals(
    "prop root seats under the placement group",
    byId.get("frontDoor/root")?.parent,
    "frontDoor",
  );
  TestValidator.equals(
    "hinge parent takes the prefix",
    byId.get("frontDoor/hinge")?.parent,
    "frontDoor/root",
  );
  TestValidator.equals(
    "mirror parent takes the prefix",
    byId.get("frontDoor/handleMirror")?.parent,
    "frontDoor/root",
  );

  TestValidator.predicate(
    "the hinge transform carries verbatim",
    vclose(byId.get("frontDoor/hinge")!.transform.translation, {
      x: 0,
      y: 1,
      z: 0,
    }),
  );
  TestValidator.equals(
    "the node kind carries verbatim",
    byId.get("frontDoor/hinge")?.kind,
    "group",
  );

  const rigid = sceneToNodes({
    scene: placedScene(),
    props: { door: { ...spec, articulation: null } },
  });
  TestValidator.equals(
    "a rigid prop lowers only its placement group",
    rigid.length,
    1,
  );
};

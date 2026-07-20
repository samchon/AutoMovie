import { sceneToNodes } from "@automovie/engine";
import { IAutoMovieScene } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createDoorPropSpec } from "../film/test_film_forge_prop";
import { createModel } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

const scene = (
  placements: ReadonlyArray<readonly [string, string]>,
): IAutoMovieScene => ({
  id: "scene-pg",
  name: null,
  nodes: placements.map(([id, model]) => ({
    id,
    model,
    transform: {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    motion: null,
    pose: null,
  })),
  cameras: [],
  lights: [],
});

/**
 * The lossless-bridge rules over the two registries: when either is supplied
 * every placement must resolve in their union, an id present in BOTH registries
 * is a contradiction (a forged prop carries its own model), and mixed scenes
 * resolve each placement through its own registry.
 *
 * Scenarios:
 *
 * 1. A mixed scene resolves: the door through `props`, the actor through `models`
 *    and both subtrees lower into one graph (the positive twin).
 * 2. An id in both registries throws naming the contradiction.
 * 3. With only `props` supplied, a placement missing from the union throws: the
 *    union rule, not a silent partial lowering.
 * 4. Both registries omitted → placements-only lowering, no throw (the legacy
 *    twin).
 */
export const test_resolve_scene_prop_guards = (): void => {
  const door = createDoorPropSpec();
  const hero = { ...createModel(), id: "hero" };

  const mixed = sceneToNodes({
    scene: scene([
      ["frontDoor", "door"],
      ["knight", "hero"],
    ]),
    props: { door },
    models: { hero },
  });
  TestValidator.predicate(
    "a mixed scene lowers both subtrees into one graph",
    mixed.some((node) => node.id === "frontDoor/hinge") &&
      mixed.some((node) => node.id === "knight/hips"),
  );

  TestValidator.predicate(
    "an id in both registries throws the contradiction",
    throwsError(
      () =>
        sceneToNodes({
          scene: scene([["frontDoor", "door"]]),
          props: { door },
          models: { door: { ...createModel(null), id: "door" } },
        }),
      ["BOTH", "door", "frontDoor"],
    ),
  );

  TestValidator.predicate(
    "a placement outside the union throws",
    throwsError(
      () =>
        sceneToNodes({
          scene: scene([
            ["frontDoor", "door"],
            ["knight", "hero"],
          ]),
          props: { door },
        }),
      ["hero", "knight", "scene-pg"],
    ),
  );

  TestValidator.equals(
    "both registries omitted lowers placements only",
    sceneToNodes({ scene: scene([["frontDoor", "door"]]) }).length,
    1,
  );
};

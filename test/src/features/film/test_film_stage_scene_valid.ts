import { Quaternion, Vector3, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { vclose } from "../internal/predicates";

/**
 * Pins the happy path of the STAGING consumer: a coherent script + staging pair
 * composes an {@link IAutoMovieScene} whose geometry is the placements' — facing
 * degrees become Y rotations, cameras aim their −Z at the resolved target,
 * lights are realised as directional, and mount couplings surface as validated
 * `mounts` rather than scene-graph edges.
 *
 * Scenarios:
 *
 * 1. Two placed knights → success with two nodes; `knightA` keeps its cast
 *    `modelRef` ("stickman"), `knightB` (null ref) falls back to its node id.
 * 2. `facingDeg` 0 leaves +Z forward (identity rotation); 180 turns the node to
 *    face −Z — checked by rotating +Z through each node's rotation.
 * 3. A node-target camera's −Z axis points from its position at `knightA`'s
 *    position; a point-target camera aims at the literal point (both `lookAt`
 *    kinds exercised in one staging).
 * 4. The sun light is directional with its −Z rotated onto the declared direction,
 *    and `knightB`'s `attach` becomes `mounts[0]` (parent `knightA`, bone
 *    `chest`).
 */
export const test_film_stage_scene_valid = (): void => {
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      actors: [
        { node: "knightA", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
        {
          node: "knightB",
          position: { x: 0, y: 0, z: 0.7 },
          facingDeg: 180,
          attach: { parent: "knightA", bone: "chest" },
        },
      ],
      cameras: [
        {
          node: "cam-main",
          position: { x: 2, y: 1.5, z: 0.35 },
          lookAt: { kind: "node", node: "knightA" },
          fovDeg: 40,
        },
        {
          node: "cam-wide",
          position: { x: 0, y: 2, z: -3 },
          lookAt: { kind: "point", point: { x: 0, y: 1, z: 0 } },
          fovDeg: 60,
        },
      ],
    }),
  );
  TestValidator.equals("success", staged.success, true);
  if (staged.success !== true) return;

  TestValidator.equals("scene id", staged.scene.id, "scene-duel");
  TestValidator.equals(
    "node ids",
    staged.scene.nodes.map((n) => n.id),
    ["knightA", "knightB"],
  );
  TestValidator.equals(
    "modelRef kept",
    staged.scene.nodes[0]!.model,
    "stickman",
  );
  TestValidator.equals(
    "stand-in falls back to node id",
    staged.scene.nodes[1]!.model,
    "knightB",
  );

  const forwardOf = (rotation: {
    x: number;
    y: number;
    z: number;
    w: number;
  }) => Quaternion.rotateVector(rotation, { x: 0, y: 0, z: 1 });
  TestValidator.predicate(
    "facing 0° keeps +Z",
    vclose(forwardOf(staged.scene.nodes[0]!.transform.rotation), {
      x: 0,
      y: 0,
      z: 1,
    }),
  );
  TestValidator.predicate(
    "facing 180° turns to −Z",
    vclose(forwardOf(staged.scene.nodes[1]!.transform.rotation), {
      x: 0,
      y: 0,
      z: -1,
    }),
  );

  const aimOf = (camera: (typeof staged.scene.cameras)[number]) =>
    Quaternion.rotateVector(camera.transform.rotation, {
      x: 0,
      y: 0,
      z: -1,
    });
  TestValidator.predicate(
    "node-target camera aims at knightA",
    vclose(
      aimOf(staged.scene.cameras[0]!),
      Vector3.normalize({ x: -2, y: -1.5, z: -0.35 }),
    ),
  );
  TestValidator.predicate(
    "point-target camera aims at the point",
    vclose(
      aimOf(staged.scene.cameras[1]!),
      Vector3.normalize({ x: 0, y: -1, z: 3 }),
    ),
  );

  TestValidator.equals(
    "light kind",
    staged.scene.lights[0]!.type,
    "directional",
  );
  TestValidator.predicate(
    "sun −Z shines down the declared direction",
    vclose(
      Quaternion.rotateVector(staged.scene.lights[0]!.transform.rotation, {
        x: 0,
        y: 0,
        z: -1,
      }),
      Vector3.normalize({ x: -1, y: -1, z: 0 }),
    ),
  );

  TestValidator.equals("mounts", staged.mounts, [
    { node: "knightB", binding: { parent: "knightA", bone: "chest" } },
  ]);
};

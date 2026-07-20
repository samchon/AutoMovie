import { Quaternion, Vector3, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, vclose } from "../internal/predicates";

/**
 * Set pieces (#1173): staging may drop environment geometry (a floor slab, a
 * wall) as static scene nodes realising skeleton-less models, so the guide
 * passes describe a world instead of actors floating in a void.
 *
 * Scenarios:
 *
 * 1. A floor (no `facingDeg`) and a turned wall stage as scene nodes after the
 *    cast: model ids kept verbatim, the floor unrotated (identity), the wall's
 *    yaw encoded exactly like an actor's facing, motion/pose null.
 * 2. A camera may `lookAt` a set piece: its −Z aims at the piece's position.
 * 3. The gates: a set node colliding with a cast id, a blank node id, a blank
 *    model id, a non-finite position, and a non-finite `facingDeg` are all
 *    refused in one round at their `$input.set[i]` paths; an omitted
 *    `facingDeg` is NOT a violation.
 */
export const test_film_stage_scene_set = (): void => {
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      set: [
        { node: "floor", model: "slab", position: { x: 0, y: 0, z: 0 } },
        {
          node: "wall-east",
          model: "wall",
          position: { x: 3, y: 0, z: 0 },
          facingDeg: 90,
        },
      ],
      cameras: [
        {
          node: "cam-main",
          position: { x: 2, y: 1.5, z: 3 },
          lookAt: { kind: "node", node: "wall-east" },
          fovDeg: 40,
        },
      ],
    }),
  );
  TestValidator.equals("staging with set succeeds", staged.success, true);
  if (staged.success !== true) return;

  TestValidator.equals(
    "set nodes follow the cast in the scene",
    staged.scene.nodes.map((n) => n.id),
    ["knightA", "knightB", "floor", "wall-east"],
  );
  const floor = staged.scene.nodes[2]!;
  const wall = staged.scene.nodes[3]!;
  TestValidator.equals("set model ids are kept verbatim", floor.model, "slab");
  TestValidator.equals(
    "an omitted facingDeg stages unrotated",
    floor.transform.rotation,
    { x: 0, y: 0, z: 0, w: 1 },
  );
  TestValidator.predicate(
    "a set piece is static scenery",
    floor.motion === null && floor.pose === null,
  );
  // facingDeg 90 turns +Z onto +X: the same encoding actors use.
  TestValidator.predicate(
    "the wall's yaw is encoded like an actor's facing",
    vclose(
      Quaternion.rotateVector(wall.transform.rotation, { x: 0, y: 0, z: 1 }),
      { x: 1, y: 0, z: 0 },
    ),
  );

  // 2. the camera aims its −Z from its position at the piece.
  const camera = staged.scene.cameras[0]!;
  const minusZ = Quaternion.rotateVector(camera.transform.rotation, {
    x: 0,
    y: 0,
    z: -1,
  });
  const toWall = Vector3.normalize(
    Vector3.subtract(wall.transform.translation, camera.transform.translation),
  );
  TestValidator.predicate(
    "a camera may frame a set piece",
    vclose(minusZ, toWall),
  );

  // 3. the gates, all in one refused round.
  const refused = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      set: [
        { node: "knightA", model: "slab", position: { x: 0, y: 0, z: 0 } },
        { node: " ", model: "slab", position: { x: 0, y: 0, z: 0 } },
        { node: "wall", model: " ", position: { x: 0, y: 0, z: 0 } },
        {
          node: "pit",
          model: "hole",
          position: { x: Number.NaN, y: 0, z: 0 },
        },
        {
          node: "gate",
          model: "arch",
          position: { x: 0, y: 0, z: 0 },
          facingDeg: Number.POSITIVE_INFINITY,
        },
      ],
    }),
  );
  TestValidator.predicate(
    "every malformed piece is refused at its own path in one round",
    refused.success === false &&
      hasViolation(refused, "type", "$input.set[0].node") &&
      hasViolation(refused, "type", "$input.set[1].node") &&
      hasViolation(refused, "type", "$input.set[2].model") &&
      hasViolation(refused, "range", "$input.set[3].position") &&
      hasViolation(refused, "range", "$input.set[4].facingDeg"),
  );
};

import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins the camera gates: a field of view must sit strictly inside (0, 180)° and
 * a node-target must track a placed actor — a camera aimed at nobody frames
 * nothing.
 *
 * Scenarios:
 *
 * 1. `fovDeg = 180` (the exclusive boundary itself) → a `range` violation on
 *    `$input.cameras[0].fovDeg`.
 * 2. A second camera looks at the unplaced node `nobody` → a `type` violation on
 *    `$input.cameras[1].lookAt.node`.
 * 3. A third camera looks at its own position, yielding `range` on
 *    `$input.cameras[2].lookAt`.
 */
export const test_film_stage_scene_camera_invalid = (): void => {
  const base = makeStagingWrite();
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      cameras: [
        { ...base.cameras[0]!, fovDeg: 180 },
        {
          node: "cam-lost",
          position: { x: 0, y: 1, z: -2 },
          lookAt: { kind: "node", node: "nobody" },
          fovDeg: 50,
        },
        {
          node: "cam-zero",
          position: { x: 1, y: 2, z: 3 },
          lookAt: { kind: "point", point: { x: 1, y: 2, z: 3 } },
          fovDeg: 50,
        },
      ],
    }),
  );
  TestValidator.equals("fails", staged.success, false);
  TestValidator.predicate(
    "fov boundary rejected",
    staged.success === false &&
      hasViolation(staged, "range", "$input.cameras[0].fovDeg"),
  );
  TestValidator.predicate(
    "dangling look-at rejected",
    staged.success === false &&
      hasViolation(staged, "type", "$input.cameras[1].lookAt.node"),
  );
  TestValidator.predicate(
    "zero look vector rejected",
    staged.success === false &&
      hasViolation(staged, "range", "$input.cameras[2].lookAt"),
  );
};

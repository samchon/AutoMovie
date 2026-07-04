import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins mount-coupling integrity: a rider must ride a _different, placed_ actor
 * ??self-mounts and dangling parents are both contradictions staging must hear
 * about before any shot is performed.
 *
 * Scenarios:
 *
 * 1. `knightA` declares `attach.parent = "knightA"` ??a `type` violation on
 *    `$input.actors[0].attach.parent` (a node cannot ride itself).
 * 2. `knightB` declares `attach.parent = "horse"` which nobody placed ??a `type`
 *    violation on `$input.actors[1].attach.parent` carrying "horse".
 */
export const test_film_stage_scene_mount_invalid = (): void => {
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      actors: [
        {
          node: "knightA",
          position: { x: 0, y: 0, z: 0 },
          facingDeg: 0,
          attach: { parent: "knightA", bone: "chest" },
        },
        {
          node: "knightB",
          position: { x: 0, y: 0, z: 0.7 },
          facingDeg: 180,
          attach: { parent: "horse", bone: "hips" },
        },
      ],
    }),
  );
  TestValidator.equals("fails", staged.success, false);
  TestValidator.predicate(
    "self-mount rejected",
    staged.success === false &&
      hasViolation(staged, "type", "$input.actors[0].attach.parent"),
  );
  TestValidator.predicate(
    "dangling parent rejected",
    staged.success === false &&
      hasViolation(staged, "type", "$input.actors[1].attach.parent") &&
      staged.violations.some((v) => v.value === "horse"),
  );
};

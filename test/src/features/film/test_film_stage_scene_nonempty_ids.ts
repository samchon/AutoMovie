import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Staging creates the scene artifact and its scene-wide entity ids. Blank ids
 * can avoid duplicate checks when the blank strings differ, but still cannot be
 * used as stable scene, node, camera, or light references.
 *
 * Scenario: a staging payload with blank scene/actor/camera/light ids fails at
 * each id field's own path.
 */
export const test_film_stage_scene_nonempty_ids = (): void => {
  const base = makeStagingWrite();
  const staged = stageScene(
    makeScriptWrite({
      cast: [
        { node: " ", character: "the unnamed challenger", modelRef: null },
        { node: "knightB", character: "the champion", modelRef: null },
      ],
    }),
    makeStagingWrite({
      scene: { ...base.scene, id: "" },
      actors: [
        { ...base.actors[0]!, node: " " },
        { ...base.actors[1]!, node: "knightB" },
      ],
      cameras: [
        {
          ...base.cameras[0]!,
          node: "\t",
          lookAt: { kind: "node", node: "knightB" },
        },
      ],
      lights: [{ ...base.lights[0]!, node: "\n" }],
    }),
  );

  TestValidator.equals("blank staging ids fail", staged.success, false);
  TestValidator.predicate(
    "scene id violation",
    staged.success === false && hasViolation(staged, "type", "$input.scene.id"),
  );
  TestValidator.predicate(
    "actor node violation",
    staged.success === false &&
      hasViolation(staged, "type", "$input.actors[0].node"),
  );
  TestValidator.predicate(
    "camera node violation",
    staged.success === false &&
      hasViolation(staged, "type", "$input.cameras[0].node"),
  );
  TestValidator.predicate(
    "light node violation",
    staged.success === false &&
      hasViolation(staged, "type", "$input.lights[0].node"),
  );
};

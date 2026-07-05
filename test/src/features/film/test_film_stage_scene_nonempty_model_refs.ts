import { stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Staging joins cast members to imported or generated models through `modelRef
 * ?? node`. A blank non-null `modelRef` skips the stand-in fallback and would
 * produce a scene node whose model key cannot be resolved.
 *
 * Scenario: a whitespace-only cast model reference fails before scene
 * composition.
 */
export const test_film_stage_scene_nonempty_model_refs = (): void => {
  const base = makeScriptWrite();
  const staged = stageScene(
    makeScriptWrite({
      cast: [
        { ...base.cast[0]!, modelRef: " " },
        { ...base.cast[1]!, modelRef: null },
      ],
    }),
    makeStagingWrite(),
  );

  TestValidator.equals("blank cast modelRef fails", staged.success, false);
  TestValidator.predicate(
    "modelRef violation",
    staged.success === false &&
      hasViolation(staged, "type", "$script.cast[0].modelRef"),
  );
};

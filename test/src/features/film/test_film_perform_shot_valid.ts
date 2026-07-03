import { performShot, stageScene } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";

/**
 * Pins the happy path of the PERFORMANCE consumer: a coherent action list
 * compiles into one clip per actor, the `frame` action picks the live camera,
 * and every clip passes ROM validation against its actor's rig.
 *
 * Scenarios:
 *
 * 1. The duel performance (unison locomote for both knights + a strike + one
 *    `frame` on `cam-main`, `final: null` so the draft performs) → success; the
 *    shot is `shot:beat-1`, named after the beat, on the staged scene, with
 *    `cam-main` live and a locked-off (`null`) camera motion.
 * 2. Both knights get a performance entry whose `motion` id matches the compiled
 *    clip in `motions`, each starting at offset 0.
 */
export const test_film_perform_shot_valid = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const performed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite(),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("success", performed.success, true);
  if (performed.success !== true) return;

  TestValidator.equals("shot id", performed.shot.id, "shot:beat-1");
  TestValidator.equals("shot name", performed.shot.name, "the charge");
  TestValidator.equals("shot scene", performed.shot.scene, "scene-duel");
  TestValidator.equals("live camera", performed.shot.camera, "cam-main");
  TestValidator.equals("locked-off camera", performed.shot.cameraMotion, null);
  TestValidator.equals("shot duration", performed.shot.duration, 2);

  TestValidator.equals(
    "one performance per knight",
    performed.shot.performances
      .map((p) => p.node)
      .sort((a, b) => a.localeCompare(b)),
    ["knightA", "knightB"],
  );
  for (const p of performed.shot.performances) {
    TestValidator.equals(
      `motion id of ${p.node}`,
      p.motion,
      performed.motions[p.node]!.id,
    );
    TestValidator.equals(`start offset of ${p.node}`, p.startOffset, 0);
  }
};

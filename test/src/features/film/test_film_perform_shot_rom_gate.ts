import { performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";

/**
 * Pins the ROM gate on the far side of the compile: even a referentially
 * perfect action list fails when the synthesised clip bends a joint past its
 * anatomical range — and the violation's path is remapped from `$input` onto
 * `$compiled["<node>"]` so the blame lands on the offending actor's clip, not
 * the LLM's own JSON.
 *
 * Scenarios:
 *
 * 1. The synthesizer returns an elbow clip peaking at 200° flexion (max 150°) →
 *    failure with a `rom` violation whose path starts with
 *    `$compiled["knightA"]` and carries a positive overshoot.
 */
export const test_film_perform_shot_rom_gate = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const performed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: () =>
      makeMotion(
        [
          keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
          keyframe(1, makePose([joint("leftLowerArm", { flexion: 200 })])),
        ],
        1,
      ),
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("fails", performed.success, false);
  TestValidator.predicate(
    "rom violation remapped onto the compiled clip",
    performed.success === false &&
      performed.violations.some(
        (v) =>
          v.kind === "rom" &&
          v.path.startsWith('$compiled["knightA"]') &&
          (v.overshoot ?? 0) > 0,
      ),
  );
};

import { performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Pins the live-camera fallback: a shot with no `frame` call defaults to the
 * scene's first camera (staging already aimed it), and a scene with no cameras
 * at all cannot be framed.
 *
 * Scenarios:
 *
 * 1. The performance has no `frame` action but staging rigged `cam-main` → success
 *    with `cam-main` live.
 * 2. Same performance against a staging with zero cameras → a `type` violation on
 *    `$input` (nothing can frame the take).
 */
export const test_film_perform_shot_camera_fallback = (): void => {
  const performance = makePerformanceWrite({
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
  });

  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");
  const performed = performShot({
    script: makeScriptWrite(),
    staged,
    performance,
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("falls back", performed.success, true);
  if (performed.success === true) {
    TestValidator.equals(
      "first scene camera live",
      performed.shot.camera,
      "cam-main",
    );
    TestValidator.equals(
      "no frame action, locked-off camera",
      performed.shot.cameraMotion,
      null,
    );
  }

  const bare = stageScene(makeScriptWrite(), makeStagingWrite({ cameras: [] }));
  if (bare.success !== true) throw new Error("bare staging must succeed");
  const unframed = performShot({
    script: makeScriptWrite(),
    staged: bare,
    performance,
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("no camera fails", unframed.success, false);
  TestValidator.predicate(
    "unframeable take reported",
    unframed.success === false && hasViolation(unframed, "type", "$input"),
  );
};

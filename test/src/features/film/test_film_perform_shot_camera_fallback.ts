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
 * 3. The id this fallback picks becomes `shot.camera`, which the artifact contract
 *    requires to be non-empty. The other two routes to that field are already
 *    checked (a `frame` action through its actor, a coverage intent through its
 *    own id), so an unchecked fallback was the one way to assemble a shot the
 *    validator refuses (#1318). An empty first-camera id is refused, and the
 *    counter-case one property away, an empty id on a camera the fallback does
 *    NOT pick, still performs: the check follows the camera actually chosen
 *    rather than scanning the list.
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

  // 3. the fallback's id is the shot's camera, so it carries the same
  //    non-empty contract every other route to that field already carries.
  //    stageScene refuses an empty node id, so this is the shape only an
  //    EXPLICIT staged set can present.
  const withCameraIds = (...ids: string[]): typeof staged => ({
    ...staged,
    scene: {
      ...staged.scene,
      cameras: ids.map((id) => ({ ...staged.scene.cameras[0]!, id })),
    },
  });
  const emptyFirst = performShot({
    script: makeScriptWrite(),
    staged: withCameraIds("", "cam-alt"),
    performance,
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "an empty fallback camera id is refused",
    emptyFirst.success === false &&
      hasViolation(emptyFirst, "type", "$staged.scene.cameras[0].id"),
  );
  TestValidator.equals(
    "an empty id the fallback does not pick still performs",
    performShot({
      script: makeScriptWrite(),
      staged: withCameraIds("cam-main", ""),
      performance,
      synthesize: validSynthesizer,
      skeleton: () => createSkeleton(),
    }).success,
    true,
  );

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

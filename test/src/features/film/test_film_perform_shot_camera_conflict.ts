import { performShot, stageScene } from "@autofilm/engine";
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
 * Pins the one-live-camera rule: `frame` must name a staged camera, and a
 * second camera fighting over the take is a contradiction, not a cut (cuts live
 * in the ASSEMBLE stage, between shots).
 *
 * Scenarios:
 *
 * 1. A `frame` action performed by `knightA` (an actor, not a camera) → `type` on
 *    `$input.draft[0].actor`.
 * 2. Two `frame` actions on different cameras (`cam-main`, then `cam-b`) → `type`
 *    on the second's actor, naming the camera already live.
 */
export const test_film_perform_shot_camera_conflict = (): void => {
  const base = makeStagingWrite();
  const staged = stageScene(
    makeScriptWrite(),
    makeStagingWrite({
      cameras: [
        ...base.cameras,
        {
          node: "cam-b",
          position: { x: -2, y: 1.5, z: 0.35 },
          lookAt: { kind: "node", node: "knightB" },
          fovDeg: 40,
        },
      ],
    }),
  );
  if (staged.success !== true) throw new Error("staging must succeed");

  const frame = (actor: string, start: number) =>
    ({
      verb: "frame",
      actor,
      start,
      duration: "auto",
      framing: "medium",
      move: "static",
      on: { kind: "node", node: "knightA" },
    }) as const;

  const performed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame("knightA", 0), frame("cam-main", 0), frame("cam-b", 1)],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("fails", performed.success, false);
  TestValidator.predicate(
    "non-camera frame actor rejected",
    performed.success === false &&
      hasViolation(performed, "type", "$input.draft[0].actor"),
  );
  TestValidator.predicate(
    "second live camera rejected",
    performed.success === false &&
      hasViolation(performed, "type", "$input.draft[2].actor") &&
      performed.violations.some((v) => v.value === "cam-b"),
  );
};

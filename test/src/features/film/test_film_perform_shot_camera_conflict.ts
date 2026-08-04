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
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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
 * 3. A `frame` action with an actor list: `type` on its `actor`, because a frame
 *    move has exactly one live camera.
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
  TestValidator.equals(
    "second live camera rejected",
    namedFacts([
      ["performedSuccess", () => performed.success === false],
      [
        "hasViolationPerformed",
        () => hasViolation(performed, "type", "$input.draft[2].actor"),
      ],
      [
        "performedViolations",
        () => performed.violations.some((v) => v.value === "cam-b"),
      ],
    ]),
    {
      performedSuccess: true,
      hasViolationPerformed: true,
      performedViolations: true,
    },
  );

  const listed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          ...frame("cam-main", 0),
          actor: ["cam-main", "cam-b"],
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "frame actor list rejected",
    listed.success === false &&
      hasViolation(listed, "type", "$input.draft[0].actor"),
  );
};

import { performShot, stageScene } from "@automovie/engine";
import { IAutoMovieCameraAction } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const frame = (
  overrides: Partial<IAutoMovieCameraAction>,
): IAutoMovieCameraAction => ({
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
  ...overrides,
});

/**
 * Pins the frame-authoring gates that camera compilation added to the
 * PERFORMANCE consumer: a frame subject must be a positional target, and two
 * moves cannot double-book the one live camera.
 *
 * Scenarios:
 *
 * 1. A frame aimed at `{kind: "direction"}` (a heading, not a point) → a `type`
 *    violation on `$input.draft[0].on`.
 * 2. A 1.5-second move starting at 0 followed by another starting at 1.0 on the
 *    same camera → a `range` violation on the second's `start` (the first still
 *    owns the camera until 1.5 s).
 * 3. Two auto frame moves at the same start fail instead of letting camera
 *    compilation overwrite one intent.
 * 4. An unknown frame `framing` returns a `type` violation instead of leaking
 *    `compileCameraMove`'s throw.
 * 5. An unknown frame `move` returns a `type` violation instead of leaking
 *    `compileCameraMove`'s throw.
 * 6. Malformed frame actor/target shapes return path-bearing `type` violations
 *    instead of raw property access failures.
 */
export const test_film_perform_shot_frame_gates = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const directed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame({ on: { kind: "direction", headingDeg: 90 } })],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("directional subject fails", directed.success, false);
  TestValidator.predicate(
    "non-positional frame subject rejected",
    directed.success === false &&
      hasViolation(directed, "type", "$input.draft[0].on"),
  );

  const doubled = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        frame({ start: 0, duration: 1.5 }),
        frame({ start: 1.0, move: "push-in" }),
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("overlapping moves fail", doubled.success, false);
  TestValidator.predicate(
    "double-booked camera rejected",
    doubled.success === false &&
      hasViolation(doubled, "range", "$input.draft[1].start"),
  );

  const sameStart = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame({ start: 0 }), frame({ start: 0, move: "push-in" })],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("same-start frame moves fail", sameStart.success, false);
  TestValidator.predicate(
    "same-start camera moves rejected",
    sameStart.success === false &&
      hasViolation(sameStart, "range", "$input.draft[1].start"),
  );

  const invalidFraming = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame({ framing: "macro" as never })],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "invalid framing fails as data",
    invalidFraming.success,
    false,
  );
  TestValidator.predicate(
    "unknown frame framing rejected",
    invalidFraming.success === false &&
      hasViolation(invalidFraming, "type", "$input.draft[0].framing"),
  );

  const invalidMove = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame({ move: "crash-zoom" as never })],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "invalid move fails as data",
    invalidMove.success,
    false,
  );
  TestValidator.predicate(
    "unknown frame move rejected",
    invalidMove.success === false &&
      hasViolation(invalidMove, "type", "$input.draft[0].move"),
  );

  const malformedActor = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame({ actor: null as never })],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "malformed frame actor rejected",
    malformedActor.success === false &&
      hasViolation(malformedActor, "type", "$input.draft[0].actor"),
  );

  const missingTarget = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame({ on: undefined as never })],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "missing frame target rejected",
    missingTarget.success === false &&
      hasViolation(missingTarget, "type", "$input.draft[0].on"),
  );

  const malformedGroup = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        frame({
          on: { kind: "group", nodes: "knightA" } as never,
        }),
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "malformed group target rejected",
    malformedGroup.success === false &&
      hasViolation(malformedGroup, "type", "$input.draft[0].on.nodes"),
  );

  const malformedKind = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [frame({ on: { kind: null } as never })],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.predicate(
    "malformed target kind rejected",
    malformedKind.success === false &&
      hasViolation(malformedKind, "type", "$input.draft[0].on"),
  );
};

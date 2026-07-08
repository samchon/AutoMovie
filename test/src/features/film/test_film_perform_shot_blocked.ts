import { performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const run = (
  blocking: ReturnType<typeof makeBlockingWrite>,
  performance = makePerformanceWrite(),
) =>
  performShot({
    script: makeScriptWrite(),
    staged: (() => {
      const staged = stageScene(makeScriptWrite(), makeStagingWrite());
      if (staged.success !== true) throw new Error("staging must succeed");
      return staged;
    })(),
    performance,
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
    blocking,
  });

/**
 * Pins the intent→realization gates that arm when a validated blocking rides
 * along with the performance: matching beat and duration, anchors covered by
 * their actor's actions, and the camera intent honoured by the lead frame.
 *
 * Scenarios:
 *
 * 1. The duel blocking against the duel performance (strike anchor t = 1 inside
 *    the gesture's [1, 2] span; medium static frame) → success. An
 *    "auto"-duration action also covers a late anchor (knightB watched through
 *    the whole beat).
 * 2. Blocking for another beat → `type` on `$input.beat`.
 * 3. Blocking fixed at 3 s against a 2-second performance → `range` on
 *    `$input.duration`.
 * 4. An anchor at t = 0.2 for knightA — before any of knightA's actions (locomote
 *    starts at 0 but... it does cover 0.2; use knightB at t = 1.9 with no
 *    knightB action past the unison locomote's [0, 1] span) → `range` naming
 *    the dropped cue.
 * 5. Blocking asks close/push-in; the performance frames medium/static → `type` on
 *    the lead frame's `framing` and `move`.
 * 6. Blocking asks a follow camera; the performance authors no frame at all →
 *    `type` (a locked-off camera cannot follow).
 */
export const test_film_perform_shot_blocked = (): void => {
  const aligned = run(
    makeBlockingWrite({
      actors: [
        {
          node: "knightA",
          beats: "advances, then strikes",
          anchors: [{ t: 1, cue: "the strike lands" }],
        },
        {
          node: "knightB",
          beats: "watches to the end",
          anchors: [{ t: 1.9, cue: "still watching" }],
        },
      ],
    }),
    makePerformanceWrite({
      draft: [
        ...makePerformanceWrite().draft,
        {
          verb: "lookAt",
          actor: "knightB",
          start: 0,
          duration: "auto",
          to: { kind: "node", node: "knightA" },
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
  );
  TestValidator.equals("aligned blocking passes", aligned.success, true);

  const wrongBeat = run(makeBlockingWrite({ beat: "beat-99" }));
  TestValidator.predicate(
    "beat mismatch rejected",
    wrongBeat.success === false &&
      hasViolation(wrongBeat, "type", "$input.beat"),
  );

  const wrongDuration = run(makeBlockingWrite({ duration: 3 }));
  TestValidator.predicate(
    "duration mismatch rejected",
    wrongDuration.success === false &&
      hasViolation(wrongDuration, "range", "$input.duration"),
  );

  const dropped = run(
    makeBlockingWrite({
      actors: [
        {
          node: "knightB",
          beats: "reacts late in the beat",
          anchors: [{ t: 1.9, cue: "the flinch" }],
        },
      ],
    }),
  );
  TestValidator.predicate(
    "uncovered anchor rejected with its cue",
    dropped.success === false &&
      dropped.violations.some(
        (v) => v.kind === "range" && String(v.expected).includes("the flinch"),
      ),
  );

  const wrongCamera = run(
    makeBlockingWrite({
      camera: {
        framing: "close",
        move: "push-in",
        on: { kind: "node", node: "knightA" },
      },
    }),
  );
  TestValidator.predicate(
    "camera intent mismatch rejected on framing and move",
    wrongCamera.success === false &&
      hasViolation(wrongCamera, "type", "$input.draft[2].framing") &&
      hasViolation(wrongCamera, "type", "$input.draft[2].move"),
  );

  const unframed = run(
    makeBlockingWrite({
      camera: {
        framing: "medium",
        move: "follow",
        on: { kind: "node", node: "knightA" },
      },
    }),
    makePerformanceWrite({
      draft: makePerformanceWrite().draft.filter((a) => a.verb !== "frame"),
      revise: { review: "unchanged.", final: null },
    }),
  );
  TestValidator.predicate(
    "unauthored camera move rejected",
    unframed.success === false &&
      unframed.violations.some((v) =>
        String(v.expected).includes('asks for a "follow" camera'),
      ),
  );

  const malformedActor = run(
    makeBlockingWrite(),
    makePerformanceWrite({
      draft: [
        {
          verb: "locomote",
          actor: {} as never,
          start: 0,
          duration: 1,
          gait: "walk",
          to: { kind: "point", point: { x: 1, y: 0, z: 0 } },
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
  );
  TestValidator.predicate(
    "blocked malformed actor rejected",
    malformedActor.success === false &&
      hasViolation(malformedActor, "type", "$input.draft[0].actor"),
  );
};

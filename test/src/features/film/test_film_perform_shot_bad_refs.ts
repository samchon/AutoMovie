import { performShot, stageScene } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { createSkeleton } from "../internal/fixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

/**
 * Pins the referential and range gates of the PERFORMANCE consumer, all raised
 * from one incoherent write so the correction round sees the full list at
 * once.
 *
 * Scenarios:
 *
 * 1. The performance names a beat the script never planned → `type` on
 *    `$input.beat`.
 * 2. Its duration is 0 → `range` on `$input.duration`.
 * 3. Its only action is performed by an unstaged `ghost` → `type` on
 *    `$input.draft[0].actor`.
 * 4. That action starts at t = 5 s, outside the shot's [0, 0] span → `range` on
 *    `$input.draft[0].start`.
 * 5. A staged action with explicit duration 0: `range` on
 *    `$input.draft[0].duration`.
 * 6. A staged action whose explicit span ends after the shot yields `range` on
 *    `$input.draft[0].duration`.
 * 7. A staged action with `repeat: 0` yields `range` on `$input.draft[0].repeat`.
 * 8. A staged action with fractional `repeat` yields `range` on
 *    `$input.draft[0].repeat`.
 * 9. A staged action with an empty actor list yields `type` on
 *    `$input.draft[0].actor`.
 * 10. A staged action with a duplicate actor entry yields `type` on the repeated
 *     item.
 * 11. A staged `react` with force outside `[0,1]` yields `range` on
 *     `$input.draft[0].force`.
 * 12. A staged `emote` with intensity outside `[0,1]` yields `range` on
 *     `$input.draft[0].intensity`.
 * 13. A staged `reach` to a relative target yields `type` on `$input.draft[0].to`.
 * 14. A staged `lookAt` to a relative target yields `type` on `$input.draft[0].to`.
 * 15. A staged `point` gesture without `at` yields `type` on `$input.draft[0].at`.
 * 16. A staged `strike` gesture aimed at a relative target yields `type` on
 *     `$input.draft[0].at`.
 * 17. A non-`frame` action assigned to a staged camera yields `type` on
 *     `$input.draft[0].actor`.
 * 18. Malformed non-frame actor shapes yield `type` violations instead of raw
 *     iteration failures.
 */
export const test_film_perform_shot_bad_refs = (): void => {
  const staged = stageScene(makeScriptWrite(), makeStagingWrite());
  if (staged.success !== true) throw new Error("staging must succeed");

  const performed = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      beat: "beat-99",
      duration: 0,
      draft: [
        {
          verb: "gesture",
          actor: "ghost",
          start: 5,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals("fails", performed.success, false);
  TestValidator.equals(
    "unknown beat",
    namedFacts([
      ["refused", () => performed.success === false],
      ["violated", () => hasViolation(performed, "type", "$input.beat")],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "zero duration",
    namedFacts([
      ["refused", () => performed.success === false],
      ["violated", () => hasViolation(performed, "range", "$input.duration")],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "unstaged actor",
    namedFacts([
      ["refused", () => performed.success === false],
      [
        "violated",
        () => hasViolation(performed, "type", "$input.draft[0].actor"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "start out of shot",
    namedFacts([
      ["refused", () => performed.success === false],
      [
        "violated",
        () => hasViolation(performed, "range", "$input.draft[0].start"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const zeroActionDuration = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 0,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "zero action duration rejected",
    namedFacts([
      ["refused", () => zeroActionDuration.success === false],
      [
        "violated",
        () =>
          hasViolation(zeroActionDuration, "range", "$input.draft[0].duration"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const overrunActionDuration = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 1.5,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "overrun action duration rejected",
    namedFacts([
      ["refused", () => overrunActionDuration.success === false],
      [
        "violated",
        () =>
          hasViolation(
            overrunActionDuration,
            "range",
            "$input.draft[0].duration",
          ),
      ],
    ]),
    { refused: true, violated: true },
  );

  const zeroRepeat = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          repeat: 0,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "zero repeat rejected",
    namedFacts([
      ["refused", () => zeroRepeat.success === false],
      [
        "violated",
        () => hasViolation(zeroRepeat, "range", "$input.draft[0].repeat"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const fractionalRepeat = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          repeat: 1.5,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "fractional repeat rejected",
    namedFacts([
      ["refused", () => fractionalRepeat.success === false],
      [
        "violated",
        () => hasViolation(fractionalRepeat, "range", "$input.draft[0].repeat"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const emptyActorList = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: [],
          start: 0,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "empty actor list rejected",
    namedFacts([
      ["refused", () => emptyActorList.success === false],
      [
        "violated",
        () => hasViolation(emptyActorList, "type", "$input.draft[0].actor"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const duplicateActor = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: ["knightA", "knightA"],
          start: 0,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "duplicate actor list entry rejected",
    namedFacts([
      ["refused", () => duplicateActor.success === false],
      [
        "violated",
        () => hasViolation(duplicateActor, "type", "$input.draft[0].actor[1]"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const oversizedReact = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "react",
          actor: "knightA",
          start: 0,
          duration: 1,
          from: { kind: "node", node: "knightB" },
          force: 1.2,
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "oversized react force rejected",
    namedFacts([
      ["refused", () => oversizedReact.success === false],
      [
        "violated",
        () => hasViolation(oversizedReact, "range", "$input.draft[0].force"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const oversizedEmote = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "emote",
          actor: "knightA",
          start: 0,
          duration: 1,
          preset: "happy",
          intensity: 1.2,
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "oversized emote intensity rejected",
    namedFacts([
      ["refused", () => oversizedEmote.success === false],
      [
        "violated",
        () =>
          hasViolation(oversizedEmote, "range", "$input.draft[0].intensity"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const relativeReach = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "reach",
          actor: "knightA",
          start: 0,
          duration: 1,
          hand: "right",
          to: { kind: "direction", headingDeg: 90 },
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "relative reach target rejected",
    namedFacts([
      ["refused", () => relativeReach.success === false],
      [
        "violated",
        () => hasViolation(relativeReach, "type", "$input.draft[0].to"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const relativeLook = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "lookAt",
          actor: "knightA",
          start: 0,
          duration: 1,
          to: { kind: "direction", headingDeg: 90 },
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "relative lookAt target rejected",
    namedFacts([
      ["refused", () => relativeLook.success === false],
      [
        "violated",
        () => hasViolation(relativeLook, "type", "$input.draft[0].to"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const untargetedPoint = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          kind: "point",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "untargeted point gesture rejected",
    namedFacts([
      ["refused", () => untargetedPoint.success === false],
      [
        "violated",
        () => hasViolation(untargetedPoint, "type", "$input.draft[0].at"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const relativeStrike = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          kind: "strike",
          at: { kind: "direction", headingDeg: 90 },
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "relative strike target rejected",
    namedFacts([
      ["refused", () => relativeStrike.success === false],
      [
        "violated",
        () => hasViolation(relativeStrike, "type", "$input.draft[0].at"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const cameraGesture = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "cam-main",
          start: 0,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "non-frame camera actor rejected",
    namedFacts([
      ["refused", () => cameraGesture.success === false],
      [
        "violated",
        () => hasViolation(cameraGesture, "type", "$input.draft[0].actor"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const objectActor = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
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
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "object actor rejected",
    namedFacts([
      ["refused", () => objectActor.success === false],
      [
        "violated",
        () => hasViolation(objectActor, "type", "$input.draft[0].actor"),
      ],
    ]),
    { refused: true, violated: true },
  );

  const nonStringActorEntry = performShot({
    script: makeScriptWrite(),
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: [null] as never,
          start: 0,
          duration: 1,
          kind: "wave",
        },
      ],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => createSkeleton(),
  });
  TestValidator.equals(
    "non-string actor entry rejected",
    namedFacts([
      ["refused", () => nonStringActorEntry.success === false],
      [
        "violated",
        () =>
          hasViolation(nonStringActorEntry, "type", "$input.draft[0].actor[0]"),
      ],
    ]),
    { refused: true, violated: true },
  );
};

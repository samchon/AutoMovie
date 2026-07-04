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
 * 5. A staged action with explicit duration 0 — `range` on
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
  TestValidator.predicate(
    "unknown beat",
    performed.success === false &&
      hasViolation(performed, "type", "$input.beat"),
  );
  TestValidator.predicate(
    "zero duration",
    performed.success === false &&
      hasViolation(performed, "range", "$input.duration"),
  );
  TestValidator.predicate(
    "unstaged actor",
    performed.success === false &&
      hasViolation(performed, "type", "$input.draft[0].actor"),
  );
  TestValidator.predicate(
    "start out of shot",
    performed.success === false &&
      hasViolation(performed, "range", "$input.draft[0].start"),
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
  TestValidator.predicate(
    "zero action duration rejected",
    zeroActionDuration.success === false &&
      hasViolation(zeroActionDuration, "range", "$input.draft[0].duration"),
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
  TestValidator.predicate(
    "overrun action duration rejected",
    overrunActionDuration.success === false &&
      hasViolation(overrunActionDuration, "range", "$input.draft[0].duration"),
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
  TestValidator.predicate(
    "zero repeat rejected",
    zeroRepeat.success === false &&
      hasViolation(zeroRepeat, "range", "$input.draft[0].repeat"),
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
  TestValidator.predicate(
    "fractional repeat rejected",
    fractionalRepeat.success === false &&
      hasViolation(fractionalRepeat, "range", "$input.draft[0].repeat"),
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
  TestValidator.predicate(
    "empty actor list rejected",
    emptyActorList.success === false &&
      hasViolation(emptyActorList, "type", "$input.draft[0].actor"),
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
  TestValidator.predicate(
    "duplicate actor list entry rejected",
    duplicateActor.success === false &&
      hasViolation(duplicateActor, "type", "$input.draft[0].actor[1]"),
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
  TestValidator.predicate(
    "oversized react force rejected",
    oversizedReact.success === false &&
      hasViolation(oversizedReact, "range", "$input.draft[0].force"),
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
  TestValidator.predicate(
    "oversized emote intensity rejected",
    oversizedEmote.success === false &&
      hasViolation(oversizedEmote, "range", "$input.draft[0].intensity"),
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
  TestValidator.predicate(
    "relative reach target rejected",
    relativeReach.success === false &&
      hasViolation(relativeReach, "type", "$input.draft[0].to"),
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
  TestValidator.predicate(
    "relative lookAt target rejected",
    relativeLook.success === false &&
      hasViolation(relativeLook, "type", "$input.draft[0].to"),
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
  TestValidator.predicate(
    "untargeted point gesture rejected",
    untargetedPoint.success === false &&
      hasViolation(untargetedPoint, "type", "$input.draft[0].at"),
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
  TestValidator.predicate(
    "relative strike target rejected",
    relativeStrike.success === false &&
      hasViolation(relativeStrike, "type", "$input.draft[0].at"),
  );
};

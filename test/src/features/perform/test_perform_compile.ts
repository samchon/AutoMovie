import {
  IAutoMovieActionSynthesizer,
  compilePerformance,
} from "@automovie/engine";
import { IAutoMovieActionCall, IAutoMovieMotion } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/** A gesture action — the only verb shape these scenarios need. */
const gesture = (
  actor: string | string[],
  start: number,
  repeat?: number,
): IAutoMovieActionCall => ({
  verb: "gesture",
  kind: "wave",
  actor,
  start,
  duration: 1,
  ...(repeat !== undefined ? { repeat } : {}),
});

/** A one-cycle base clip (duration 1), or `null` for the actor named `"skip"`. */
const synth: IAutoMovieActionSynthesizer = (
  _action: IAutoMovieActionCall,
  actor: string,
): IAutoMovieMotion | null =>
  actor === "skip"
    ? null
    : makeMotion(
        [
          keyframe(0, makePose([joint("spine", { flexion: 0 })])),
          keyframe(1, makePose([joint("spine", { flexion: 20 })])),
        ],
        1,
      );

const times = (m: IAutoMovieMotion): number[] => m.keyframes.map((k) => k.time);

/**
 * `compilePerformance` — the action compiler's timeline assembly (the content
 * seam is faked here; rig-specific clips are exercised elsewhere).
 *
 * Scenarios:
 *
 * 1. Empty action list → no performances.
 * 2. A single actor's one action becomes its performance clip, placed at its start
 *    with the synthesised keyframes.
 * 3. Unison (`actor: string[]`) fans the same verb onto each actor's own timeline;
 *    a `null` synthesis (actor `"skip"`) is dropped.
 * 4. `repeat > 1` concatenates the base cycle N times (duration ×N); `repeat` of 1
 *    or undefined leaves a single cycle.
 * 5. Two actions for one actor with a gap arrange into one clip, holding the first
 *    pose across the gap.
 */
export const test_perform_compile = (): void => {
  // 1. empty
  const empty = compilePerformance([], synth);
  TestValidator.equals("empty → no actors", Object.keys(empty).length, 0);

  // 2. single actor, single action at a start offset
  const one = compilePerformance([gesture("a", 0)], synth);
  TestValidator.equals("one actor compiled", Object.keys(one), ["a"]);
  TestValidator.equals(
    "performance id names the actor",
    one.a!.id,
    "perform:a",
  );
  TestValidator.predicate("single cycle spans 1s", nclose(one.a!.duration, 1));
  TestValidator.predicate(
    "placed cycle times 0,1",
    times(one.a!).every((t, i) => nclose(t, [0, 1][i]!)),
  );

  // 3. unison + a skipped actor
  const unison = compilePerformance([gesture(["a", "b", "skip"], 0)], synth);
  TestValidator.equals(
    "unison fans to the non-skipped actors",
    Object.keys(unison).sort((a, b) => a.localeCompare(b)),
    ["a", "b"],
  );
  TestValidator.equals(
    "skipped actor produces no performance",
    unison.skip,
    undefined,
  );

  // 4. repeat: >1 concatenates, =1 and undefined stay single
  const repeated = compilePerformance([gesture("r", 0, 2)], synth).r!;
  TestValidator.predicate(
    "repeat 2 doubles the duration",
    nclose(repeated.duration, 2),
  );
  TestValidator.predicate(
    "repeat 2 → times 0,1,2 (seam dropped)",
    times(repeated).every((t, i) => nclose(t, [0, 1, 2][i]!)),
  );
  const once = compilePerformance([gesture("o", 0, 1)], synth).o!;
  TestValidator.predicate(
    "explicit repeat 1 stays a single cycle",
    nclose(once.duration, 1),
  );

  // 5. two actions, same actor, with a gap → arranged, hold across the gap
  const gapped = compilePerformance(
    [gesture("g", 0), gesture("g", 2)],
    synth,
  ).g!;
  TestValidator.predicate(
    "two clips + gap → times 0,1,2,3",
    times(gapped).every((t, i) => nclose(t, [0, 1, 2, 3][i]!)),
  );
  TestValidator.predicate(
    "gapped duration is the last placement end",
    nclose(gapped.duration, 3),
  );
};

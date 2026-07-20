import { sequenceMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const errorMessage = (task: () => void): string | null => {
  try {
    task();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/**
 * `sequenceMotion`: concatenating clips into one timeline. Parts are laid
 * end-to-end with their keyframe times offset by the running duration; a later
 * part's `time: 0` boundary keyframe is dropped so the merged times stay
 * strictly increasing.
 *
 * Scenarios:
 *
 * 1. Two parts (durations 1.0 + 0.8) merge to one clip of duration 1.8 whose
 *    keyframes are [0, 1.0, 1.8]: part A keeps both (including its `time:0`),
 *    part B's `time:0` seam keyframe is dropped and its 0.8 keyframe is shifted
 *    to 1.8.
 * 2. The merged times are strictly increasing and the skeleton id carries over.
 * 3. `loop` defaults to false and is passed through when set.
 * 4. Invalid part lists and durations reject before emitting malformed sequence
 *    clips.
 */
export const test_motion_sequence = (): void => {
  const A = makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperArm", { abduction: 0 })])),
      keyframe(1, makePose([joint("leftUpperArm", { abduction: 60 })])),
    ],
    1,
  );
  const B = makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(0.8, makePose([joint("leftLowerArm", { flexion: 120 })])),
    ],
    0.8,
  );

  const seq = sequenceMotion("combo", [A, B]);

  // 1. merge shape
  TestValidator.equals(
    "seam keyframe dropped → 3 keyframes",
    seq.keyframes.length,
    3,
  );
  TestValidator.predicate("kf0 at 0", nclose(seq.keyframes[0]!.time, 0));
  TestValidator.predicate("kf1 at 1.0", nclose(seq.keyframes[1]!.time, 1));
  TestValidator.predicate(
    "kf2 shifted to 1.8",
    nclose(seq.keyframes[2]!.time, 1.8),
  );
  TestValidator.predicate("duration is the sum", nclose(seq.duration, 1.8));

  // 2. strictly increasing + skeleton carried over
  TestValidator.predicate(
    "strictly increasing times",
    seq.keyframes.every(
      (k, i) => i === 0 || k.time > seq.keyframes[i - 1]!.time,
    ),
  );
  TestValidator.equals("skeleton id from first part", seq.skeleton, A.skeleton);

  // 3. loop flag
  TestValidator.equals("loop defaults false", seq.loop, false);
  TestValidator.equals(
    "loop passes through",
    sequenceMotion("c", [A, B], true).loop,
    true,
  );

  // 4. invalid part contracts
  TestValidator.equals(
    "empty sequence rejects with contract error",
    errorMessage(() => sequenceMotion("empty", [])),
    "sequence parts must not be empty",
  );
  TestValidator.equals(
    "mixed skeleton sequence rejects",
    errorMessage(() =>
      sequenceMotion("mixed", [A, { ...B, skeleton: "skeleton-2" }]),
    ),
    "sequence part skeletons must match",
  );
  for (const duration of [Number.NaN, 0, -1])
    TestValidator.equals(
      `invalid part duration ${duration} rejects`,
      errorMessage(() =>
        sequenceMotion("badDuration", [{ ...A, duration }, B]),
      ),
      "sequence part duration must be finite and positive",
    );

  // 5. the seam keyframe carries the INCOMING part's first-segment easing:
  //    sampleMotion eases each segment from its starting keyframe, so keeping
  //    the outgoing part's final easing would freeze/pop the next part's
  //    first segment
  const eased = makeMotion(
    [keyframe(0, makePose([]), "easeOut"), keyframe(1, makePose([]), "step")],
    1,
  );
  const seamed = sequenceMotion("seamEase", [eased, eased]);
  TestValidator.equals(
    "seam easing is the incoming part's first",
    seamed.keyframes[1]!.easing,
    "easeOut",
  );
  TestValidator.equals(
    "the authored final easing survives",
    seamed.keyframes[2]!.easing,
    "step",
  );
};

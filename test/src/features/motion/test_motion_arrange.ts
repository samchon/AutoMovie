import { arrangeMotion, holdMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const spine = (m: ReturnType<typeof makePose>) =>
  m.joints.find((x) => x.bone === "spine");

/**
 * `holdMotion` + `arrangeMotion` ??the harness PERFORMANCE composer.
 *
 * Scenarios:
 *
 * 1. `holdMotion` is a two-keyframe clip holding one pose for the duration, with
 *    the skeleton id stamped on.
 * 2. `arrangeMotion([])` is an empty, zero-length clip (skeleton id "").
 * 3. Two clips with a gap: each is shifted to its start, and the first clip's
 *    final pose is held at the next clip's start (times 0,1,2,3; the t=2 frame
 *    holds clip A's end pose). The dropped coincident frame keeps times
 *    strictly increasing.
 * 4. Contiguous clips (no gap) just concatenate; the seam's duplicate time is
 *    dropped. Input order does not matter (placements are sorted by start).
 */
export const test_motion_arrange = (): void => {
  // 1. holdMotion
  const held = holdMotion(
    "h",
    "skeleton-1",
    makePose([joint("spine", { flexion: 12 })]),
    2,
  );
  TestValidator.equals("hold has two keyframes", held.keyframes.length, 2);
  TestValidator.predicate("hold spans the duration", nclose(held.duration, 2));
  TestValidator.equals(
    "hold carries the skeleton",
    held.skeleton,
    "skeleton-1",
  );
  TestValidator.predicate(
    "both frames hold the same pose",
    nclose(spine(held.keyframes[0]!.pose)!.flexion!, 12) &&
      nclose(spine(held.keyframes[1]!.pose)!.flexion!, 12),
  );

  // 2. empty
  const empty = arrangeMotion("e", []);
  TestValidator.equals("empty has no keyframes", empty.keyframes.length, 0);
  TestValidator.predicate("empty is zero-length", nclose(empty.duration, 0));
  TestValidator.equals("empty skeleton falls back to ''", empty.skeleton, "");

  // 3. two clips with a gap ??hold across it (input order shuffled)
  const A = makeMotion(
    [
      keyframe(0, makePose([joint("spine", { flexion: 0 })])),
      keyframe(1, makePose([joint("spine", { flexion: 30 })])),
    ],
    1,
  );
  const B = makeMotion(
    [
      keyframe(0, makePose([joint("spine", { flexion: 0 })])),
      keyframe(1, makePose([joint("spine", { flexion: -20 })])),
    ],
    1,
  );
  const gapped = arrangeMotion("g", [
    { start: 2, motion: B },
    { start: 0, motion: A },
  ]);
  TestValidator.predicate(
    "times are 0,1,2,3 (gap held, seam dropped)",
    gapped.keyframes
      .map((k) => k.time)
      .every((t, i) => nclose(t, [0, 1, 2, 3][i]!)),
  );
  TestValidator.predicate(
    "duration is the last placement end",
    nclose(gapped.duration, 3),
  );
  TestValidator.predicate(
    "t=2 holds clip A's end pose",
    nclose(spine(gapped.keyframes[2]!.pose)!.flexion!, 30),
  );
  TestValidator.equals(
    "skeleton from the first placement",
    gapped.skeleton,
    "skeleton-1",
  );

  // 4. contiguous ??concatenate, seam dropped, no hold inserted
  const back2back = arrangeMotion("c", [
    { start: 0, motion: A },
    { start: 1, motion: B },
  ]);
  TestValidator.predicate(
    "contiguous times 0,1,2",
    back2back.keyframes
      .map((k) => k.time)
      .every((t, i) => nclose(t, [0, 1, 2][i]!)),
  );
  TestValidator.predicate(
    "contiguous duration 2",
    nclose(back2back.duration, 2),
  );
};

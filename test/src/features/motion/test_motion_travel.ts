import { travelMotion } from "@automovie/engine";
import { IAutoMovieTransform } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/**
 * `travelMotion` — baking continuous root travel onto an in-place locomotion
 * cycle. A looping clip is repeated `cycles` times and a root offset growing
 * linearly with elapsed time (`velocity · t`) is added, so the figure glides
 * forward across every seam while its legs keep cycling.
 *
 * Scenarios:
 *
 * 1. A two-keyframe, 1 s in-place base (root null) travelled at 0.5 m/s in +Z over
 *    3 cycles → a 3 s non-looping clip whose seam keyframes are dropped (4
 *    keyframes, not 6) and whose root Z is exactly velocity·time at every
 *    keyframe — strictly increasing and continuous across the seams.
 * 2. A base that already carries a root transform (a vertical bob + a yaw) has the
 *    travel added on top: its own translation and rotation are preserved.
 * 3. Travel is purely a function of global time, so the duplicate-seam frame of
 *    cycle n and the first frame of cycle n+1 would have landed at the same
 *    place — confirming continuity (no per-cycle reset / snap-back).
 * 4. A `facing` rotation composes onto the base root rotation: travelling the
 *    45°-yaw base with a further 90° yaw lands the root at 135° yaw.
 */
export const test_motion_travel = (): void => {
  // 1. in-place base (root null) → linear travel, seams dropped
  const base = makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperLeg", { flexion: -30 })])),
      keyframe(1, makePose([joint("leftUpperLeg", { flexion: 30 })])),
    ],
    1,
    true,
  );
  const travelled = travelMotion("stroll", base, 3, { x: 0, y: 0, z: 0.5 });

  TestValidator.equals(
    "3 cycles, seams dropped → 4 keyframes",
    travelled.keyframes.length,
    4,
  );
  TestValidator.predicate(
    "duration = cycles × base",
    nclose(travelled.duration, 3),
  );
  TestValidator.equals("result no longer loops", travelled.loop, false);
  TestValidator.equals(
    "skeleton carried over",
    travelled.skeleton,
    base.skeleton,
  );

  // times are 0, 1, 2, 3 and root Z = 0.5 × time at each
  const times = travelled.keyframes.map((k) => k.time);
  TestValidator.predicate(
    "times are 0,1,2,3",
    times.every((t, i) => nclose(t, i)),
  );
  TestValidator.predicate(
    "root Z = velocity × time at every keyframe",
    travelled.keyframes.every((k) =>
      nclose(k.pose.root!.translation.z, 0.5 * k.time),
    ),
  );
  TestValidator.predicate(
    "no travel on unused axes",
    travelled.keyframes.every(
      (k) =>
        nclose(k.pose.root!.translation.x, 0) &&
        nclose(k.pose.root!.translation.y, 0),
    ),
  );

  // 2. base root preserved, travel added on top
  const bob: IAutoMovieTransform = {
    translation: { x: 0, y: 0.1, z: 0 },
    rotation: { x: 0, y: 0.3826834, z: 0, w: 0.9238795 }, // ~45° yaw
    scale: { x: 1, y: 1, z: 1 },
  };
  const withRoot = makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperLeg", { flexion: 0 })], bob)),
      keyframe(1, makePose([joint("leftUpperLeg", { flexion: 0 })], bob)),
    ],
    1,
    true,
  );
  const t2 = travelMotion("hopAcross", withRoot, 2, { x: 1, y: 0, z: 0 });
  const k1 = t2.keyframes[1]!; // at global time 1
  TestValidator.predicate(
    "base bob Y preserved",
    nclose(k1.pose.root!.translation.y, 0.1),
  );
  TestValidator.predicate(
    "travel added to X (1 m/s × 1 s)",
    nclose(k1.pose.root!.translation.x, 1),
  );
  TestValidator.predicate(
    "base yaw preserved",
    nclose(k1.pose.root!.rotation.w, 0.9238795),
  );

  // 3. continuity: the last frame of one cycle and the (dropped) seam of the
  //    next would coincide — root advances monotonically, never resets
  TestValidator.predicate(
    "root Z strictly increasing across seams",
    travelled.keyframes.every(
      (k, i) =>
        i === 0 ||
        k.pose.root!.translation.z >
          travelled.keyframes[i - 1]!.pose.root!.translation.z,
    ),
  );

  // 4. facing composes onto the base root rotation (45° yaw + 90° yaw = 135°)
  const yaw90 = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
  const faced = travelMotion("turn", withRoot, 2, { x: 1, y: 0, z: 0 }, yaw90);
  TestValidator.predicate(
    "facing ∘ base yaw = 135° (w = cos 67.5°)",
    nclose(
      faced.keyframes[1]!.pose.root!.rotation.w,
      Math.cos((67.5 * Math.PI) / 180),
    ),
  );
};

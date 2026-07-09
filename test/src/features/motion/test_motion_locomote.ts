import { Quaternion, locomoteMotion } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose, vclose } from "../internal/predicates";

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

/**
 * `locomoteMotion` — the harness `locomote` verb: carry a looping gait across a
 * distance at a speed, the engine sizing the cycles + forward velocity.
 *
 * Scenarios:
 *
 * 1. A 1 s gait at 1 m/s over 6 m bakes 6 cycles of travel in the +Z direction;
 *    the final keyframe's root has advanced ≈ 6 m.
 * 2. The direction is normalised before scaling by speed.
 * 3. A distance shorter than one cycle still plays at least one cycle — and still
 *    arrives at exactly the asked distance (0.2 m, not a full-stride 1 m
 *    overshoot).
 * 4. `faceTravel` turns the root so the model's +Z faces the travel heading — a
 *    walk sent along +X ends up facing +X — while the default keeps the root
 *    rotation identity (a strafe).
 * 5. Invalid distance/speed/gait-duration/direction inputs reject before cycle
 *    sizing.
 * 6. A fractional ask arrives exactly: 3.49 m at 1 m/s on a 1 s gait rounds to 3
 *    cycles but ends at 3.49 m along the heading (the old bake of the requested
 *    speed stopped at 3.0 m).
 */
export const test_motion_locomote = (): void => {
  const gait = makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperLeg", { flexion: -20 })])),
      keyframe(1, makePose([joint("leftUpperLeg", { flexion: 20 })])),
    ],
    1,
    true,
  );

  // 1. 6 m at 1 m/s on a 1 s gait → 6 cycles, ~6 m of +Z travel
  const stroll = locomoteMotion("stroll", gait, 6, 1, { x: 0, y: 0, z: 1 });
  TestValidator.predicate(
    "duration = 6 cycles × 1 s",
    nclose(stroll.duration, 6),
  );
  const lastZ =
    stroll.keyframes[stroll.keyframes.length - 1]!.pose.root!.translation.z;
  TestValidator.predicate("travelled ≈ 6 m forward", nclose(lastZ, 6, 0.001));

  // 2. unnormalised direction is normalised (a (0,0,5) dir still travels at speed)
  const diag = locomoteMotion("d", gait, 4, 2, { x: 0, y: 0, z: 5 });
  const dz =
    diag.keyframes[diag.keyframes.length - 1]!.pose.root!.translation.z;
  // 4 m at 2 m/s on a 1 s gait → round(2) = 2 cycles → 2 s → 2 × 2 = 4 m
  TestValidator.predicate("normalised: ≈ 4 m at 2 m/s", nclose(dz, 4, 0.001));

  // 3. sub-cycle distance still plays one cycle — and arrives, not overshoots
  const tiny = locomoteMotion("t", gait, 0.2, 1, { x: 0, y: 0, z: 1 });
  TestValidator.predicate("at least one cycle", nclose(tiny.duration, 1));
  const tinyZ =
    tiny.keyframes[tiny.keyframes.length - 1]!.pose.root!.translation.z;
  TestValidator.predicate(
    "a 0.2 m ask ends at 0.2 m, not a full stride",
    nclose(tinyZ, 0.2, 0.001),
  );

  // 4. faceTravel turns the body toward the heading
  const strafe = locomoteMotion("s", gait, 4, 1, { x: 1, y: 0, z: 0 });
  TestValidator.predicate(
    "default keeps rest facing (identity root rotation)",
    nclose(strafe.keyframes[1]!.pose.root!.rotation.w, 1),
  );
  const turned = locomoteMotion("f", gait, 4, 1, { x: 1, y: 0, z: 0 }, true);
  const rot =
    turned.keyframes[turned.keyframes.length - 1]!.pose.root!.rotation;
  TestValidator.predicate(
    "faceTravel: model +Z now points +X (the travel heading)",
    vclose(Quaternion.rotateVector(rot, { x: 0, y: 0, z: 1 }), {
      x: 1,
      y: 0,
      z: 0,
    }),
  );
  // 5. invalid locomotion inputs reject before travel cycle sizing
  for (const distance of [Number.NaN, 0, -1])
    TestValidator.predicate(
      `rejects invalid distance ${distance}`,
      throws(() => {
        locomoteMotion("badDistance", gait, distance, 1, { x: 0, y: 0, z: 1 });
      }),
    );

  for (const speed of [Number.NaN, 0, -1])
    TestValidator.predicate(
      `rejects invalid speed ${speed}`,
      throws(() => {
        locomoteMotion("badSpeed", gait, 1, speed, { x: 0, y: 0, z: 1 });
      }),
    );

  for (const duration of [Number.NaN, 0, -1])
    TestValidator.predicate(
      `rejects invalid gait duration ${duration}`,
      throws(() => {
        locomoteMotion("badGait", { ...gait, duration }, 1, 1, {
          x: 0,
          y: 0,
          z: 1,
        });
      }),
    );

  const invalidDirections = [
    { x: Number.NaN, y: 0, z: 1 },
    { x: 0, y: Infinity, z: 1 },
    { x: 0, y: 0, z: -Infinity },
    { x: 0, y: 0, z: 0 },
    { x: Number.MAX_VALUE, y: Number.MAX_VALUE, z: 0 },
  ];
  for (const direction of invalidDirections)
    TestValidator.predicate(
      "rejects invalid direction",
      throws(() => {
        locomoteMotion("badDirection", gait, 1, 1, direction);
      }),
    );

  // 6. a fractional ask arrives exactly
  const fractional = locomoteMotion("fr", gait, 3.49, 1, { x: 0, y: 0, z: 1 });
  TestValidator.predicate(
    "3.49 m rounds to 3 cycles",
    nclose(fractional.duration, 3),
  );
  const fractionalZ =
    fractional.keyframes[fractional.keyframes.length - 1]!.pose.root!
      .translation.z;
  TestValidator.predicate(
    "3.49 m ask ends at 3.49 m along the heading",
    nclose(fractionalZ, 3.49, 0.001),
  );
};

import { HUMANOID_JOINT_AXES, reachPose, resolvePose } from "@automovie/engine";
import { IAutoMovieBone, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton } from "../internal/fixtures";
import { vclose } from "../internal/predicates";

const idTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/** Where the hand lands after posing the skeleton with `pose`. */
const handAt = (
  pose: NonNullable<ReturnType<typeof reachPose>>,
): IAutoMovieVector3 =>
  resolvePose(pose, createSkeleton(), HUMANOID_JOINT_AXES).find(
    (b) => b.bone === "leftHand",
  )!.worldPosition;

/**
 * `reachPose` — analytic two-bone arm IK. The contract is the FK oracle: pose
 * the skeleton with the returned angles and the hand lands on the target. Any
 * error in the shoulder/elbow solve or the quaternion→clinical lowering shows
 * up as a hand that misses, so this pins correctness end to end regardless of
 * the convention details.
 *
 * The fixture's left arm runs shoulder (0.2, 1.4, 0) → elbow → hand with
 * segments 0.3 + 0.25 = 0.55 m of reach.
 *
 * Scenarios:
 *
 * 1. Several reachable targets around the shoulder (forward, down, across, up) —
 *    the resolved left hand lands on each within tolerance.
 * 2. A target beyond the 0.55 m reach extends the arm fully toward it: the hand
 *    lands on the shoulder→target ray at exactly reach distance (on the shell,
 *    not past it, not failing).
 * 3. A missing arm chain (the fixture has no rightHand) returns null; a target on
 *    the shoulder returns null (degenerate); a zero-length arm bone (a
 *    malformed rig) returns null instead of dividing by zero.
 * 4. A target straight below the shoulder (the reach axis parallel to the
 *    world-down pole) still lands — the bend-plane normal falls back to a
 *    second reference so the solve stays total.
 */
export const test_kinematics_reach = (): void => {
  const skeleton = createSkeleton();
  const shoulder: IAutoMovieVector3 = { x: 0.2, y: 1.4, z: 0 };

  const targets: IAutoMovieVector3[] = [
    { x: 0.4, y: 1.0, z: 0.3 }, // forward and down
    { x: 0.3, y: 1.2, z: -0.35 }, // behind
    { x: 0.5, y: 1.5, z: 0.15 }, // up and out
    { x: 0.1, y: 1.15, z: 0.25 }, // across the body
  ];
  for (const target of targets) {
    const pose = reachPose(skeleton, "left", target);
    TestValidator.predicate(
      `reach ${JSON.stringify(target)} poses`,
      pose !== null,
    );
    if (pose === null) continue;
    TestValidator.predicate(
      `the left hand lands on ${JSON.stringify(target)}`,
      vclose(handAt(pose), target, 1e-3),
    );
  }

  // 2. unreachable → arm fully extended along the ray at reach distance
  const far: IAutoMovieVector3 = { x: 1.4, y: 1.4, z: 0 };
  const farPose = reachPose(skeleton, "left", far)!;
  const handFar = handAt(farPose);
  const dir = {
    x: far.x - shoulder.x,
    y: far.y - shoulder.y,
    z: far.z - shoulder.z,
  };
  const len = Math.hypot(dir.x, dir.y, dir.z);
  const onShell = {
    x: shoulder.x + (dir.x / len) * 0.55,
    y: shoulder.y + (dir.y / len) * 0.55,
    z: shoulder.z + (dir.z / len) * 0.55,
  };
  TestValidator.predicate(
    "an unreachable target extends the arm onto the reach shell",
    vclose(handFar, onShell, 1e-3),
  );

  // 3. degenerate cases
  TestValidator.equals(
    "a missing arm chain (rightHand) → null",
    reachPose(skeleton, "right", { x: 0, y: 1, z: 0.3 }),
    null,
  );
  TestValidator.equals(
    "a target on the shoulder → null",
    reachPose(skeleton, "left", shoulder),
    null,
  );

  // a malformed rig: the forearm collapses onto the elbow (l2 = 0)
  const degenerate = createSkeleton();
  const forearm = degenerate.bones.find(
    (b) => b.bone === "leftHand",
  ) as IAutoMovieBone;
  forearm.rest = idTransform; // hand coincident with the elbow → zero segment
  TestValidator.equals(
    "a zero-length arm segment → null",
    reachPose(degenerate, "left", { x: 0.4, y: 1.2, z: 0.2 }),
    null,
  );

  // 4. straight-down target: reach axis ∥ world-down pole
  const below: IAutoMovieVector3 = { x: 0.2, y: 1.0, z: 0 };
  const belowPose = reachPose(skeleton, "left", below)!;
  TestValidator.predicate(
    "a straight-down reach still lands (pole fallback)",
    vclose(handAt(belowPose), below, 1e-3),
  );
};

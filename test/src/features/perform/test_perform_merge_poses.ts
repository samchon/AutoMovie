import { mergePoses } from "@automovie/engine";
import { IAutoMovieTransform } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, makePose } from "../internal/fixtures";
import { nclose, throwsError } from "../internal/predicates";

const rootAt = (x: number): IAutoMovieTransform => ({
  translation: { x, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const flexionOf = (
  pose: ReturnType<typeof makePose>,
  bone: Parameters<typeof joint>[0],
): number => pose.joints.find((j) => j.bone === bone)!.flexion!;

/**
 * `mergePoses`: compose several per-region poses into one (the per-frame
 * operation behind layering).
 *
 * Scenarios:
 *
 * 1. Disjoint poses combine their joints; the root comes from the rooted pose (a
 *    null-root pose does not clear it).
 * 2. Two poses touching the same bone → the later one wins.
 * 3. With two rooted poses, the last root wins.
 */
export const test_perform_merge_poses = (): void => {
  // 1. disjoint join, root from the rooted (covers root non-null and null)
  const merged = mergePoses([
    makePose([joint("leftUpperLeg", { flexion: 20 })], rootAt(5)),
    makePose([joint("leftUpperArm", { flexion: 30 })]),
  ]);
  TestValidator.equals("disjoint joints combine", merged.joints.length, 2);
  TestValidator.predicate(
    "the leg's flexion survives",
    nclose(flexionOf(merged, "leftUpperLeg"), 20),
  );
  TestValidator.predicate(
    "the arm's flexion survives",
    nclose(flexionOf(merged, "leftUpperArm"), 30),
  );
  TestValidator.predicate(
    "root taken from the rooted pose, not cleared by the null one",
    merged.root !== null && nclose(merged.root.translation.x, 5),
  );
  TestValidator.equals(
    "skeleton from the first pose",
    merged.skeleton,
    "skeleton-1",
  );

  // 2. same bone → later wins
  const overridden = mergePoses([
    makePose([joint("spine", { flexion: 10 })]),
    makePose([joint("spine", { flexion: 50 })]),
  ]);
  TestValidator.equals(
    "same-bone merge keeps one joint",
    overridden.joints.length,
    1,
  );
  TestValidator.predicate(
    "the later joint wins",
    nclose(flexionOf(overridden, "spine"), 50),
  );

  // 3. two roots → last wins
  const twoRoots = mergePoses([
    makePose([joint("hips")], rootAt(2)),
    makePose([joint("chest")], rootAt(9)),
  ]);
  TestValidator.predicate(
    "the last non-null root wins",
    twoRoots.root !== null && nclose(twoRoots.root.translation.x, 9),
  );

  TestValidator.predicate(
    "empty pose merge rejects missing base pose",
    throwsError(() => mergePoses([]), "merge poses must not be empty"),
  );
};

import {
  indexSkeletonTopology,
  reachableBoneNames,
  resolvePose,
} from "@automovie/engine";
import { IAutoMovieSkeleton } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makePose } from "../internal/fixtures";

const rest = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/**
 * The core #730 scenario: a skeleton with a real root and a reachable sub-tree,
 * plus ONE orphaned bone whose parent names a bone absent from the skeleton.
 * `resolvePose` resolves the reachable bones and **omits the orphan** (the
 * partial-return contract) — so a consumer that reads a specific bone must gate
 * on {@link reachableBoneNames} to notice the orphan rather than trusting the
 * `skeleton.bones` declared set. This pins that the reachable-set query and the
 * FK walk agree exactly on which bones are present.
 *
 * `hips`(root)→`spine`→`chest` are reachable; `leftHand`→`leftLowerArm` is
 * orphaned (`leftLowerArm` is not declared).
 */
export const test_kinematics_resolve_orphan = (): void => {
  const skeleton: IAutoMovieSkeleton = {
    id: "orphan",
    bones: [
      { bone: "hips", parent: null, rest, constraint: null },
      { bone: "spine", parent: "hips", rest, constraint: null },
      { bone: "chest", parent: "spine", rest, constraint: null },
      { bone: "leftHand", parent: "leftLowerArm", rest, constraint: null },
    ],
  };

  const resolved = resolvePose(makePose([]), skeleton)
    .map((r) => r.bone)
    .sort((a, b) => a.localeCompare(b));
  TestValidator.equals(
    "resolvePose returns exactly the root-anchored sub-tree, omitting the orphan",
    resolved,
    ["chest", "hips", "spine"],
  );

  const reachable = reachableBoneNames(skeleton);
  TestValidator.equals(
    "reachableBoneNames agrees with the FK walk, bone-for-bone",
    [...reachable].sort((a, b) => a.localeCompare(b)),
    ["chest", "hips", "spine"],
  );
  TestValidator.predicate(
    "the orphan is absent from the reachable set (a validator would flag it)",
    !reachable.has("leftHand"),
  );

  const topology = indexSkeletonTopology(skeleton);
  const resolvedFromTopology = resolvePose(
    makePose([]),
    skeleton,
    undefined,
    undefined,
    topology,
  )
    .map((r) => r.bone)
    .sort((a, b) => a.localeCompare(b));
  TestValidator.equals(
    "explicit topology drives the same FK walk as the default path",
    resolvedFromTopology,
    resolved,
  );
  TestValidator.equals(
    "reachableBoneNames can reuse the same topology source as resolvePose",
    [...reachableBoneNames(skeleton, topology)].sort((a, b) =>
      a.localeCompare(b),
    ),
    resolved,
  );

  const mutable: IAutoMovieSkeleton = {
    id: "mutable",
    bones: [{ bone: "hips", parent: null, rest, constraint: null }],
  };
  const oldTopology = indexSkeletonTopology(mutable);
  mutable.bones.push({ bone: "spine", parent: "hips", rest, constraint: null });
  TestValidator.equals(
    "default resolvePose rebuilds topology after skeleton mutation",
    resolvePose(makePose([]), mutable)
      .map((r) => r.bone)
      .sort((a, b) => a.localeCompare(b)),
    ["hips", "spine"],
  );
  TestValidator.equals(
    "an explicit topology is a caller-owned snapshot for repeated FK work",
    resolvePose(makePose([]), mutable, undefined, undefined, oldTopology).map(
      (r) => r.bone,
    ),
    ["hips"],
  );

  // A fully-reachable skeleton resolves every bone (regression guard).
  const wellFormed: IAutoMovieSkeleton = {
    id: "well-formed",
    bones: [
      { bone: "hips", parent: null, rest, constraint: null },
      { bone: "spine", parent: "hips", rest, constraint: null },
    ],
  };
  TestValidator.equals(
    "well-formed skeleton resolves every bone",
    resolvePose(makePose([]), wellFormed).length,
    2,
  );
};

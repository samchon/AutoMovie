import { reachableBoneNames, resolvePose } from "@automovie/engine";
import { IAutoMovieSkeleton } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makePose } from "../internal/fixtures";

const rest = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/**
 * `resolvePose` walks from null-parent roots. When no bone is a root, nothing
 * is walked: the result is an empty array, the load-bearing "partial return"
 * contract graceful consumers (`retargetHumanoidMotion`'s rest-height measure,
 * the FK-reachability gate a validator uses) rely on to report a malformed rig
 * instead of crashing. {@link reachableBoneNames} answers the same "nothing is
 * reachable" without a separate FK pass, and a cyclic parent chain resolves to
 * the same empty result (every member has a non-null parent, so none is entered
 * from a root, and because a bone is reached only through its single parent,
 * the walk cannot recurse infinitely).
 *
 * Scenario A (rootless): `spine`→`hips` and `chest`→`spine`, but no `hips`
 * root. Scenario B (cycle): `spine`→`chest` and `chest`→`spine`.
 */
export const test_kinematics_resolve_rootless = (): void => {
  const rootless: IAutoMovieSkeleton = {
    id: "rootless",
    bones: [
      { bone: "spine", parent: "hips", rest, constraint: null },
      { bone: "chest", parent: "spine", rest, constraint: null },
    ],
  };
  TestValidator.equals(
    "rootless skeleton resolves to nothing",
    resolvePose(makePose([]), rootless).length,
    0,
  );
  TestValidator.equals(
    "reachableBoneNames agrees: nothing reachable",
    reachableBoneNames(rootless).size,
    0,
  );

  const cyclic: IAutoMovieSkeleton = {
    id: "cyclic",
    bones: [
      { bone: "spine", parent: "chest", rest, constraint: null },
      { bone: "chest", parent: "spine", rest, constraint: null },
    ],
  };
  TestValidator.equals(
    "cyclic parent chain resolves to nothing (never enters from a root)",
    resolvePose(makePose([]), cyclic).length,
    0,
  );
  TestValidator.equals(
    "cyclic chain reaches nothing",
    reachableBoneNames(cyclic).size,
    0,
  );
};

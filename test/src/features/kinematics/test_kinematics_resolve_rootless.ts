import { resolvePose } from "@autofilm/engine";
import { IAutoFilmSkeleton } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { makePose } from "../internal/fixtures";

/**
 * `resolvePose` walks the hierarchy starting from root bones (those with a null
 * parent). A degenerate skeleton in which every bone is parented — so there is
 * no root to start from — must resolve to an empty array rather than throwing
 * or looping. Pins the "no `__root__`" branch a normal skeleton never reaches.
 *
 * Scenario: two bones, `spine`→`hips` and `chest`→`spine`, but no `hips` bone
 * with a null parent. With no entry point, nothing is walked.
 */
export const test_kinematics_resolve_rootless = (): void => {
  const rootless: IAutoFilmSkeleton = {
    id: "rootless",
    bones: [
      {
        bone: "spine",
        parent: "hips",
        rest: {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        constraint: null,
      },
      {
        bone: "chest",
        parent: "spine",
        rest: {
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        constraint: null,
      },
    ],
  };
  TestValidator.equals(
    "rootless skeleton resolves to nothing",
    resolvePose(makePose([]), rootless).length,
    0,
  );
};

import { appendPortraitEyeMargins } from "@automovie/human/components/eyes";
import { createPortraitUpperLidProfile } from "@automovie/human/components/upperLidSection";
import { subdivideControlMesh } from "@automovie/human/geometry/subdivideControlMesh";
import { TestValidator } from "@nestia/e2e";

import { portraitEyeShapeFixture } from "../internal/portraitEyeShapeFixture";
import { upperLidFoldFixture } from "../internal/upperLidFoldFixture";

/**
 * The folded section must reach refined skin, not merely have nonmonotone
 * authoring coordinates that common Loop averaging then removes.
 *
 * Scenarios:
 * 1. A hand-authored upper aperture at (0,2) and outer attachment at (0,7)
 *    produces anterior and returning triangles after two shared refinements.
 * 2. Its fully closed target has no returning triangles in the same central
 *    region. Ring identities and material populations remain the same.
 */
export const test_subject_upper_lid_fold_surface = (): void => {
  const portraitEyeShape = portraitEyeShapeFixture();
  const aperture = [
      [-4, 0, 0],
      [-2, 1.5, 0],
      [0, 2, 0],
      [2, 1.5, 0],
      [4, 0, 0],
      [0, -2, 0],
    ],
    profile = upperLidFoldFixture(),
    socket = {
      name: "left" as const,
      top: [0, 1, 2, 3, 4],
      bottom: [0, 5, 4],
      iris: 0,
      browTop: [],
      browBottom: [],
    };
  const build = (blink: number) => {
    const cage = {
      positions: [
        [-6, 0, 0],
        [-4, 5.5, 0],
        [0, 7, 0],
        [4, 5.5, 0],
        [6, 0, 0],
        [0, -5, 0],
      ],
      indices: [] as number[],
      groups: [] as number[],
    };
    appendPortraitEyeMargins(
      cage,
      aperture,
      socket,
      {
        ...portraitEyeShape,
        aegyoSal: undefined,
        lowerLidProfile: undefined,
        upperLidProfile: profile,
      },
      1,
      undefined,
      undefined,
      createPortraitUpperLidProfile(profile, {
        blink,
        observedBlink: 0,
        yaw: 0,
        pitch: 0,
      }),
    );
    return subdivideControlMesh(cage, 2);
  };
  const folded = build(0),
    closed = build(1);
  const slopes = (mesh: typeof folded) => {
    const values: number[] = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const [a, b, c] = mesh.indices
        .slice(i, i + 3)
        .map((id) => mesh.positions[id]);
      if (
        Math.abs((a[0] + b[0] + c[0]) / 3) > 1.5 ||
        (a[1] + b[1] + c[1]) / 3 <= 2
      )
        continue;
      values.push(
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
      );
    }
    return values;
  };
  const openSlopes = slopes(folded),
    closedSlopes = slopes(closed);
  TestValidator.predicate(
    "central tissue is populated",
    openSlopes.length > 0 && closedSlopes.length > 0,
  );
  TestValidator.predicate(
    "refined fold has a returning surface",
    openSlopes.some((z) => z < -1e-9) && openSlopes.some((z) => z > 1e-9),
  );
  TestValidator.predicate(
    "unfolded target has no returning surface",
    closedSlopes.every((z) => z > 0),
  );
  TestValidator.equals(
    "fold and closed topology exact",
    folded.indices,
    closed.indices,
  );
  TestValidator.equals(
    "fold and closed region ownership exact",
    folded.groups,
    closed.groups,
  );
};

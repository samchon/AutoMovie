import { attachPortraitOralMesh } from "@automovie/human";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Oral-frame admission retains the dental transform's normal and range checks.
 *
 * Scenarios:
 * 1. Empty resident buffers remain owned, and a nonorthogonal up guide loses
 *    its chord component without scaling a hand-authored point or normal.
 * 2. Misaligned normals and representational overflow cannot escape the frame.
 *    Dental-row scenarios separately pin rigid rotations and invalid anchors.
 */
export const test_subject_oral_frame = (): void => {
  const empty: IAutoMovieMesh = {
    positions: [],
    normals: [],
    indices: [],
    uvs: null,
    skin: null,
  };
  const frame = {
    rightCorner: { x: -1, y: 0, z: 0 },
    leftCorner: { x: 1, y: 0, z: 0 },
    origin: { x: 0, y: 0, z: 0 },
    up: { x: 2, y: 1, z: 0 },
    lift: 2,
    recess: 3,
  };
  TestValidator.equals(
    "empty resident mesh",
    attachPortraitOralMesh(empty, frame),
    empty,
  );
  const mesh = { ...empty, positions: [4, 5, 6], normals: [0, 1, 0] };
  const moved = attachPortraitOralMesh(mesh, frame);
  TestValidator.equals("orthogonalized dimensions", moved.positions, [4, 7, 3]);
  TestValidator.equals("orthogonalized normal", moved.normals, [0, 1, 0]);
  TestValidator.predicate(
    "aligned normals required",
    throwsError(
      () => attachPortraitOralMesh({ ...mesh, normals: [] }, frame),
      "normals",
    ),
  );
  TestValidator.predicate(
    "representable transformed range",
    throwsError(
      () =>
        attachPortraitOralMesh(
          { ...mesh, positions: [Number.MAX_VALUE, 0, 0] },
          { ...frame, origin: { x: Number.MAX_VALUE, y: 0, z: 0 } },
        ),
      "representable",
    ),
  );
};

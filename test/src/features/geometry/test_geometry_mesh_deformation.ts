import { createAutoMovieMeshDeformer } from "@automovie/engine";
import type {
  IAutoMovieMesh,
  IAutoMovieMeshDeformationField,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Compact spatial fields move vertices and transform normals by their actual
 * Jacobian. The check uses independent polynomial derivatives on a flat plane.
 *
 * Scenarios:
 * 1. Unit Z displacement with radius 2 gives height (3/4)^3 and slope -27/32
 *    at X=1, while points at/outside support keep their coordinates.
 * 2. Empty and normal-free meshes remain valid; compiled fields own their
 *    inputs and geometry connectivity/UV/skin metadata are retained.
 * 3. Invalid field vectors/radii, local reflection/singularity and nonfinite
 *    accumulated geometry are refused, with a nearby positive Jacobian allowed.
 * 4. All six support faces and diagonals outside the ellipsoid retain their
 *    coordinates, including points inside its bounding box but outside its field.
 */
export const test_geometry_mesh_deformation = (): void => {
  const zero = { x: 0, y: 0, z: 0 };
  const field: IAutoMovieMeshDeformationField = {
    center: { ...zero },
    radius: { x: 2, y: 2, z: 2 },
    displacement: { x: 0, y: 0, z: 1 },
    stretch: { ...zero },
  };
  const mesh: IAutoMovieMesh = {
    positions: [0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0, 0, 1, 0],
    indices: [0, 1, 4],
    normals: Array.from({ length: 5 }, () => [0, 0, 1]).flat(),
    uvs: new Array(10).fill(0),
    skin: null,
  };
  const before = structuredClone(mesh),
    apply = createAutoMovieMeshDeformer([field]);
  field.displacement.z = 100;
  const result = apply(mesh),
    length = Math.hypot(27 / 32, 1);
  TestValidator.predicate(
    "independent displacement polynomial",
    nclose(result.positions[2], 1) &&
      nclose(result.positions[5], 27 / 64) &&
      result.positions[8] === 0 &&
      result.positions[11] === 0,
  );
  TestValidator.predicate(
    "inverse-transpose normal",
    nclose(result.normals![3], 27 / 32 / length) &&
      nclose(result.normals![4], 0) &&
      nclose(result.normals![5], 1 / length),
  );
  TestValidator.equals("input geometry retained", mesh, before);
  const boundaries = [
    2, 0, 0, -2, 0, 0, 0, 2, 0, 0, -2, 0, 0, 0, 2, 0, 0, -2, 1.6, 1.6, 0, 1.6,
    0, 1.6, 0, 1.6, 1.6,
  ];
  TestValidator.equals(
    "support faces and exterior diagonals remain unchanged",
    apply({
      ...mesh,
      positions: boundaries,
      normals: null,
      indices: null,
      uvs: null,
    }).positions,
    boundaries,
  );
  TestValidator.predicate(
    "attribute ownership retained",
    result.indices === mesh.indices &&
      result.uvs === mesh.uvs &&
      result.skin === mesh.skin,
  );
  TestValidator.equals(
    "empty field geometry",
    createAutoMovieMeshDeformer([])(mesh),
    mesh,
  );
  TestValidator.equals(
    "normal-free mesh",
    apply({ ...mesh, normals: null }).normals,
    null,
  );
  TestValidator.equals(
    "empty mesh",
    apply({ positions: [], indices: [], normals: [], uvs: null, skin: null })
      .positions,
    [],
  );
  for (const change of [
    { radius: { x: 0, y: 2, z: 2 } },
    { radius: { x: -1, y: 2, z: 2 } },
    { center: { x: NaN, y: 0, z: 0 } },
    { displacement: { x: 0, y: Infinity, z: 0 } },
    { stretch: { x: 0, y: 0, z: NaN } },
  ])
    TestValidator.predicate(
      "invalid field refused",
      throwsError(() => createAutoMovieMeshDeformer([{ ...field, ...change }])),
    );
  for (const stretch of [-2, -1])
    TestValidator.predicate(
      "orientation reversal refused",
      throwsError(() =>
        createAutoMovieMeshDeformer([
          { ...field, displacement: zero, stretch: { x: stretch, y: 0, z: 0 } },
        ])(mesh),
      ),
    );
  createAutoMovieMeshDeformer([
    { ...field, displacement: zero, stretch: { x: -0.99, y: 0, z: 0 } },
  ])(mesh);
  TestValidator.predicate(
    "overflowing Jacobian refused",
    throwsError(() =>
      createAutoMovieMeshDeformer([
        {
          ...field,
          stretch: {
            x: Number.MAX_VALUE,
            y: Number.MAX_VALUE,
            z: Number.MAX_VALUE,
          },
        },
      ])(mesh),
    ),
  );
  const huge = { ...field, displacement: { x: 0, y: 0, z: Number.MAX_VALUE } };
  TestValidator.predicate(
    "nonfinite accumulated displacement refused",
    throwsError(() => createAutoMovieMeshDeformer([huge, huge])(mesh)),
  );
};

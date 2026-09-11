import { createAutoMovieMeshDeformer } from "@automovie/engine";
import type {
  IAutoMovieMesh,
  IAutoMovieMeshDeformationField,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Endpoint derivatives cannot certify the triangles connecting those endpoints.
 * The independent planar area is 1-2d when a compact field moves only the
 * origin of a unit right triangle by (d,d,0). Every endpoint Jacobian is the
 * identity, including when that triangle collapses or reverses its winding.
 *
 * Scenarios:
 * 1. d=0.2 retains area 0.3; d=0.5 collapses and d=2 reverses. Indexed,
 *    non-indexed, reversed-winding and normal-free inputs obey the same rule.
 * 2. A field with two negative local scales turns a face through 180 degrees
 *    with positive determinant. Transported orientation permits it, whereas
 *    comparing the unchanged source normal with the output would reject it.
 * 3. Empty triangle populations and a microscopic valid triangle are accepted.
 *    Malformed attributes/indices, degenerate source and overflowing face area
 *    refuse explicitly. The failed operation leaves input buffers untouched.
 */
export const test_geometry_mesh_deformation_topology = (): void => {
  const mesh: IAutoMovieMesh = {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: null,
    skin: null,
  };
  const field = (d: number): IAutoMovieMeshDeformationField => ({
    center: { x: 0, y: 0, z: 0 },
    radius: { x: 0.25, y: 0.25, z: 0.25 },
    displacement: { x: d, y: d, z: 0 },
    stretch: { x: 0, y: 0, z: 0 },
  });
  const before = structuredClone(mesh);
  for (const variant of [
    mesh,
    { ...mesh, indices: null },
    { ...mesh, normals: null },
    { ...mesh, indices: [2, 1, 0], normals: mesh.normals!.map((v) => -v) },
    // Shading normals do not own topological orientation.
    { ...mesh, normals: mesh.normals!.map((v) => -v) },
  ]) {
    const result = createAutoMovieMeshDeformer([field(0.2)])(variant);
    const p = result.positions;
    const twiceArea =
      (p[3] - p[0]) * (p[7] - p[1]) - (p[4] - p[1]) * (p[6] - p[0]);
    TestValidator.predicate(
      "positive independent area",
      nclose(twiceArea, 0.6),
    );
    for (const d of [0.5, 2])
      TestValidator.predicate(
        "endpoint-positive collapse and reversal refuse",
        throwsError(() => createAutoMovieMeshDeformer([field(d)])(variant)),
      );
  }
  TestValidator.equals("failed deformation retains input", mesh, before);

  const radius = 1000;
  const turn: IAutoMovieMeshDeformationField = {
    ...field(0),
    radius: { x: radius, y: radius, z: radius },
    stretch: { x: 0, y: -2, z: -2 },
  };
  const turned = createAutoMovieMeshDeformer([turn])(mesh);
  TestValidator.predicate(
    "a positive-Jacobian half-turn is not a fold",
    nclose(turned.positions[7], 1 - 2 * (1 - 1 / radius ** 2) ** 3) &&
      turned.positions[7] < 0 &&
      turned.normals![2] < 0,
  );

  const identity = createAutoMovieMeshDeformer([]);
  const tiny = { ...mesh, positions: mesh.positions.map((v) => v * 1e-80) };
  TestValidator.equals(
    "no absolute area floor",
    identity(tiny).positions,
    tiny.positions,
  );
  TestValidator.equals(
    "an explicit empty face population retains isolated samples",
    createAutoMovieMeshDeformer([field(2)])({ ...mesh, indices: [] }).positions,
    [2, 2, 0, 1, 0, 0, 0, 1, 0],
  );
  TestValidator.equals(
    "empty implicit triangle population",
    identity({
      positions: [],
      normals: null,
      indices: null,
      uvs: null,
      skin: null,
    }).positions,
    [],
  );
  for (const invalid of [
    { ...mesh, positions: [0, 0] },
    { ...mesh, positions: [NaN, ...mesh.positions.slice(1)] },
    { ...mesh, indices: [0, 1] },
    { ...mesh, indices: [0, 1, 0.5] },
    { ...mesh, indices: [0, 1, -1] },
    { ...mesh, indices: [0, 1, 3] },
    { ...mesh, normals: [0, 0, 1] },
    { ...mesh, normals: [NaN, ...mesh.normals!.slice(1)] },
    { ...mesh, indices: null, positions: [0, 0, 0] },
    { ...mesh, positions: [0, 0, 0, 1, 0, 0, 2, 0, 0] },
    { ...mesh, positions: mesh.positions.map((v) => v * 1e200) },
  ])
    TestValidator.predicate(
      "invalid resident triangles refuse",
      throwsError(() => identity(invalid)),
    );
  TestValidator.predicate(
    "finite vertices can still overflow the emitted area",
    throwsError(() => createAutoMovieMeshDeformer([field(1e308)])(mesh)),
  );
};

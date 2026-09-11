import { measureAutoMovieMeshClearance } from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * Plane differences attain extrema at projected intersection vertices, including
 * intersections absent from either source vertex set.
 *
 * Scenarios:
 * 1. Two crossing triangles have all front vertices outside the back triangle.
 *    Their overlap still has separation -1; raising the front by two gives +1.
 * 2. Reversing winding, changing depth axis, or using implicit triangle indices
 *    preserves the signed answer. Exact contact reports zero.
 * 3. Disjoint, empty and ray-parallel surfaces have no ordering relationship.
 */
export const test_geometry_mesh_clearance = (): void => {
  const mesh = (points: number[][]): IAutoMovieMesh => ({
    positions: points.flat(),
    indices: null,
    normals: null,
    uvs: null,
    skin: null,
  });
  const front = mesh([
    [-2, -1, 0],
    [2, -1, 0],
    [0, 2, 0],
  ]);
  const back = mesh([
    [-2, 1, 1],
    [0, -2, 1],
    [2, 1, 1],
  ]);
  const original = structuredClone([front, back]);
  const sloped = {
    ...back,
    positions: back.positions.map((v, i) =>
      i % 3 === 2 ? back.positions[i - 2] : v,
    ),
  };
  TestValidator.predicate(
    "crossed edge affine minimum",
    Math.abs(
      measureAutoMovieMeshClearance(front, sloped, "z")[0].minimum + 4 / 3,
    ) < 1e-12,
  );
  for (const axis of ["x", "y", "z"] as const) {
    const permute = (m: IAutoMovieMesh, lift: number): IAutoMovieMesh => ({
      ...m,
      positions: Array.from({ length: 3 }, (_, i) => {
        const [u, v, d] = m.positions.slice(i * 3, i * 3 + 3);
        return axis === "x"
          ? [d + lift, u, v]
          : axis === "y"
            ? [v, d + lift, u]
            : [u, v, d + lift];
      }).flat(),
    });
    for (const lift of [0, 1, 2]) {
      const a = permute(front, lift),
        b = permute(back, 0);
      const expected = lift - 1;
      for (const indices of [null, [2, 1, 0]]) {
        const result = measureAutoMovieMeshClearance(
          { ...a, indices },
          { ...b, indices },
          axis,
        );
        TestValidator.equals("one overlapping front face", result.length, 1);
        TestValidator.predicate(
          "independent constant plane gap",
          Math.abs(result[0].minimum - expected) < 1e-12,
        );
      }
    }
  }
  TestValidator.equals("caller buffers unchanged", [front, back], original);
  TestValidator.equals(
    "empty back",
    measureAutoMovieMeshClearance(front, mesh([]), "z"),
    [],
  );
  TestValidator.equals(
    "empty front",
    measureAutoMovieMeshClearance(mesh([]), back, "z"),
    [],
  );
  for (const offset of [
    [10, 0],
    [0, 10],
    [0, -10],
    [-10, 0],
  ]) {
    const moved = {
      ...back,
      positions: back.positions.map(
        (v, i) => v + (i % 3 < 2 ? offset[i % 3] : 0),
      ),
    };
    TestValidator.equals(
      "disjoint projections",
      measureAutoMovieMeshClearance(front, moved, "z"),
      [],
    );
  }
  const parallel = mesh([
    [0, 0, 0],
    [1, 0, 0],
    [0, 0, 1],
  ]);
  TestValidator.equals(
    "parallel front",
    measureAutoMovieMeshClearance(parallel, back, "z"),
    [],
  );
  TestValidator.equals(
    "parallel back",
    measureAutoMovieMeshClearance(front, parallel, "z"),
    [],
  );
};

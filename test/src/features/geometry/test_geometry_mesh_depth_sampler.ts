import { createAutoMovieMeshDepthSampler } from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Axis-aligned attachment depths come from resident triangles and survive
 * winding, index layout and caller mutation rather than an inferred ellipsoid.
 *
 * Scenarios:
 * 1. Two parallel triangular planes with depth u+2v and u+2v+3 produce the
 *    independent interval [1.25,4.25] at (0.25,0.5), in all three axes.
 * 2. Edges/corners are included; exterior, triangle-exterior, empty-grid-cell,
 *    empty-mesh and edge-on-face queries return null. Winding is immaterial.
 * 3. Editing caller buffers cannot change a built sampler; nonindexed input
 *    produces the same intersections as indexed triangles.
 * 4. Incomplete/nonfinite/out-of-range buffers, unknown axes, unrepresentable
 *    projected arithmetic and nonfinite queries are refused.
 */
export const test_geometry_mesh_depth_sampler = (): void => {
  const mesh = (
    positions: number[],
    indices: number[] | null,
  ): IAutoMovieMesh => ({
    positions,
    indices,
    normals: null,
    uvs: null,
    skin: null,
  });
  const uvDepth = [
    [0, 0, 0],
    [2, 0, 2],
    [0, 2, 4],
    [0, 0, 3],
    [2, 0, 5],
    [0, 2, 7],
  ];
  for (const axis of ["x", "y", "z"] as const) {
    const positions = uvDepth.flatMap(([u, v, d]) =>
      axis === "x" ? [d, u, v] : axis === "y" ? [v, d, u] : [u, v, d],
    );
    const input = mesh(positions, [0, 1, 2, 5, 4, 3]);
    const sample = createAutoMovieMeshDepthSampler(input, axis);
    const value = sample(0.25, 0.5);
    TestValidator.predicate(
      "independent two-plane intersection",
      value !== null &&
        nclose(value.minimum, 1.25) &&
        nclose(value.maximum, 4.25),
    );
    TestValidator.equals("vertex included", sample(0, 0), {
      minimum: 0,
      maximum: 3,
    });
    TestValidator.equals("outer grid boundary included", sample(2, 0), {
      minimum: 2,
      maximum: 5,
    });
    TestValidator.equals("triangle edge included", sample(1, 1), {
      minimum: 3,
      maximum: 6,
    });
    for (const [u, v] of [
      [-1, 0],
      [3, 0],
      [0, -1],
      [0, 3],
      [1.75, 1.75],
    ])
      TestValidator.equals(
        "query misses projected triangle",
        sample(u, v),
        null,
      );
    input.positions.fill(900);
    input.indices!.fill(0);
    TestValidator.equals("sampler owns source values", sample(0, 0), {
      minimum: 0,
      maximum: 3,
    });
    for (const [u, v] of [
      [NaN, 0],
      [0, Infinity],
    ])
      TestValidator.predicate(
        "invalid query refused",
        throwsError(() => sample(u, v)),
      );
  }
  const triangle = [0, 0, 0, 2, 0, 2, 0, 2, 4];
  const tilted = createAutoMovieMeshDepthSampler(
    mesh([1, 0, 0, 0, 2, 0, 2, 2, 0], null),
    "z",
  );
  TestValidator.equals("outside left triangle edge", tilted(0.1, 0.1), null);
  TestValidator.equals("outside right triangle edge", tilted(1.9, 0.1), null);
  const verticalExtent = mesh(
    [
      0,
      Number.MAX_VALUE,
      0,
      0,
      Number.MAX_VALUE * 0.999999999999999,
      0,
      1e-308,
      Number.MAX_VALUE,
      0,
      0,
      -Number.MAX_VALUE,
      0,
      0,
      -Number.MAX_VALUE * 0.999999999999999,
      0,
      1e-308,
      -Number.MAX_VALUE,
      0,
    ],
    null,
  );
  TestValidator.predicate(
    "unrepresentable vertical extent",
    throwsError(() => createAutoMovieMeshDepthSampler(verticalExtent, "z")),
  );
  const extremeDepth = createAutoMovieMeshDepthSampler(
    mesh(
      [
        0,
        0,
        Number.MAX_VALUE,
        1,
        0,
        Number.MAX_VALUE,
        0,
        1,
        Number.MAX_VALUE,
        2,
        0,
        0,
        2,
        1,
        0,
        1,
        1,
        0,
      ],
      null,
    ),
    "z",
  );
  TestValidator.predicate(
    "unrepresentable interpolated depth",
    throwsError(() => extremeDepth(1 + 1e-11, 0)),
  );
  TestValidator.equals(
    "nonindexed triangle",
    createAutoMovieMeshDepthSampler(mesh(triangle, null), "z")(0.25, 0.5),
    { minimum: 1.25, maximum: 1.25 },
  );
  const sparse = mesh([...triangle, 10, 10, 0, 11, 10, 0, 10, 11, 0], null);
  TestValidator.equals(
    "empty spatial bin",
    createAutoMovieMeshDepthSampler(sparse, "z")(5, 5),
    null,
  );
  for (const source of [
    mesh([], null),
    mesh([0, 0, 0, 0, 1, 0, 0, 1, 1], null),
  ])
    TestValidator.equals(
      "no isolated projected triangles",
      createAutoMovieMeshDepthSampler(source, "z")(0, 0.5),
      null,
    );
  for (const source of [
    mesh([0], null),
    mesh([0, 0, 0], null),
    mesh(triangle, [0, 1]),
    mesh([NaN, 0, 0, 2, 0, 2, 0, 2, 4], null),
    ...[-1, 0.5, 3].map((id) => mesh(triangle, [0, 1, id])),
    mesh([0, 0, 0, Number.MAX_VALUE, 0, 0, 0, Number.MAX_VALUE, 0], null),
    mesh(
      [
        Number.MAX_VALUE,
        0,
        0,
        Number.MAX_VALUE * 0.999999999999999,
        0,
        0,
        Number.MAX_VALUE,
        1e-308,
        0,
        -Number.MAX_VALUE,
        0,
        0,
        -Number.MAX_VALUE * 0.999999999999999,
        0,
        0,
        -Number.MAX_VALUE,
        1e-308,
        0,
      ],
      null,
    ),
  ])
    TestValidator.predicate(
      "invalid triangle input refused",
      throwsError(() => createAutoMovieMeshDepthSampler(source, "z")),
    );
  TestValidator.predicate(
    "invalid axis refused",
    throwsError(() =>
      createAutoMovieMeshDepthSampler(mesh(triangle, null), "bad" as "x"),
    ),
  );
};

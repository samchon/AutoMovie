import { measureAutoMovieMeshClearance } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Invalid geometry and unrepresentable arithmetic never become a clear result.
 * Scenarios:
 * 1. Incomplete/nonfinite buffers and invalid indices refuse beside the valid
 *    indexed plane, and the axis vocabulary is enforced at runtime.
 * 2. Finite coordinates whose area, cross-triangle clipping or signed depth
 *    arithmetic overflow refuse at the relevant operation.
 */
export const test_geometry_mesh_clearance_refusals = (): void => {
  const mesh = {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2],
    normals: null,
    uvs: null,
    skin: null,
  };
  TestValidator.predicate(
    "valid contact plane",
    Math.abs(measureAutoMovieMeshClearance(mesh, mesh, "z")[0].minimum) < 1e-12,
  );
  for (const invalid of [
    { ...mesh, positions: [0, 0] },
    { ...mesh, positions: [NaN, 0, 0] },
    { ...mesh, indices: [0, 1] },
    { ...mesh, indices: [0, 1, 3] },
    { ...mesh, indices: [0, 1, -1] },
    { ...mesh, indices: [0, 1, 0.5] },
  ])
    TestValidator.predicate(
      "invalid triangle buffers",
      throwsError(
        () => measureAutoMovieMeshClearance(invalid, mesh, "z"),
        "triangle buffers",
      ),
    );
  TestValidator.predicate(
    "invalid axis",
    throwsError(
      () => measureAutoMovieMeshClearance(mesh, mesh, "w" as never),
      "depth axis",
    ),
  );
  const huge = { ...mesh, positions: [0, 0, 0, 1e308, 0, 0, 0, 1e308, 0] };
  TestValidator.predicate(
    "projected area overflow",
    throwsError(
      () => measureAutoMovieMeshClearance(huge, mesh, "z"),
      "projected area",
    ),
  );
  const high = {
    ...mesh,
    positions: mesh.positions.map((v, i) => (i % 3 === 2 ? 1e308 : v)),
  };
  const low = {
    ...mesh,
    positions: mesh.positions.map((v, i) => (i % 3 === 2 ? -1e308 : v)),
  };
  TestValidator.predicate(
    "depth difference overflow",
    throwsError(
      () => measureAutoMovieMeshClearance(high, low, "z"),
      "arithmetic",
    ),
  );
  const left = {
    ...mesh,
    positions: [-1e308, 0, 0, 0, 0, 0, -1e308, 1e-308, 0],
  };
  const right = {
    ...mesh,
    positions: [0, 0, 0, 1e308, 0, 0, 1e308, 1e-308, 0],
  };
  TestValidator.predicate(
    "cross triangle clipping overflow",
    throwsError(
      () => measureAutoMovieMeshClearance(left, right, "z"),
      "clipping",
    ),
  );
};

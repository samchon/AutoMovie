import { validateModel } from "@automovie/engine";
import { IAutoMovieMesh, IAutoMovieModel } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const modelWithMesh = (mesh: IAutoMovieMesh): IAutoMovieModel => {
  const base = createModel(null);
  return {
    ...base,
    origin: "imported",
    parts: base.parts.map((part) => ({
      ...part,
      geometry: { type: "mesh", mesh },
    })),
  };
};

/**
 * An empty position buffer is a multiple of 3, so the tuple-length check
 * accepts it and every downstream buffer stays "consistent" at vertexCount 0: a
 * mesh with no vertices used to validate clean and only degenerate at
 * render/export. validateModel now rejects it, mirroring a primitive's
 * strictly-positive extents, so the correction round catches empty geometry.
 *
 * Scenarios:
 *
 * 1. Empty positions, all optional buffers null → a positions type violation (the
 *    dependent buffers are absent, so nothing masks the empty-vertex fault).
 * 2. Empty positions with empty normals/uvs/indices: each is length 0, so the
 *    per-vertex length checks all pass at vertexCount 0; the only violation is
 *    the empty positions itself (the dependent buffers do not drift).
 * 3. A single-vertex mesh (the minimum) still validates: the check is "at least
 *    one", not "at least a triangle".
 */
export const test_validation_model_mesh_empty = (): void => {
  const bare = validateModel({
    model: modelWithMesh({
      positions: [],
      normals: null,
      uvs: null,
      indices: null,
      skin: null,
    }),
  });
  TestValidator.equals("empty mesh fails", bare.success, false);
  TestValidator.predicate(
    "empty positions violation",
    hasViolation(bare, "type", "$input.parts[0].geometry.mesh.positions"),
  );

  const withEmptyBuffers = validateModel({
    model: modelWithMesh({
      positions: [],
      normals: [],
      uvs: [],
      indices: [],
      skin: null,
    }),
  });
  TestValidator.equals(
    "empty mesh with empty dependent buffers fails",
    withEmptyBuffers.success,
    false,
  );
  TestValidator.predicate(
    "empty positions is the only fault",
    hasViolation(
      withEmptyBuffers,
      "type",
      "$input.parts[0].geometry.mesh.positions",
    ) &&
      withEmptyBuffers.success === false &&
      withEmptyBuffers.violations.every(
        (violation) =>
          violation.path === "$input.parts[0].geometry.mesh.positions",
      ),
  );

  TestValidator.equals(
    "single-vertex mesh succeeds",
    validateModel({
      model: modelWithMesh({
        positions: [0, 0, 0],
        normals: null,
        uvs: null,
        indices: null,
        skin: null,
      }),
    }).success,
    true,
  );
};

import { validateModel } from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieMesh,
  IAutoMovieMeshSkin,
  IAutoMovieModel,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const VALID_SKIN: IAutoMovieMeshSkin = {
  joints: ["leftUpperArm", "leftLowerArm"],
  boneIndices: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  weights: [0.7, 0.3, 0, 0, 0.5, 0.5, 0, 0, 1, 0, 0, 0],
};

const VALID_MESH: IAutoMovieMesh = {
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  normals: null,
  uvs: null,
  indices: null,
  skin: VALID_SKIN,
};

const modelWithSkin = (skin: IAutoMovieMeshSkin): IAutoMovieModel => {
  const base = createModel();
  return {
    ...base,
    origin: "imported",
    parts: base.parts.map((part) => ({
      ...part,
      geometry: { type: "mesh", mesh: { ...VALID_MESH, skin } },
    })),
  };
};

/**
 * Mesh skin data binds every vertex to up to four skeleton joints. The
 * validator must reject malformed bindings before skinned deformation or export
 * consumes them.
 *
 * Scenarios:
 *
 * 1. A valid four-influence-per-vertex skin validates.
 * 2. Skin joints must resolve to unique model skeleton bones.
 * 3. Bone indices must be integer references into the skin joint array.
 * 4. Weights must be finite normalized values in `[0,1]`.
 * 5. Bone-index and weight buffers must contain four entries per vertex.
 */
export const test_validation_model_mesh_skin = (): void => {
  TestValidator.equals(
    "valid skin succeeds",
    validateModel({ model: modelWithSkin(VALID_SKIN) }).success,
    true,
  );

  const invalid = validateModel({
    model: modelWithSkin({
      joints: ["leftUpperArm", "leftUpperArm", "jaw" as AutoMovieHumanoidBone],
      boneIndices: [0, -1, 3, 1.5, 0, 1, 2, 0, 0, 1, 2, 0],
      weights: [0.4, 0.4, 0.1, 0, 1.2, -0.1, Number.NaN, 0, 0.5, 0.5, 0, 0],
    }),
  });

  TestValidator.equals("malformed skin fails", invalid.success, false);
  TestValidator.predicate(
    "duplicate skin joint violation",
    hasViolation(
      invalid,
      "type",
      "$input.parts[0].geometry.mesh.skin.joints[1]",
    ),
  );
  TestValidator.predicate(
    "unknown skin joint violation",
    hasViolation(
      invalid,
      "type",
      "$input.parts[0].geometry.mesh.skin.joints[2]",
    ),
  );
  TestValidator.predicate(
    "negative bone index violation",
    hasViolation(
      invalid,
      "range",
      "$input.parts[0].geometry.mesh.skin.boneIndices[1]",
    ),
  );
  TestValidator.predicate(
    "high bone index violation",
    hasViolation(
      invalid,
      "range",
      "$input.parts[0].geometry.mesh.skin.boneIndices[2]",
    ),
  );
  TestValidator.predicate(
    "fractional bone index violation",
    hasViolation(
      invalid,
      "range",
      "$input.parts[0].geometry.mesh.skin.boneIndices[3]",
    ),
  );
  TestValidator.predicate(
    "weight upper-bound violation",
    hasViolation(
      invalid,
      "range",
      "$input.parts[0].geometry.mesh.skin.weights[4]",
    ),
  );
  TestValidator.predicate(
    "weight lower-bound violation",
    hasViolation(
      invalid,
      "range",
      "$input.parts[0].geometry.mesh.skin.weights[5]",
    ),
  );
  TestValidator.predicate(
    "non-finite weight violation",
    hasViolation(
      invalid,
      "range",
      "$input.parts[0].geometry.mesh.skin.weights[6]",
    ),
  );
  TestValidator.predicate(
    "weight sum violation",
    hasViolation(
      invalid,
      "range",
      "$input.parts[0].geometry.mesh.skin.weights[0]",
    ),
  );

  const badLengths = validateModel({
    model: modelWithSkin({
      ...VALID_SKIN,
      boneIndices: [0, 1],
      weights: [1, 0],
    }),
  });
  TestValidator.equals("skin buffer lengths fail", badLengths.success, false);
  TestValidator.predicate(
    "bone index length violation",
    hasViolation(
      badLengths,
      "type",
      "$input.parts[0].geometry.mesh.skin.boneIndices",
    ),
  );
  TestValidator.predicate(
    "weight length violation",
    hasViolation(
      badLengths,
      "type",
      "$input.parts[0].geometry.mesh.skin.weights",
    ),
  );
};

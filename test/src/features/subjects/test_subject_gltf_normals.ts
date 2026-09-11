import type { IAutoMovieMesh } from "@automovie/interface";
import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { portraitDocument } from "../../subjects/portraitDocument";
import { portraitMeshBuffers } from "../../subjects/portraitMeshBuffers";
import { createModel } from "../internal/fixtures";
import { nclose, throwsError } from "../internal/predicates";

/**
 * A NORMAL accessor contains unit directions independently of triangle-area
 * policy. A collapsed pole cannot waive that attribute's glTF contract.
 *
 * Scenarios:
 * 1. Normalized diagonal directions survive Float32 rounding and actual GLB.
 * 2. Zero, underflowed and nonunit directions refuse, including redundant-only
 *    vertices; absent normals remain absent and empty buffers remain empty.
 * 3. One Float32 epsilon of length error is admitted; two epsilons refuse.
 *    The actual document consumer rejects an authored zero direction.
 */
export const test_subject_gltf_normals = async (): Promise<void> => {
  const mesh: IAutoMovieMesh = {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    indices: [0, 1, 2],
    normals: new Array<number>(9).fill(1 / Math.sqrt(3)),
    uvs: null,
    skin: null,
  };
  const model = createModel(null);
  model.parts = [{ ...model.parts[0], geometry: { type: "mesh", mesh } }];
  const io = new NodeIO();
  const glb = await io.readBinary(
    await io.writeBinary(portraitDocument(model)),
  );
  const attribute = glb
    .getRoot()
    .listMeshes()[0]
    .listPrimitives()[0]
    .getAttribute("NORMAL")!
    .getArray()!;
  TestValidator.predicate(
    "Float32 diagonal is unit within its rounding",
    nclose(Math.hypot(attribute[0], attribute[1], attribute[2]), 1, 1e-7),
  );
  for (const normal of [
    [0, 0, 0],
    [0, 0, 1e-100],
    [0, 0, 0.5],
    [0, 0, 1.01],
  ])
    for (const positions of [mesh.positions, new Array<number>(9).fill(0)])
      TestValidator.predicate(
        "NORMAL contract also applies to redundant faces",
        throwsError(
          () =>
            portraitMeshBuffers({
              ...mesh,
              positions,
              normals: [...normal, ...normal, ...normal],
            }),
          "unit",
        ),
      );
  for (const sign of [-1, 1]) {
    const normal = [0, 0, 1 + sign * 2 ** -23];
    portraitMeshBuffers({
      ...mesh,
      normals: [...normal, ...normal, ...normal],
    });
    const invalid = [0, 0, 1 + sign * 2 ** -22];
    TestValidator.predicate(
      "error beyond Float32 roundoff refuses",
      throwsError(
        () =>
          portraitMeshBuffers({
            ...mesh,
            normals: [...invalid, ...invalid, ...invalid],
          }),
        "unit",
      ),
    );
  }
  const invalidModel = {
    ...model,
    parts: [
      {
        ...model.parts[0],
        geometry: {
          type: "mesh" as const,
          mesh: { ...mesh, normals: [0, 0, 0, 0, 0, 1, 0, 0, 1] },
        },
      },
    ],
  };
  TestValidator.predicate(
    "document enforces NORMAL identity",
    throwsError(() => portraitDocument(invalidModel), "unit"),
  );
  TestValidator.equals(
    "absent normal accessor",
    portraitMeshBuffers({ ...mesh, normals: null }).normals,
    null,
  );
  TestValidator.equals(
    "empty NORMAL population",
    Array.from(
      portraitMeshBuffers({ ...mesh, positions: [], indices: [], normals: [] })
        .normals!,
    ),
    [],
  );
};

import { inspectAutoMovieMeshTopology } from "@automovie/engine";
import type { IAutoMovieMesh } from "@automovie/interface";
import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { portraitDocument } from "../../subjects/portraitDocument";
import {
  placePortraitMesh,
  portraitMeshBuffers,
} from "../../subjects/portraitMeshBuffers";
import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Float32 export must preserve every nonredundant source face and the final
 * group's edge topology. The independent oracles use IEEE binary spacing,
 * signed planar area and the engine's established positional-weld policy.
 *
 * Scenarios:
 * 1. A unit triangle survives at X=1e7 but loses its width at X=1e8. Three
 *    distinct rounded vertices can also become collinear or reverse winding.
 * 2. Existing welded pole triangles remain permitted. A two-face input swaps
 *    the redundant ordinal under rounding while keeping the count at one;
 *    the newly lost face still refuses.
 * 3. Two equally wound parallel triangles retain their individual areas but
 *    merge after rounding a 1mm gap at Z=1e5. A 10mm gap survives. Every
 *    final material group owes topology, including a non-optical open surface.
 * 4. Optional normals, implicit indices and empty buffers retain their shapes;
 *    unaligned normals and Float32 position/normal overflow refuse.
 * 5. A translation at 1e16 cannot erase a locally real face before redundancy
 *    classification. Linear enlargement can make an original sub-weld face
 *    real, while deliberate shrinking retains the established pole policy.
 *    Proper rotations and mirrors remain supported through the same transform.
 */
export const test_subject_gltf_precision = async (): Promise<void> => {
  const mesh = (positions: number[]): IAutoMovieMesh => ({
    positions,
    normals: null,
    indices: Array.from({ length: positions.length / 3 }, (_v, i) => i),
    uvs: null,
    skin: null,
  });
  const document = (
    geometry: IAutoMovieMesh,
    transform: typeof IDENTITY_TRANSFORM | null = null,
  ) => {
    const model = createModel(null);
    model.parts = [
      {
        ...model.parts[0],
        transform,
        geometry: { type: "mesh", mesh: geometry },
      },
    ];
    return portraitDocument(model);
  };
  const unit = (x: number) => mesh([x, 0, 0, x + 1, 0, 0, x, 1, 0]);
  const io = new NodeIO();
  const roundTrip = await io.readBinary(
    await io.writeBinary(document(unit(1e7))),
  );
  const positions = roundTrip
    .getRoot()
    .listMeshes()[0]
    .listPrimitives()[0]
    .getAttribute("POSITION")!
    .getArray()!;
  TestValidator.predicate(
    "representable unit width survives actual GLB",
    nclose(positions[3] - positions[0], 1),
  );
  for (const invalid of [
    unit(1e8),
    mesh([1e8, 0, 0, 1e8 + 1, 1, 0, 1e8, 2, 0]),
    // Source twice-area is -4; Float32 X offsets 0,8,8 give twice-area +8.
    mesh([1e8 + 3, 0, 0, 1e8 + 5, 1, 0, 1e8 + 11, 2, 0]),
  ])
    TestValidator.predicate(
      "new face loss or inversion refuses",
      throwsError(() => document(invalid)),
    );

  const pole = mesh([1, 0, 0, 1 + 1e-12, 0, 0, 1, 1, 0]);
  TestValidator.equals(
    "source pole has a known redundant ordinal",
    inspectAutoMovieMeshTopology(pole).degenerateTriangles,
    [0],
  );
  document(pole);
  const midpoint = 1 + 2 ** -24,
    delta = 2 ** -40;
  const swapped = mesh([
    midpoint - delta,
    0,
    0,
    midpoint + delta,
    0,
    0,
    midpoint - delta,
    1,
    0,
    1e8,
    0,
    0,
    1e8 + 1,
    0,
    0,
    1e8,
    1,
    0,
  ]);
  const sourceReport = inspectAutoMovieMeshTopology(swapped);
  const roundedReport = inspectAutoMovieMeshTopology({
    ...swapped,
    positions: Array.from(new Float32Array(swapped.positions)),
  });
  TestValidator.equals(
    "aggregate count hides different lost faces",
    [sourceReport.degenerate, roundedReport.degenerate],
    [1, 1],
  );
  TestValidator.equals(
    "redundancy is a face identity",
    [sourceReport.degenerateTriangles, roundedReport.degenerateTriangles],
    [[0], [1]],
  );
  TestValidator.predicate(
    "new loss cannot borrow an old pole exemption",
    throwsError(() => document(swapped)),
  );

  const planes = (gap: number) =>
    mesh([
      0,
      0,
      1e5,
      1,
      0,
      1e5,
      0,
      1,
      1e5,
      0,
      0,
      1e5 + gap,
      1,
      0,
      1e5 + gap,
      0,
      1,
      1e5 + gap,
    ]);
  document(planes(0.01));
  TestValidator.predicate(
    "quantized open surfaces must retain edge topology",
    throwsError(() => document(planes(0.001))),
  );
  const implicit = portraitMeshBuffers({ ...unit(0), indices: null });
  TestValidator.equals(
    "implicit indices are resident",
    Array.from(implicit.indices),
    [0, 1, 2],
  );
  TestValidator.equals(
    "absent normal attribute stays absent",
    implicit.normals,
    null,
  );
  TestValidator.equals(
    "empty buffer population",
    Array.from(portraitMeshBuffers(mesh([])).positions),
    [],
  );
  portraitMeshBuffers({ ...unit(0), normals: [0, 0, 1, 0, 0, 1, 0, 0, 1] });
  for (const invalid of [
    mesh([0, 0, 0, 1e39, 0, 0, 0, 1, 0]),
    { ...unit(0), normals: [0, 0, 1e39, 0, 0, 1, 0, 0, 1] },
    { ...unit(0), normals: [0, 0, 1] },
  ])
    TestValidator.predicate(
      "unrepresentable resident buffers refuse",
      throwsError(() => portraitMeshBuffers(invalid)),
    );

  const far = { ...IDENTITY_TRANSFORM, translation: { x: 1e16, y: 0, z: 0 } };
  TestValidator.predicate(
    "placement loss cannot masquerade as an old pole",
    throwsError(() => document(unit(0), far)),
  );
  const small = mesh([0, 0, 0, 1e-12, 0, 0, 0, 1e-12, 0]);
  const enlarged = {
    ...IDENTITY_TRANSFORM,
    scale: { x: 1e12, y: 1e12, z: 1e12 },
  };
  document(small, enlarged);
  TestValidator.predicate(
    "enlarged source pole becomes a real face",
    throwsError(() =>
      document(small, { ...enlarged, translation: far.translation }),
    ),
  );
  document(unit(0), {
    ...IDENTITY_TRANSFORM,
    scale: { x: 1e-12, y: 1e-12, z: 1e-12 },
  });
  const turn = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };
  document(unit(0), { ...IDENTITY_TRANSFORM, rotation: turn });
  // Model-part TRS requires positive scale; the general geometry operation
  // supports baking a mirror into the resident mesh before that model boundary.
  document(
    placePortraitMesh(unit(0), {
      rotation: turn,
      scale: { x: -1, y: 2, z: 1 },
    }),
  );
  TestValidator.predicate(
    "model-part scale contract stays strict",
    throwsError(() =>
      document(unit(0), {
        ...IDENTITY_TRANSFORM,
        scale: { x: -1, y: 1, z: 1 },
      }),
    ),
  );
  placePortraitMesh({ ...unit(0), indices: null }, {});
  TestValidator.equals(
    "empty placement population",
    placePortraitMesh(mesh([]), {}).positions,
    [],
  );
};

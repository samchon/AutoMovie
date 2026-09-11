import type { IAutoMovieMesh, IAutoMovieModel } from "@automovie/interface";
import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { portraitDocument } from "../../subjects/portraitDocument";
import {
  IDENTITY_TRANSFORM,
  createModel,
  createSkeleton,
} from "../internal/fixtures";
import { nclose, throwsError } from "../internal/predicates";

/**
 * The study's portable glTF must carry the actual AutoMovie buffers, not an
 * independently reconstructed approximation. Serialization stays in memory.
 *
 * Scenarios:
 * 1. A translated triangle and a primitive survive a binary glTF round trip with
 *    their positions, material factors and resident buffers; unused finishes drop.
 * 2. A normal-free mesh keeps that optional buffer absent. Sidedness, emission,
 *    inferred transparency and explicit alpha modes/cutoffs reach the document.
 * 3. Rigs, texture bindings, rigid bone attachment, skin data and unresolved
 *    materials are refused instead of being
 *    silently flattened or dropped.
 */
export const test_subject_gltf_document = async (): Promise<void> => {
  const mesh: IAutoMovieMesh = {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2],
    uvs: null,
    skin: null,
  };
  const model = createModel(null);
  model.parts = [
    {
      ...model.parts[0],
      id: "triangle",
      geometry: { type: "mesh", mesh },
      transform: { ...IDENTITY_TRANSFORM, translation: { x: 1, y: 2, z: 3 } },
    },
    { ...model.parts[0], id: "box", material: "box-finish" },
    {
      ...model.parts[0],
      id: "normal-free",
      material: "normal-free-finish",
      geometry: { type: "mesh", mesh: { ...mesh, normals: null } },
    },
  ];
  model.materials = [
    {
      ...model.materials[0],
      doubleSided: true,
      emissive: { r: 0.1, g: 0.2, b: 0.3, a: null, hex: null },
    },
    { ...model.materials[0], id: "box-finish", opacity: 0.5 },
    {
      ...model.materials[0],
      id: "normal-free-finish",
      alphaMode: "mask",
      alphaCutoff: 0.3,
    },
    { ...model.materials[0], id: "unused" },
  ];
  const io = new NodeIO();
  const read = await io.readBinary(
    await io.writeBinary(portraitDocument(model)),
  );
  const root = read.getRoot();
  TestValidator.equals(
    "three resident material groups",
    root.listMeshes().length,
    3,
  );
  const triangle = root.listMeshes()[0].listPrimitives()[0];
  TestValidator.equals(
    "actual translated positions",
    Array.from(triangle.getAttribute("POSITION")!.getArray()!),
    [1, 2, 3, 2, 2, 3, 1, 3, 3],
  );
  TestValidator.equals(
    "explicit sidedness",
    triangle.getMaterial()!.getDoubleSided(),
    true,
  );
  TestValidator.equals(
    "default sidedness",
    root.listMeshes()[1].listPrimitives()[0].getMaterial()!.getDoubleSided(),
    false,
  );
  TestValidator.equals(
    "absent normals stay absent",
    root.listMeshes()[2].listPrimitives()[0].getAttribute("NORMAL"),
    null,
  );
  TestValidator.predicate(
    "material factor",
    triangle
      .getMaterial()!
      .getBaseColorFactor()
      .every((value, i) => nclose(value, [0.8, 0.1, 0.1, 1][i])),
  );
  TestValidator.predicate(
    "emission",
    triangle
      .getMaterial()!
      .getEmissiveFactor()
      .every((value, i) => nclose(value, [0.1, 0.2, 0.3][i])),
  );
  TestValidator.equals(
    "default opaque",
    triangle.getMaterial()!.getAlphaMode(),
    "OPAQUE",
  );
  TestValidator.equals(
    "inferred transparency",
    root.listMaterials()[1].getAlphaMode(),
    "BLEND",
  );
  TestValidator.equals(
    "explicit mask",
    root.listMaterials()[2].getAlphaMode(),
    "MASK",
  );
  TestValidator.predicate(
    "explicit cutoff",
    nclose(root.listMaterials()[2].getAlphaCutoff(), 0.3),
  );
  for (const [mode, expected] of [
    ["opaque", "OPAQUE"],
    ["blend", "BLEND"],
  ] as const) {
    const explicit = portraitDocument({
      ...model,
      parts: [model.parts[0]],
      materials: [{ ...model.materials[0], alphaMode: mode, opacity: 1 }],
    });
    TestValidator.equals(
      `explicit ${mode}`,
      explicit.getRoot().listMaterials()[0].getAlphaMode(),
      expected,
    );
  }
  const rejected = (change: Partial<IAutoMovieModel>): boolean =>
    throwsError(() => portraitDocument({ ...model, ...change }));
  TestValidator.predicate(
    "opaque alpha contradiction refused",
    rejected({
      materials: [
        { ...model.materials[0], alphaMode: "opaque", opacity: 0.25 },
        ...model.materials.slice(1),
      ],
    }),
  );
  TestValidator.predicate(
    "rig refusal",
    rejected({ skeleton: createSkeleton() }),
  );
  for (const field of [
    "metallicRoughnessTexture",
    "normalTexture",
    "occlusionTexture",
    "emissiveTexture",
  ] as const)
    TestValidator.predicate(
      `${field} refusal`,
      rejected({ materials: [{ ...model.materials[0], [field]: "photo" }] }),
    );
  TestValidator.predicate(
    "texture refusal",
    rejected({
      materials: [{ ...model.materials[0], baseColorTexture: "photo" }],
    }),
  );
  TestValidator.predicate(
    "bone attachment refusal",
    rejected({ parts: [{ ...model.parts[0], attachedBone: "head" }] }),
  );
  TestValidator.predicate(
    "skin refusal",
    rejected({
      parts: [
        {
          ...model.parts[0],
          geometry: {
            type: "mesh",
            mesh: {
              ...mesh,
              skin: {
                joints: ["head"],
                boneIndices: new Array<number>(12).fill(0),
                weights: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
              },
            },
          },
        },
      ],
    }),
  );
  TestValidator.predicate(
    "unresolved finish refusal",
    rejected({ parts: [{ ...model.parts[0], material: "missing" }] }),
  );
};

import { NodeIO } from "@gltf-transform/core";
import type {
  Clearcoat,
  IOR,
  Transmission,
  Volume,
} from "@gltf-transform/extensions";
import { TestValidator } from "@nestia/e2e";

import {
  portraitDocument,
  portraitGltfExtensions,
} from "../../subjects/portraitDocument";
import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Optical coefficients survive actual GLB serialization through their required
 * extensions. Unsupported readers fail; an open surface cannot claim a volume.
 *
 * Scenarios:
 * 1. A closed primitive round-trips transmission, IOR, thickness and clearcoat;
 *    another finish retains explicit zeros and an ordinary finish has no optics.
 * 2. Zero thickness without a transmission field emits the required neutral
 *    transmission dependency and admits an open triangle as a thin surface.
 * 3. Positive thickness on that triangle and invalid optical coefficients or
 *    alpha/transmission combinations are refused before a document is returned.
 */
export const test_subject_gltf_optics = async (): Promise<void> => {
  const model = createModel(null),
    base = model.materials[0],
    part = model.parts[0];
  model.materials = [
    {
      ...base,
      transmission: 1,
      ior: 1.376,
      thickness: 0.00055,
      clearcoat: 0.4,
    },
    {
      ...base,
      id: "zero",
      transmission: 0,
      ior: 1,
      thickness: 0,
      clearcoat: 0,
    },
    { ...base, id: "plain" },
  ];
  model.parts = model.materials.map((finish, i) => ({
    ...part,
    id: "part-" + i,
    material: finish.id,
    transform: { ...IDENTITY_TRANSFORM, translation: { x: 2 * i, y: 0, z: 0 } },
  }));
  const io = new NodeIO().registerExtensions(portraitGltfExtensions);
  const bytes = await io.writeBinary(portraitDocument(model)),
    read = await io.readBinary(bytes);
  const materials = read.getRoot().listMaterials();
  for (const [i, expected] of [
    [0, [1, 1.376, 0.00055, 0.4]],
    [1, [0, 1, 0, 0]],
  ] as const) {
    const values = [
      materials[i]
        .getExtension<Transmission>("KHR_materials_transmission")!
        .getTransmissionFactor(),
      materials[i].getExtension<IOR>("KHR_materials_ior")!.getIOR(),
      materials[i]
        .getExtension<Volume>("KHR_materials_volume")!
        .getThicknessFactor(),
      materials[i]
        .getExtension<Clearcoat>("KHR_materials_clearcoat")!
        .getClearcoatFactor(),
    ];
    TestValidator.predicate(
      "optical scalar round trip",
      values.every((value, j) => nclose(value, expected[j])),
    );
  }
  TestValidator.equals(
    "ordinary material stays ordinary",
    materials[2].listExtensions().length,
    0,
  );
  TestValidator.equals(
    "optical extensions are required",
    read.getRoot().listExtensionsRequired().length,
    4,
  );
  let unsupported = false;
  try {
    await new NodeIO().readBinary(bytes);
  } catch {
    unsupported = true;
  }
  TestValidator.equals("unsupported reader refuses", unsupported, true);
  const thin = {
    ...model,
    parts: [
      {
        ...part,
        geometry: {
          type: "mesh" as const,
          mesh: {
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            indices: [0, 1, 2],
            normals: null,
            uvs: null,
            skin: null,
          },
        },
      },
    ],
    materials: [{ ...base, thickness: 0 }],
  };
  const thinMaterial = portraitDocument(thin).getRoot().listMaterials()[0];
  TestValidator.equals(
    "implicit volume dependency",
    thinMaterial
      .getExtension<Transmission>("KHR_materials_transmission")!
      .getTransmissionFactor(),
    0,
  );
  TestValidator.predicate(
    "open positive volume refused",
    throwsError(() =>
      portraitDocument({
        ...thin,
        materials: [{ ...base, transmission: 1, thickness: 0.001 }],
      }),
    ),
  );
  for (const change of [
    { transmission: -0.01 },
    { transmission: 1.01 },
    { transmission: NaN },
    { ior: 0.99 },
    { ior: NaN },
    { thickness: -1 },
    { thickness: NaN },
    { clearcoat: -0.1 },
    { clearcoat: 1.1 },
    { clearcoat: NaN },
    { transmission: 1, alphaMode: "blend" as const },
  ])
    TestValidator.predicate(
      "invalid optics refused",
      throwsError(() =>
        portraitDocument({
          ...model,
          materials: [
            { ...model.materials[0], ...change },
            ...model.materials.slice(1),
          ],
        }),
      ),
    );
};

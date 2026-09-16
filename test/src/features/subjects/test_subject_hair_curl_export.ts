import {
  buildPortraitHairCards,
  createPortraitHairMaterial,
  exportHumanFace,
} from "@automovie/human";
import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { createModel } from "../internal/fixtures";

/**
 * Curled surface hair remains a self-contained static asset after export.
 * Scenarios:
 * 1. One authored card exports and independently reopens with its generated
 *    colour and normal PNG bytes, alpha cutoff and normal strength intact.
 * 2. The exported primitive retains UV0 and the four guide-strip triangles;
 *    painted fibres do not become additional geometry.
 */
export const test_subject_hair_curl_export = async (): Promise<void> => {
  const model = createModel(null);
  const shape = {
    material: model.materials[0].id,
    cards: [
      {
        guide: [
          [0, 0, 0],
          [0, 10, 0],
        ] as const,
        across: [
          [1, 0, 0],
          [1, 0, 0],
        ] as const,
        width: 2,
      },
    ],
    segments: 2,
    widthScale: 1,
    tipWidth: 0.5,
    seed: 9,
    fibres: 2,
    coverage: 0.8,
    fibreNormalScale: 0.4,
    fibreCurl: { amplitude: 0.2, cycles: 4.8, aspectRatio: 0.2 },
  };
  const finish = createPortraitHairMaterial(
    { ...model.materials[0], alphaCutoff: 0.3 },
    shape,
  );
  model.parts = buildPortraitHairCards({ ...shape, material: finish.id });
  model.materials = [finish];
  const output = await exportHumanFace(model);
  const root = (await new NodeIO().readBinary(output.glb)).getRoot();
  const material = root.listMaterials()[0];
  for (const [image, uri] of [
    [material.getBaseColorTexture()!.getImage()!, finish.baseColorTexture],
    [material.getNormalTexture()!.getImage()!, finish.normalTexture],
  ] as const) {
    if (typeof uri !== "string") throw new Error("Expected resident PNG");
    TestValidator.predicate(
      "resident image bytes",
      Buffer.from(image).equals(Buffer.from(uri.slice(22), "base64")),
    );
    const png = PNG.sync.read(Buffer.from(image));
    TestValidator.equals(
      "curl dimensions",
      [png.width, png.height],
      [512, 512],
    );
  }
  TestValidator.equals(
    "owned mask and normal settings",
    [
      material.getAlphaMode(),
      material.getAlphaCutoff(),
      material.getNormalScale(),
    ],
    ["MASK", 0.3, 0.4],
  );
  const primitive = root.listMeshes()[0].listPrimitives()[0];
  TestValidator.equals(
    "no per-fibre geometry",
    primitive.getIndices()!.getCount(),
    12,
  );
  TestValidator.equals(
    "portable UV0",
    primitive.getAttribute("TEXCOORD_0")!.getCount(),
    6,
  );
};

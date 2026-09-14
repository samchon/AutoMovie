import {
  buildPortraitHairCards,
  createPortraitHairTexture,
  exportHumanFace,
  portraitDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { createModel } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

/**
 * Surface hair exports its actual UVs and resident PNG rather than an opaque strip.
 * Scenarios:
 * 1. A two-interval lock emits UV0 and one shared PNG in GLB/glTF; an independent
 *    image decoder reads the stored mask. Reusing a texture deduplicates bytes.
 * 2. Missing/incomplete/nonfinite UVs, external/structured bindings and invalid
 *    PNG bytes refuse. Float32-overflow UVs refuse at the portable boundary.
 */
export const test_subject_hair_export = async (): Promise<void> => {
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
    seed: 3,
    fibres: 4,
    coverage: 0.7,
  };
  model.parts = buildPortraitHairCards(shape);
  const image = createPortraitHairTexture(3, 4, 0.7);
  model.materials[0] = {
    ...model.materials[0],
    baseColorTexture: image,
    alphaMode: "mask",
    alphaCutoff: 0.45,
    doubleSided: true,
  };
  const document = portraitDocument(model),
    root = document.getRoot();
  TestValidator.equals("one PNG", root.listTextures().length, 1);
  TestValidator.equals(
    "mask dimensions",
    PNG.sync.read(Buffer.from(root.listTextures()[0].getImage()!)).width,
    128,
  );
  TestValidator.equals(
    "UV0 survives",
    Array.from(
      root
        .listMeshes()[0]
        .listPrimitives()[0]
        .getAttribute("TEXCOORD_0")!
        .getArray()!,
    ),
    [0, 0, 1, 0, 0, 0.5, 1, 0.5, 0, 1, 1, 1],
  );
  TestValidator.equals(
    "alpha mode",
    root.listMaterials()[0].getAlphaMode(),
    "MASK",
  );
  const bytes = await exportHumanFace(model);
  TestValidator.predicate("GLB contains binary", bytes.glb.length > 100);
  TestValidator.predicate(
    "glTF resources contain PNG",
    Object.values(bytes.gltf.resources).some(
      (b) => b[0] === 137 && b[1] === 80,
    ),
  );
  const duplicate = structuredClone(model);
  duplicate.materials.push({ ...duplicate.materials[0], id: "second" });
  duplicate.parts.push({
    ...structuredClone(duplicate.parts[0]),
    id: "second",
    material: "second",
  });
  TestValidator.equals(
    "PNG deduplicated",
    portraitDocument(duplicate).getRoot().listTextures().length,
    1,
  );
  for (const binding of [
    "https://example.com/hair.png",
    "data:image/png;base64,AAAA",
    { asset: image, texCoord: 0, colorSpace: "srgb" as const },
  ]) {
    const bad = structuredClone(model);
    bad.materials[0].baseColorTexture = binding;
    TestValidator.predicate(
      "unsupported texture",
      throwsError(() => portraitDocument(bad)),
    );
  }
  for (const offset of [12, 16, 20]) {
    const broken = Buffer.from(image.slice(22), "base64");
    broken.fill(0, offset, offset + 4);
    const bad = structuredClone(model);
    bad.materials[0].baseColorTexture =
      "data:image/png;base64," + broken.toString("base64");
    TestValidator.predicate(
      "invalid PNG header",
      throwsError(() => portraitDocument(bad)),
    );
  }
  for (const uvs of [
    null,
    [0, 0],
    [0, 0, 1, 0, 0, 1, NaN, 0, 1, 1, 1, 1],
    [0, 0, 1, 0, 0, 1, 1e100, 0, 1, 1, 1, 1],
  ]) {
    const bad = structuredClone(model);
    if (bad.parts[0].geometry.type !== "mesh") throw new Error("Expected card");
    bad.parts[0].geometry.mesh.uvs = uvs;
    TestValidator.predicate(
      "invalid UVs",
      throwsError(() => portraitDocument(bad)),
    );
  }
};

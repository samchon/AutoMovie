import {
  createPortraitHairNormalTexture,
  exportHumanFace,
  portraitDocument,
} from "@automovie/human";
import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { createModel } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

/**
 * Resident normal PNGs survive the portable boundary in their own linear slot.
 * Scenarios:
 * 1. A hand-authored UV triangle exports and independently reopens with the
 *    same PNG bytes, UV0 and positive, zero, negative or default normal scale.
 * 2. Reusing one resident image in two slots deduplicates its pixel bytes.
 * 3. External/structured bindings, malformed PNG, missing UV and nonfinite
 *    scale refuse beside the admitted normal-only material.
 */
export const test_subject_hair_normal_export = async (): Promise<void> => {
  const model = createModel(null);
  model.parts[0].geometry = {
    type: "mesh",
    mesh: {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
      uvs: [0, 0, 1, 0, 0, 1],
      skin: null,
    },
  };
  const uri = createPortraitHairNormalTexture(1, 1, 1);
  model.materials[0].normalTexture = uri;
  const io = new NodeIO();
  for (const scale of [undefined, 0, 0.4, -1]) {
    model.materials[0].normalScale = scale;
    const output = await exportHumanFace(model);
    const root = (await io.readBinary(output.glb)).getRoot();
    const material = root.listMaterials()[0];
    TestValidator.equals(
      "normal strength",
      material.getNormalScale(),
      scale ?? 1,
    );
    TestValidator.equals(
      "no colour map invented",
      material.getBaseColorTexture(),
      null,
    );
    TestValidator.equals(
      "normal image bytes",
      Array.from(material.getNormalTexture()!.getImage()!),
      Array.from(Buffer.from(uri.slice(22), "base64")),
    );
    TestValidator.equals(
      "normal RGB decodes",
      PNG.sync.read(Buffer.from(material.getNormalTexture()!.getImage()!))
        .width,
      128,
    );
    TestValidator.equals(
      "clamped UV0 sampler",
      [
        material.getNormalTextureInfo()!.getTexCoord(),
        material.getNormalTextureInfo()!.getWrapS(),
        material.getNormalTextureInfo()!.getWrapT(),
      ],
      [0, 33071, 33071],
    );
    TestValidator.equals(
      "portable UV coordinates",
      Array.from(
        root
          .listMeshes()[0]
          .listPrimitives()[0]
          .getAttribute("TEXCOORD_0")!
          .getArray()!,
      ),
      [0, 0, 1, 0, 0, 1],
    );
    TestValidator.predicate(
      "glTF preserves normal slot",
      output.gltf.json.materials![0].normalTexture !== undefined,
    );
  }
  const shared = structuredClone(model);
  shared.materials[0].baseColorTexture = uri;
  TestValidator.equals(
    "shared pixel bytes",
    portraitDocument(shared).getRoot().listTextures().length,
    1,
  );
  for (const binding of [
    "https://example.com/normal.png",
    "data:image/png;base64,AAAA",
    { asset: uri, texCoord: 0, colorSpace: "linear" as const },
  ]) {
    const bad = structuredClone(model);
    bad.materials[0].normalTexture = binding;
    TestValidator.predicate(
      "unsupported normal binding",
      throwsError(() => portraitDocument(bad)),
    );
  }
  const missing = structuredClone(model);
  if (missing.parts[0].geometry.type !== "mesh")
    throw new Error("Expected triangle");
  missing.parts[0].geometry.mesh.uvs = null;
  TestValidator.predicate(
    "normal map requires UV",
    throwsError(() => portraitDocument(missing)),
  );
  const invalidScale = structuredClone(model);
  invalidScale.materials[0].normalScale = NaN;
  TestValidator.predicate(
    "finite scale required",
    throwsError(() => portraitDocument(invalidScale)),
  );
};

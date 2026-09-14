import { exportHumanFace, portraitGltfExtensions } from "@automovie/human";
import { WebIO } from "@gltf-transform/core";
import type { IOR } from "@gltf-transform/extensions";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/**
 * The face package owns both glTF document creation and serialization so a
 * consumer crosses the module boundary with bytes, not class-instance state.
 *
 * Scenarios:
 * 1. GLB and glTF/resources round-trip a triangle's three actual positions and
 *    its optical material through an independent reader without changing input.
 * 2. Repeated exports are byte-identical for the same model in one runtime.
 * 3. Unsupported texture input rejects before any portable result is returned.
 */
export const test_subject_human_export = async (): Promise<void> => {
  const model = createModel(null);
  model.parts[0].geometry = {
    type: "mesh",
    mesh: {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      normals: null,
      uvs: null,
      skin: null,
    },
  };
  model.materials[0].ior = 1.376;
  const original = structuredClone(model);
  const exported = await exportHumanFace(model);
  const reader = new WebIO().registerExtensions(portraitGltfExtensions);
  for (const document of [
    await reader.readBinary(exported.glb),
    await reader.readJSON(exported.gltf),
  ]) {
    const primitive = document.getRoot().listMeshes()[0].listPrimitives()[0];
    TestValidator.equals(
      "resident position count",
      primitive.getAttribute("POSITION")!.getCount(),
      3,
    );
    const positions = [0, 1, 2].flatMap((index) =>
      primitive.getAttribute("POSITION")!.getElement(index, [0, 0, 0]),
    );
    TestValidator.predicate(
      "actual metric positions",
      positions.every((value, i) =>
        nclose(value, [0, 0, 0, 1, 0, 0, 0, 1, 0][i]),
      ),
    );
    TestValidator.equals(
      "resident triangle",
      primitive.getIndices()!.getCount(),
      3,
    );
    TestValidator.predicate(
      "optical extension preserved",
      nclose(
        primitive
          .getMaterial()!
          .getExtension<IOR>("KHR_materials_ior")!
          .getIOR(),
        1.376,
      ),
    );
  }
  const repeated = await exportHumanFace(model);
  TestValidator.equals(
    "repeat binary",
    Array.from(repeated.glb),
    Array.from(exported.glb),
  );
  TestValidator.equals("input stays owned by caller", model, original);
  model.materials[0].baseColorTexture = "unsupported";
  let refusal: unknown;
  try {
    await exportHumanFace(model);
  } catch (error) {
    refusal = error;
  }
  TestValidator.predicate(
    "static export admission preserved",
    refusal instanceof Error &&
      refusal.message.includes("resident PNG data URIs"),
  );
};

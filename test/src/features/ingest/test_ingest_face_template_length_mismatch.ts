import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * A delta array whose length disagrees with the resting face is a corrupt
 * asset; importing it would defer the failure to morph time on some parameters
 * only, so the import throws up front.
 *
 * Scenario: a 3-component POSITION with a 6-component `identity` delta throws.
 */
export const test_ingest_face_template_length_mismatch = (): void => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (array: number[]) =>
    doc
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array(array))
      .setBuffer(buffer);

  const prim = doc.createPrimitive().setAttribute("POSITION", acc([0, 0, 0]));
  prim.addTarget(
    doc
      .createPrimitiveTarget("identity")
      .setAttribute("POSITION", acc([1, 0, 0, 0, 1, 0])),
  );
  doc.createMesh("face").addPrimitive(prim);

  TestValidator.predicate(
    "mismatched delta length throws",
    throwsError(
      () => ingestFaceTemplate(doc),
      ['morph target "identity"', "6 components", "expected 3"],
    ),
  );
};

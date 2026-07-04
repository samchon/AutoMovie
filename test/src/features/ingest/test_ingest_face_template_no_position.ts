import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

/**
 * Defective morph geometry throws rather than degrades: a morphed primitive
 * must carry a resting POSITION, and every target must carry POSITION deltas.
 *
 * Scenario: a named target without POSITION deltas (on a primitive that has
 * resting positions) throws.
 */
export const test_ingest_face_template_no_position = (): void => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive().setAttribute(
    "POSITION",
    doc
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array([0, 0, 0]))
      .setBuffer(buffer),
  );
  prim.addTarget(doc.createPrimitiveTarget("identity"));
  doc.createMesh("face").addPrimitive(prim);

  TestValidator.error("target without deltas throws", () =>
    ingestFaceTemplate(doc),
  );
};

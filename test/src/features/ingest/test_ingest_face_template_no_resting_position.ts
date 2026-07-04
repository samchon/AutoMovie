import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

/**
 * A morphed primitive without a resting POSITION has deltas but nothing to
 * apply them to ??the negative twin of the happy path's POSITION carry-over,
 * one attribute away.
 *
 * Scenario: a primitive carrying only a named morph target (no POSITION)
 * throws.
 */
export const test_ingest_face_template_no_resting_position = (): void => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive();
  prim.addTarget(
    doc.createPrimitiveTarget("identity").setAttribute(
      "POSITION",
      doc
        .createAccessor()
        .setType("VEC3")
        .setArray(new Float32Array([1, 0, 0]))
        .setBuffer(buffer),
    ),
  );
  doc.createMesh("face").addPrimitive(prim);

  TestValidator.error("primitive without POSITION throws", () =>
    ingestFaceTemplate(doc),
  );
};

import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

/**
 * A document with no morphed primitive cannot become a face template ??a silent
 * empty template would let the editor "succeed" on a prop or an unrigged head,
 * so the import throws.
 *
 * Scenario: a document holding only a target-less mesh primitive throws.
 */
export const test_ingest_face_template_no_morphs = (): void => {
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
  doc.createMesh("prop").addPrimitive(prim);

  TestValidator.error("no morphed primitive throws", () =>
    ingestFaceTemplate(doc),
  );
};

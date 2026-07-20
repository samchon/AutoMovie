import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

/**
 * Many exporters (and three.js) leave glTF morph targets unnamed and put the
 * names in `mesh.extras.targetNames` instead. The import must fall back to that
 * convention per index, while a target that does carry its own name keeps it
 * over the extras entry.
 *
 * Scenario: target #0 is unnamed but extras lists "identity"; target #1 is
 * named "jawWidth" while extras lists "WRONG" at its index: the template keys
 * come out ["identity", "jawWidth"].
 */
export const test_ingest_face_template_extras_names = (): void => {
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
    doc.createPrimitiveTarget().setAttribute("POSITION", acc([1, 0, 0])),
  );
  prim.addTarget(
    doc
      .createPrimitiveTarget("jawWidth")
      .setAttribute("POSITION", acc([0, 1, 0])),
  );
  doc
    .createMesh("face")
    .addPrimitive(prim)
    .setExtras({ targetNames: ["identity", "WRONG"] });

  const template = ingestFaceTemplate(doc);
  TestValidator.equals(
    "extras fallback + own-name precedence",
    Object.keys(template.targets).sort((a, b) => a.localeCompare(b)),
    ["identity", "jawWidth"],
  );
};

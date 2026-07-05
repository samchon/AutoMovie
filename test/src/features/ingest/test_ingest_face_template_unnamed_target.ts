import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * A morph target that can be named neither from the target itself nor from
 * `mesh.extras.targetNames` is unreachable by any parameter document, so the
 * import throws instead of inventing or dropping a key.
 *
 * Scenario: one unnamed target with no extras on the mesh throws.
 */
export const test_ingest_face_template_unnamed_target = (): void => {
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
  doc.createMesh("face").addPrimitive(prim);

  TestValidator.predicate(
    "unnameable target throws",
    throwsError(() => ingestFaceTemplate(doc), "morph target #0 has no name"),
  );
};

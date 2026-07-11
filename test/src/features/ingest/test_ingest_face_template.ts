import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

/**
 * The happy path of the face-template import: a primitive carrying POSITION
 * plus named morph targets maps onto the flat-array template verbatim — resting
 * positions from POSITION, each delta array keyed by its target's own name. A
 * plain (target-less) mesh earlier in the document must be skipped, pinning the
 * "first MORPHED primitive" selection rule.
 *
 * Scenario: a `plain` mesh without targets followed by a `face` mesh whose
 * primitive has positions [0,0,0, 1,1,1] and targets `identity` / `eyeSize`;
 * the result reproduces both arrays exactly and only those two keys.
 */
export const test_ingest_face_template = (): void => {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const acc = (array: number[]) =>
    doc
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array(array))
      .setBuffer(buffer);

  const plain = doc.createPrimitive().setAttribute("POSITION", acc([9, 9, 9]));
  doc.createMesh("plain").addPrimitive(plain);

  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", acc([0, 0, 0, 1, 1, 1]));
  prim.addTarget(
    doc
      .createPrimitiveTarget("identity")
      .setAttribute("POSITION", acc([0.5, 0, 0, 0, 0.5, 0])),
  );
  prim.addTarget(
    doc
      .createPrimitiveTarget("eyeSize")
      .setAttribute("POSITION", acc([0, 0.25, 0, 0, 0, 0.25])),
  );
  doc.createMesh("face").addPrimitive(prim);

  const template = ingestFaceTemplate(doc);
  TestValidator.equals("positions", template.positions, [0, 0, 0, 1, 1, 1]);
  TestValidator.equals(
    "target names",
    Object.keys(template.targets).sort((a, b) => a.localeCompare(b)),
    ["eyeSize", "identity"],
  );
  TestValidator.equals(
    "identity deltas",
    template.targets["identity"],
    [0.5, 0, 0, 0, 0.5, 0],
  );
  TestValidator.equals(
    "eyeSize deltas",
    template.targets["eyeSize"],
    [0, 0.25, 0, 0, 0, 0.25],
  );
};

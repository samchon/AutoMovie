import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Defective morph geometry throws rather than degrades: a morphed primitive
 * must carry a resting POSITION, and every target must carry POSITION deltas.
 *
 * Scenario: a named target without POSITION deltas (on a primitive that has
 * resting positions) throws; a target POSITION accessor without backing array
 * data throws before morphing can defer the failure.
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

  TestValidator.predicate(
    "target without deltas throws",
    throwsError(
      () => ingestFaceTemplate(doc),
      'morph target "identity" has no POSITION deltas',
    ),
  );

  const noDeltaData = new Document();
  const noDeltaDataBuffer = noDeltaData.createBuffer();
  const noDeltaDataPrim = noDeltaData.createPrimitive().setAttribute(
    "POSITION",
    noDeltaData
      .createAccessor()
      .setType("VEC3")
      .setArray(new Float32Array([0, 0, 0]))
      .setBuffer(noDeltaDataBuffer),
  );
  noDeltaDataPrim.addTarget(
    noDeltaData
      .createPrimitiveTarget("identity")
      .setAttribute(
        "POSITION",
        noDeltaData
          .createAccessor()
          .setType("VEC3")
          .setBuffer(noDeltaDataBuffer),
      ),
  );
  noDeltaData.createMesh("face").addPrimitive(noDeltaDataPrim);

  TestValidator.predicate(
    "target without delta array throws",
    throwsError(
      () => ingestFaceTemplate(noDeltaData),
      ['morph target "identity"', "POSITION accessor", "no array data"],
    ),
  );
};

import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * A morphed primitive without a resting POSITION has deltas but nothing to
 * apply them to — the negative twin of the happy path's POSITION carry-over,
 * one attribute away.
 *
 * Scenario: a primitive carrying only a named morph target (no POSITION)
 * throws; a POSITION accessor without backing array data also throws.
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

  TestValidator.predicate(
    "primitive without POSITION throws",
    throwsError(
      () => ingestFaceTemplate(doc),
      "morphed primitive has no POSITION attribute",
    ),
  );

  const noRestData = new Document();
  const noRestDataBuffer = noRestData.createBuffer();
  const noRestDataPrim = noRestData
    .createPrimitive()
    .setAttribute(
      "POSITION",
      noRestData.createAccessor().setType("VEC3").setBuffer(noRestDataBuffer),
    );
  noRestDataPrim.addTarget(
    noRestData.createPrimitiveTarget("identity").setAttribute(
      "POSITION",
      noRestData
        .createAccessor()
        .setType("VEC3")
        .setArray(new Float32Array([1, 0, 0]))
        .setBuffer(noRestDataBuffer),
    ),
  );
  noRestData.createMesh("face").addPrimitive(noRestDataPrim);

  TestValidator.predicate(
    "primitive POSITION without array throws",
    throwsError(
      () => ingestFaceTemplate(noRestData),
      ["morphed primitive POSITION accessor", "no array data"],
    ),
  );
};

import { ingestFaceTemplate } from "@automovie/ingest";
import { Document } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Two morph targets resolving to the SAME name are a structural defect: the
 * record write would silently keep only the last sculpt, so the template no
 * longer matches the asset, the degradation the throw-on-structural-defect
 * contract forbids (#1105). The import throws, naming both indices.
 *
 * Scenarios:
 *
 * 1. Two targets both named "smile" (via `mesh.extras.targetNames`) throw with the
 *    duplicate and the first index named.
 * 2. Negative twin: names one character apart ("smile", "smild") ingest fine and
 *    carry both deltas.
 */
export const test_ingest_face_template_duplicate_name = (): void => {
  const build = (names: [string, string]): Document => {
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
      doc.createPrimitiveTarget().setAttribute("POSITION", acc([0, 2, 0])),
    );
    doc.createMesh("face").addPrimitive(prim).setExtras({ targetNames: names });
    return doc;
  };

  // 1. duplicate names throw with both indices named
  TestValidator.predicate(
    "duplicate morph-target name throws",
    throwsError(
      () => ingestFaceTemplate(build(["smile", "smile"])),
      'morph target #1 duplicates name "smile" (first at #0)',
    ),
  );

  // 2. negative twin: distinct names one character apart ingest fine
  const template = ingestFaceTemplate(build(["smile", "smild"]));
  TestValidator.equals(
    "distinct names carry both deltas",
    [template.targets["smile"], template.targets["smild"]],
    [
      [1, 0, 0],
      [0, 2, 0],
    ],
  );
};

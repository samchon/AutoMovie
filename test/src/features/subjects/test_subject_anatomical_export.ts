import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { portraitDocument } from "../../subjects/portraitDocument";
import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../../subjects/reference-anatomy/model";
import { nclose } from "../internal/predicates";

/**
 * The full anatomical prior reaches the real document/GLB consumer with valid
 * optical normals, independently of the active measured portrait's optics.
 *
 * Scenarios:
 * 1. Export the unrefined prior and reimport every material NORMAL accessor;
 *    all directions remain unit, including the six optical parts' pole rows.
 */
export const test_subject_anatomical_export = async (): Promise<void> => {
  const model = buildAnatomicalStudy({
    ...anatomicalStudyShape,
    subdivisionRounds: 0,
  });
  const io = new NodeIO();
  const document = await io.readBinary(
    await io.writeBinary(portraitDocument(model)),
  );
  for (const mesh of document.getRoot().listMeshes()) {
    const normals = mesh
      .listPrimitives()[0]
      .getAttribute("NORMAL")!
      .getArray()!;
    for (let i = 0; i < normals.length; i += 3)
      TestValidator.predicate(
        "delivered unit NORMAL",
        nclose(Math.hypot(normals[i], normals[i + 1], normals[i + 2]), 1, 1e-7),
      );
  }
};

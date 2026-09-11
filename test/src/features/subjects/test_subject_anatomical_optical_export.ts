import { NodeIO } from "@gltf-transform/core";
import { TestValidator } from "@nestia/e2e";

import { portraitDocument } from "../../subjects/portraitDocument";
import {
  anatomicalStudyShape,
  buildAnatomicalStudy,
} from "../../subjects/reference-anatomy/model";
import { nclose } from "../internal/predicates";

/**
 * Every non-skin/lip part of the anatomical prior reaches actual binary glTF
 * with unit normals, including optical poles. This is the complementary
 * population to anatomical_export, rather than a selected sample of vertices.
 *
 * Scenarios:
 * 1. Build the unrefined prior, export all non-skin/lip parts, and inspect every
 *    returned NORMAL vector after a binary round trip.
 * 2. The same predicate rejects an injected zero vector, showing that a pole
 *    cannot pass merely because its triangles are collapsed.
 */
export const test_subject_anatomical_optical_export =
  async (): Promise<void> => {
    const model = buildAnatomicalStudy({
      ...anatomicalStudyShape,
      subdivisionRounds: 0,
    });
    model.parts = model.parts.filter(
      (part) => part.material !== "skin" && part.material !== "lips",
    );
    TestValidator.predicate(
      "complementary population exists",
      model.parts.length > 0,
    );
    const io = new NodeIO();
    const document = await io.readBinary(
      await io.writeBinary(portraitDocument(model)),
    );
    const unit = (normals: ArrayLike<number>) => {
      for (let i = 0; i < normals.length; i += 3)
        if (
          !nclose(
            Math.hypot(normals[i], normals[i + 1], normals[i + 2]),
            1,
            1e-7,
          )
        )
          return false;
      return true;
    };
    for (const mesh of document.getRoot().listMeshes())
      TestValidator.predicate(
        "all delivered optical directions are unit",
        unit(mesh.listPrimitives()[0].getAttribute("NORMAL")!.getArray()!),
      );
    TestValidator.equals("zero pole is rejected", unit([0, 0, 0]), false);
  };

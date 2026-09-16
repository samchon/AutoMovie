import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import { skinColourRegion } from "../internal/skinColourFixture";

/**
 * The document reaches actual skin meshes, not a renderer-only override.
 *
 * Scenarios:
 * 1. A wide reference-bound region gives head, lids and pinnae resident RGB
 *    while other tissues receive no pigmentation attribute and the input
 *    document stays unchanged.
 */
export const test_subject_human_skin_colour_model = (): void => {
  const doc = coarseHumanFaceFixture("skin-colour-consumer");
  doc.expression = { lipPart: 10 };
  doc.detail = {
    skinColour: [{ ...skinColourRegion(), radius: [1000, 1000, 1000] }],
  };
  const before = structuredClone(doc),
    colored = buildHumanFace(doc, 0);
  TestValidator.equals("input retained", doc, before);
  for (const part of colored.parts) {
    TestValidator.predicate("resident mesh", part.geometry.type === "mesh");
    if (part.geometry.type !== "mesh") continue;
    const mesh = part.geometry.mesh;
    if (part.material === "skin") {
      TestValidator.equals(
        "complete skin RGB",
        mesh.colors!.length,
        mesh.positions.length,
      );
      TestValidator.predicate(
        "nonwhite skin",
        mesh.colors!.some((v) => v < 1),
      );
    } else
      TestValidator.equals(
        "other tissues have no pigment",
        mesh.colors,
        undefined,
      );
  }
};

import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";
import { skinColourRegion } from "../internal/skinColourFixture";

/**
 * An explicitly empty colour population clears inherited pigmentation.
 *
 * Scenarios:
 * 1. A coloured basis plus a [] detail override builds no RGB attributes.
 */
export const test_subject_human_skin_colour_empty = (): void => {
  const doc = coarseHumanFaceFixture("empty-skin-colour");
  doc.basis.recipe.skinColour = [skinColourRegion()];
  doc.detail = { skinColour: [] };
  const model = buildHumanFace(doc, 0);
  TestValidator.predicate(
    "empty removes inherited colours",
    model.parts.every(
      (p) => p.geometry.type !== "mesh" || p.geometry.mesh.colors === undefined,
    ),
  );
};

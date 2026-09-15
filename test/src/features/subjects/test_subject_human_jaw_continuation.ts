import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";

/**
 * The document builder actually uses reference continuation during jaw motion.
 *
 * Scenarios:
 * 1. A coarse complete face at the maximum authored jaw angle constructs with
 *    its unchanged neck recipe, resident oral parts and finite metric skin.
 */
export const test_subject_human_jaw_continuation = (): void => {
  const document = coarseHumanFaceFixture("jaw-continuation-unit");
  document.basis.bindings.jawHinge = { x: 0, y: 0, z: -45 };
  document.expression = { jawOpen: 25, lipPart: 12 };
  const model = buildHumanFace(document, 0);
  TestValidator.predicate(
    "performed anatomy",
    ["head", "lips", "oral-cavity"].every((id) =>
      model.parts.some((p) => p.id === id),
    ),
  );
  TestValidator.predicate(
    "finite metric output",
    model.parts.every(
      (p) =>
        p.geometry.type !== "mesh" ||
        p.geometry.mesh.positions.every(
          (v) => Number.isFinite(v) && Math.abs(v) < 1,
        ),
    ),
  );
  TestValidator.equals("no neck rewrite", document.detail?.neck, undefined);
};

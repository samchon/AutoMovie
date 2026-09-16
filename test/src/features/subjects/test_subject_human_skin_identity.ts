import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Zero skin condition preserves earlier numerical face documents.
 *
 * Scenarios:
 * 1. An omitted skin profile and explicit zero laxity/creasing build exactly
 *    the same face, including materials and component geometry.
 */
export const test_subject_human_skin_identity = (): void => {
  const doc = coarseHumanFaceFixture("taut-face"),
    baseline = buildHumanFace(doc, 0);
  doc.detail = { skin: { laxity: 0, expressionCreasing: 0 } };
  TestValidator.equals(
    "zero condition legacy geometry",
    buildHumanFace(doc, 0),
    baseline,
  );
};

import { buildHumanFace } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { coarseHumanFaceFixture } from "../internal/humanFaceFixture";

/**
 * Completed face construction still owes resident-model validation.
 *
 * Scenarios:
 * 1. An explicitly empty base palette leaves anatomical material references unresolved.
 * 2. The final model guard refuses it rather than returning a partially valid asset.
 *    test_subject_human_model is the adjacent valid-palette twin.
 */
export const test_subject_human_model_refusal = (): void => {
  const document = coarseHumanFaceFixture("missing-palette");
  document.appearance = [];
  let message = "";
  try {
    buildHumanFace(document, 0);
  } catch (error) {
    message = (error as Error).message;
  }
  TestValidator.predicate(
    "final model admission rejects missing materials",
    message.startsWith("The constructed face is not a valid resident model:"),
  );
};

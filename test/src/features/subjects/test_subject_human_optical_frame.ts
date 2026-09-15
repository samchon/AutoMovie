import {
  humanFaceRegionValue,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  serializeHumanFaceDocument,
} from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { humanFaceFixture } from "../internal/humanFaceFixture";
import { throwsError } from "../internal/predicates";

/**
 * A radial optical frame is saved anatomy, not an editor-only preview choice.
 *
 * Scenarios:
 * 1. A unilateral radial profile round-trips without altering the other eye;
 *    clearing the override restores omission, and explicit head-plane persists.
 * 2. An unsupported optical frame refuses at JSON admission.
 */
export const test_subject_human_optical_frame = (): void => {
  const original = humanFaceFixture(),
    value = humanFaceRegionValue(original, "eye")!;
  const changed = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "eye",
    side: "left",
    value: { ...value, opticalFrame: "radial" },
  });
  TestValidator.equals(
    "radial JSON exact",
    parseHumanFaceDocument(serializeHumanFaceDocument(changed)),
    changed,
  );
  TestValidator.equals(
    "left radial",
    humanFaceRegionValue(changed, "eye", "left")!.opticalFrame,
    "radial",
  );
  TestValidator.equals(
    "right inherited",
    humanFaceRegionValue(changed, "eye", "right")!.opticalFrame,
    undefined,
  );
  const reset = replaceHumanFaceRegion({
    document: changed,
    basisId: changed.basis.id,
    region: "eye",
    side: "left",
    value: undefined,
  });
  TestValidator.equals(
    "reset omission",
    humanFaceRegionValue(reset, "eye", "left")!.opticalFrame,
    undefined,
  );
  const legacy = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "eye",
    value: { ...value, opticalFrame: "head-plane" },
  });
  TestValidator.equals(
    "explicit old JSON",
    parseHumanFaceDocument(serializeHumanFaceDocument(legacy)),
    legacy,
  );
  Object.assign(legacy.detail!.eye!, { opticalFrame: "invalid" });
  TestValidator.predicate(
    "unknown optical frame refuses",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(legacy))),
  );
};

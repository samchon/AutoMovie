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
 * Reference sphere alignment is a saved eye-profile choice, including unilateral
 * edits. A missing choice remains missing rather than being written as a default.
 *
 * Scenarios:
 * 1. A left observation-ray profile saves and reloads without changing the
 *    right inherited eye; clearing that profile restores its omission.
 * 2. The explicit legacy mode also round-trips, while an unknown mode refuses
 *    through the actual JSON schema before constructing geometry.
 */
export const test_subject_human_eye_sphere_fit = (): void => {
  const original = humanFaceFixture();
  const value = {
    ...humanFaceRegionValue(original, "eye")!,
    sphereFit: "observation-ray" as const,
  };
  const changed = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "eye",
    side: "left",
    value,
  });
  TestValidator.equals(
    "selected profile round trip",
    parseHumanFaceDocument(serializeHumanFaceDocument(changed)),
    changed,
  );
  TestValidator.equals(
    "left choice",
    humanFaceRegionValue(changed, "eye", "left")!.sphereFit,
    "observation-ray",
  );
  TestValidator.equals(
    "right still inherited",
    humanFaceRegionValue(changed, "eye", "right")!.sphereFit,
    undefined,
  );
  const reset = replaceHumanFaceRegion({
    document: changed,
    basisId: original.basis.id,
    region: "eye",
    side: "left",
    value: undefined,
  });
  TestValidator.equals(
    "restore omission",
    humanFaceRegionValue(reset, "eye", "left")!.sphereFit,
    undefined,
  );
  const legacy = replaceHumanFaceRegion({
    document: original,
    basisId: original.basis.id,
    region: "eye",
    value: { ...value, sphereFit: "aperture-plane" },
  });
  TestValidator.equals(
    "explicit legacy schema",
    parseHumanFaceDocument(serializeHumanFaceDocument(legacy)),
    legacy,
  );
  const invalid = structuredClone(legacy);
  Object.assign(invalid.detail!.eye!, { sphereFit: "invalid" });
  TestValidator.predicate(
    "unknown mode schema refuses",
    throwsError(() => parseHumanFaceDocument(JSON.stringify(invalid))),
  );
  TestValidator.equals("caller omission kept", original.detail, undefined);
};

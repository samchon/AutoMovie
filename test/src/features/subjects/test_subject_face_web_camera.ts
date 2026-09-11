import { TestValidator } from "@nestia/e2e";

import {
  portraitWebCamera,
  portraitWebFocusIds,
  portraitWebModes,
} from "../../../scripts/face-review/web/logic.mjs";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Inspection cameras preserve the export frame and focus only resident geometry.
 * Scenarios:
 * 1. Front, opposing profiles and vertical positions agree with hand-set axes;
 *    a translated oblique preserves its independently calculated distance.
 * 2. Eye, nasal and oral target selection excludes unrelated similarly named
 *    parts, refuses a missing target and never invents an absent component.
 */
export const test_subject_face_web_camera = (): void => {
  for (const [yaw, pitch, expected] of [
    [0, 0, [1, 2, 5]],
    [90, 0, [3, 2, 3]],
    [-90, 0, [-1, 2, 3]],
    [180, 0, [1, 2, 1]],
    [0, 90, [1, 4, 3]],
    [0, -90, [1, 0, 3]],
    [45, 0, [1 + Math.SQRT2, 2, 3 + Math.SQRT2]],
  ] as const) {
    const actual = portraitWebCamera([1, 2, 3], 2, yaw, pitch);
    TestValidator.predicate(
      "Y-up camera convention",
      actual.every((value, index) => nclose(value, expected[index])),
    );
  }
  TestValidator.equals(
    "zero radius",
    portraitWebCamera([1, 2, 3], 0, 20, 30),
    [1, 2, 3],
  );
  const ids = [
    "head",
    "left-eyelids",
    "right-eyelids",
    "nose-core",
    "nose-join",
    "nasal-interior",
    "lips",
    "oral-cavity",
    "tooth-upper-arch",
    "hair",
    "not-nose-core",
    "lips-extra",
  ];
  TestValidator.equals("eye focus", portraitWebFocusIds(ids, "eyes"), [
    "left-eyelids",
    "right-eyelids",
  ]);
  TestValidator.equals("nasal focus", portraitWebFocusIds(ids, "nose"), [
    "nose-core",
    "nose-join",
    "nasal-interior",
  ]);
  TestValidator.equals(
    "resident basic nasal interior",
    portraitWebFocusIds(["head", "nostril-interiors"], "nose"),
    ["nostril-interiors"],
  );
  TestValidator.equals(
    "standalone nasal part",
    portraitWebFocusIds(["head", "nose"], "nose"),
    ["nose"],
  );
  TestValidator.equals("oral focus", portraitWebFocusIds(ids, "mouth"), [
    "lips",
    "oral-cavity",
    "tooth-upper-arch",
  ]);
  TestValidator.predicate(
    "unknown focus refuses",
    throwsError(() => portraitWebFocusIds(ids, "hair"), "Unknown close view"),
  );
  TestValidator.predicate(
    "absent focus refuses",
    throwsError(() => portraitWebFocusIds([], "nose"), "No resident parts"),
  );
  TestValidator.equals(
    "inspection modes",
    [...portraitWebModes],
    ["colour", "clay", "wireframe"],
  );
};

import { ViolationCollector, validateFace } from "@autofilm/engine";
import { TestValidator } from "@nestia/e2e";

import { makeFace } from "../internal/fixtures";

/**
 * ValidateFace composes into a larger document check: callers hand it a path
 * prefix and a shared collector (the way validateMotion threads keyframe
 * expressions), instead of the bare-call defaults.
 *
 * Scenario: an out-of-range `mouth.width` (a mouth group with no lips)
 * validated under path "$doc.face" into a pre-seeded collector — the new
 * violation lands in the same collector after the existing entry, and its path
 * carries the caller's prefix and the leaf's dotted document path.
 */
export const test_validation_face_collector = (): void => {
  const collector = new ViolationCollector();
  collector.push("type", "$doc.id", "pre-existing entry", null);

  const returned = validateFace({
    face: makeFace({ mouth: { width: 9 } }),
    path: "$doc.face",
    collector,
  });

  TestValidator.equals("same collector returned", returned, collector);
  TestValidator.equals("accumulates after the seed", collector.items.length, 2);
  TestValidator.equals(
    "caller's path prefix",
    collector.items[1]!.path,
    "$doc.face.mouth.width",
  );
};

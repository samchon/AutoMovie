import { detectSupportToppling } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

const v = (x: number, z: number) => ({ x, y: 0, z });

/**
 * The support footprint is built into a real convex hull, so the classification
 * no longer depends on the order the contact points are given. The old check
 * assumed the points were already a convex, correctly-wound polygon; a
 * mis-ordered (self-crossing) list could then misclassify an interior COM as
 * outside. This pins order-independence.
 *
 * Scenarios:
 *
 * 1. A CCW square and the same four corners in a self-crossing "bowtie" order both
 *    classify a centered COM as stable.
 * 2. An overhanging COM is detected as toppling regardless of point order.
 */
export const test_validation_support_hull_fix = (): void => {
  const ordered = [v(0, 0), v(2, 0), v(2, 2), v(0, 2)];
  const crossed = [v(0, 0), v(2, 2), v(2, 0), v(0, 2)];

  TestValidator.equals(
    "ordered support: centered COM is stable",
    detectSupportToppling({ centerOfMass: v(1, 1), support: ordered })
      .validation.success,
    true,
  );
  TestValidator.equals(
    "mis-ordered support: same classification (stable)",
    detectSupportToppling({ centerOfMass: v(1, 1), support: crossed }).toppling,
    null,
  );

  const overhang = detectSupportToppling({
    centerOfMass: v(5, 1),
    support: crossed,
  });
  TestValidator.predicate(
    "mis-ordered support still detects the overhang",
    overhang.validation.success === true &&
      (overhang.validation.warnings?.length ?? 0) === 1,
  );
};

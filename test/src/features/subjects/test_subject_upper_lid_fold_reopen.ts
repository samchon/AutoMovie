import { createPortraitUpperLidProfile } from "@automovie/human/components/upperLidSection";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import { upperLidFoldFixture } from "../internal/upperLidFoldFixture";

/**
 * Inverse observed-relative motion can invalidate otherwise admitted targets.
 * Guard the resulting geometry, including overflow, rather than clamping it.
 *
 * Scenarios:
 * 1. Reopening 95% observed closure moves a 0.3 mm closed tarsal point past the
 *    5 mm attachment. Finite but escaped tissue is refused.
 * 2. Reopening halfway observed closure reverses the crease/tarsal order while
 *    every point remains finite. Only the hood may reverse, so this refuses.
 * 3. A finite 1e308 closed relief overflows under inverse motion and refuses.
 */
export const test_subject_upper_lid_fold_reopen = (): void => {
  const escaped = upperLidFoldFixture();
  for (const witness of escaped.closedSections!) {
    witness.section.margin.offset = 0.01;
    witness.section.tarsal.offset = 0.3;
  }
  TestValidator.predicate(
    "reopened point stays inside attachment",
    throwsError(
      () =>
        createPortraitUpperLidProfile(escaped, {
          blink: 0,
          observedBlink: 0.95,
          yaw: 0,
          pitch: 0,
        })(0.5),
      "finite inside",
    ),
  );
  const reversed = upperLidFoldFixture();
  for (const witness of reversed.closedSections!) {
    const s = witness.section;
    s.creaseInner.offset = 3.9;
    s.creaseOuter.offset = 3.94;
    s.hood.offset = 3.97;
  }
  TestValidator.predicate(
    "reopening cannot reverse another tissue station",
    throwsError(
      () =>
        createPortraitUpperLidProfile(reversed, {
          blink: 0,
          observedBlink: 0.5,
          yaw: 0,
          pitch: 0,
        })(0.5),
      "only permits the hood",
    ),
  );
  const overflow = upperLidFoldFixture();
  for (const witness of overflow.closedSections!)
    witness.section.margin.projection = 1e308;
  TestValidator.predicate(
    "derived relief overflow refuses",
    throwsError(
      () =>
        createPortraitUpperLidProfile(overflow, {
          blink: 0,
          observedBlink: 0.95,
          yaw: 0,
          pitch: 0,
        })(0.5),
      "finite inside",
    ),
  );
};

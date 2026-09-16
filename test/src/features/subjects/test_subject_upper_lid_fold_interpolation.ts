import { createPortraitUpperLidProfile } from "@automovie/human/components/upperLidSection";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import { upperLidFoldFixture } from "../internal/upperLidFoldFixture";

/**
 * Valid ends alone do not certify a folded skin interpolation. Crossing is
 * evaluated by the engine's shared planar predicate at the consumed section.
 *
 * Scenarios:
 * 1. Hoods at (1.5,1) and (1.5,-1) are separately simple. Their halfway hood
 *    lies at (1.5,0), returning across the crease at (2,0), and must refuse.
 * 2. The same invalid section reached during closure refuses after motion,
 *    not only when a longitudinal witness happens to match it.
 */
export const test_subject_upper_lid_fold_interpolation = (): void => {
  const profile = upperLidFoldFixture();
  profile.sections[1].section.hood.projection = -1;
  const sample = createPortraitUpperLidProfile(profile);
  TestValidator.equals("anterior endpoint", sample(0).hood.projection, 1);
  TestValidator.equals("posterior endpoint", sample(1).hood.projection, -1);
  TestValidator.predicate(
    "interior crossing refuses",
    throwsError(() => sample(0.5), "cross or touch"),
  );
  const closing = upperLidFoldFixture();
  for (const witness of closing.closedSections!)
    witness.section.hood = { offset: 3, projection: -2 };
  const posed = createPortraitUpperLidProfile(closing, {
    blink: 1 / 3,
    observedBlink: 0,
    yaw: 0,
    pitch: 0,
  });
  // At one third: hood (2,0) touches the nonadjacent creaseInner (2,0).
  TestValidator.predicate(
    "motion crossing refuses",
    throwsError(() => posed(0.5), "cross or touch"),
  );
};

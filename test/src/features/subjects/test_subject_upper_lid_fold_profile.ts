import { createPortraitUpperLidProfile } from "@automovie/human/components/upperLidSection";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";
import { upperLidFoldFixture } from "../internal/upperLidFoldFixture";

/**
 * A returning hood is an explicit skin section with an authored closure target,
 * not a weakening of ordinary ordered profile admission.
 *
 * Scenarios:
 * 1. A 1.5 mm hood returns inward from a 2.5 mm crease. Without a closed target
 *    it refuses; the prior unfolded profile still returns the exact endpoint.
 * 2. Observed closure 0.2 to current 0.6 is halfway to one: the hood becomes
 *    offset 2.25, projection 0.6. Attachment remains 5 and the other rows stay.
 * 3. Input, performance and returned-result mutations cannot change a sampler.
 *    Reopening from observed 0.2 uses factor -0.25 and a 1.125 mm hood offset.
 * 4. Mismatched targets, crossing or reversed tissue, nonfinite dimensions,
 *    invalid closure and out-of-range sampling refuse beside valid profiles.
 */
export const test_subject_upper_lid_fold_profile = (): void => {
  const profile = upperLidFoldFixture(),
    sample = createPortraitUpperLidProfile(profile);
  TestValidator.equals(
    "observed folded endpoint",
    sample(0),
    profile.sections[0].section,
  );
  TestValidator.predicate(
    "old ordered contract remains armed",
    throwsError(
      () => createPortraitUpperLidProfile({ sections: profile.sections }),
      "strictly ordered",
    ),
  );
  TestValidator.equals(
    "old unfolded endpoint exact",
    createPortraitUpperLidProfile({ sections: profile.closedSections! })(1),
    profile.closedSections![1].section,
  );
  const performance = { blink: 0.6, observedBlink: 0.2, yaw: 0, pitch: 0 },
    halfway = createPortraitUpperLidProfile(profile, performance),
    section = halfway(0.5);
  TestValidator.predicate(
    "hand-derived observed-relative unfolding",
    nclose(section.hood.offset, 2.25) && nclose(section.hood.projection, 0.6),
  );
  TestValidator.equals("attachment fixed", section.attachment, 5);
  TestValidator.equals(
    "other anatomical point fixed",
    section.tarsal,
    profile.sections[0].section.tarsal,
  );
  TestValidator.equals(
    "same observed closure exact",
    createPortraitUpperLidProfile(profile, { ...performance, blink: 0.2 })(0),
    sample(0),
  );
  TestValidator.predicate(
    "closed target reached",
    nclose(
      createPortraitUpperLidProfile(profile, { ...performance, blink: 1 })(0.5)
        .hood.offset,
      3,
    ),
  );
  TestValidator.predicate(
    "reopening extrapolates the same motion",
    nclose(
      createPortraitUpperLidProfile(profile, { ...performance, blink: 0 })(0.5)
        .hood.offset,
      1.125,
    ),
  );
  profile.closedSections![0].section.hood.offset = 3.5;
  profile.sections[0].section.hood.projection = 2;
  performance.blink = 1;
  section.hood.offset = 100;
  TestValidator.predicate(
    "input and output ownership",
    nclose(halfway(0.5).hood.offset, 2.25) &&
      nclose(halfway(0.5).hood.projection, 0.6),
  );
  for (const change of [
    (p: typeof profile) => {
      p.closedSections = [];
    },
    (p: typeof profile) => {
      p.closedSections = [
        p.closedSections![0],
        { ...p.closedSections![0], at: 0.5 },
        p.closedSections![1],
      ];
    },
    (p: typeof profile) => {
      p.sections = [
        p.sections[0],
        { ...p.sections[0], at: 0.4 },
        p.sections[1],
      ];
      p.closedSections = [
        p.closedSections![0],
        { ...p.closedSections![0], at: 0.6 },
        p.closedSections![1],
      ];
    },
    (p: typeof profile) => {
      p.closedSections![0].section.attachment = 6;
    },
    (p: typeof profile) => {
      p.sections[0].section.creaseInner.offset = 0.9;
    },
    (p: typeof profile) => {
      p.sections[0].section.hood.offset = 0.2;
    },
    (p: typeof profile) => {
      p.sections[0].section.hood.offset = 4;
    },
    (p: typeof profile) => {
      p.sections[0].section.hood.projection = 0;
    },
    (p: typeof profile) => {
      p.sections[0].section.hood.offset = 0;
    },
    (p: typeof profile) => {
      p.sections[0].section.hood.offset = NaN;
    },
    (p: typeof profile) => {
      p.sections[0].section.hood.projection = Infinity;
    },
    (p: typeof profile) => {
      p.sections[0].section.attachment = 3;
    },
  ]) {
    const bad = upperLidFoldFixture();
    change(bad);
    TestValidator.predicate(
      "invalid folded witness refuses",
      throwsError(() => createPortraitUpperLidProfile(bad), "Upper-lid"),
    );
  }
  TestValidator.predicate(
    "invalid performance refuses",
    throwsError(
      () =>
        createPortraitUpperLidProfile(upperLidFoldFixture(), {
          ...performance,
          blink: 1.1,
        }),
      "performance",
    ),
  );
  for (const at of [-0.1, 1.1, NaN])
    TestValidator.predicate(
      "folded query bounds",
      throwsError(() => halfway(at), "sampling"),
    );
  TestValidator.predicate(
    "extrapolated tissue cannot escape attachment domain",
    throwsError(
      () =>
        createPortraitUpperLidProfile(upperLidFoldFixture(), {
          ...performance,
          blink: 0,
          observedBlink: 0.95,
        })(0.5),
      "folded tissue",
    ),
  );
};

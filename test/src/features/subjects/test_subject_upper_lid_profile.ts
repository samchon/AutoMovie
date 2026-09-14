import {
  type IPortraitUpperLidSection,
  createPortraitUpperLidProfile,
} from "@automovie/human/components/upperLidSection";
import { TestValidator } from "@nestia/e2e";

import { nclose, throwsError } from "../internal/predicates";

/**
 * Complete upper sections keep independently named crease and hood witnesses.
 * Their numerical interpolation uses a hand-known convex smoothstep oracle.
 *
 * Scenarios:
 * 1. Quarter progress weights endpoints by 27/32 and 5/32. All six row names
 *    retain their own offsets and signed relief; attachment shares the weight.
 * 2. Input and result mutation preserve ownership. Uneven three-station data
 *    sample the later interval, and the 32-section population remains valid.
 * 3. Empty detail, missing canthal ends, duplicate progress, crossing tissue,
 *    nonfinite projection and an attachment inside tissue refuse beside valid data.
 */
export const test_subject_upper_lid_profile = (): void => {
  const section = (scale: number): IPortraitUpperLidSection => ({
    margin: { offset: scale, projection: -scale },
    tarsal: { offset: 2 * scale, projection: 2 * scale },
    creaseInner: { offset: 3 * scale, projection: -3 * scale },
    creaseOuter: { offset: 4 * scale, projection: -4 * scale },
    hood: { offset: 5 * scale, projection: 5 * scale },
    preseptal: { offset: 6 * scale, projection: 6 * scale },
    attachment: 7 * scale,
  });
  const input = {
    sections: [
      { at: 0, section: section(1) },
      { at: 1, section: section(3) },
    ],
  };
  const sample = createPortraitUpperLidProfile(input),
    quarter = sample(0.25);
  const expected = section(21 / 16);
  for (const role of [
    "margin",
    "tarsal",
    "creaseInner",
    "creaseOuter",
    "hood",
    "preseptal",
  ] as const)
    TestValidator.predicate(
      "each named row has independent quarter oracle",
      nclose(quarter[role].offset, expected[role].offset) &&
        nclose(quarter[role].projection, expected[role].projection),
    );
  TestValidator.predicate(
    "attachment shares convex weight",
    nclose(quarter.attachment, 147 / 16),
  );
  TestValidator.equals("medial endpoint", sample(0), section(1));
  TestValidator.equals("lateral endpoint", sample(1), section(3));
  input.sections[0].section.hood.projection = 100;
  quarter.hood.offset = 100;
  TestValidator.predicate(
    "independent input and result ownership",
    nclose(sample(0.25).hood.offset, 105 / 16) &&
      nclose(sample(0.25).hood.projection, 105 / 16),
  );
  const later = createPortraitUpperLidProfile({
    sections: [
      { at: 0, section: section(1) },
      { at: 0.2, section: section(2) },
      { at: 1, section: section(4) },
    ],
  })(0.6);
  TestValidator.predicate(
    "later interval midpoint",
    nclose(later.margin.offset, 3) && nclose(later.attachment, 21),
  );
  const many = Array.from({ length: 32 }, (_, i) => ({
    at: i / 31,
    section: section(1),
  }));
  TestValidator.equals(
    "maximum population",
    createPortraitUpperLidProfile({ sections: many })(1),
    section(1),
  );
  const valid = [
    { at: 0, section: section(1) },
    { at: 1, section: section(1) },
  ];
  for (const sections of [
    [],
    valid.slice(0, 1),
    [{ ...valid[0], at: 0.1 }, valid[1]],
    [valid[0], { ...valid[1], at: 0.9 }],
    [valid[0], valid[0], valid[1]],
  ])
    TestValidator.predicate(
      "invalid population refuses",
      throwsError(
        () => createPortraitUpperLidProfile({ sections }),
        "Upper-lid",
      ),
    );
  for (const patch of [
    { offset: 2, projection: 0 },
    { offset: 3, projection: NaN },
  ]) {
    const bad = section(1);
    bad.creaseInner = patch;
    TestValidator.predicate(
      "crossed or nonfinite crease refuses",
      throwsError(
        () =>
          createPortraitUpperLidProfile({
            sections: [{ at: 0, section: bad }, valid[1]],
          }),
        "tissue offsets",
      ),
    );
  }
  TestValidator.predicate(
    "invalid attachment refuses",
    throwsError(
      () =>
        createPortraitUpperLidProfile({
          sections: [
            { at: 0, section: { ...section(1), attachment: 6 } },
            valid[1],
          ],
        }),
      "attachment",
    ),
  );
  for (const at of [-0.1, 1.1, NaN])
    TestValidator.predicate(
      "query refuses",
      throwsError(() => sample(at), "sampling"),
    );
};

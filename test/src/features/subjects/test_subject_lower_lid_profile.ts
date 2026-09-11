import { TestValidator } from "@nestia/e2e";

import {
  type IPortraitLowerLidSection,
  createPortraitLowerLidProfile,
} from "../../subjects/generated-korean-girl-01/lowerLidSection";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Anatomical section witnesses retain ordered tissue rows and independent depth
 * values. The interpolation oracle is hand-derived cubic smoothstep, not a mesh
 * snapshot or a repetition of the production's section extraction.
 *
 * Scenarios:
 * 1. At one quarter, weight is 5/32: offset 1 to 2 gives 37/32 and projection
 *    -1 to 3 gives -3/8. Endpoints and later station intervals retain their data.
 * 2. Copied inputs and returned samples are independently owned. Exactly 32
 *    witnesses pass, with positive ordered offsets and signed projections.
 * 3. Short/oversized lists, missing ends, unordered/nonfinite progress, crossed
 *    tissue rows, invalid attachment and out-of-domain queries all refuse.
 */
export const test_subject_lower_lid_profile = (): void => {
  const section = (
    scale: number,
    projection: number,
  ): IPortraitLowerLidSection => ({
    margin: { offset: scale, projection },
    pretarsalCrest: { offset: 2 * scale, projection },
    pretarsalLower: { offset: 3 * scale, projection },
    subtarsalInner: { offset: 4 * scale, projection },
    subtarsalOuter: { offset: 5 * scale, projection },
    preseptal: { offset: 6 * scale, projection },
    attachment: 7 * scale,
  });
  const a = section(1, -1),
    b = section(2, 3);
  const input = {
    sections: [
      { at: 0, section: a },
      { at: 1, section: b },
    ],
  };
  const sample = createPortraitLowerLidProfile(input);
  const quarter = sample(0.25);
  TestValidator.predicate(
    "independent quarter oracle",
    nclose(quarter.margin.offset, 37 / 32) &&
      nclose(quarter.margin.projection, -3 / 8) &&
      nclose(quarter.attachment, 259 / 32),
  );
  TestValidator.equals("start section", sample(0), a);
  TestValidator.equals("end section", sample(1), b);
  const many = createPortraitLowerLidProfile({
    sections: [
      { at: 0, section: a },
      { at: 0.5, section: b },
      { at: 1, section: section(3, 7) },
    ],
  });
  TestValidator.predicate(
    "later interval",
    nclose(many(0.75).margin.offset, 2.5) &&
      nclose(many(0.75).margin.projection, 5),
  );
  input.sections[0].section.margin.projection = 100;
  quarter.margin.offset = 100;
  TestValidator.predicate(
    "input and result ownership",
    nclose(sample(0.25).margin.offset, 37 / 32) &&
      nclose(sample(0.25).margin.projection, -3 / 8),
  );
  const limits = Array.from({ length: 32 }, (_, i) => ({
    at: i / 31,
    section: section(1, 0),
  }));
  TestValidator.equals(
    "32 witnesses admitted",
    createPortraitLowerLidProfile({ sections: limits })(0.9),
    section(1, 0),
  );
  const valid = [
    { at: 0, section: section(1, 0) },
    { at: 1, section: section(1, 0) },
  ];
  for (const sections of [
    [],
    valid.slice(0, 1),
    Array.from({ length: 33 }, (_, i) => ({
      at: i / 32,
      section: section(1, 0),
    })),
    [{ ...valid[0], at: 0.1 }, valid[1]],
    [valid[0], { ...valid[1], at: 0.9 }],
  ])
    TestValidator.predicate(
      "population boundaries refuse",
      throwsError(() => createPortraitLowerLidProfile({ sections })),
    );
  for (const at of [-0.1, 1.1, NaN, 0])
    TestValidator.predicate(
      "bad station progress refuses",
      throwsError(() =>
        createPortraitLowerLidProfile({
          sections: [valid[0], { at, section: section(1, 0) }, valid[1]],
        }),
      ),
    );
  for (const offset of [0, -1, NaN, Infinity]) {
    const malformed = section(1, 0);
    malformed.margin.offset = offset;
    TestValidator.predicate(
      "bad first offset refuses",
      throwsError(() =>
        createPortraitLowerLidProfile({
          sections: [{ at: 0, section: malformed }, valid[1]],
        }),
      ),
    );
  }
  for (const patch of [
    { offset: 1, projection: 0 },
    { offset: 2, projection: Infinity },
  ]) {
    const malformed = section(1, 0);
    malformed.pretarsalCrest = patch;
    TestValidator.predicate(
      "crossed or nonfinite tissue refuses",
      throwsError(() =>
        createPortraitLowerLidProfile({
          sections: [{ at: 0, section: malformed }, valid[1]],
        }),
      ),
    );
  }
  for (const attachment of [6, 5, NaN, Infinity])
    TestValidator.predicate(
      "attachment beyond tissue required",
      throwsError(() =>
        createPortraitLowerLidProfile({
          sections: [
            { at: 0, section: { ...section(1, 0), attachment } },
            valid[1],
          ],
        }),
      ),
    );
  for (const at of [-0.1, 1.1, NaN, Infinity])
    TestValidator.predicate(
      "query bounds",
      throwsError(() => sample(at)),
    );
};

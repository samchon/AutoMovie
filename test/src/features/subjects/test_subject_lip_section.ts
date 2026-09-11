import { TestValidator } from "@nestia/e2e";

import { createPortraitLipSection } from "../../subjects/generated-korean-girl-01/lipSection";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Lip section controls reshape the band between its two fixed boundaries.
 * Scenarios:
 * 1. Unit upper/lower bodies follow an independently calculated smooth envelope;
 *    central upper and paired lower projections remain separate controls.
 * 2. Both edges/corners are exact zero, signed relief is supported, and copied
 *    settings remain unchanged after the caller edits its profile.
 * 3. Invalid relative dimensions, nonfinite projections, out-of-band samples
 *    and arithmetic overflow refuse; neutral projections remain identity.
 */
export const test_subject_lip_section = (): void => {
  const shape = {
    upperBody: 1,
    upperTubercle: 0,
    upperTubercleWidth: 0.25,
    lowerBody: -1,
    lowerPads: 0,
    lowerPadOffset: 0.3,
    lowerPadWidth: 0.25,
  };
  const sample = createPortraitLipSection(shape);
  for (const side of ["upper", "lower"] as const) {
    const sign = side === "upper" ? 1 : -1;
    TestValidator.predicate(
      "unit section peak",
      nclose(sample({ side, lateral: 0, across: 0.5 }), sign),
    );
    TestValidator.predicate(
      "independent envelope oracle",
      nclose(sample({ side, lateral: 0.5, across: 0.25 }), sign * 0.28125),
    );
    for (const [lateral, across] of [
      [-1, 0.5],
      [1, 0.5],
      [0, 0],
      [0, 1],
    ])
      TestValidator.equals(
        "exact boundary identity",
        sample({ side, lateral, across }),
        0,
      );
  }
  const tubercle = createPortraitLipSection({
    ...shape,
    upperBody: 0,
    upperTubercle: 2,
  });
  TestValidator.predicate(
    "central upper control",
    nclose(tubercle({ side: "upper", lateral: 0, across: 0.5 }), 2),
  );
  TestValidator.predicate(
    "upper control leaves lower body alone",
    nclose(tubercle({ side: "lower", lateral: 0, across: 0.5 }), -1),
  );
  const pads = createPortraitLipSection({
    ...shape,
    lowerBody: 0,
    lowerPads: 0.7,
  });
  TestValidator.predicate(
    "paired lower control",
    nclose(
      pads({ side: "lower", lateral: 0.3, across: 0.5 }),
      (1 - 0.3 ** 2) ** 2 * 0.7 * (1 + Math.exp(-(2.4 ** 2))),
    ),
  );
  TestValidator.predicate(
    "lower reflection",
    nclose(
      pads({ side: "lower", lateral: -0.3, across: 0.5 }),
      pads({ side: "lower", lateral: 0.3, across: 0.5 }),
    ),
  );
  shape.upperBody = 99;
  TestValidator.predicate(
    "profile ownership",
    nclose(sample({ side: "upper", lateral: 0, across: 0.5 }), 1),
  );
  const zero = createPortraitLipSection({
    ...shape,
    upperBody: 0,
    lowerBody: 0,
  });
  TestValidator.equals(
    "neutral section",
    zero({ side: "upper", lateral: 0, across: 0.5 }),
    0,
  );
  for (const field of Object.keys(shape))
    TestValidator.predicate(
      "nonfinite setting refuses",
      throwsError(
        () => createPortraitLipSection({ ...shape, [field]: NaN }),
        "finite",
      ),
    );
  for (const change of [
    { upperTubercleWidth: 0 },
    { upperTubercleWidth: 1.1 },
    { lowerPadWidth: -1 },
    { lowerPadWidth: 2 },
    { lowerPadOffset: -0.1 },
    { lowerPadOffset: 1.1 },
  ])
    TestValidator.predicate(
      "invalid relative dimension refuses",
      throwsError(
        () => createPortraitLipSection({ ...shape, ...change }),
        "bounded",
      ),
    );
  createPortraitLipSection({
    ...shape,
    upperTubercleWidth: 1,
    lowerPadWidth: 1,
    lowerPadOffset: 0,
  });
  createPortraitLipSection({ ...shape, lowerPadOffset: 1 });
  for (const [lateral, across] of [
    [NaN, 0],
    [0, NaN],
    [-1.1, 0.5],
    [1.1, 0.5],
    [0, -0.1],
    [0, 1.1],
  ])
    TestValidator.predicate(
      "invalid sample refuses",
      throwsError(
        () => sample({ side: "upper", lateral, across }),
        "normalized",
      ),
    );
  const huge = createPortraitLipSection({
    ...shape,
    upperBody: Number.MAX_VALUE,
    upperTubercle: Number.MAX_VALUE,
  });
  TestValidator.predicate(
    "overflow refuses",
    throwsError(
      () => huge({ side: "upper", lateral: 0, across: 0.5 }),
      "representable",
    ),
  );
};

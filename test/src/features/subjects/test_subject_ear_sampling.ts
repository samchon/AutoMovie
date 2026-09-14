import { portraitEarShape, resolvePortraitEarSampling } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Pinna sampling is a bounded precision setting, not an anatomical scale.
 *
 * Scenarios:
 * 1. Omission and both inclusive bounds resolve to independent owned records.
 * 2. Adjacent invalid bounds, fractional counts and nonfinite dimensions refuse.
 * 3. Zero embedding is valid; zero scale/projection and negative embedding refuse.
 */
export const test_subject_ear_sampling = (): void => {
  TestValidator.equals(
    "default precision",
    resolvePortraitEarSampling(portraitEarShape),
    { columns: 112, frontRows: 60, backRows: 40 },
  );
  for (const sampling of [
    { columns: 8, frontRows: 2, backRows: 2 },
    { columns: 512, frontRows: 256, backRows: 256 },
  ]) {
    const resolved = resolvePortraitEarSampling({
      ...portraitEarShape,
      sampling,
      embedding: 0,
    });
    TestValidator.equals("inclusive precision", resolved, sampling);
    resolved.columns++;
    TestValidator.predicate(
      "owned sampling",
      resolved.columns !== sampling.columns,
    );
  }
  for (const [field, values] of [
    ["columns", [7, 513, 8.5]],
    ["frontRows", [1, 257, 2.5]],
    ["backRows", [1, 257, NaN]],
  ] as const)
    for (const value of values)
      TestValidator.predicate(
        `${field} refuses ${value}`,
        throwsError(() =>
          resolvePortraitEarSampling({
            ...portraitEarShape,
            sampling: { columns: 8, frontRows: 2, backRows: 2, [field]: value },
          }),
        ),
      );
  for (const field of [
    "centerY",
    "centerZ",
    "heightScale",
    "depthScale",
    "projection",
    "embedding",
  ] as const)
    TestValidator.predicate(
      `finite ${field}`,
      throwsError(() =>
        resolvePortraitEarSampling({ ...portraitEarShape, [field]: Infinity }),
      ),
    );
  for (const field of ["heightScale", "depthScale", "projection"] as const)
    TestValidator.predicate(
      `positive ${field}`,
      throwsError(() =>
        resolvePortraitEarSampling({ ...portraitEarShape, [field]: 0 }),
      ),
    );
  TestValidator.predicate(
    "nonnegative root embedding",
    throwsError(() =>
      resolvePortraitEarSampling({ ...portraitEarShape, embedding: -0.001 }),
    ),
  );
};

import { mergeHumanFaceSettings } from "@automovie/human";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * Typed detail composition has one object/array replacement rule.
 *
 * Scenarios:
 * 1. Omission copies the basis; nested overrides preserve unrelated fields.
 * 2. Supplied arrays, including empty arrays and object arrays, replace completely.
 * 3. Optional new objects and scalar/null values are copied without retaining caller aliases.
 * 4. Object-over-scalar/array/null and prototype keys refuse explicitly.
 */
export const test_subject_human_settings = (): void => {
  const base = {
    volume: { width: 3, projection: 2 },
    weights: [1, 2, 3],
    sections: [
      { at: 0, width: 1 },
      { at: 1, width: 2 },
    ],
  };
  const copy = mergeHumanFaceSettings(base);
  copy.volume.width = 8;
  TestValidator.equals("omitted value copied", base.volume.width, 3);
  const patch = {
    volume: { projection: -1 },
    weights: [],
    sections: [{ at: 0.5, width: 4 }],
  };
  const merged = mergeHumanFaceSettings(base, patch);
  patch.sections[0].width = 10;
  TestValidator.equals("nested field preservation", merged.volume, {
    width: 3,
    projection: -1,
  });
  TestValidator.equals("empty replaces array", merged.weights, []);
  TestValidator.equals("object array replaces and copies", merged.sections, [
    { at: 0.5, width: 4 },
  ]);
  const optional = mergeHumanFaceSettings<{
    enabled: boolean;
    nested?: { width: number };
    label: string | null;
  }>(
    { enabled: true, label: "base" },
    { enabled: false, nested: { width: 2 }, label: null },
  );
  TestValidator.equals("optional object and scalar replacements", optional, {
    enabled: false,
    nested: { width: 2 },
    label: null,
  });
  TestValidator.equals(
    "explicit undefined retains basis",
    mergeHumanFaceSettings(base, { volume: undefined }),
    base,
  );
  for (const value of [null, 1, []])
    TestValidator.predicate(
      "object cannot replace nonobject",
      throwsError(() => mergeHumanFaceSettings<unknown>(value, { field: 1 })),
    );
  for (const key of ["__proto__", "constructor", "prototype"])
    TestValidator.predicate(
      "prototype key refused",
      throwsError(() =>
        mergeHumanFaceSettings<Record<string, unknown>>(
          {},
          JSON.parse(`{"${key}":1}`),
        ),
      ),
    );
};

import { validateModel } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const hasFiniteViolation = (
  result: ReturnType<typeof validateModel>,
  path: string,
): boolean =>
  result.success === false &&
  hasViolation(result, "range", path) &&
  result.violations.some(
    (v) =>
      v.kind === "range" &&
      v.path.includes(path) &&
      v.expected.includes("finite"),
  );

/**
 * Pins non-finite model scalar gates before model geometry or PBR values reach
 * downstream render/validation consumers.
 *
 * Scenarios:
 *
 * 1. Primitive dimensions must be finite positive numbers.
 * 2. Material coefficients must be finite values inside `[0,1]`.
 */
export const test_validation_model_non_finite_scalars = (): void => {
  const base = createModel();
  const model = {
    ...base,
    parts: base.parts.map((p) => ({
      ...p,
      geometry: {
        type: "primitive" as const,
        shape: {
          type: "box" as const,
          width: Number.NaN,
          height: Number.POSITIVE_INFINITY,
          depth: 0.2,
        },
      },
    })),
    materials: base.materials.map((m) => ({
      ...m,
      metallic: Number.NaN,
    })),
  };

  const result = validateModel({ model });
  TestValidator.equals("non-finite model scalars fail", result.success, false);
  TestValidator.predicate(
    "non-finite width rejected",
    hasFiniteViolation(result, ".width"),
  );
  TestValidator.predicate(
    "non-finite height rejected",
    hasFiniteViolation(result, ".height"),
  );
  TestValidator.predicate(
    "non-finite material coefficient rejected",
    hasFiniteViolation(result, ".metallic"),
  );
};

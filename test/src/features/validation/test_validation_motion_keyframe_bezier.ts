import { validateMotion } from "@automovie/engine";
import { IAutoMovieKeyframe } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createSkeleton, createValidMotion } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Keyframe `bezier` data is only meaningful for `easing: "cubicBezier"`.
 * Runtime JSON can still send missing, malformed, or stray control points, so
 * motion validation must enforce the interface contract before sampling.
 */
export const test_validation_motion_keyframe_bezier = (): void => {
  const makeMotion = (
    patch: Partial<IAutoMovieKeyframe>,
  ): ReturnType<typeof createValidMotion> => {
    const base = createValidMotion();
    return {
      ...base,
      keyframes: base.keyframes.map((kf, i) =>
        i === 0 ? { ...kf, ...patch } : kf,
      ),
    };
  };

  const invalidCases: {
    name: string;
    patch: Partial<IAutoMovieKeyframe>;
  }[] = [
    {
      name: "cubicBezier without controls",
      patch: { easing: "cubicBezier", bezier: null },
    },
    {
      name: "cubicBezier short tuple",
      patch: {
        easing: "cubicBezier",
        bezier: [0, 0, 1] as unknown as IAutoMovieKeyframe["bezier"],
      },
    },
    {
      name: "cubicBezier non-finite control",
      patch: {
        easing: "cubicBezier",
        bezier: [0, 0, Number.NaN, 1],
      },
    },
    {
      name: "linear with stray controls",
      patch: {
        easing: "linear",
        bezier: [0, 0, 1, 1],
      },
    },
  ];

  for (const scenario of invalidCases) {
    const result = validateMotion({
      motion: makeMotion(scenario.patch),
      skeleton: createSkeleton(),
    });
    TestValidator.equals(`${scenario.name} fails`, result.success, false);
    TestValidator.predicate(
      `${scenario.name} reports bezier`,
      hasViolation(result, "type", ".bezier"),
    );
  }

  const validCubic = validateMotion({
    motion: makeMotion({
      easing: "cubicBezier",
      bezier: [0, 0, 1, 1],
    }),
    skeleton: createSkeleton(),
  });
  TestValidator.equals(
    "valid cubicBezier controls pass",
    validCubic.success,
    true,
  );
};

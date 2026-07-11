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

  // #1159: a finite-but-out-of-[0,1] control x breaks the easing solver's
  // monotonicity, so it must fail with a RANGE (not type) violation. `y` is
  // unconstrained, so only x1/x2 are gated.
  const outOfRangeX: {
    label: string;
    bezier: [number, number, number, number];
  }[] = [
    { label: "x1 above 1", bezier: [2, 0, 0, 1] },
    { label: "x1 below 0", bezier: [-0.5, 0, 1, 1] },
    { label: "x2 above 1", bezier: [0, 0, 1.5, 1] },
    { label: "x2 below 0", bezier: [0, 0, -0.2, 1] },
  ];
  for (const { label, bezier } of outOfRangeX) {
    const result = validateMotion({
      motion: makeMotion({ easing: "cubicBezier", bezier }),
      skeleton: createSkeleton(),
    });
    TestValidator.equals(`cubicBezier ${label} fails`, result.success, false);
    TestValidator.predicate(
      `cubicBezier ${label} reports a range bezier violation`,
      hasViolation(result, "range", ".bezier"),
    );
  }

  // an unconstrained y outside [0,1] still passes (only x is gated).
  TestValidator.equals(
    "cubicBezier with y outside [0,1] passes",
    validateMotion({
      motion: makeMotion({
        easing: "cubicBezier",
        bezier: [0.25, -2, 0.75, 3],
      }),
      skeleton: createSkeleton(),
    }).success,
    true,
  );
};

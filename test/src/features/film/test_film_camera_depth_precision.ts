import { evaluateAutoMovieCameraDepthPrecision } from "@automovie/engine";
import type { IAutoMovieCameraDepthPrecisionConstraint } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

const CONSTRAINT: IAutoMovieCameraDepthPrecisionConstraint = {
  minimumDepthBits: 8,
  maximumStepMeters: 20,
};

const evaluate = (
  overrides: Partial<
    Parameters<typeof evaluateAutoMovieCameraDepthPrecision>[0]
  > = {},
) =>
  evaluateAutoMovieCameraDepthPrecision({
    camera: "camera-main",
    time: 1.25,
    near: 1,
    far: 101,
    requiredNear: 2,
    requiredFar: 50,
    constraint: CONSTRAINT,
    ...overrides,
  });

/** Standard fixed-point depth precision has one exact, addressed boundary. */
export const test_film_camera_depth_precision = (): void => {
  const valid = evaluate();
  TestValidator.equals(
    "hand-computable far-end cell is reported in metres",
    namedFacts([
      ["passed", () => valid.passed],
      ["status", () => valid.status === "satisfied"],
      ["codes", () => valid.lowerCode === 252 && valid.upperCode === 253],
      [
        "step",
        () =>
          valid.measuredStepMeters !== null &&
          nclose(valid.measuredStepMeters, 10.198990198990188, 1e-12),
      ],
      ["metric", () => valid.metric === "maximum-adjacent-depth-step"],
      ["unit", () => valid.unit === "meters"],
    ]),
    {
      passed: true,
      status: true,
      codes: true,
      step: true,
      metric: true,
      unit: true,
    },
  );

  const exact = evaluate({
    constraint: {
      ...CONSTRAINT,
      maximumStepMeters: valid.measuredStepMeters!,
    },
  });
  const below = evaluate({
    constraint: {
      ...CONSTRAINT,
      maximumStepMeters: valid.measuredStepMeters! / 2,
    },
  });
  TestValidator.equals(
    "exact threshold passes and the precision negative twin fails",
    [exact.status, exact.passed, below.status, below.passed],
    ["satisfied", true, "insufficient-precision", false],
  );

  const outsideNear = evaluate({ requiredNear: 0.5 });
  const outsideFar = evaluate({ requiredFar: 102 });
  TestValidator.equals(
    "either required-range edge outside the clip range is refused",
    [outsideNear.status, outsideFar.status],
    ["outside-clipping-range", "outside-clipping-range"],
  );

  const extreme = evaluate({
    near: 1,
    far: 1_000_000,
    requiredNear: 2,
    requiredFar: 1_000_000,
    constraint: { minimumDepthBits: 24, maximumStepMeters: 1000 },
  });
  TestValidator.predicate(
    "extreme far-to-near ratio exposes its coarse far-end step",
    extreme.status === "insufficient-precision" &&
      extreme.measuredStepMeters !== null &&
      nclose(extreme.measuredStepMeters, 56251.727617006865, 1e-6),
  );

  const invalid = [
    evaluate({ camera: " " }),
    evaluate({ time: Number.NaN }),
    evaluate({ time: -1 }),
    evaluate({ near: Number.NaN }),
    evaluate({ near: 0 }),
    evaluate({ far: Number.POSITIVE_INFINITY }),
    evaluate({ far: 1 }),
    evaluate({ requiredNear: Number.NaN }),
    evaluate({ requiredFar: Number.NEGATIVE_INFINITY }),
    evaluate({ requiredNear: 51, requiredFar: 50 }),
    evaluate({ constraint: { ...CONSTRAINT, minimumDepthBits: 1.5 } }),
    evaluate({ constraint: { ...CONSTRAINT, minimumDepthBits: 0 } }),
    evaluate({ constraint: { ...CONSTRAINT, minimumDepthBits: 54 } }),
    evaluate({
      constraint: { ...CONSTRAINT, maximumStepMeters: Number.NaN },
    }),
    evaluate({ constraint: { ...CONSTRAINT, maximumStepMeters: 0 } }),
    evaluate({
      near: Number.MIN_VALUE,
      far: 1,
      requiredNear: 1,
      requiredFar: 1,
      constraint: { minimumDepthBits: 53, maximumStepMeters: 1 },
    }),
  ];
  TestValidator.predicate(
    "malformed and numerically unmeasurable inputs return serializable invalid reports",
    invalid.every(
      (report) =>
        report.status === "invalid" &&
        report.passed === false &&
        report.lowerCode === null &&
        report.upperCode === null &&
        report.measuredStepMeters === null,
    ) && invalid.every((report) => JSON.stringify(report).includes("null")),
  );

  const nearPoint = evaluate({ requiredNear: 1, requiredFar: 1 });
  TestValidator.equals(
    "a degenerate required point exactly on near owns no preceding cell",
    [nearPoint.lowerCode, nearPoint.upperCode, nearPoint.measuredStepMeters],
    [0, 0, 0],
  );

  TestValidator.equals(
    "same identity is byte-stable while camera and time remain addressed",
    namedFacts([
      ["same", () => JSON.stringify(valid) === JSON.stringify(evaluate())],
      [
        "camera",
        () => evaluate({ camera: "alternate" }).camera === "alternate",
      ],
      ["time", () => evaluate({ time: 2 }).time === 2],
    ]),
    { same: true, camera: true, time: true },
  );
};

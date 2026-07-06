import { IAutoMovieSampledChannel, resolveDrivers } from "@automovie/engine";
import {
  IAutoMovieChannel,
  IAutoMovieDrivenCurve,
  IAutoMovieDrivenCurvePoint,
  IAutoMovieDrivenDriver,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const ptr = (p: string): IAutoMovieChannel => ({
  kind: "pointer",
  pointer: p,
  valueType: "scalar",
});

const seed = (
  entries: [string, IAutoMovieChannel, number[]][],
): Map<string, IAutoMovieSampledChannel> =>
  new Map(entries.map(([k, channel, value]) => [k, { channel, value }]));

const driven = (
  over: Partial<IAutoMovieDrivenDriver>,
): IAutoMovieDrivenDriver => ({
  type: "driven",
  output: ptr("/out"),
  source: ptr("/in"),
  inRange: [50, 60],
  outRange: [500, 600],
  clamp: true,
  ...over,
});

const curve = (over: Partial<IAutoMovieDrivenCurve> = {}) =>
  ({
    points: [
      { source: 0, output: 0 },
      { source: 7, output: 10 },
      { source: 10, output: 100 },
    ],
    ...over,
  }) satisfies IAutoMovieDrivenCurve;

/**
 * The nonlinear `driven.curve` contract is separate from the linear range
 * remap: it carries named `{ source, output }` points, supplies its own
 * source-absent default, and rejects malformed curve data before
 * interpolation.
 *
 * Scenarios:
 *
 * 1. Piecewise interpolation and endpoint holds use curve points, ignoring
 *    `inRange`/`outRange`/`clamp`.
 * 2. With no sampled source, a curve defaults to its first source point rather
 *    than the linear driver's `inRange[0]`.
 * 3. Malformed curve objects, point lists, point objects, non-finite coordinates,
 *    and non-increasing source values reject before output.
 */
export const test_resolve_driven_curve = (): void => {
  const run = (d: IAutoMovieDrivenDriver, src?: number): number[] => {
    const sampled =
      src === undefined ? seed([]) : seed([["ptr:/in", ptr("/in"), [src]]]);
    resolveDrivers([d], sampled, new Map());
    return sampled.get("ptr:/out")!.value;
  };

  const curl = driven({ curve: curve() });
  TestValidator.equals(
    "curve interpolates between named points",
    run(curl, 8.5),
    [55],
  );
  TestValidator.equals("curve holds below first point", run(curl, -3), [0]);
  TestValidator.equals("curve holds above last point", run(curl, 20), [100]);
  TestValidator.equals("curve absent source uses first point", run(curl), [0]);

  TestValidator.predicate(
    "driven curve rejects array contract",
    throwsError(
      () =>
        run(
          driven({
            curve: [
              { source: 0, output: 0 },
              { source: 1, output: 1 },
            ] as unknown as IAutoMovieDrivenCurve,
          }),
          1,
        ),
      ["driven driver curve", "object"],
    ),
  );
  TestValidator.predicate(
    "driven curve rejects primitive contract",
    throwsError(
      () =>
        run(
          driven({
            curve: "bad" as unknown as IAutoMovieDrivenCurve,
          }),
          1,
        ),
      ["driven driver curve", "object"],
    ),
  );
  TestValidator.predicate(
    "driven curve rejects missing points",
    throwsError(
      () =>
        run(
          driven({
            curve: {} as unknown as IAutoMovieDrivenCurve,
          }),
          1,
        ),
      ["driven driver curve.points", "array"],
    ),
  );
  TestValidator.predicate(
    "driven curve rejects empty points",
    throwsError(
      () => run(driven({ curve: curve({ points: [] }) }), 1),
      ["driven driver curve.points", "at least one"],
    ),
  );
  TestValidator.predicate(
    "driven curve rejects array point",
    throwsError(
      () =>
        run(
          driven({
            curve: curve({
              points: [
                { source: 0, output: 0 },
                [1, 1] as unknown as IAutoMovieDrivenCurvePoint,
              ],
            }),
          }),
          1,
        ),
      ["driven driver curve.points[1]", "object"],
    ),
  );
  TestValidator.predicate(
    "driven curve rejects primitive point",
    throwsError(
      () =>
        run(
          driven({
            curve: curve({
              points: [
                { source: 0, output: 0 },
                "bad" as unknown as IAutoMovieDrivenCurvePoint,
              ],
            }),
          }),
          1,
        ),
      ["driven driver curve.points[1]", "object"],
    ),
  );
  TestValidator.predicate(
    "driven curve rejects null point",
    throwsError(
      () =>
        run(
          driven({
            curve: curve({
              points: [
                { source: 0, output: 0 },
                null as unknown as IAutoMovieDrivenCurvePoint,
              ],
            }),
          }),
          1,
        ),
      ["driven driver curve.points[1]", "object"],
    ),
  );
  TestValidator.predicate(
    "driven curve rejects non-finite output",
    throwsError(
      () =>
        run(
          driven({
            curve: curve({
              points: [
                { source: 0, output: 0 },
                { source: 1, output: Number.NaN },
              ],
            }),
          }),
          1,
        ),
      ["driven driver curve.points[1].output", "finite", "NaN"],
    ),
  );
  TestValidator.predicate(
    "driven curve rejects non-increasing source",
    throwsError(
      () =>
        run(
          driven({
            curve: curve({
              points: [
                { source: 0, output: 0 },
                { source: 0, output: 1 },
              ],
            }),
          }),
          1,
        ),
      ["driven driver curve.points", "strictly increasing", "0"],
    ),
  );
};

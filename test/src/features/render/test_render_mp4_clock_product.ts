import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const clock = loadSourceModule<{
  exactProductionClockProduct: (left: number, right: number) => bigint;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/render/src/node/exactProductionClockProduct.ts",
  ),
);

/**
 * Two MP4 tracks are compared by an exact cross-product, never by division.
 *
 * A feature's video and audio tracks carry their own timescales, so equality of
 * runtime is `videoDuration * audioTimescale === audioDuration * videoTimescale`.
 * Each term is a safe integer, but their product is not bounded by that range,
 * so the multiplication happens in `bigint`: a `number` product would round to
 * the nearest representable double and report two different runtimes as equal.
 * That is why every term is refused unless it is a positive safe integer, and
 * why the product is never divided. The mux and the delivered-feature probe
 * share this arithmetic and keep their own refusal texts, so this pins the
 * shared half.
 *
 * Scenarios:
 *
 * 1. Two cross-products of one equal-runtime pair agree, and a one-tick-longer
 *    audio track disagrees.
 * 2. A product past the safe-integer range is exact: the largest admitted term
 *    times three differs from the double a `number` multiplication would give.
 * 3. Zero, negative, fractional and non-finite terms are refused on either side
 *    with the shared message, and the largest safe integer is still admitted.
 */
export const test_render_mp4_clock_product = (): void => {
  // 90 minutes of picture on a 24 fps, 12288-tick media clock beside the same
  // runtime on a 48 kHz audio clock: both products are 2^53 or larger, so a
  // number-typed multiplication could not carry them.
  const videoDuration = 90 * 60 * 12_288;
  const videoTimescale = 12_288;
  const audioDuration = 90 * 60 * 48_000;
  const audioTimescale = 48_000;
  const left = clock.exactProductionClockProduct(videoDuration, audioTimescale);
  const right = clock.exactProductionClockProduct(
    audioDuration,
    videoTimescale,
  );
  TestValidator.equals(
    "equal runtimes cross-multiply to one exact product",
    {
      left: left.toString(),
      right: right.toString(),
      equal: left === right,
    },
    {
      left: "3185049600000",
      right: "3185049600000",
      equal: true,
    },
  );
  TestValidator.predicate(
    "one audio tick more is a different runtime, not a rounding difference",
    clock.exactProductionClockProduct(audioDuration + 1, videoTimescale) !==
      left,
  );

  // Past the safe-integer range a `number` product rounds to the nearest double,
  // which is the loss the bigint multiplication exists to avoid.
  TestValidator.equals(
    "a product past the safe-integer range keeps every digit",
    {
      exact: clock
        .exactProductionClockProduct(Number.MAX_SAFE_INTEGER, 3)
        .toString(),
      rounded: (Number.MAX_SAFE_INTEGER * 3).toString(),
    },
    { exact: "27021597764222973", rounded: "27021597764222972" },
  );

  const refused = (left: number, right: number): boolean => {
    try {
      clock.exactProductionClockProduct(left, right);
      return false;
    } catch (error) {
      return (
        error instanceof Error &&
        error.message ===
          "MP4 presentation clocks must be positive safe integers."
      );
    }
  };
  TestValidator.equals(
    "every term outside the positive safe-integer domain is refused",
    {
      zeroLeft: refused(0, 48_000),
      zeroRight: refused(48_000, 0),
      negativeLeft: refused(-1, 48_000),
      negativeRight: refused(48_000, -1),
      fractionalLeft: refused(1.5, 48_000),
      fractionalRight: refused(48_000, 1.5),
      unsafeLeft: refused(Number.MAX_SAFE_INTEGER + 2, 48_000),
      infiniteRight: refused(48_000, Number.POSITIVE_INFINITY),
      notANumber: refused(Number.NaN, 48_000),
      maximumSafeAdmitted: refused(Number.MAX_SAFE_INTEGER, 1) === false,
    },
    {
      zeroLeft: true,
      zeroRight: true,
      negativeLeft: true,
      negativeRight: true,
      fractionalLeft: true,
      fractionalRight: true,
      unsafeLeft: true,
      infiniteRight: true,
      notANumber: true,
      maximumSafeAdmitted: true,
    },
  );
};

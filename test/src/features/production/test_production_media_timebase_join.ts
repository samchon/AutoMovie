import {
  canonicalProductionFrameRate,
  equalProductionFrameRates,
  productionFrameBoundaryToGridTick,
  productionFrameIntervalToGridTicks,
  resolveProductionFrameRate,
} from "@automovie/engine";
import { isProductionFrameTime } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const refused = (closure: () => unknown, message: string): boolean => {
  try {
    closure();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(message);
  }
};

/**
 * Validate the one rational mapping shared by media destination clocks.
 *
 * Scenarios:
 * 1. Integer and reducible rational rates canonicalize to stable identities,
 *    while decimal scalar rates and mismatched display projections refuse.
 * 2. Common fractional rates map frame boundaries to exact sample and WebVTT
 *    ticks with the named nonnegative nearest-half-up policy.
 * 3. Floor, ceiling, zero, overflow, invalid domains, and destination-grid
 *    interval collapse exercise every refusal and boundary branch.
 */
export const test_production_media_timebase_join = (): void => {
  TestValidator.equals(
    "integer and equivalent rational rates have one canonical identity",
    {
      integer: canonicalProductionFrameRate(24),
      reduced: canonicalProductionFrameRate({
        numerator: 60_000,
        denominator: 2_002,
      }),
      equal: equalProductionFrameRates(
        { numerator: 60_000, denominator: 2_002 },
        { numerator: 30_000, denominator: 1_001 },
      ),
      distinct: equalProductionFrameRates(
        { numerator: 30_000, denominator: 1_001 },
        { numerator: 2_997, denominator: 100 },
      ),
      rationalFrameTime: isProductionFrameTime(1_001 / 30_000, {
        numerator: 30_000,
        denominator: 1_001,
      }),
      integerFrameTime: isProductionFrameTime(1 / 24, 24),
    },
    {
      integer: { numerator: 24, denominator: 1 },
      reduced: { numerator: 30_000, denominator: 1_001 },
      equal: true,
      distinct: false,
      rationalFrameTime: true,
      integerFrameTime: true,
    },
  );
  TestValidator.equals(
    "fractional frame boundaries map once to sample and WebVTT clocks",
    {
      sample30000_1: productionFrameBoundaryToGridTick({
        frame: 1,
        frameRate: { numerator: 30_000, denominator: 1_001 },
        ticksPerSecond: 48_000,
        rounding: "nearest",
      }),
      sample30000_2: productionFrameBoundaryToGridTick({
        frame: 2,
        frameRate: { numerator: 30_000, denominator: 1_001 },
        ticksPerSecond: 48_000,
        rounding: "nearest",
      }),
      milliseconds30000_1: productionFrameBoundaryToGridTick({
        frame: 1,
        frameRate: { numerator: 30_000, denominator: 1_001 },
        ticksPerSecond: 1_000,
        rounding: "nearest",
      }),
      milliseconds30000_2: productionFrameBoundaryToGridTick({
        frame: 2,
        frameRate: { numerator: 30_000, denominator: 1_001 },
        ticksPerSecond: 1_000,
        rounding: "nearest",
      }),
      sample24000_1: productionFrameBoundaryToGridTick({
        frame: 1,
        frameRate: { numerator: 24_000, denominator: 1_001 },
        ticksPerSecond: 48_000,
        rounding: "nearest",
      }),
      milliseconds24000_1: productionFrameBoundaryToGridTick({
        frame: 1,
        frameRate: { numerator: 24_000, denominator: 1_001 },
        ticksPerSecond: 1_000,
        rounding: "nearest",
      }),
    },
    {
      sample30000_1: 1_602,
      sample30000_2: 3_203,
      milliseconds30000_1: 33,
      milliseconds30000_2: 67,
      sample24000_1: 2_002,
      milliseconds24000_1: 42,
    },
  );
  TestValidator.equals(
    "rounding policies and positive intervals preserve exact boundaries",
    {
      zero: productionFrameBoundaryToGridTick({
        frame: 0,
        frameRate: { numerator: 2, denominator: 1 },
        ticksPerSecond: 1,
        rounding: "nearest",
      }),
      halfUp: productionFrameBoundaryToGridTick({
        frame: 1,
        frameRate: { numerator: 2, denominator: 1 },
        ticksPerSecond: 1,
        rounding: "nearest",
      }),
      floor: productionFrameBoundaryToGridTick({
        frame: 1,
        frameRate: { numerator: 3, denominator: 1 },
        ticksPerSecond: 1,
        rounding: "floor",
      }),
      ceiling: productionFrameBoundaryToGridTick({
        frame: 1,
        frameRate: { numerator: 3, denominator: 1 },
        ticksPerSecond: 1,
        rounding: "ceiling",
      }),
      exactCeiling: productionFrameBoundaryToGridTick({
        frame: 1,
        frameRate: { numerator: 1, denominator: 1 },
        ticksPerSecond: 1,
        rounding: "ceiling",
      }),
      interval: productionFrameIntervalToGridTicks({
        startFrame: 1,
        endFrame: 2,
        frameRate: { numerator: 24, denominator: 1 },
        ticksPerSecond: 1_000,
        rounding: "nearest",
      }),
    },
    {
      zero: 0,
      halfUp: 1,
      floor: 0,
      ceiling: 1,
      exactCeiling: 1,
      interval: { start: 42, end: 83 },
    },
  );
  TestValidator.equals(
    "invalid, ambiguous, unsafe, and collapsed clocks fail closed",
    {
      fractionalScalar: refused(
        () => canonicalProductionFrameRate(29.97),
        "exact numerator and denominator",
      ),
      zeroNumerator: refused(
        () => canonicalProductionFrameRate({ numerator: 0, denominator: 1 }),
        "positive safe-integer terms",
      ),
      negativeDenominator: refused(
        () => canonicalProductionFrameRate({ numerator: 24, denominator: -1 }),
        "positive safe-integer terms",
      ),
      nonIntegerNumerator: refused(
        () =>
          canonicalProductionFrameRate({ numerator: 23.98, denominator: 1 }),
        "positive safe-integer terms",
      ),
      mismatchedDisplay: refused(
        () =>
          resolveProductionFrameRate({
            fps: 29.97,
            frameRate: { numerator: 30_000, denominator: 1_001 },
          }),
        "does not equal",
      ),
      negativeFrame: refused(
        () =>
          productionFrameBoundaryToGridTick({
            frame: -1,
            frameRate: { numerator: 24, denominator: 1 },
            ticksPerSecond: 1_000,
            rounding: "nearest",
          }),
        "nonnegative safe integer",
      ),
      zeroClock: refused(
        () =>
          productionFrameBoundaryToGridTick({
            frame: 1,
            frameRate: { numerator: 24, denominator: 1 },
            ticksPerSecond: 0,
            rounding: "nearest",
          }),
        "positive safe integer",
      ),
      overflow: refused(
        () =>
          productionFrameBoundaryToGridTick({
            frame: Number.MAX_SAFE_INTEGER,
            frameRate: { numerator: 1, denominator: 1 },
            ticksPerSecond: Number.MAX_SAFE_INTEGER,
            rounding: "nearest",
          }),
        "exceeds the safe",
      ),
      reversed: refused(
        () =>
          productionFrameIntervalToGridTicks({
            startFrame: 2,
            endFrame: 1,
            frameRate: { numerator: 24, denominator: 1 },
            ticksPerSecond: 1_000,
            rounding: "nearest",
          }),
        "positive frame duration",
      ),
      collapsed: refused(
        () =>
          productionFrameIntervalToGridTicks({
            startFrame: 0,
            endFrame: 1,
            frameRate: { numerator: 3_000, denominator: 1 },
            ticksPerSecond: 1_000,
            rounding: "nearest",
          }),
        "collapses",
      ),
      offGridTime: isProductionFrameTime(0.04, {
        numerator: 24_000,
        denominator: 1_001,
      }),
      nonFiniteTime: isProductionFrameTime(Number.NaN, 24),
      invalidTimeRate: isProductionFrameTime(1, 29.97),
    },
    {
      fractionalScalar: true,
      zeroNumerator: true,
      negativeDenominator: true,
      nonIntegerNumerator: true,
      mismatchedDisplay: true,
      negativeFrame: true,
      zeroClock: true,
      overflow: true,
      reversed: true,
      collapsed: true,
      offGridTime: false,
      nonFiniteTime: false,
      invalidTimeRate: false,
    },
  );
};

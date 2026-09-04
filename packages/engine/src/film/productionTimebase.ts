import type { IAutoMovieProductionFrameRate } from "@automovie/interface";

/**
 * Reduce one positive production frame rate to its exact integer identity.
 *
 * Integer legacy rates remain lossless `n/1` inputs. Fractional rates require
 * an explicit numerator and denominator because a decimal display value does
 * not identify the rate that produced it.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-rational-time-ranges Preserves the authored frame clock as a reduced rational identity instead of a binary-float approximation.
 * @evidence specifications/editorial-render-and-delivery/rational-timeline-and-composition.md#spec-editorial-rational-timeline Implements the canonical rational timeline used by every destination clock.
 */
export const canonicalProductionFrameRate = (
  input: number | IAutoMovieProductionFrameRate,
): IAutoMovieProductionFrameRate => {
  if (typeof input === "number") {
    if (Number.isSafeInteger(input) === false || input <= 0)
      throw new Error(
        `A scalar production frame rate must be a positive safe integer, but was ${input}. Supply an exact numerator and denominator for a fractional rate.`,
      );
    return { numerator: input, denominator: 1 };
  }
  if (
    Number.isSafeInteger(input.numerator) === false ||
    input.numerator <= 0 ||
    Number.isSafeInteger(input.denominator) === false ||
    input.denominator <= 0
  )
    throw new Error(
      `Production frame rate ${input.numerator}/${input.denominator} must use positive safe-integer terms.`,
    );
  const divisor = greatestCommonDivisor(input.numerator, input.denominator);
  return {
    numerator: input.numerator / divisor,
    denominator: input.denominator / divisor,
  };
};

/**
 * Resolve the exact rate carried beside the legacy display scalar.
 *
 * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-rational-frame-rate Keeps a fractional delivery rate unambiguous while retaining lossless integer-rate compatibility.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Makes the canonical numerator and denominator authoritative over a decimal display projection.
 */
export const resolveProductionFrameRate = (props: {
  fps: number;
  frameRate?: IAutoMovieProductionFrameRate;
}): IAutoMovieProductionFrameRate => {
  const rate = canonicalProductionFrameRate(props.frameRate ?? props.fps);
  if (
    props.frameRate !== undefined &&
    props.fps !== rate.numerator / rate.denominator
  )
    throw new Error(
      `Production fps ${props.fps} does not equal its exact ${rate.numerator}/${rate.denominator} frame-rate identity.`,
    );
  return rate;
};

/**
 * Compare two frame rates by reduced integer identity.
 *
 * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-stream-synchronization Prevents approximately equal display rates from joining distinct media clocks.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Implements fieldwise rational clock equality at the delivery join.
 */
export const equalProductionFrameRates = (
  left: number | IAutoMovieProductionFrameRate,
  right: number | IAutoMovieProductionFrameRate,
): boolean => {
  const canonicalLeft = canonicalProductionFrameRate(left);
  const canonicalRight = canonicalProductionFrameRate(right);
  return (
    canonicalLeft.numerator === canonicalRight.numerator &&
    canonicalLeft.denominator === canonicalRight.denominator
  );
};

/**
 * Map one nonnegative film-frame boundary to deterministic seconds.
 *
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-film-time-mapping Maps every film-owned effect from the compiler clock rather than a tier-local output index.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Centralizes the single exact-rational frame-to-effect-clock conversion.
 */
export const productionFrameBoundaryToSeconds = (props: {
  frame: number;
  frameRate: IAutoMovieProductionFrameRate;
}): number => {
  if (Number.isSafeInteger(props.frame) === false || props.frame < 0)
    throw new Error(
      `Production frame boundary ${props.frame} must be a nonnegative safe integer.`,
    );
  const rate = canonicalProductionFrameRate(props.frameRate);
  return (props.frame * rate.denominator) / rate.numerator;
};

/**
 * Map one nonnegative film-frame boundary onto a destination integer clock.
 *
 * The conversion uses integer arithmetic exactly once. Nearest sends a
 * nonnegative half tick upward, and floor or ceiling remain explicit choices.
 *
 * @evidence requirements/editorial/rational-time-and-ranges.md#editorial-mixed-timebases Maps every destination clock from the same exact film-frame boundary.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#effect-film-time-step-boundary Implements an explicit integer division policy at the shared boundary.
 */
export const productionFrameBoundaryToGridTick = (props: {
  frame: number;
  frameRate: IAutoMovieProductionFrameRate;
  ticksPerSecond: number;
  rounding: "nearest" | "floor" | "ceiling";
}): number => {
  if (Number.isSafeInteger(props.frame) === false || props.frame < 0)
    throw new Error(
      `Production frame boundary ${props.frame} must be a nonnegative safe integer.`,
    );
  if (
    Number.isSafeInteger(props.ticksPerSecond) === false ||
    props.ticksPerSecond <= 0
  )
    throw new Error(
      `Destination clock ${props.ticksPerSecond} must be a positive safe integer.`,
    );
  const rate = canonicalProductionFrameRate(props.frameRate);
  const numerator =
    BigInt(props.frame) *
    BigInt(rate.denominator) *
    BigInt(props.ticksPerSecond);
  const denominator = BigInt(rate.numerator);
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const tick =
    props.rounding === "floor"
      ? quotient
      : props.rounding === "ceiling"
        ? quotient + (remainder === 0n ? 0n : 1n)
        : quotient + (remainder * 2n >= denominator ? 1n : 0n);
  if (tick > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(
      `Production frame boundary ${props.frame} exceeds the safe ${props.ticksPerSecond}-tick destination clock.`,
    );
  return Number(tick);
};

/**
 * Map one positive film interval and refuse a destination-grid collapse.
 *
 * @evidence requirements/delivery-and-accessibility/frame-rate-timebase-and-timecode.md#delivery-time-refusal Refuses a caption or media interval whose distinct frame boundaries cannot survive the selected destination grid.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-timecode-sync Preserves ordered exclusive boundaries after the one canonical conversion.
 */
export const productionFrameIntervalToGridTicks = (props: {
  startFrame: number;
  endFrame: number;
  frameRate: IAutoMovieProductionFrameRate;
  ticksPerSecond: number;
  rounding: "nearest" | "floor" | "ceiling";
}): { start: number; end: number } => {
  if (props.endFrame <= props.startFrame)
    throw new Error(
      `Production interval ${props.startFrame}..${props.endFrame} must have a positive frame duration.`,
    );
  const start = productionFrameBoundaryToGridTick({
    frame: props.startFrame,
    frameRate: props.frameRate,
    ticksPerSecond: props.ticksPerSecond,
    rounding: props.rounding,
  });
  const end = productionFrameBoundaryToGridTick({
    frame: props.endFrame,
    frameRate: props.frameRate,
    ticksPerSecond: props.ticksPerSecond,
    rounding: props.rounding,
  });
  if (end <= start)
    throw new Error(
      `Production interval ${props.startFrame}..${props.endFrame} collapses to ${start}..${end} on the ${props.ticksPerSecond}-tick destination clock.`,
    );
  return { start, end };
};

const greatestCommonDivisor = (left: number, right: number): number => {
  let a = left;
  let b = right;
  while (b !== 0) [a, b] = [b, a % b];
  return a;
};

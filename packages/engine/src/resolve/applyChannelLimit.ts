import { IAutoMovieChannelLimit } from "@automovie/interface";

import { channelKey } from "./channel";

/**
 * One component of a channel value that exceeded its bound and was clamped.
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Makes each applied channel-range correction visible instead of silently accepting it.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Defines the per-component result emitted when the constraint pass clamps a channel.
 * @author Samchon
 */
export interface IAutoMovieClampViolation {
  /**
   * Index of the offending component within the channel value vector.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Identifies the exact constrained degree of freedom that crossed its range.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Locates the corrected component in the channel constraint result.
   */
  component: number;

  /**
   * Which bound was crossed.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Distinguishes a lower-range breach from an upper-range breach.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Reports which side of the declared ROM constrained the value.
   */
  bound: "min" | "max";

  /**
   * The bound value the component was clamped to.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Preserves the declared numeric limit that resolved the invalid component.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Emits the applied constraint boundary beside the correction.
   */
  limit: number;

  /**
   * The component's value before clamping.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Keeps the requested out-of-range value available for diagnosis.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Records the requested component value before correction.
   */
  actual: number;
}

/**
 * The clamped value plus the list of bounds it crossed (empty if in range).
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Pairs a constrained channel value with its explicit correction receipt.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Defines the public result of one channel constraint pass.
 * @author Samchon
 */
export interface IAutoMovieClampOutcome {
  /**
   * The value after clamping, same length as the input.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Carries the channel value after every declared component range is enforced.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Emits the resolved channel state produced by the constraint pass.
   */
  value: number[];

  /**
   * Every component/bound that was exceeded, in component order.
   *
   * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Preserves one receipt for every applied component correction.
   * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Emits constraint findings in component order.
   */
  violations: IAutoMovieClampViolation[];
}

/**
 * The CONSTRAIN pass for one channel: clamp a sampled value to a channel limit
 * and, in the same walk, report every bound it crossed.
 *
 * This is the engine's unification of _resolve_ and _validate_: the very `[min,
 * max]` that pins a runaway pose back into range is the `[min, max]` whose
 * breach the LLM harness surfaces as a correction. A `null` side (or a
 * `null`/absent component within a side) leaves that direction free; bounds are
 * one-per-component matching the channel width
 * ({@link IAutoMovieChannelLimit}).
 *
 * @evidence requirements/actors/skeleton-rig-and-retargeting.md#actor-joint-range-constraints Enforces each declared component range while retaining the requested value in a violation.
 * @evidence specifications/performance-motion-and-staging/rig-deformation-and-retargeting.md#performance-rig-rom-control-driver-graph Emits the clamped channel with per-component correction receipts.
 * @author Samchon
 */
export const applyChannelLimit = (
  value: number[],
  limit: IAutoMovieChannelLimit,
): IAutoMovieClampOutcome => {
  const key = channelKey(limit.channel);
  validateFiniteValues(value, key);
  validateFiniteBounds(limit.min, key, "min", value.length);
  validateFiniteBounds(limit.max, key, "max", value.length);
  validateOrderedBounds(limit.min, limit.max, key);

  const out = value.slice();
  const violations: IAutoMovieClampViolation[] = [];
  for (let i = 0; i < out.length; ++i) {
    const lo = limit.min === null ? null : (limit.min[i] ?? null);
    if (lo !== null && out[i]! < lo) {
      violations.push({
        component: i,
        bound: "min",
        limit: lo,
        actual: out[i]!,
      });
      out[i] = lo;
    }
    const hi = limit.max === null ? null : (limit.max[i] ?? null);
    if (hi !== null && out[i]! > hi) {
      violations.push({
        component: i,
        bound: "max",
        limit: hi,
        actual: out[i]!,
      });
      out[i] = hi;
    }
  }
  return { value: out, violations };
};

const validateFiniteValues = (value: number[], key: string): void => {
  for (let i = 0; i < value.length; ++i)
    if (!Number.isFinite(value[i]!))
      throw new Error(
        `channel limit "${key}" value[${i}] must be finite, but was ${value[i]!}`,
      );
};

const validateFiniteBounds = (
  bounds: (number | null)[] | null,
  key: string,
  side: "min" | "max",
  width: number,
): void => {
  if (bounds === null) return;
  for (let i = 0; i < bounds.length; ++i) {
    const bound = bounds[i];
    if (bound === null) continue;
    if (i >= width)
      throw new Error(
        `channel limit "${key}" ${side}[${i}] is outside value width ${width}, but was ${bound}`,
      );
    if (!Number.isFinite(bound))
      throw new Error(
        `channel limit "${key}" ${side}[${i}] must be finite, but was ${bound}`,
      );
  }
};

const validateOrderedBounds = (
  min: (number | null)[] | null,
  max: (number | null)[] | null,
  key: string,
): void => {
  if (min === null || max === null) return;
  const length = Math.max(min.length, max.length);
  for (let i = 0; i < length; ++i) {
    const lo = min[i] ?? null;
    const hi = max[i] ?? null;
    if (lo !== null && hi !== null && lo > hi)
      throw new Error(
        `channel limit "${key}" min[${i}] must be <= max[${i}], but was ${lo} > ${hi}`,
      );
  }
};

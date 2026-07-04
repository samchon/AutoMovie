import { IautomovieChannelLimit } from "@automovie/interface";

/** One component of a channel value that exceeded its bound and was clamped. */
export interface IautomovieClampViolation {
  /** Index of the offending component within the channel value vector. */
  component: number;

  /** Which bound was crossed. */
  bound: "min" | "max";

  /** The bound value the component was clamped to. */
  limit: number;

  /** The component's value before clamping. */
  actual: number;
}

/** The clamped value plus the list of bounds it crossed (empty if in range). */
export interface IautomovieClampOutcome {
  /** The value after clamping, same length as the input. */
  value: number[];

  /** Every component/bound that was exceeded, in component order. */
  violations: IautomovieClampViolation[];
}

/**
 * The CONSTRAIN pass for one channel: clamp a sampled value to a channel limit
 * and, in the same walk, report every bound it crossed.
 *
 * This is the engine's unification of _resolve_ and _validate_: the very `[min,
 * max]` that pins a runaway pose back into range is the `[min, max]` whose
 * breach the LLM harness surfaces as a correction. A `null` side (or a
 * `null`/absent component within a side) leaves that direction free; bounds are
 * one-per-component matching the channel width ({@link IautomovieChannelLimit}).
 *
 * @author Samchon
 */
export const applyChannelLimit = (
  value: number[],
  limit: IautomovieChannelLimit,
): IautomovieClampOutcome => {
  const out = value.slice();
  const violations: IautomovieClampViolation[] = [];
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

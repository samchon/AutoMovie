/**
 * The lower index of the segment straddling `time` in a strictly increasing
 * sequence of `length` key times read through `timeAt`: the `lo` in `[0,
 * length
 *
 * - 2]`with`timeAt(lo) <= time <= timeAt(lo + 1)`, resolving an exact hit on an
 *   interior key to the segment ENDING at it (so `time === timeAt(k)`yields`lo
 *   === k - 1`). That tie rule reproduces the historical front-to-back linear
 *   scan the pose and track samplers used, so swapping this binary search in
 *   leaves every interpolated result byte-identical.
 *
 * Runs in `O(log length)`. The caller must already have handled the ends (`time
 * <= timeAt(0)` and `time >= timeAt(length - 1)`); this searches the strict
 * interior `timeAt(0) < time < timeAt(length - 1)`, where `length >= 2` and the
 * answer is in `[0, length - 2]`.
 *
 * The accessor form (rather than a `readonly number[]`) lets the pose sampler
 * search keyframes without materializing a times array on the hot path.
 *
 * @author Samchon
 */
export const segmentIndex = (
  length: number,
  timeAt: (index: number) => number,
  time: number,
): number => {
  // Lower bound: the first index whose key time is >= `time`. The interior
  // precondition puts that index in [1, length - 1], so the straddling segment
  // is [bound - 1, bound]; the search starts at 1 because timeAt(0) < time.
  let lo = 1;
  let hi = length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (timeAt(mid) < time) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
};

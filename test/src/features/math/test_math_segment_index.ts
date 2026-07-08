import { segmentIndex } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

/**
 * The shared binary segment search under the pose and track samplers must pick
 * exactly the segment the historical front-to-back linear scan did — otherwise
 * an exact-keyframe hit could resolve to a different (equal-in-value but not
 * byte-identical) segment. This pins the equivalence and the endpoint tie rule
 * directly on the helper, so the sampler byte-identity follows by
 * construction.
 *
 * Scenarios:
 *
 * 1. Against a naive linear scan over several strictly increasing arrays (length
 *    2, 3, an irregular grid, and a 200-key ramp) at a dense set of interior
 *    query times (every segment midpoint, every interior key, and two off-grid
 *    points) → identical index everywhere.
 * 2. The tie rule and boundaries explicitly: a length-2 array yields 0 (the loop
 *    body never runs); an exact hit on interior key k resolves to segment [k-1,
 *    k]; a strictly-interior time resolves to its straddling segment.
 */

// The pre-optimization behavior: the first i with times[i] <= time <=
// times[i+1], given times[0] < time < times[last] — the exact scan both
// samplers ran before the binary search replaced it.
const linearSegment = (times: readonly number[], time: number): number => {
  for (let i = 0; i < times.length - 1; ++i)
    if (time >= times[i]! && time <= times[i + 1]!) return i;
  throw new Error("time outside interior");
};

const at =
  (times: readonly number[]) =>
  (i: number): number =>
    times[i]!;

export const test_math_segment_index = (): void => {
  const arrays: number[][] = [
    [0, 1],
    [0, 1, 2],
    [0, 0.5, 2, 2.25, 10],
    Array.from({ length: 200 }, (_, i) => i * 0.5),
  ];

  for (const times of arrays) {
    const last = times[times.length - 1]!;
    const queries: number[] = [];
    for (let i = 0; i < times.length - 1; ++i)
      queries.push((times[i]! + times[i + 1]!) / 2); // segment midpoints
    for (let i = 1; i < times.length - 1; ++i) queries.push(times[i]!); // interior keys
    queries.push(times[0]! + (last - times[0]!) * 0.137); // off-grid low
    queries.push(times[0]! + (last - times[0]!) * 0.911); // off-grid high

    for (const time of queries)
      if (time > times[0]! && time < last)
        TestValidator.equals(
          `segmentIndex matches linear scan (len ${times.length}, t=${time})`,
          segmentIndex(times.length, at(times), time),
          linearSegment(times, time),
        );
  }

  const t = [0, 1, 2, 3];
  TestValidator.equals(
    "length-2 array yields 0 (loop body never runs)",
    segmentIndex(2, at([0, 5]), 3),
    0,
  );
  TestValidator.equals(
    "exact interior key k=1 resolves to segment [0,1]",
    segmentIndex(4, at(t), 1),
    0,
  );
  TestValidator.equals(
    "exact interior key k=2 resolves to segment [1,2]",
    segmentIndex(4, at(t), 2),
    1,
  );
  TestValidator.equals(
    "midpoint of the first segment resolves to 0",
    segmentIndex(4, at(t), 0.5),
    0,
  );
  TestValidator.equals(
    "midpoint of the last segment resolves to 2",
    segmentIndex(4, at(t), 2.5),
    2,
  );
};

import { applyChannelLimit } from "@automovie/engine";
import {
  IAutoMovieChannel,
  IAutoMovieChannelLimit,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

const CHANNEL: IAutoMovieChannel = {
  kind: "node",
  node: "n",
  path: "translation",
};

const limit = (
  min: (number | null)[] | null,
  max: (number | null)[] | null,
): IAutoMovieChannelLimit => ({ channel: CHANNEL, min, max });

/**
 * The CONSTRAIN pass: clamp a value to a channel limit and report every bound
 * it crossed, with the `null`-side / `null`-component freedoms.
 *
 * Scenarios:
 *
 * 1. A both-sides-null limit clamps nothing and reports no violation — the value
 *    passes through untouched.
 * 2. A mixed limit (`min=[0,null,-5]`, `max=[10,null,50]`) on `[-3,99,100]`:
 *    component 0 underflows and clamps up to 0, component 1 is free on both
 *    sides (null component), component 2 overflows and clamps down to 50. The
 *    two violations are reported in component order with their bound, limit,
 *    and pre-clamp actual.
 * 3. A value already inside the bounds yields the value verbatim and no violations
 *    (the not-below / not-above sides of both comparisons).
 * 4. A component with both bounds present rejects when `min > max`, because no
 *    clamp result can satisfy both sides of that range.
 * 5. Non-null bound components beyond the sampled value width reject instead of
 *    being silently ignored.
 */
export const test_resolve_channel_limit = (): void => {
  // 1. both sides null → untouched
  const free = applyChannelLimit([1, 2, 3], limit(null, null));
  TestValidator.equals("null limit keeps value", free.value, [1, 2, 3]);
  TestValidator.equals(
    "null limit has no violations",
    free.violations.length,
    0,
  );

  // 2. mixed under/over/free
  const mixed = applyChannelLimit(
    [-3, 99, 100],
    limit([0, null, -5], [10, null, 50]),
  );
  TestValidator.equals("mixed clamp value", mixed.value, [0, 99, 50]);
  TestValidator.equals("mixed clamp violations", mixed.violations, [
    { component: 0, bound: "min", limit: 0, actual: -3 },
    { component: 2, bound: "max", limit: 50, actual: 100 },
  ]);

  // 3. within range → untouched, both comparisons take the "not crossed" side
  const inside = applyChannelLimit([5, 5, 5], limit([0, 0, 0], [10, 10, 10]));
  TestValidator.equals("in-range keeps value", inside.value, [5, 5, 5]);
  TestValidator.equals(
    "in-range has no violations",
    inside.violations.length,
    0,
  );

  TestValidator.predicate(
    "non-finite channel value rejects",
    throwsError(
      () => applyChannelLimit([1, Number.NaN, 3], limit(null, null)),
      ["node:n:translation", "value[1]", "finite", "NaN"],
    ),
  );

  TestValidator.predicate(
    "non-finite min bound rejects",
    throwsError(
      () => applyChannelLimit([1, 2, 3], limit([0, Infinity, null], null)),
      ["node:n:translation", "min[1]", "finite", "Infinity"],
    ),
  );

  TestValidator.predicate(
    "non-finite max bound rejects",
    throwsError(
      () => applyChannelLimit([1, 2, 3], limit(null, [10, Number.NaN, null])),
      ["node:n:translation", "max[1]", "finite", "NaN"],
    ),
  );

  TestValidator.predicate(
    "inverted component range rejects",
    throwsError(
      () =>
        applyChannelLimit([7, 2, 3], limit([10, null, null], [5, null, null])),
      ["node:n:translation", "min[0]", "10", "max[0]", "5"],
    ),
  );

  TestValidator.predicate(
    "extra min component rejects",
    throwsError(
      () => applyChannelLimit([5], limit([0, 10], null)),
      ["node:n:translation", "min[1]", "value width", "1", "10"],
    ),
  );

  TestValidator.predicate(
    "extra max component rejects",
    throwsError(
      () => applyChannelLimit([5], limit(null, [10, 20])),
      ["node:n:translation", "max[1]", "value width", "1", "20"],
    ),
  );
};

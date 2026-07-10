import { IForgeHeadMorph, morphHead } from "@automovie/forge";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/**
 * A sparse morph delta targeting a vertex outside the base is a structural
 * defect and throws (#1107): the write would read `undefined` and silently
 * EXTEND the array with NaN holes — poisoned vertices that vanish or explode
 * the bounds far from the actual defect, the same silent NaN ride #1043 closed
 * for the amplitude fit.
 *
 * Scenarios (two-vertex base, indices 0..1):
 *
 * 1. An out-of-range index (2) throws naming the morph, the delta ordinal, and the
 *    vertex count.
 * 2. A negative index throws.
 * 3. A fractional index throws.
 * 4. Negative twin: the boundary index (1, the last vertex) morphs fine.
 * 5. A defective morph left at value 0 stays skipped — the guard fires only on
 *    applied deltas.
 */
export const test_forge_head_morph_index_guard = (): void => {
  const base = [0, 0, 0, 1, 1, 1];
  const bad = (li: number): Record<string, IForgeHeadMorph> => ({
    a: { plus: [[li, 1, 0, 0]], minus: [] },
  });

  // 1. out-of-range index throws with morph, ordinal, and vertex count
  TestValidator.predicate(
    "an out-of-range delta index throws",
    throwsError(
      () => morphHead(base, bad(2), { a: 1 }),
      'morph "a" delta #0 targets vertex 2 outside the base\'s 2 vertices',
    ),
  );

  // 2. a negative index throws
  TestValidator.predicate(
    "a negative delta index throws",
    throwsError(() => morphHead(base, bad(-1), { a: 1 }), "targets vertex -1"),
  );

  // 3. a fractional index throws
  TestValidator.predicate(
    "a fractional delta index throws",
    throwsError(
      () => morphHead(base, bad(0.5), { a: 1 }),
      "targets vertex 0.5",
    ),
  );

  // 4. negative twin: the boundary index (last vertex) morphs fine
  TestValidator.equals(
    "the boundary index morphs the last vertex",
    morphHead(base, bad(1), { a: 1 }),
    [0, 0, 0, 2, 1, 1],
  );

  // 5. a zero value never applies the defective delta, so it stays skipped
  TestValidator.equals(
    "a zero-valued defective morph is skipped, not validated",
    morphHead(base, bad(9), { a: 0 }),
    base,
  );
};

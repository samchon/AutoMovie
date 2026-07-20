import { cutSequence } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

/**
 * Pins the film-level gates of the ASSEMBLE consumer: a film needs at least one
 * shot and a positive frame rate: an empty cut at 0 fps is not a short film, it
 * is nothing.
 *
 * Scenarios:
 *
 * 1. `fps: 0` and `entries: []` in one write → a `range` violation on `$input.fps`
 *    and a `type` violation on `$input.entries`.
 */
export const test_film_cut_sequence_empty = (): void => {
  const cut = cutSequence(
    {
      type: "write",
      sequence: { id: "seq-empty", name: "nothing" },
      fps: 0,
      entries: [],
      pacing: "n/a",
      continuity: "n/a",
    },
    [],
  );
  TestValidator.equals("fails", cut.success, false);
  TestValidator.predicate(
    "zero fps rejected",
    cut.success === false && hasViolation(cut, "range", "$input.fps"),
  );
  TestValidator.predicate(
    "empty cut rejected",
    cut.success === false && hasViolation(cut, "type", "$input.entries"),
  );
};

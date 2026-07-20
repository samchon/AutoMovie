import { locateOnBeat } from "@automovie/engine";
import { IAutoMovieConstraintViolation } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createScriptTree } from "../validation/test_validation_script_tree";

const sample = (): IAutoMovieConstraintViolation[] => [
  {
    kind: "physics",
    severity: "warning",
    path: "$input.support.overshoot",
    expected: "would topple",
    value: 0.2,
  },
  {
    kind: "type",
    severity: "error",
    path: "$input.id",
    expected: "must be a shot id",
    value: null,
  },
];

/**
 * LocateOnBeat stamps beat-scoped feedback onto the screenplay graph, and only
 * then: without a tree or a claiming node the input passes through unstamped,
 * and the originals are never mutated (a located copy is a new object).
 *
 * Scenarios:
 *
 * 1. With a tree that claims the beat, every violation gains `node` = the beat
 *    node's id, severity and paths untouched.
 * 2. The input objects are NOT mutated: the stamp lives on copies.
 * 3. A treeless call returns the violations without a `node` field.
 * 4. An unclaimed beat likewise passes through unstamped.
 */
export const test_film_locate_on_beat = (): void => {
  const tree = createScriptTree();
  const violations = sample();
  const located = locateOnBeat(violations, tree, "beat-1");
  TestValidator.equals(
    "every violation gains the beat node",
    located.map((violation) => violation.node),
    ["b1", "b1"],
  );
  TestValidator.equals(
    "severity and path ride along untouched",
    located.map((violation) => `${violation.severity}:${violation.path}`),
    ["warning:$input.support.overshoot", "error:$input.id"],
  );
  TestValidator.equals(
    "originals are not mutated",
    violations.every((violation) => violation.node === undefined),
    true,
  );

  const treeless = locateOnBeat(sample(), null, "beat-1");
  TestValidator.equals(
    "treeless call passes through unstamped",
    treeless.every((violation) => violation.node === undefined),
    true,
  );
  const unclaimed = locateOnBeat(sample(), tree, "beat-99");
  TestValidator.equals(
    "unclaimed beat passes through unstamped",
    unclaimed.every((violation) => violation.node === undefined),
    true,
  );
};

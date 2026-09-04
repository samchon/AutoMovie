import { TestValidator } from "@nestia/e2e";

import {
  changedOrder,
  describeInheritedGaps,
  inheritedGapsAreEmpty,
  rangeTouchesChange,
  spanIsDemanded,
} from "../../coverage/changedLineDemand";

/**
 * The demand is the lines the change occupies, and it still refuses.
 *
 * A rule that narrows what a gate asks for has to be watched refusing, or the
 * narrowing is indistinguishable from switching the gate off. Every scenario
 * here is read twice: once with the position on a changed line, where it is
 * refused, and once with the same position untouched, where it is excused and
 * said out loud.
 *
 * Scenarios:
 *
 * 1. A changed line's uncovered statement, branch and function are each refused
 *    by name, and the same file with nothing touched refuses none of them and
 *    reports what it excused instead.
 * 2. A statement spanning four lines, of which only the third changed, is
 *    refused. Anchoring on the span's first line would have excused it, which
 *    is an edit inside a statement that owes nothing.
 * 3. A position carrying no line at all is demanded, because an excuse is a
 *    claim about where the change reached and an unplaceable position offers no
 *    evidence for it.
 * 4. The search itself: a changed line before, inside, after and exactly on each
 *    end of a range, and an empty change set that touches nothing.
 */
export const test_workspace_changed_line_demand = (): void => {
  const span = (start: number, end: number = start) => ({
    end: { line: end },
    start: { line: start },
  });

  const order = changedOrder(new Set([9, 3, 1]));
  TestValidator.equals(
    "changed lines arrive ordered for the search",
    order,
    [1, 3, 9],
  );

  TestValidator.equals(
    "a range is touched only when a changed line falls inside it",
    {
      before: rangeTouchesChange({ end: 2, order: [5], start: 1 }),
      after: rangeTouchesChange({ end: 9, order: [5], start: 6 }),
      inside: rangeTouchesChange({ end: 9, order: [5], start: 1 }),
      lower: rangeTouchesChange({ end: 9, order: [5], start: 5 }),
      upper: rangeTouchesChange({ end: 5, order: [5], start: 1 }),
      empty: rangeTouchesChange({ end: 9, order: [], start: 1 }),
    },
    {
      before: false,
      after: false,
      inside: true,
      lower: true,
      upper: true,
      empty: false,
    },
  );

  TestValidator.equals(
    "a span is placed by every line it occupies, and an unplaceable one is demanded",
    {
      // Scenario 2: the edit is at line 12, inside a statement opening at 10.
      interior: spanIsDemanded({ order: [12], span: span(10, 13) }),
      untouched: spanIsDemanded({ order: [30], span: span(10, 13) }),
      // Scenario 3, in its three shapes: no span, no lines, and an end with no
      // start, which is still a line the position can be placed on.
      absent: spanIsDemanded({ order: [1], span: undefined }),
      lineless: spanIsDemanded({ order: [1], span: {} }),
      endOnly: spanIsDemanded({ order: [4], span: { end: { line: 4 } } }),
      endMissed: spanIsDemanded({ order: [5], span: { end: { line: 4 } } }),
      // An end before its start is not a range; the start alone places it.
      inverted: spanIsDemanded({ order: [10], span: span(10, 2) }),
      invertedMissed: spanIsDemanded({ order: [2], span: span(10, 2) }),
      untrackedWholeFile: spanIsDemanded({
        order: [],
        span: span(10, 13),
        wholeFile: true,
      }),
    },
    {
      interior: true,
      untouched: false,
      absent: true,
      lineless: true,
      endOnly: true,
      endMissed: false,
      inverted: true,
      invertedMissed: false,
      untrackedWholeFile: true,
    },
  );

  TestValidator.equals(
    "an empty excused population is distinguished from one worth stating",
    {
      empty: inheritedGapsAreEmpty({
        branches: 0,
        functions: 0,
        statements: 0,
      }),
      branch: inheritedGapsAreEmpty({
        branches: 1,
        functions: 0,
        statements: 0,
      }),
      fn: inheritedGapsAreEmpty({ branches: 0, functions: 1, statements: 0 }),
      statement: inheritedGapsAreEmpty({
        branches: 0,
        functions: 0,
        statements: 1,
      }),
      singular: describeInheritedGaps({
        file: "a.ts",
        gaps: { branches: 1, functions: 1, statements: 1 },
      }),
      plural: describeInheritedGaps({
        file: "a.ts",
        gaps: { branches: 2, functions: 0, statements: 3 },
      }),
    },
    {
      empty: true,
      branch: false,
      fn: false,
      statement: false,
      singular:
        "INHERITED GAP: a.ts carries 1 statement, 1 branch, 1 function uncovered" +
        " on lines this change did not touch; closing them is its own work",
      plural:
        "INHERITED GAP: a.ts carries 3 statements, 2 branches, 0 functions uncovered" +
        " on lines this change did not touch; closing them is its own work",
    },
  );
};

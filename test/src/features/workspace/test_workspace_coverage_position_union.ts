import { TestValidator } from "@nestia/e2e";

import {
  type ICoverageEntry,
  unionEntries,
  unionEntryByLine,
} from "../../coverage/shapeReconciliation";

/**
 * The fullest single reading is not a union, and the shortfall was measured.
 *
 * Shape-consistent groups each report what their own processes ran, and taking
 * the best of them recovers a file whose coverage sits whole in one group. It
 * does nothing for a file whose coverage is split, because a record is assigned
 * to a group by every URL it carries: one unrelated file's shape conflict is
 * enough to separate two records that both saw this file.
 *
 * `build/experimental.ts` is that case. Across the groups of one real run its
 * statement coverage reads 185, 138, 214 and 247 of 261. The shipped rule takes
 * 247. Folding the groups by position takes **260**, which is what c8 reports
 * for the same records read together, and the difference is the thirteen
 * statements no single group saw all of.
 *
 * Positions are what two shapes have in common. Identifiers differ between
 * emitted forms and cannot be matched; line numbers are the source's own and
 * can. The granularity is therefore the line, which is the honest limit: two
 * statements on one line cannot be told apart, and one of them covered marks
 * both. Saying that is better than claiming an exactness the identifiers do not
 * support.
 *
 * Scenarios:
 *
 * 1. The structure comes from the reading with the most positions, so what is
 *    returned is a shape c8 produced rather than one assembled here.
 * 2. A position keeps its own hits, takes a single hit from a line another
 *    group ran, and stays at zero when no group ran it. Nothing is marked run
 *    that no process ran.
 * 3. Functions and branches fold the same way, and a branch keeps its own count
 *    where it has one.
 * 4. Files are folded independently, one no other group knows is carried
 *    through, and an empty set of readings yields nothing rather than an
 *    invented entry.
 */
export const test_workspace_coverage_position_union = (): void => {
  const span = (line: number) => ({ start: { line } });
  const thin: ICoverageEntry = {
    b: {},
    branchMap: {},
    f: {},
    fnMap: {},
    s: { 0: 0 },
    statementMap: { 0: span(1) },
  };
  const base: ICoverageEntry = {
    b: { 0: [1, 0] },
    branchMap: { 0: { locations: [span(9), span(10)] } },
    f: { 0: 2, 1: 0 },
    fnMap: { 0: { loc: span(5) }, 1: { loc: span(6) } },
    s: { 0: 3, 1: 0, 2: 0 },
    statementMap: { 0: span(1), 1: span(2), 2: span(3) },
  };
  const sibling: ICoverageEntry = {
    // A different emitted form: the same lines, different identifiers.
    b: { 7: [0, 4] },
    branchMap: { 7: { locations: [span(9), span(10)] } },
    f: { 9: 1 },
    fnMap: { 9: { loc: span(6) } },
    s: { 4: 1 },
    statementMap: { 4: span(2) },
  };

  const folded = unionEntryByLine([thin, base, sibling]);
  TestValidator.equals(
    "the fullest structure carries every line another group ran",
    {
      statements: folded?.s,
      functions: folded?.f,
      branches: folded?.b,
      // Line 3 is in no group's covered set, so it stays at zero.
      structure: Object.keys(folded?.statementMap ?? {}),
    },
    {
      statements: { 0: 3, 1: 1, 2: 0 },
      functions: { 0: 2, 1: 1 },
      branches: { 0: [1, 1] },
      structure: ["0", "1", "2"],
    },
  );

  // A reading c8 wrote before it knew the shape: no maps at all, a span with no
  // line, a branch with no locations, and a hit list shorter than the locations
  // it belongs to. Each is an ordinary reading to fold, not an error to guard.
  const ragged: ICoverageEntry = {};
  const partial: ICoverageEntry = {
    b: { 0: [] },
    branchMap: { 0: { locations: [span(9), {}] }, 1: {} },
    f: { 0: 0 },
    fnMap: { 0: { loc: {} } },
    s: { 0: 0, 1: 0 },
    statementMap: { 0: {}, 1: span(1) },
  };
  const rough = unionEntryByLine([ragged, partial, base]);
  TestValidator.equals(
    "a reading with missing maps and lineless positions folds without inventing",
    {
      statements: rough?.s,
      functions: rough?.f,
      branches: rough?.b,
      alone: unionEntryByLine([ragged]),
    },
    {
      // `base` has three positions and wins the base; line 1 ran there already.
      statements: { 0: 3, 1: 0, 2: 0 },
      functions: { 0: 2, 1: 0 },
      branches: { 0: [1, 0] },
      // Folding always states the three counter maps, empty where the reading
      // carried none, so a consumer never has to ask whether they are there.
      alone: { b: {}, f: {}, s: {} },
    },
  );

  // Positions with no counter beside them: a map naming an identifier the hit
  // record never mentions. It reads as unrun, and folds like anything else.
  const uncounted: ICoverageEntry = {
    // Two ways a branch position arrives with no counter: a hit list shorter
    // than its locations, and an identifier the hit record never names.
    b: { 1: [] },
    // Plus a branch that names no locations at all, which folds to no
    // positions rather than to a position nobody can point at.
    branchMap: {
      0: { locations: [span(9)] },
      1: { locations: [span(9)] },
      2: {},
    },
    fnMap: { 0: { loc: span(5) } },
    statementMap: { 0: span(1), 1: span(7), 2: span(8), 3: span(9) },
  };
  const counted = unionEntryByLine([uncounted, base]);
  TestValidator.equals(
    "a position with no counter reads as unrun and still takes its line",
    {
      statements: counted?.s,
      functions: counted?.f,
      branches: counted?.b,
      // And a reading that names branch positions with no hit record at all.
      recordless: unionEntryByLine([
        {
          branchMap: { 0: { locations: [span(9)] } },
          statementMap: { 0: span(1), 1: span(7), 2: span(8), 3: span(9) },
        },
        base,
      ])?.b,
    },
    {
      statements: { 0: 1 },
      functions: { 0: 1 },
      branches: { 0: [1], 1: [1], 2: [] },
      recordless: { 0: [1] },
    },
  );

  TestValidator.equals(
    "files fold independently and nothing is invented",
    {
      folded: unionEntries([
        { "a.ts": base, "b.ts": thin },
        { "a.ts": sibling },
      ]),
      empty: unionEntries([]),
      none: unionEntryByLine([]),
    },
    {
      folded: {
        "a.ts": {
          ...base,
          b: { 0: [1, 1] },
          f: { 0: 2, 1: 1 },
          s: { 0: 3, 1: 1, 2: 0 },
        },
        "b.ts": thin,
      },
      empty: {},
      none: undefined,
    },
  );
};

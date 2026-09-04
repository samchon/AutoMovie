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
 * Positions are what two shapes have in common. Report-local numeric ids differ
 * between emitted forms, so the fold matches the complete source span instead:
 * kind, start/end line and column, plus function declaration/name or branch
 * parent and arm. Two positions on one line therefore remain independent.
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
  const span = (line: number, column: number = 0) => ({
    start: { line, column },
    end: { line, column: column + 1 },
  });
  const fn = (name: string, line: number) => ({
    name,
    decl: span(line),
    loc: span(line),
  });
  const branch = (locations: ReturnType<typeof span>[]) => ({
    type: "if",
    loc: span(locations[0]?.start.line ?? 0),
    locations,
  });
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
    branchMap: { 0: branch([span(9), span(10)]) },
    f: { 0: 2, 1: 0 },
    fnMap: { 0: fn("first", 5), 1: fn("second", 6) },
    s: { 0: 3, 1: 0, 2: 0 },
    statementMap: { 0: span(1), 1: span(2), 2: span(3) },
  };
  const sibling: ICoverageEntry = {
    // A different emitted form: the same lines, different identifiers.
    b: { 7: [0, 4] },
    branchMap: { 7: branch([span(9), span(10)]) },
    f: { 9: 1 },
    fnMap: { 9: fn("second", 6) },
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

  const collisions = unionEntryByLine([
    base,
    {
      b: { 4: [1] },
      branchMap: { 4: branch([span(10, 8)]) },
      f: { 4: 1 },
      fnMap: { 4: fn("second", 60) },
      s: { 4: 1 },
      statementMap: { 4: span(2, 8) },
    },
  ]);
  TestValidator.equals(
    "same-line and same-name collisions do not transfer hits",
    {
      statement: collisions?.s?.[1],
      function: collisions?.f?.[1],
      branch: collisions?.b?.[0]?.[1],
    },
    { statement: 0, function: 0, branch: 0 },
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
  // record never mentions. It reads as unrun, so it does not become the base --
  // that is what keeps an `--all` entry for a file a group never loaded, whose
  // positions are one per source line including comments, from deciding the
  // structure. `base` ran, so `base` stays the structure and this reading
  // contributes only the lines it saw run, which is none.
  const uncounted: ICoverageEntry = {
    // Two ways a branch position arrives with no counter: a hit list shorter
    // than its locations, and an identifier the hit record never names.
    // One position that ran, so this reading outranks `base` and becomes the
    // structure; the rest arrive with no counter beside them.
    b: { 1: [] },
    s: { 0: 1 },
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
      // The larger reading is the structure, but incomplete identities borrow
      // no hits from positions that merely share their source line.
      statements: { 0: 1 },
      functions: {},
      branches: { 0: [0], 1: [0], 2: [] },
      recordless: { 0: [1, 0] },
    },
  );

  // The `--all` shape: an entry for a file this group never loaded, carrying one
  // position per source line -- comments and blanks among them -- with nothing
  // run. It has the most positions of anything here and must still lose, or the
  // fold would report every comment as an uncovered statement.
  const synthesized: ICoverageEntry = {
    b: {},
    branchMap: {},
    f: { 0: 0 },
    fnMap: { 0: { loc: span(5) } },
    s: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    statementMap: {
      0: span(1),
      1: span(2),
      2: span(3),
      3: span(4),
      4: span(5),
      5: span(6),
    },
  };
  TestValidator.equals(
    "a reading that ran outranks a larger one that did not",
    {
      structure: Object.keys(
        unionEntryByLine([synthesized, base])?.statementMap ?? {},
      ),
      statements: unionEntryByLine([synthesized, base])?.s,
      // With nothing that ran, the largest reading is still the only structure
      // available, so it is taken rather than refused.
      aloneStructure: Object.keys(
        unionEntryByLine([thin, synthesized])?.statementMap ?? {},
      ),
      // The same comparison with the arrival order reversed.
      reversed: Object.keys(
        unionEntryByLine([base, synthesized])?.statementMap ?? {},
      ),
    },
    {
      structure: ["0", "1", "2"],
      statements: { 0: 3, 1: 0, 2: 0 },
      aloneStructure: ["0", "1", "2", "3", "4", "5"],
      reversed: ["0", "1", "2"],
    },
  );

  // Splitting by shape assumed a differing shape means a lossy merge. It is
  // true of one measured file and false of another: c8 folds three shapes of
  // `build/experimental.ts` to 302 of 304 statements, where splitting them into
  // groups and folding back reached only 184. So the report c8 already wrote is
  // one more reading, and taking the fullest of all of them is what makes this
  // never worse than the merge it replaces.
  const groupA: ICoverageEntry = {
    b: {},
    branchMap: {},
    f: {},
    fnMap: {},
    s: { 0: 1, 1: 0, 2: 0 },
    statementMap: { 0: span(1), 1: span(2), 2: span(3) },
  };
  const groupB: ICoverageEntry = {
    b: {},
    branchMap: {},
    f: {},
    fnMap: {},
    s: { 0: 0, 1: 1, 2: 0 },
    statementMap: { 0: span(1), 1: span(2), 2: span(3) },
  };
  const alreadyMerged: ICoverageEntry = {
    b: {},
    branchMap: {},
    f: {},
    fnMap: {},
    s: { 0: 1, 1: 1, 2: 1 },
    statementMap: { 0: span(1), 1: span(2), 2: span(3) },
  };
  TestValidator.equals(
    "a merge the groups cannot beat is kept rather than replaced",
    {
      groupsAlone: unionEntryByLine([groupA, groupB])?.s,
      withMerged: unionEntryByLine([groupA, groupB, alreadyMerged])?.s,
    },
    {
      // Lines 1 and 2 ran in some group; line 3 ran in neither, and only the
      // merged reading saw it.
      groupsAlone: { 0: 1, 1: 1, 2: 0 },
      withMerged: { 0: 1, 1: 1, 2: 1 },
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

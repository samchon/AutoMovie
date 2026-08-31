import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  type GitExecute,
  type IIstanbulFileCoverage,
  collectGitChangedLines,
  inspectChangedCoverage,
  isAuthoredExecutableSource,
  parseChangedCoverageArguments,
  parseChangedLines,
  reportChangedCoverage,
  resolveCoverageBase,
  runChangedCoverageGate,
  runGit,
} from "../../coverage/changedCoverage";
import {
  inspectCoveragePopulation,
  repositoryCandidates,
  runCoveragePopulationGate,
} from "../../coverage/coveragePopulation";
import {
  type ICoverageMeasurementDependencies,
  type ICoverageSpawnResult,
  MEASURED_LINES,
  MEASURED_SOURCES,
  coverageIncludes,
  coverageMissingScripts,
  coverageRecordCount,
  coverageRecords,
  coverageScriptShapes,
  coverageSourceHostDirectory,
  coverageSourceRoots,
  coverageTemporaryDirectory,
  measureCoverage,
  removeCoverageTemporaryDirectory,
  writeMeasuredLines,
  writeMeasuredSources,
} from "../../coverage/measureCoverage";

interface IScenario {
  name: string;
  run: () => void;
}

interface IRawFixtureFunction {
  functionName?: string;
  ranges?: Array<{ startOffset?: number }>;
}

interface IRawFixtureScript {
  functions?: IRawFixtureFunction[];
  url?: string;
}

interface IMeasuredCoverageFixture {
  coverage: Record<string, IIstanbulFileCoverage>;
  report: string;
}

const isIstanbulFileCoverage = (
  value: unknown,
): value is IIstanbulFileCoverage =>
  typeof value === "object" && value !== null && Array.isArray(value) === false;

const readUnknownRecord = (file: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${file} does not contain a JSON object`);
  return Object.fromEntries(Object.entries(value));
};

const readCoverageRecord = (
  file: string,
): Record<string, IIstanbulFileCoverage> => {
  const output: Record<string, IIstanbulFileCoverage> = {};
  for (const [name, value] of Object.entries(readUnknownRecord(file))) {
    if (isIstanbulFileCoverage(value) === false)
      throw new Error(`${file} has a non-object coverage entry for ${name}`);
    output[name] = value;
  }
  return output;
};

const scenarios: IScenario[] = [];
const test = (name: string, run: () => void): void => {
  scenarios.push({ name, run });
};

const hash = (text: string): string =>
  crypto.createHash("sha256").update(text).digest("hex");

test("parses new-side diff lines and recognizes authored executable source", () => {
  const changed = parseChangedLines(
    [
      "diff --git a/packages/engine/src/a.ts b/packages/engine/src/a.ts",
      "--- a/packages/engine/src/a.ts",
      "+++ b/packages/engine/src/a.ts",
      "@@ -1 +1,2 @@",
      "+one",
      "+two",
      "diff --git a/packages/engine/src/deleted.ts b/packages/engine/src/deleted.ts",
      "--- a/packages/engine/src/deleted.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-gone",
      "",
    ].join("\n"),
  );
  assert.deepEqual(
    [...(changed.get("packages/engine/src/a.ts") ?? new Set<number>())],
    [1, 2],
  );
  assert.equal(changed.has("packages/engine/src/deleted.ts"), false);
  assert.deepEqual(
    [
      ...parseChangedLines(
        '+++ "b/packages/engine/src/quoted.ts"\n@@ -0,0 +3 @@\n+x\n',
      ).keys(),
    ],
    ["packages/engine/src/quoted.ts"],
  );
  assert.deepEqual(
    [
      ...parseChangedLines(
        '+++ "b/packages/engine/src/bad\\q.ts"\n@@ -0,0 +1 @@\n+x\n',
      ).keys(),
    ],
    ["packages/engine/src/bad/q.ts"],
  );
  assert.deepEqual(
    parseChangedLines("+++ b/a.ts\n@@ invalid @@\n"),
    new Map([["a.ts", new Set()]]),
  );
  assert.equal(isAuthoredExecutableSource("packages/engine/src/a.ts"), true);
  assert.equal(isAuthoredExecutableSource("packages/engine/src/a.tsx"), true);
  assert.equal(isAuthoredExecutableSource("packages/engine/src/a.cts"), true);
  assert.equal(isAuthoredExecutableSource("packages/engine/src/a.mts"), true);
  assert.equal(isAuthoredExecutableSource("packages/engine/src/a.js"), false);
  assert.equal(isAuthoredExecutableSource("packages/engine/src/a.mjs"), false);
  assert.equal(isAuthoredExecutableSource("packages/engine/src/a.cjs"), false);
  assert.equal(
    isAuthoredExecutableSource("packages/production/lint.config.ts"),
    true,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/playground/lint.config.ts"),
    true,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/playground/src/film-view.ts"),
    true,
  );
  assert.equal(isAuthoredExecutableSource("packages/cli/src/other.ts"), true);
  assert.equal(isAuthoredExecutableSource("build/tgz.ts"), true);
  assert.equal(isAuthoredExecutableSource("config/lint.config.ts"), true);
  assert.equal(isAuthoredExecutableSource("lint.config.ts"), true);
  assert.equal(
    isAuthoredExecutableSource("packages/template/build/syncVersions.ts"),
    true,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/playground/scripts/build-cat.ts"),
    true,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/engine/src/index.ts"),
    false,
  );
  assert.equal(isAuthoredExecutableSource("packages/cli/src/bin.ts"), false);
  assert.equal(isAuthoredExecutableSource("index.ts"), false);
  assert.equal(
    isAuthoredExecutableSource("packages/engine/src/types.d.ts"),
    false,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/engine/src/types.d.cts"),
    false,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/engine/src/types.d.mts"),
    false,
  );
  assert.equal(isAuthoredExecutableSource("test/src/features/a.ts"), false);
  // The two typed repository-tool roots are measured, so the gate has to judge
  // them. Both sit under `test/`, and one of them is additionally named
  // `coverage`, which is also the name of c8's own output directory. The
  // exemption covered the first rule and not the second, so the four modules
  // that implement the per-change obligation were measured and never judged.
  assert.equal(
    isAuthoredExecutableSource("test/src/coverage/measureCoverage.ts"),
    true,
  );
  assert.equal(
    isAuthoredExecutableSource("test/src/integrity/zeroJavaScript.ts"),
    true,
  );
  // The negative twin: a real coverage output directory is still refused, at the
  // repository root and inside a package, or the exemption above would have
  // bought the rule away instead of narrowing it.
  assert.equal(isAuthoredExecutableSource("coverage/report/a.ts"), false);
  assert.equal(
    isAuthoredExecutableSource("packages/engine/coverage/a.ts"),
    false,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/evidence/test/a.test.ts"),
    false,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/engine/src/a.test.ts"),
    false,
  );
  assert.equal(
    isAuthoredExecutableSource("test/fixtures/project/src/a.ts"),
    false,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/engine/src/generated/a.ts"),
    false,
  );
  assert.equal(
    isAuthoredExecutableSource("packages/template/.cache/project/a.ts"),
    false,
  );
  assert.equal(isAuthoredExecutableSource("packages/engine/dist/a.ts"), false);
  assert.equal(
    isAuthoredExecutableSource("packages/engine/src/readme.md"),
    false,
  );
});

interface ICoveredFixture {
  coverage: Record<string, IIstanbulFileCoverage>;
  data: IIstanbulFileCoverage;
  file: string;
  files: Map<string, Set<number>>;
  measuredSources: Record<string, unknown>;
  relative: string;
  root: string;
  text: string;
}

const coveredFixture = (): ICoveredFixture => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-changed-coverage-"),
  );
  const relative = "packages/engine/src/sample.ts";
  const file = path.join(root, relative);
  const text = "const first = true;\nconst value = first ? 1 : 2;\n";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  const data: IIstanbulFileCoverage = {
    path: file,
    statementMap: {
      0: { start: { line: 2, column: 0 }, end: { line: 2, column: 34 } },
    },
    s: { 0: 1 },
    fnMap: {
      0: {
        // Named as the fixture text names it. A real source contains its own
        // function's name, and an entry naming something the file does not
        // contain is what the gate now reads as a transpile artifact.
        name: "value",
        decl: { start: { line: 2, column: 0 }, end: { line: 2, column: 5 } },
        loc: { start: { line: 2, column: 0 }, end: { line: 2, column: 34 } },
      },
    },
    f: { 0: 1 },
    branchMap: {
      0: {
        type: "cond-expr",
        loc: { start: { line: 2, column: 14 }, end: { line: 2, column: 27 } },
        locations: [
          { start: { line: 2, column: 22 }, end: { line: 2, column: 23 } },
          { start: { line: 2, column: 26 }, end: { line: 2, column: 27 } },
        ],
      },
    },
    b: { 0: [1, 1] },
  };
  return {
    root,
    relative,
    file,
    text,
    data,
    files: new Map([[relative, new Set([2])]]),
    coverage: { [file]: data },
    measuredSources: { [file]: { lines: 2, sha256: hash(text) } },
  };
};

test("requires 100 percent of every touched file, not only changed lines", () => {
  const fixture = coveredFixture();
  try {
    const statements = fixture.data.statementMap;
    const statementHits = fixture.data.s;
    const functionHits = fixture.data.f;
    const branchHits = fixture.data.b;
    assert.ok(statements);
    assert.ok(statementHits);
    assert.ok(functionHits);
    assert.ok(branchHits);
    statements[1] = {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 19 },
    };
    statementHits[1] = 1;
    const green = inspectChangedCoverage({ ...fixture, divergent: [] });
    // One statement, not two: statement 1 sits on line 1 and this change
    // occupies line 2. It is covered either way, so it changes no verdict here
    // -- it changes what the totals claim to have measured, which is the point.
    assert.deepEqual(green.totals, {
      statements: { covered: 1, total: 1 },
      lines: { covered: 1, total: 1 },
      branches: { covered: 2, total: 2 },
      functions: { covered: 1, total: 1 },
    });
    assert.deepEqual(green.gaps, []);
    assert.deepEqual(green.inherited, []);
    assert.deepEqual(green.instrumentFailures, []);
    assert.deepEqual(green.files, [
      { file: fixture.relative, totals: green.totals },
    ]);

    statementHits[0] = 0;
    statementHits[1] = 0;
    functionHits[0] = 0;
    branchHits[0][1] = 0;
    const red = inspectChangedCoverage({ ...fixture, divergent: [] });
    assert.deepEqual(red.totals, {
      statements: { covered: 0, total: 1 },
      lines: { covered: 0, total: 1 },
      branches: { covered: 1, total: 2 },
      functions: { covered: 0, total: 1 },
    });
    assert.match(red.gaps.join("\n"), /:2 uncovered statement/u);
    // Statement 1 sits on line 1, which this change did not touch. It is
    // uncovered in exactly the same reading, and it is excused and said rather
    // than refused: the toll on an unrelated change is what #2163 removed.
    assert.equal(
      red.gaps.some((gap) => gap.includes(":1 ")),
      false,
    );
    assert.deepEqual(red.inherited, [
      `INHERITED GAP: ${fixture.relative} carries 1 statement, 0 branches, 0` +
        " functions uncovered on lines this change did not touch; closing them" +
        " is its own work",
    ]);
    // And the same file whose diff added no line at all -- a hunk that only
    // deletes, which `parseChangedLines` reports as a touched file with an
    // empty line set. Nothing is demanded, so nothing is refused, and every
    // uncovered position is stated instead. A run reporting no gap and no
    // inherited population would be the failure this pair exists to tell apart.
    const deletion = inspectChangedCoverage({
      ...fixture,
      divergent: [],
      files: new Map([[fixture.relative, new Set<number>()]]),
    });
    assert.deepEqual(deletion.gaps, []);
    // A function entry anchored only at its declaration, which is a shape the
    // transpile produces: the demand is placed from `decl` when `loc` is
    // absent, so an entry the change occupies is still asked for and one it
    // does not occupy is still excused. The address degrades to `?` because
    // only `loc` carries a position to report, which is the honest limit.
    const declarationOnly = (lines: Set<number>) =>
      inspectChangedCoverage({
        ...fixture,
        divergent: [],
        files: new Map([[fixture.relative, lines]]),
        coverage: {
          [fixture.file]: {
            ...fixture.data,
            fnMap: { 0: { name: "value", decl: { start: { line: 2 } } } },
            f: { 0: 0 },
          },
        },
      });
    assert.deepEqual(
      declarationOnly(new Set([2])).gaps.filter((gap) =>
        gap.includes("function"),
      ),
      [`${fixture.relative}:? uncovered function value`],
    );
    const elsewhere = declarationOnly(new Set([1]));
    assert.deepEqual(
      elsewhere.gaps.filter((gap) => gap.includes("function")),
      [],
    );
    assert.equal(elsewhere.inherited.length, 1);

    assert.deepEqual(deletion.inherited, [
      `INHERITED GAP: ${fixture.relative} carries 2 statements, 1 branch, 1` +
        " function uncovered on lines this change did not touch; closing them" +
        " is its own work",
    ]);
    assert.match(red.gaps.join("\n"), /uncovered line/u);
    assert.match(red.gaps.join("\n"), /uncovered function value/u);
    assert.match(red.gaps.join("\n"), /uncovered branch cond-expr\[1\]/u);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("reports stale, absent, malformed, divergent, and invalid instrumentation", () => {
  const fixture = coveredFixture();
  try {
    const missingCoverage = inspectChangedCoverage({
      ...fixture,
      coverage: {},
      divergent: [fixture.relative],
    });
    assert.equal(missingCoverage.instrumentFailures.length, 2);

    const missingSnapshot = inspectChangedCoverage({
      ...fixture,
      measuredSources: {},
      divergent: [],
    });
    assert.match(missingSnapshot.instrumentFailures[0], /snapshot is absent/u);

    const malformedSnapshot = inspectChangedCoverage({
      ...fixture,
      measuredSources: { [fixture.file]: { lines: "two" } },
      divergent: [],
    });
    assert.match(
      malformedSnapshot.instrumentFailures[0],
      /snapshot is absent/u,
    );

    fs.appendFileSync(fixture.file, "// stale\n");
    const stale = inspectChangedCoverage({ ...fixture, divergent: [] });
    assert.match(stale.instrumentFailures[0], /predates/u);
    fs.writeFileSync(fixture.file, fixture.text);

    const statements = fixture.data.statementMap;
    const functions = fixture.data.fnMap;
    const functionHits = fixture.data.f;
    assert.ok(statements?.[0]?.end);
    assert.ok(functions);
    assert.ok(functionHits);
    statements[0].end.line = 3;
    const outside = inspectChangedCoverage({ ...fixture, divergent: [] });
    assert.match(outside.instrumentFailures[0], /past the measured source/u);
    functions[1] = {
      name: "alsoOutside",
      decl: { start: { line: 3 }, end: { line: 3 } },
      loc: { start: { line: 3 }, end: { line: 3 } },
    };
    functionHits[1] = 0;
    const multipleOutside = inspectChangedCoverage({
      ...fixture,
      divergent: [],
    });
    assert.match(
      multipleOutside.instrumentFailures[0],
      /2 coverage positions lie/u,
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("handles comment-only files and sparse Istanbul maps without false green", () => {
  const fixture = coveredFixture();
  try {
    const missing = "packages/engine/src/missing.ts";
    const ignored = "packages/engine/src/readme.md";
    fixture.files = new Map([
      [ignored, new Set([1])],
      [missing, new Set([1])],
      [fixture.relative, new Set([1])],
      ["packages/engine/src/empty.ts", new Set()],
    ]);
    fixture.data.statementMap = {
      bad: { start: {}, end: {} },
      unchanged: { start: { line: 2 }, end: { line: 2 } },
      changed: { start: { line: 1 }, end: { line: 1 } },
      duplicate: { start: { line: 1 }, end: { line: 1 } },
    };
    fixture.data.s = undefined;
    fixture.data.fnMap = {
      unchanged: {
        name: "unchanged",
        decl: { start: { line: 2 }, end: { line: 2 } },
        loc: { start: { line: 2 }, end: { line: 2 } },
      },
      changed: {
        decl: undefined,
        loc: { start: { line: 1 }, end: { line: 1 } },
      },
      fallbackLocation: {
        // Named as the fixture text names it, so this entry survives the
        // artifact reading and still exercises the missing-location fallback.
        name: "first",
        decl: { start: { line: 1 }, end: { line: 1 } },
        loc: {},
      },
    };
    fixture.data.f = undefined;
    fixture.data.branchMap = {
      unchanged: {
        type: "if",
        loc: { start: { line: 2 }, end: { line: 2 } },
        locations: [{ start: { line: 2 }, end: { line: 2 } }],
      },
      changed: {
        loc: undefined,
        locations: [{ start: { line: 1 }, end: { line: 1 } }],
      },
      noLocations: {
        type: "if",
        loc: { start: { line: 1 }, end: { line: 1 } },
      },
      fallbackLocation: {
        type: "if",
        loc: { start: { line: 1 }, end: { line: 1 } },
        locations: [{}, { start: { line: 1 }, end: { line: 1 } }],
      },
    };
    fixture.data.b = undefined;
    // Both lines of the fixture are named as changed, so nothing here is
    // excused by #2163's demand rule and this case stays about what it is
    // about: how a sparse Istanbul map reads.
    const touched = {
      ...fixture,
      files: new Map([[fixture.relative, new Set([1, 2])]]),
    };
    const sparse = inspectChangedCoverage({ ...touched, divergent: [] });
    assert.deepEqual(sparse.instrumentFailures, []);
    assert.deepEqual(sparse.totals, {
      statements: { covered: 0, total: 4 },
      lines: { covered: 0, total: 2 },
      branches: { covered: 0, total: 4 },
      // `unchanged` names something this file does not contain, which is the
      // transpile-helper reading, so it leaves the totals and is reported as a
      // disagreement instead. The anonymous entry stays, because nothing can be
      // said about a name that is not there, and so does the one named as the
      // text names it.
      functions: { covered: 0, total: 2 },
    });
    assert.deepEqual(sparse.disagreements, [
      `${fixture.relative}: 1 function entry is a second reading of a function that ran, not an untested one`,
    ]);
    assert.match(sparse.gaps.join("\n"), /function \(anonymous\)/u);
    assert.match(sparse.gaps.join("\n"), /branch branch\[0\]/u);

    fixture.data.statementMap = undefined;
    fixture.data.fnMap = undefined;
    fixture.data.branchMap = undefined;
    const emptyMaps = inspectChangedCoverage({ ...touched, divergent: [] });
    assert.deepEqual(emptyMaps.totals, {
      statements: { covered: 0, total: 0 },
      lines: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 },
      functions: { covered: 0, total: 0 },
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

const git = (root: string, arguments_: string[]): string => {
  const result = spawnSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
};

test("collects committed, staged, worktree, and untracked sources", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-changed-git-"));
  try {
    git(root, ["init", "-b", "master"]);
    git(root, ["config", "user.email", "coverage@example.com"]);
    git(root, ["config", "user.name", "Coverage Gate"]);
    const source = path.join(root, "packages", "engine", "src");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "a.ts"), "export const a = 1;\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "base"]);
    fs.writeFileSync(path.join(source, "a.ts"), "export const a = 2;\n");
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "head"]);

    fs.appendFileSync(path.join(source, "a.ts"), "export const local = 3;\n");
    fs.writeFileSync(path.join(source, "b.ts"), "export const staged = 1;\n");
    git(root, ["add", "packages/engine/src/b.ts"]);
    fs.writeFileSync(
      path.join(source, "c.ts"),
      "export const untracked = 1;\n",
    );

    assert.equal(resolveCoverageBase(root, "HEAD~1", {}), "HEAD~1");
    assert.equal(
      resolveCoverageBase(root, undefined, {
        AUTOMOVIE_COVERAGE_BASE: "HEAD~1",
      }),
      "HEAD~1",
    );
    assert.equal(
      resolveCoverageBase(root, undefined, { GITHUB_BASE_REF: "master" }),
      "master",
    );
    const changes = collectGitChangedLines(root, "HEAD~1");
    assert.deepEqual(
      [...changes.files.keys()].sort((left, right) =>
        left.localeCompare(right),
      ),
      [
        "packages/engine/src/a.ts",
        "packages/engine/src/b.ts",
        "packages/engine/src/c.ts",
      ],
    );
    assert.equal(changes.staged, 1);
    assert.equal(changes.worktree, 1);
    assert.equal(changes.untracked, 1);
    assert.deepEqual(changes.divergent, []);

    const report = path.join(root, "report");
    fs.mkdirSync(report);
    const coverage: Record<string, IIstanbulFileCoverage> = {};
    for (const name of ["a.ts", "b.ts", "c.ts"]) {
      const file = path.join(source, name);
      const lines = fs.readFileSync(file, "utf8").trimEnd().split("\n");
      coverage[file] = {
        path: file,
        statementMap: Object.fromEntries(
          lines.map((line, index) => [
            index,
            {
              start: { line: index + 1, column: 0 },
              end: { line: index + 1, column: line.length },
            },
          ]),
        ),
        s: Object.fromEntries(lines.map((_, index) => [index, 1])),
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      };
    }
    fs.writeFileSync(
      path.join(report, "coverage-final.json"),
      JSON.stringify(coverage),
    );
    writeMeasuredSources(report);
    const arguments_ = [
      "--root",
      root,
      "--report-directory",
      report,
      "--base",
      "HEAD~1",
    ];
    assert.equal(
      runChangedCoverageGate(arguments_, {}, () => undefined),
      0,
    );
    const firstCoverage = coverage[path.join(source, "a.ts")];
    const firstStatementHits = firstCoverage?.s;
    assert.ok(firstStatementHits);
    firstStatementHits[0] = 0;
    fs.writeFileSync(
      path.join(report, "coverage-final.json"),
      JSON.stringify(coverage),
    );
    assert.equal(
      runChangedCoverageGate(arguments_, {}, () => undefined),
      1,
    );
    firstStatementHits[0] = 1;
    fs.writeFileSync(
      path.join(report, "coverage-final.json"),
      JSON.stringify(coverage),
    );

    fs.appendFileSync(
      path.join(source, "b.ts"),
      "export const different = 2;\n",
    );
    assert.deepEqual(collectGitChangedLines(root, "HEAD~1").divergent, [
      "packages/engine/src/b.ts",
    ]);
    assert.equal(
      runChangedCoverageGate(arguments_, {}, () => undefined),
      2,
    );
    assert.equal(
      runChangedCoverageGate(
        ["--root", root, "--report-directory", path.join(root, "missing")],
        { AUTOMOVIE_COVERAGE_BASE: "HEAD~1" },
        () => undefined,
      ),
      2,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("refuses a run whose measured and judged populations disagree", () => {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "automovie-coverage-population-")),
  );
  try {
    git(root, ["init", "-b", "master"]);
    git(root, ["config", "user.email", "coverage@example.com"]);
    git(root, ["config", "user.name", "Coverage Gate"]);
    const source = path.join(root, "packages", "engine", "src");
    const scenarios = path.join(root, "test", "src", "features");
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(scenarios, { recursive: true });
    fs.mkdirSync(path.join(root, "ignored"));
    fs.writeFileSync(path.join(root, ".gitignore"), "ignored/\n");
    fs.writeFileSync(path.join(source, "a.ts"), "export const a = 1;\n");
    fs.writeFileSync(path.join(source, "gone.ts"), "export const gone = 1;\n");
    fs.writeFileSync(
      path.join(scenarios, "f.ts"),
      "export const scenario = 1;\n",
    );
    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "base"]);
    // Tracked and then removed from the working tree. Nothing can instrument a
    // file that is not there, so it must leave the obliged population rather
    // than become a permanent unmeasured accusation.
    fs.rmSync(path.join(source, "gone.ts"));
    // Untracked and not ignored: the working tree added it, so the gate owes it
    // the same judgment it owes a committed source.
    fs.writeFileSync(path.join(source, "new.ts"), "export const added = 1;\n");
    // Ignored: a local artifact, not a repository fact, and a gate that means
    // the same thing in CI cannot be decided by one.
    fs.writeFileSync(
      path.join(root, "ignored", "x.ts"),
      "export const local = 1;\n",
    );

    assert.deepEqual(repositoryCandidates(root), [
      ".gitignore",
      "packages/engine/src/a.ts",
      "packages/engine/src/gone.ts",
      "packages/engine/src/new.ts",
      "test/src/features/f.ts",
    ]);

    const disagreeing = path.join(root, "report-disagreeing");
    const agreeing = path.join(root, "report-agreeing");
    fs.mkdirSync(disagreeing);
    fs.mkdirSync(agreeing);
    const keys = (names: string[]): string =>
      JSON.stringify(
        Object.fromEntries(names.map((name) => [path.join(root, name), {}])),
      );
    fs.writeFileSync(
      path.join(disagreeing, "coverage-final.json"),
      // `a.ts` agrees; `f.ts` is measured and never judged; `ignored/x.ts` is
      // measured and unknown to the repository; the root itself and a path
      // outside it are neither. `new.ts` is judged and never measured.
      keys([
        "packages/engine/src/a.ts",
        "test/src/features/f.ts",
        "ignored/x.ts",
        ".",
        "../outside.ts",
      ]),
    );
    fs.writeFileSync(
      path.join(agreeing, "coverage-final.json"),
      keys(["packages/engine/src/a.ts", "packages/engine/src/new.ts"]),
    );

    const inspection = inspectCoveragePopulation({
      root,
      candidates: repositoryCandidates(root),
      measured: Object.keys(
        JSON.parse(
          fs.readFileSync(
            path.join(disagreeing, "coverage-final.json"),
            "utf8",
          ),
        ) as Record<string, unknown>,
      ),
    });
    assert.deepEqual(inspection, {
      obliged: 2,
      measured: 3,
      unmeasured: ["packages/engine/src/new.ts"],
      unjudged: ["test/src/features/f.ts"],
    });

    const printed: string[] = [];
    const write = (line: string): void => void printed.push(line);
    assert.equal(
      runCoveragePopulationGate({
        root,
        reportDirectory: disagreeing,
        write,
      }),
      2,
    );
    assert.ok(
      printed.some(
        (line) =>
          line.startsWith("INSTRUMENT FAILURE: packages/engine/src/new.ts:") &&
          line.includes("the measurement never took it"),
      ),
    );
    assert.ok(
      printed.some(
        (line) =>
          line.startsWith("INSTRUMENT FAILURE: test/src/features/f.ts:") &&
          line.includes("never judges it"),
      ),
    );
    assert.ok(printed.every((line) => line.includes("ignored/x.ts") === false));

    printed.length = 0;
    assert.equal(
      runCoveragePopulationGate({ root, reportDirectory: agreeing, write }),
      0,
    );
    assert.deepEqual(printed, [
      "Coverage population: 2 authored executable sources owed coverage, 2 measured entries in the report.",
    ]);

    // No writer: the default sink is what CI reads, so it is proved by a run
    // whose only output is the benign summary line above.
    assert.equal(
      runCoveragePopulationGate({ root, reportDirectory: agreeing }),
      0,
    );

    printed.length = 0;
    assert.equal(
      runCoveragePopulationGate({
        root,
        reportDirectory: path.join(root, "missing"),
        write,
      }),
      2,
    );
    fs.writeFileSync(path.join(agreeing, "coverage-final.json"), "[]");
    assert.equal(
      runCoveragePopulationGate({ root, reportDirectory: agreeing, write }),
      2,
    );
    assert.ok(
      printed.every((line) =>
        line.startsWith("INSTRUMENT FAILURE: coverage population"),
      ),
    );
    assert.ok(
      printed.some((line) =>
        line.includes("does not contain a coverage object"),
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("validates CLI arguments and comparison refs", () => {
  const launchFailure: GitExecute = () => ({
    error: new Error("git did not launch"),
    status: null,
    stderr: "",
    stdout: "",
  });
  assert.throws(
    () => runGit(".", ["status"], launchFailure),
    /git did not launch/u,
  );
  assert.deepEqual(parseChangedCoverageArguments([]), {});
  assert.deepEqual(
    parseChangedCoverageArguments([
      "--base",
      "master",
      "--root",
      "repo",
      "--report-directory",
      "report",
    ]),
    { base: "master", root: "repo", reportDirectory: "report" },
  );
  assert.throws(
    () => parseChangedCoverageArguments(["--unknown"]),
    /unknown argument/u,
  );
  assert.throws(
    () => parseChangedCoverageArguments(["--base"]),
    /requires exactly one value/u,
  );
  assert.throws(
    () => parseChangedCoverageArguments(["--base", "a", "--base", "b"]),
    /requires exactly one value/u,
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-no-base-"));
  try {
    assert.throws(
      () => resolveCoverageBase(root, undefined, {}),
      /no coverage comparison base/u,
    );
    assert.throws(
      () => collectGitChangedLines(root, "HEAD"),
      /git merge-base/u,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.ok(
    [0, 1, 2].includes(runChangedCoverageGate([], {}, () => undefined)),
  );
});

test("reports totals, gaps, and instrument failures separately", () => {
  const output: string[] = [];
  reportChangedCoverage(
    {
      base: "master",
      divergent: [],
      files: new Map(),
      mergeBase: "abc123",
      staged: 1,
      worktree: 2,
      untracked: 3,
    },
    {
      totals: {
        statements: { covered: 1, total: 2 },
        lines: { covered: 1, total: 2 },
        branches: { covered: 2, total: 2 },
        functions: { covered: 0, total: 1 },
      },
      files: [
        {
          file: "a.ts",
          totals: {
            statements: { covered: 1, total: 2 },
            lines: { covered: 1, total: 2 },
            branches: { covered: 2, total: 2 },
            functions: { covered: 0, total: 1 },
          },
        },
      ],
      gaps: ["a.ts:1 uncovered line"],
      inherited: ["INHERITED GAP: d.ts carries 3 statements"],
      instrumentFailures: ["b.ts: stale"],
      disagreements: ["c.ts: 2 function entries are a second reading"],
    },
    (line) => output.push(line),
  );
  assert.match(
    output[1],
    /statements 1\/2, branches 2\/2, functions 0\/1, lines 1\/2/u,
  );
  assert.match(output[2], /^a\.ts: statements/u);
  // A disagreement is stated before the gaps it would otherwise have been
  // counted among, so a reader meets the reason before the list.
  // The excused population is stated before the refusals, because a reader
  // deciding whether the verdict is honest needs to know what was not demanded
  // before reading what was.
  assert.match(output[3], /^INHERITED GAP: d\.ts carries 3 statements$/u);
  assert.match(output[4], /^INSTRUMENT DISAGREEMENT: c\.ts: 2 function/u);
  assert.match(output[5], /^COVERAGE GAP:/u);
  assert.match(output[6], /^INSTRUMENT FAILURE:/u);
});

test("records exact source identity and line counts beside a coverage report", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-measured-source-"),
  );
  try {
    const source = path.join(root, "source.ts");
    const text = "export const measured = true;\n";
    fs.writeFileSync(source, text);
    fs.writeFileSync(
      path.join(root, "coverage-final.json"),
      JSON.stringify({
        [source]: { path: source },
        [path.join(root, "missing.ts")]: { path: "missing.ts" },
      }),
    );
    writeMeasuredLines(root);
    writeMeasuredSources(root);
    const lines = readUnknownRecord(path.join(root, MEASURED_LINES));
    const measured = readUnknownRecord(path.join(root, MEASURED_SOURCES));
    assert.deepEqual(lines, { [source]: 1 });
    assert.deepEqual(measured[source], { lines: 1, sha256: hash(text) });

    fs.rmSync(path.join(root, "coverage-final.json"));
    writeMeasuredLines(root);
    writeMeasuredSources(root);
    assert.equal(fs.existsSync(path.join(root, MEASURED_LINES)), true);
    assert.equal(fs.existsSync(path.join(root, MEASURED_SOURCES)), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("classifies every raw coverage-record boundary without guessing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-records-"));
  try {
    assert.notEqual(coverageTemporaryDirectory(), coverageTemporaryDirectory());
    assert.notEqual(
      coverageSourceHostDirectory(),
      coverageSourceHostDirectory(),
    );
    const absent = path.join(root, "absent");
    assert.deepEqual(coverageMissingScripts(absent), { urls: 0, missing: 0 });
    assert.deepEqual(coverageScriptShapes(absent), {
      urls: 0,
      reread: 0,
      disagreeing: 0,
      sample: [],
    });
    assert.deepEqual(coverageRecords(absent), {
      count: 0,
      bytes: 0,
      parsed: 0,
      results: 0,
    });

    const scripts = path.join(root, "scripts");
    fs.mkdirSync(scripts);
    const existing = path.join(root, "exists.ts");
    const missing = path.join(root, "missing.ts");
    fs.writeFileSync(existing, "export {};\n");
    fs.writeFileSync(path.join(scripts, "plain.txt"), "ignored");
    fs.writeFileSync(path.join(scripts, "invalid.json"), "{");
    fs.writeFileSync(
      path.join(scripts, "non-array.json"),
      JSON.stringify({ result: null }),
    );
    fs.writeFileSync(
      path.join(scripts, "urls.json"),
      JSON.stringify({
        result: [
          {},
          { url: "node:fs" },
          { url: pathToFileURL(existing).href },
          { url: pathToFileURL(missing).href },
          { url: "file://[invalid" },
        ],
      }),
    );
    assert.deepEqual(coverageMissingScripts(scripts), {
      urls: 3,
      missing: 1,
    });

    const shapes = path.join(root, "shapes");
    fs.mkdirSync(shapes);
    fs.writeFileSync(path.join(shapes, "plain.txt"), "ignored");
    fs.writeFileSync(path.join(shapes, "invalid.json"), "{");
    fs.writeFileSync(
      path.join(shapes, "non-array.json"),
      JSON.stringify({ result: false }),
    );
    const measured = (name: string): string =>
      `file:///repo/packages/engine/src/${name}.ts`;
    const result: IRawFixtureScript[] = [
      {},
      { url: "node:fs" },
      { url: "file:///repo/packages/face/src/outside.ts" },
      { url: measured("single") },
      { url: measured("same"), functions: [] },
      { url: measured("same"), functions: [] },
    ];
    for (let index = 0; index < 6; index++) {
      const url = measured(`different-${index}`);
      result.push(
        { url, functions: [{}, { functionName: "a", ranges: [] }] },
        {
          url,
          functions: [
            { functionName: "b", ranges: [{ startOffset: index + 1 }] },
          ],
        },
      );
    }
    fs.writeFileSync(
      path.join(shapes, "shapes.json"),
      JSON.stringify({ result }),
    );
    assert.deepEqual(coverageScriptShapes(shapes, ["packages/engine/src"]), {
      urls: 8,
      reread: 7,
      disagreeing: 6,
      sample: [
        "different-0.ts (2 shapes)",
        "different-1.ts (2 shapes)",
        "different-2.ts (2 shapes)",
        "different-3.ts (2 shapes)",
        "different-4.ts (2 shapes)",
      ],
    });

    const records = path.join(root, "records");
    fs.mkdirSync(records);
    fs.writeFileSync(path.join(records, "plain.txt"), "ignored");
    fs.mkdirSync(path.join(records, "unreadable.json"));
    fs.writeFileSync(path.join(records, "invalid.json"), "{");
    fs.writeFileSync(
      path.join(records, "no-result.json"),
      JSON.stringify({ result: null }),
    );
    fs.writeFileSync(
      path.join(records, "result.json"),
      JSON.stringify({ result: [{}, {}] }),
    );
    assert.equal(coverageRecordCount(records), 4);
    assert.deepEqual(coverageRecords(records), {
      count: 4,
      bytes:
        Buffer.byteLength("{") +
        Buffer.byteLength(JSON.stringify({ result: null })) +
        Buffer.byteLength(JSON.stringify({ result: [{}, {}] })),
      parsed: 2,
      results: 2,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * c8 maps this interface and alias to two source statements. A CommonJS TSX
 * host additionally maps `__copyProps`, its `get` callback, and `__toCommonJS`
 * onto line 1; without a runtime export the callback and two helper branches
 * cannot run. Those are the transpiled host's shape, not authored functions in
 * this file. An ESM TSX host has no such helper map and measures the authored
 * module at 2/2 statements and 2/2 lines. Both readings are pinned so the green
 * result cannot come from a path exemption, an ignore, or an invented map.
 */
test("executes type-only TypeScript and exposes CommonJS helper attribution", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-type-only-"));
  try {
    const relative = "src/type-only.ts";
    const source = path.join(root, relative);
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(
      source,
      [
        "export interface ITypeOnly { readonly value: string; }",
        "export type TypeOnlyAlias = ITypeOnly;",
        "",
      ].join("\n"),
    );
    const c8 = path.join(ROOT, "test", "node_modules", "c8", "bin", "c8.js");
    const tsx = path.join(
      ROOT,
      "test",
      "node_modules",
      "tsx",
      "dist",
      "cli.mjs",
    );
    const measure = (name: string): IMeasuredCoverageFixture => {
      const report = path.join(root, name);
      const environment = { ...process.env };
      delete environment.NODE_OPTIONS;
      const measured = spawnSync(
        process.execPath,
        [
          c8,
          "--all",
          "--src",
          "src",
          "--include",
          relative,
          "--extension",
          ".ts",
          "--reporter",
          "json",
          "--reports-dir",
          report,
          "--temp-directory",
          path.join(root, `${name}-v8`),
          process.execPath,
          tsx,
          source,
        ],
        { cwd: root, encoding: "utf8", env: environment, shell: false },
      );
      assert.equal(measured.status, 0, measured.stderr);
      return {
        report,
        coverage: readCoverageRecord(path.join(report, "coverage-final.json")),
      };
    };

    const commonJs = measure("commonjs-report");
    const commonJsEntry = commonJs.coverage[source];
    assert.ok(commonJsEntry);
    const commonJsFunctions = commonJsEntry.fnMap;
    const commonJsFunctionHits = commonJsEntry.f;
    const commonJsBranches = commonJsEntry.branchMap;
    const commonJsBranchHits = commonJsEntry.b;
    assert.ok(commonJsFunctions);
    assert.ok(commonJsFunctionHits);
    assert.ok(commonJsBranches);
    assert.ok(commonJsBranchHits);
    assert.deepEqual(
      Object.values(commonJsFunctions).map((entry) => entry.name),
      ["__copyProps", "get", "__toCommonJS"],
    );
    assert.deepEqual(Object.values(commonJsFunctionHits), [1, 0, 1]);
    assert.equal(Object.keys(commonJsBranches).length, 4);
    assert.deepEqual(Object.values(commonJsBranchHits).flat(), [1, 0, 0, 1]);
    writeMeasuredSources(commonJs.report);
    const commonJsResult = inspectChangedCoverage({
      root,
      // Both authored lines, so the whole transpiled artifact is demanded and
      // the helper attribution below is a verdict rather than an excuse.
      files: new Map([[relative, new Set([1, 2])]]),
      divergent: [],
      coverage: commonJs.coverage,
      measuredSources: readUnknownRecord(
        path.join(commonJs.report, MEASURED_SOURCES),
      ),
    });
    assert.deepEqual(commonJsResult.instrumentFailures, []);
    // `get` is the emitted interop accessor, not a function this source
    // declares, and the file's text does not contain the name. It leaves the
    // totals and is reported at the file's address instead of being counted as
    // untested code -- which is the whole reason this case measures a real
    // transpiled artifact rather than a hand-written map.
    assert.deepEqual(commonJsResult.disagreements, [
      `${relative}: 1 function entry is a second reading of a function that ran, not an untested one`,
    ]);
    assert.deepEqual(commonJsResult.totals, {
      statements: { covered: 2, total: 2 },
      branches: { covered: 2, total: 4 },
      functions: { covered: 2, total: 2 },
      lines: { covered: 2, total: 2 },
    });
    assert.equal(commonJsResult.gaps.length, 2);
    // The emitted accessor is no longer among the gaps; it is named as a
    // disagreement above, which is where a reader can act on it.
    assert.equal(
      commonJsResult.gaps.some((gap) => gap.includes("function get")),
      false,
    );
    assert.equal(
      commonJsResult.gaps.filter((gap) => gap.includes("uncovered branch"))
        .length,
      2,
    );

    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ type: "module" }),
    );
    const esm = measure("esm-report");
    const report = esm.report;
    const coverage = esm.coverage;
    const entry = coverage[source];
    assert.ok(entry);
    const statementMap = entry.statementMap;
    const statementHits = entry.s;
    assert.ok(statementMap);
    assert.ok(statementHits);
    assert.equal(Object.keys(statementMap).length, 2);
    assert.ok(Object.values(statementHits).every((hits) => hits > 0));
    assert.deepEqual(entry.fnMap, {});
    assert.deepEqual(entry.branchMap, {});
    writeMeasuredSources(report);
    const snapshots = readUnknownRecord(path.join(report, MEASURED_SOURCES));
    const result = inspectChangedCoverage({
      root,
      // Both authored lines, so the whole transpiled artifact is demanded and
      // the helper attribution below is a verdict rather than an excuse.
      files: new Map([[relative, new Set([1, 2])]]),
      divergent: [],
      coverage,
      measuredSources: snapshots,
    });
    assert.deepEqual(result.gaps, []);
    assert.deepEqual(result.instrumentFailures, []);
    assert.deepEqual(result.totals, {
      statements: { covered: 2, total: 2 },
      branches: { covered: 0, total: 0 },
      functions: { covered: 0, total: 0 },
      lines: { covered: 2, total: 2 },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("runs the coverage orchestrator through injectable child dependencies", () => {
  const roots: string[] = [];
  const output: string[] = [];
  // A shape correction that cannot be produced is an instrument failure, not a
  // quiet fall back to the merge it was going to replace.
  let reconciliation: { failure: string | null; groups: number } = {
    failure: null,
    groups: 1,
  };
  // What the run says about crediting a generated project's execution back to
  // the source it copied, so both the silent case and the refusing one are read
  // through `measureCoverage` rather than only through the pass itself.
  let attribution: {
    attributed: number;
    linked: number;
    queried: number;
    records: number;
    refused: string[];
  } = { attributed: 0, linked: 0, queried: 0, records: 0, refused: [] };
  const dependencies = (
    result: ICoverageSpawnResult,
    sample: string[],
  ): ICoverageMeasurementDependencies => ({
    attribute: () => attribution,
    temporaryDirectory: () => {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-coverage-measure-"),
      );
      roots.push(directory);
      return directory;
    },
    sourceHostDirectory: () => {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), "automovie-coverage-source-host-"),
      );
      roots.push(directory);
      return directory;
    },
    mkdir: fs.mkdirSync,
    spawn: (executable, arguments_, options) => {
      assert.equal(executable, process.execPath);
      const valuesAfter = (flag: string): string[] => {
        const values: string[] = [];
        for (let index = 0; index < arguments_.length; index++) {
          const value = arguments_[index + 1];
          if (arguments_[index] === flag && value !== undefined)
            values.push(value);
        }
        return values;
      };
      assert.deepEqual(valuesAfter("--src"), coverageSourceRoots);
      assert.deepEqual(valuesAfter("--include"), coverageIncludes);
      assert.deepEqual(valuesAfter("--extension"), [
        ".ts",
        ".tsx",
        ".cts",
        ".mts",
      ]);
      assert.equal(options.shell, false);
      assert.ok(
        (options.env.AUTOMOVIE_COVERAGE_SOURCE_HOST ?? "").includes("host"),
      );
      return result;
    },
    writeLines: () => output.push("lines"),
    writeSources: () => output.push("sources"),
    records: () => ({ count: 2, parsed: 2, results: 4, bytes: 128 }),
    reconcile: () => reconciliation,
    missingScripts: () => ({ urls: 3, missing: 1 }),
    scriptShapes: () => ({
      urls: 3,
      reread: 2,
      disagreeing: 1,
      sample,
    }),
    log: (line) => output.push(line),
    remove: removeCoverageTemporaryDirectory,
    environment: { TEST_COVERAGE_ENVIRONMENT: "preserved" },
  });

  assert.equal(measureCoverage(dependencies({ status: 0 }, ["sample.ts"])), 0);
  assert.match(
    output.join("\n"),
    /coverage groups: 1 shape-consistent record group, so the merge had nothing to lose/u,
  );
  // A run that credited nothing says so and adds no refusal clause, which is
  // the shape of every run before a generated project ran at all.
  assert.match(
    output.join("\n"),
    /coverage attribution: 0 generated script entries in 0 record files credited to the repository source whose bytes they ran$/mu,
  );
  // And a run that credited some and refused one. The refusal is named at its
  // own address rather than folded into the count, because the whole point of
  // refusing is that somebody can go and look at what ran.
  attribution = {
    attributed: 12,
    linked: 0,
    queried: 0,
    records: 3,
    refused: ["file:///tmp/film/generated/scripts/drift.ts"],
  };
  assert.equal(measureCoverage(dependencies({ status: 0 }, [])), 0);
  assert.match(
    output.join("\n"),
    /coverage attribution: 12 generated script entries in 3 record files credited to the repository source whose bytes they ran, 1 refused for bytes no repository source vouches for$/mu,
  );
  assert.match(
    output.join("\n"),
    /^UNATTRIBUTED GENERATED SCRIPT: file:[/]{3}tmp[/]film[/]generated[/]scripts[/]drift[.]ts$/mu,
  );
  // Singular on both counters, so the message is read rather than assumed.
  attribution = {
    attributed: 1,
    linked: 0,
    queried: 0,
    records: 1,
    refused: [],
  };
  assert.equal(measureCoverage(dependencies({ status: 0 }, [])), 0);
  assert.match(
    output.join("\n"),
    /coverage attribution: 1 generated script entry in 1 record file credited/u,
  );
  attribution = {
    attributed: 0,
    linked: 0,
    queried: 0,
    records: 0,
    refused: [],
  };
  reconciliation = { failure: null, groups: 3 };
  assert.equal(measureCoverage(dependencies({ status: 0 }, [])), 0);
  assert.match(
    output.join("\n"),
    /coverage groups: 3 shape-consistent record groups, report corrected/u,
  );
  reconciliation = {
    failure: "shape group 2 wrote no readable report",
    groups: 3,
  };
  assert.equal(measureCoverage(dependencies({ status: 0 }, [])), 2);
  assert.match(
    output.join("\n"),
    /INSTRUMENT FAILURE: shape group 2 wrote no readable report/u,
  );
  reconciliation = { failure: null, groups: 1 };
  assert.equal(measureCoverage(dependencies({ status: 1 }, [])), 1);
  assert.equal(measureCoverage(dependencies({ status: null }, [])), 2);
  assert.equal(
    measureCoverage(
      dependencies(
        { error: new Error("collector did not launch"), status: null },
        [],
      ),
    ),
    2,
  );
  assert.ok(output.some((line) => line.includes("collector did not launch")));
  assert.ok(output.some((line) => line.includes("sample.ts")));
  assert.ok(output.some((line) => line.includes("coverage records")));
  assert.ok(roots.every((directory) => fs.existsSync(directory) === false));
});

/** Changed coverage measures the complete final form of every touched source. */
export const test_workspace_changed_coverage = (): void => {
  for (const scenario of scenarios) scenario.run();
};

const ROOT = path.resolve(__dirname, "../../../..");

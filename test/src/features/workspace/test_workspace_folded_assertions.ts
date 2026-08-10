import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const SCANNER = path.join(ROOT, "internals", "scan-folded-predicates.mjs");

interface IScanResult {
  report: string[];
  status: number | null;
  stderr: string;
}

/**
 * Run the shipped scanner over one root and read what it printed.
 *
 * The scanner walks `test/src` relative to its own working directory while
 * resolving its compiler from this repository, so pointing `cwd` elsewhere
 * scans that tree with the very same walk the repository command runs. Nothing
 * is reimplemented here: a gate that carried its own copy of the detector would
 * measure something the `node internals/scan-folded-predicates.mjs` in the
 * issue and the contributing docs no longer measures.
 *
 * Separators are normalized because the walk joins with the host's own, and
 * blank lines are dropped so the report is the lines that carry a claim.
 */
const scan = (cwd: string): IScanResult => {
  const child = spawnSync(process.execPath, [SCANNER], {
    cwd,
    encoding: "utf8",
  });
  return {
    report: child.stdout
      .replaceAll("\\", "/")
      .split("\n")
      .filter((line) => line !== ""),
    status: child.status,
    stderr: child.stderr,
  };
};

/** One fixture module, written under the scratch root's own `test/src`. */
const writeFixture = (root: string, name: string, source: string): void => {
  const directory = path.join(root, "test", "src", "features", "fixture");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, name), source, "utf8");
};

/**
 * No assertion in the suite folds several facts into one boolean, and the
 * scanner that establishes it still fires.
 *
 * `TestValidator.predicate(title, a && b && c)` reports only "expected
 * condition is not satisfied", so a failure names no fact and localizing it
 * costs a whole run — long locally and longer in CI. #1787 paid 219 of them
 * down to zero and nothing held the line: one cycle of built-environment work
 * put 45 back across 18 files, 17 of them in a single viewer case, because the
 * measure existed and no check read it. This is that check. It pins the total
 * rather than a per-file allowance, since an allowance list is the artifact
 * that never shrinks, and it pins it at zero, which is the only number that
 * needs no justification of what was left behind.
 *
 * The fault injection is what makes the first assertion mean something. A gate
 * over a clean tree passes identically whether it is measuring correctly or
 * measuring nothing, so the same scanner is pointed at a scratch tree carrying
 * known folds and known non-folds, and its report is read line for line.
 *
 * The scratch tree is removed before any assertion runs, so there is no
 * cleanup-after-failure lifecycle here and no preservation helper: the removal
 * cannot mask a primary failure that has not happened yet.
 *
 * Scenarios:
 *
 * 1. The scanner reports zero folded assertions over this repository. The failure
 *    carries its per-file listing, so one run names every site rather than the
 *    first of them.
 * 2. Fault injection: a scratch tree holds a two-fact fold, a three-fact chain,
 *    and beside them the shapes that must NOT be reported — a single-fact
 *    predicate, a disjunction, a conjunction named through `namedFacts` inside
 *    `TestValidator.equals`, a conjunction passed to some other object's
 *    `predicate`, and an entirely clean module. Exactly the two folds are
 *    reported, each in its own file, and the clean module is absent from the
 *    listing. A gate that cannot fail is not a gate.
 */
export const test_workspace_folded_assertions = (): void => {
  TestValidator.equals(
    "no assertion folds several facts into one boolean",
    scan(ROOT),
    { report: ["0 folded assertions across 0 files"], status: 0, stderr: "" },
  );

  // 2. fault injection, outside the repository so the tree stays clean and the
  // scan above cannot reach the deliberately folded fixtures.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-folded-"));
  writeFixture(
    scratch,
    "test_folded_pair.ts",
    [
      'TestValidator.predicate("two facts folded", first && second);',
      'TestValidator.predicate("one fact stands alone", first);',
      'TestValidator.predicate("a disjunction is not a fold", first || second);',
      'TestValidator.equals("named facts are not a fold", namedFacts([',
      '  ["both", () => first && second],',
      "]), { both: true });",
      'Other.predicate("another object\'s predicate", first && second);',
      "",
    ].join("\n"),
  );
  writeFixture(
    scratch,
    "test_folded_chain.ts",
    'TestValidator.predicate("three facts folded", first && second && third);\n',
  );
  writeFixture(
    scratch,
    "test_named_only.ts",
    [
      'TestValidator.predicate("one fact stands alone", first);',
      'TestValidator.equals("an exact value", subject.count, 2);',
      "",
    ].join("\n"),
  );
  const injected = scan(scratch);
  fs.rmSync(scratch, { force: true, recursive: true });
  TestValidator.equals(
    "the injected folds are reported, and only they are",
    injected,
    {
      report: [
        "   1  test/src/features/fixture/test_folded_chain.ts",
        "   1  test/src/features/fixture/test_folded_pair.ts",
        "2 folded assertions across 2 files",
      ],
      status: 0,
      stderr: "",
    },
  );
};

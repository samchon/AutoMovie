import { TestValidator } from "@nestia/e2e";
import { closeAutoMovieProjectState } from "automovie";

import { createProjectStateClosureFixture } from "../internal/projectStateClosureFixtures";

/**
 * Identity equality and compile validity are independent currentness conditions.
 *
 * Scenarios:
 * 1. A changed before/after revision, removed/replaced manifest, first ending
 *    fingerprint, or shared ending fingerprint independently refuses current.
 * 2. An already-stale generated fingerprint remains a distinct initial problem.
 * 3. A manifest object mutated during closing is compared to its captured value.
 */
export const test_cli_project_state_closure_changes = (): void => {
  const changed = `sha256:${"b".repeat(64)}` as const;
  const arrangements: Array<{
    name: string;
    arrange: (
      fixture: ReturnType<typeof createProjectStateClosureFixture>,
    ) => void;
  }> = [
    {
      name: "before revision",
      arrange: (fixture) => {
        fixture.revisions[0] = 8;
      },
    },
    {
      name: "after revision",
      arrange: (fixture) => {
        fixture.revisions[1] = 8;
      },
    },
    {
      name: "missing closing manifest",
      arrange: (fixture) => {
        fixture.input.read.manifest = () => null;
      },
    },
    {
      name: "replaced closing manifest",
      arrange: (fixture) => {
        fixture.input.read.manifest = () => ({
          ...fixture.manifest,
          builder: { packageVersion: "2", protocolVersion: "1" },
        });
      },
    },
    {
      name: "first fingerprint",
      arrange: (fixture) => {
        fixture.first.builder.inputFingerprint = changed;
      },
    },
    {
      name: "second fingerprint",
      arrange: (fixture) => {
        fixture.second.builder.inputFingerprint = changed;
      },
    },
    {
      name: "both ending fingerprints",
      arrange: (fixture) => {
        fixture.first.builder.inputFingerprint = changed;
        fixture.second.builder.inputFingerprint = changed;
      },
    },
    {
      name: "mutated manifest snapshot",
      arrange: (fixture) => {
        fixture.input.read.manifest = () => {
          fixture.manifest.builder.packageVersion = "2";
          return fixture.manifest;
        };
      },
    },
  ];
  for (const { name, arrange } of arrangements) {
    const fixture = createProjectStateClosureFixture();
    arrange(fixture);
    const result = closeAutoMovieProjectState(fixture.input);
    TestValidator.equals(`${name} refuses`, result.freshness.status, "stale");
    TestValidator.equals(
      `${name} reason`,
      result.freshness.problems.map((problem) => problem.code),
      ["project-state-changed"],
    );
    TestValidator.equals(
      `${name} no invented diagnostic`,
      result.freshness.diagnostics,
      [],
    );
    TestValidator.equals(
      `${name} latest fingerprint`,
      result.freshness.currentFingerprint,
      fixture.second.builder.inputFingerprint,
    );
  }
  const fixture = createProjectStateClosureFixture();
  fixture.manifest.inputFingerprint = changed;
  const result = closeAutoMovieProjectState(fixture.input);
  TestValidator.equals(
    "generated fingerprint stale",
    result.freshness.problems.map((problem) => problem.code),
    ["compile-fingerprint-stale"],
  );
  TestValidator.equals(
    "generated identity retained",
    result.freshness.compileFingerprint,
    changed,
  );
  TestValidator.equals(
    "source identity retained",
    result.freshness.currentFingerprint,
    fixture.initial.builder.inputFingerprint,
  );
};

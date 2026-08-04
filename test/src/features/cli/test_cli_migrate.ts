import { AutoMovieProject } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { captureCliOutput as captureCli } from "./CliOutputCapture";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

/** The public CLI drives dry-run, apply, idempotence, and guarded rollback. */
export const test_cli_migrate = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-cli-migrate-"));
  let migrateFailure: { error: unknown } | undefined;
  try {
    AutoMovieProject.open(root);
    const dryRun = captureCli(["migrate", root, "--dry-run"]);
    const dryPlan = JSON.parse(dryRun.stdout) as {
      version: number;
      fingerprint: string;
    };
    TestValidator.equals(
      "CLI dry-run prints a plan and writes no production state",
      namedFacts([
        ["dryRunStatus", () => dryRun.status === 0],
        ["dryRunStderr", () => dryRun.stderr === ""],
        ["dryPlanVersion", () => dryPlan.version === 1],
        ["dryPlanFingerprint", () => dryPlan.fingerprint.startsWith("sha256:")],
        [
          "rootResident",
          () => fs.existsSync(path.join(root, ".automovie")) === false,
        ],
      ]),
      {
        dryRunStatus: true,
        dryRunStderr: true,
        dryPlanVersion: true,
        dryPlanFingerprint: true,
        rootResident: true,
      },
    );

    const conflict = captureCli(["migrate", root, "--dry-run", "--rollback"]);
    TestValidator.equals(
      "CLI migrate rejects conflicting modes",
      namedFacts([
        ["conflictStatus", () => conflict.status === 1],
        ["conflictStdout", () => conflict.stdout === ""],
        ["conflictStderr", () => conflict.stderr.includes("only one")],
      ]),
      {
        conflictStatus: true,
        conflictStdout: true,
        conflictStderr: true,
      },
    );

    const applied = captureCli(["migrate", root]);
    const appliedOutput = JSON.parse(applied.stdout) as { status: string };
    const repeated = captureCli(["migrate", root]);
    const repeatedOutput = JSON.parse(repeated.stdout) as { status: string };
    TestValidator.equals(
      "CLI migrate applies once and then reports the identical import",
      namedFacts([
        ["appliedStatus", () => applied.status === 0],
        ["appliedOutputStatus", () => appliedOutput.status === "applied"],
        ["repeatedStatus", () => repeated.status === 0],
        ["repeatedOutputStatus", () => repeatedOutput.status === "unchanged"],
        [
          "rootResident",
          () => fs.existsSync(path.join(root, ".automovie/manifest.json")),
        ],
      ]),
      {
        appliedStatus: true,
        appliedOutputStatus: true,
        repeatedStatus: true,
        repeatedOutputStatus: true,
        rootResident: true,
      },
    );

    const rolledBack = captureCli(["migrate", root, "--rollback"]);
    const rollbackOutput = JSON.parse(rolledBack.stdout) as { status: string };
    TestValidator.equals(
      "CLI rollback removes only the untouched applied import",
      namedFacts([
        ["rolledBackStatus", () => rolledBack.status === 0],
        ["rollbackOutputStatus", () => rollbackOutput.status === "rolled-back"],
        [
          "rootResident",
          () => fs.existsSync(path.join(root, ".automovie")) === false,
        ],
      ]),
      {
        rolledBackStatus: true,
        rollbackOutputStatus: true,
        rootResident: true,
      },
    );
  } catch (error) {
    migrateFailure = { error };
    throw error;
  } finally {
    preserveCliRootFixtureCleanup(
      migrateFailure,
      () => fs.rmSync(root, { force: true, recursive: true }),
      "migrate fixture root",
    );
  }
};

import { AutoMovieProject } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { captureCliOutput as captureCli } from "./CliOutputCapture";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

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
        [
          "dryPlanFingerprintStartsWith",
          () => dryPlan.fingerprint.startsWith("sha256:"),
        ],
        [
          "existsSyncRootAutomovie",
          () => fs.existsSync(path.join(root, ".automovie")) === false,
        ],
      ]),
      {
        dryRunStatus: true,
        dryRunStderr: true,
        dryPlanVersion: true,
        dryPlanFingerprintStartsWith: true,
        existsSyncRootAutomovie: true,
      },
    );

    const conflict = captureCli(["migrate", root, "--dry-run", "--rollback"]);
    TestValidator.equals(
      "CLI migrate rejects conflicting modes",
      namedFacts([
        ["conflictStatus", () => conflict.status === 1],
        ["conflictStdout", () => conflict.stdout === ""],
        ["conflictStderrIncludes", () => conflict.stderr.includes("only one")],
      ]),
      {
        conflictStatus: true,
        conflictStdout: true,
        conflictStderrIncludes: true,
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
        [
          "appliedOutputStatusApplied",
          () => appliedOutput.status === "applied",
        ],
        ["repeatedStatus", () => repeated.status === 0],
        [
          "repeatedOutputStatusUnchanged",
          () => repeatedOutput.status === "unchanged",
        ],
        [
          "existsSyncRootAutomovie",
          () => fs.existsSync(path.join(root, ".automovie/manifest.json")),
        ],
      ]),
      {
        appliedStatus: true,
        appliedOutputStatusApplied: true,
        repeatedStatus: true,
        repeatedOutputStatusUnchanged: true,
        existsSyncRootAutomovie: true,
      },
    );

    const manifestPath = path.join(root, ".automovie", "manifest.json");
    const manifestBytes = fs.readFileSync(manifestPath);
    fs.appendFileSync(manifestPath, "\n");
    const refusedRollback = captureCli(["migrate", root, "--rollback"]);
    TestValidator.equals(
      "CLI rollback refuses changed imported state without removing it",
      namedFacts([
        ["status", () => refusedRollback.status === 1],
        [
          "diagnostic",
          () => refusedRollback.stderr.includes("changed after import"),
        ],
        ["preserved", () => fs.existsSync(path.join(root, ".automovie"))],
      ]),
      { status: true, diagnostic: true, preserved: true },
    );
    fs.writeFileSync(manifestPath, manifestBytes);

    const rolledBack = captureCli(["migrate", root, "--rollback"]);
    const rollbackOutput = JSON.parse(rolledBack.stdout) as { status: string };
    TestValidator.equals(
      "CLI rollback removes only the untouched applied import",
      namedFacts([
        ["rolledBackStatus", () => rolledBack.status === 0],
        [
          "rollbackOutputStatusRolled",
          () => rollbackOutput.status === "rolled-back",
        ],
        [
          "existsSyncRootAutomovie",
          () => fs.existsSync(path.join(root, ".automovie")) === false,
        ],
      ]),
      {
        rolledBackStatus: true,
        rollbackOutputStatusRolled: true,
        existsSyncRootAutomovie: true,
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

import { AutoMovieProject } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { captureCliOutput as captureCli } from "./CliOutputCapture";

/** The public CLI drives dry-run, apply, idempotence, and guarded rollback. */
export const test_cli_migrate = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-cli-migrate-"));
  try {
    AutoMovieProject.open(root);
    const dryRun = captureCli(["migrate", root, "--dry-run"]);
    const dryPlan = JSON.parse(dryRun.stdout) as {
      version: number;
      fingerprint: string;
    };
    TestValidator.predicate(
      "CLI dry-run prints a plan and writes no production state",
      dryRun.status === 0 &&
        dryRun.stderr === "" &&
        dryPlan.version === 1 &&
        dryPlan.fingerprint.startsWith("sha256:") &&
        fs.existsSync(path.join(root, ".automovie")) === false,
    );

    const conflict = captureCli(["migrate", root, "--dry-run", "--rollback"]);
    TestValidator.predicate(
      "CLI migrate rejects conflicting modes",
      conflict.status === 1 &&
        conflict.stdout === "" &&
        conflict.stderr.includes("only one"),
    );

    const applied = captureCli(["migrate", root]);
    const appliedOutput = JSON.parse(applied.stdout) as { status: string };
    const repeated = captureCli(["migrate", root]);
    const repeatedOutput = JSON.parse(repeated.stdout) as { status: string };
    TestValidator.predicate(
      "CLI migrate applies once and then reports the identical import",
      applied.status === 0 &&
        appliedOutput.status === "applied" &&
        repeated.status === 0 &&
        repeatedOutput.status === "unchanged" &&
        fs.existsSync(path.join(root, ".automovie/manifest.json")),
    );

    const rolledBack = captureCli(["migrate", root, "--rollback"]);
    const rollbackOutput = JSON.parse(rolledBack.stdout) as { status: string };
    TestValidator.predicate(
      "CLI rollback removes only the untouched applied import",
      rolledBack.status === 0 &&
        rollbackOutput.status === "rolled-back" &&
        fs.existsSync(path.join(root, ".automovie")) === false,
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};

import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { preserveExperimentalSandboxCleanup } from "./ExperimentalSandboxCleanup";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const GENERATOR = path.join(ROOT, "build", "experimental.ts");
const TSX = path.join(ROOT, "test", "node_modules", "tsx", "dist", "cli.mjs");
const NAME = `fixture_sandbox_${process.pid}`;
const TARGET = path.join(ROOT, "experimental", NAME);

/** Invoke the repository-local sandbox generator without packing or installing. */
const generateNamed = (
  name: string,
  ...args: readonly string[]
): { status: number; stderr: string } => {
  const child = spawnSync(
    process.execPath,
    [TSX, GENERATOR, name, "--no-install", ...args],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  return { status: child.status ?? 1, stderr: child.stderr };
};

const generate = (...args: readonly string[]) => generateNamed(NAME, ...args);

/** The generator publishes a portable sandbox while preserving refresh work. */
export const test_workspace_experimental_sandbox = (): void => {
  let failure: { error: unknown } | undefined;
  try {
    const created = generate();
    const authored = path.join(TARGET, "README.md");
    const initial = fs.readFileSync(authored, "utf8");
    fs.writeFileSync(authored, `${initial}\nauthor work\n`, "utf8");

    const repeated = generate();
    const invalidName = generateNamed("invalid/name");
    const refreshed = generate("--refresh");
    const refreshPreserved = fs
      .readFileSync(authored, "utf8")
      .includes("author work");
    const forced = generate("--force");

    TestValidator.equals(
      "sandbox creation is portable, refuses overwrite, and separates refresh from force",
      namedFacts([
        ["created", () => created.status === 0],
        [
          "noWorkingResidue",
          () => fs.existsSync(path.join(TARGET, "node_modules")) === false,
        ],
        [
          "refusedOverwrite",
          () =>
            repeated.status === 1 &&
            repeated.stderr.includes(NAME) &&
            repeated.stderr.includes("--force"),
        ],
        [
          "invalidNameRefused",
          () =>
            invalidName.status === 1 &&
            invalidName.stderr.includes("portable directory segment"),
        ],
        ["refreshed", () => refreshed.status === 0 && refreshPreserved],
        [
          "forced",
          () =>
            forced.status === 0 &&
            fs.readFileSync(authored, "utf8").includes("author work") === false,
        ],
      ]),
      {
        created: true,
        noWorkingResidue: true,
        refusedOverwrite: true,
        invalidNameRefused: true,
        refreshed: true,
        forced: true,
      },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveExperimentalSandboxCleanup(
      failure,
      () => fs.rmSync(TARGET, { recursive: true, force: true }),
      `sandbox ${NAME}`,
    );
  }
};

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
  const environment = { ...process.env };
  // The suite runs under `ttsx`, which publishes its own module hooks through
  // `NODE_OPTIONS`. Inheriting them puts `tsx` under a second loader and the
  // child dies with `ERR_METHOD_NOT_IMPLEMENTED: The resolveSync() method is not
  // implemented` before the generator's first line runs. It exits 1 with an
  // empty standard output, so the render simply does not happen.
  delete environment.NODE_OPTIONS;
  const child = spawnSync(
    process.execPath,
    [TSX, GENERATOR, name, "--no-install", ...args],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: environment,
    },
  );
  return { status: child.status ?? 1, stderr: child.stderr };
};

const generate = (...args: readonly string[]) => generateNamed(NAME, ...args);

/**
 * The generator publishes a portable sandbox as a process entry.
 *
 * This is the process-level twin of the `build` scenarios, which drive the same
 * module through injected boundaries. What only this can reach is the entry
 * itself: `pnpm run experimental` starts the file as a script, so the guard that
 * decides whether the command runs, the argument slice it is handed, and the
 * status it publishes are only exercised when a real process does it.
 *
 * Scenarios:
 *
 * 1. A fresh sandbox renders, and the render is asserted before anything reads a
 *    file it was supposed to produce. An arrangement that fails silently would
 *    otherwise surface as an unrelated `ENOENT` on the file the case wanted,
 *    which is how a broken child once read as a missing `README.md`.
 * 2. The install is skipped, so no `node_modules` is left in the target.
 * 3. A second render over the now non-empty sandbox refuses and names `--force`.
 * 4. A name that would land outside `experimental/` is refused.
 * 5. `--refresh` keeps the author's edit to a scaffold-managed file.
 * 6. `--force` re-renders and discards it, which is the difference `--refresh`
 *    exists to preserve.
 */
export const test_workspace_experimental_sandbox = (): void => {
  let failure: { error: unknown } | undefined;
  try {
    const created = generate();
    if (created.status !== 0)
      throw new Error(
        `the sandbox generator failed before the case could arrange anything (${String(created.status)}):\n${created.stderr}`,
      );
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
            invalidName.stderr.includes(
              "must be one directory segment inside experimental/",
            ),
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

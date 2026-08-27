import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { preserveExperimentalSandboxCleanup } from "./ExperimentalSandboxCleanup";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const GENERATOR = path.join(ROOT, "internals", "experimental.mjs");
const NAME = `fixture_sandbox_${process.pid}`;
const TARGET = path.join(ROOT, "experimental", NAME);

/** Invoke the repository-local sandbox generator without packing or installing. */
const generate = (
  ...args: readonly string[]
): { status: number; stderr: string } => {
  const child = spawnSync(
    process.execPath,
    [GENERATOR, NAME, "--no-install", ...args],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  );
  return { status: child.status ?? 1, stderr: child.stderr };
};

/** The generator publishes a portable sandbox while preserving refresh work. */
export const test_workspace_experimental_sandbox = (): void => {
  let failure: { error: unknown } | undefined;
  try {
    const created = generate();
    const manifest = JSON.parse(
      fs.readFileSync(path.join(TARGET, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const automovieRanges = Object.entries({
      ...manifest.dependencies,
      ...manifest.devDependencies,
    }).filter(([name]) => name.startsWith("@automovie/"));
    const settings = JSON.parse(
      fs.readFileSync(path.join(TARGET, ".claude", "settings.json"), "utf8"),
    ) as { hooks?: { PreToolUse?: unknown[] } };
    const authored = path.join(TARGET, "README.md");
    const initial = fs.readFileSync(authored, "utf8");
    fs.writeFileSync(authored, `${initial}\nauthor work\n`, "utf8");

    const repeated = generate();
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
          "portableRanges",
          () =>
            automovieRanges.length !== 0 &&
            automovieRanges.every(
              ([, range]) =>
                range.startsWith("link:") === false &&
                range.startsWith("workspace:") === false,
            ),
        ],
        [
          // The sandbox needs the ownership guard exactly as much as a real
          // project does, so the generator must carry the scaffold's own hooks
          // through rather than writing settings of its own over them.
          "guardWired",
          () => (settings.hooks?.PreToolUse ?? []).length === 1,
        ],
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
        portableRanges: true,
        guardWired: true,
        noWorkingResidue: true,
        refusedOverwrite: true,
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

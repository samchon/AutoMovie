import { renderScaffold, writeFiles } from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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

interface IGuardResult {
  status: number | null;
  stderr: string;
}

/** Invoke the scaffold's Claude Code pre-write guard for one tool request. */
const guard = (
  root: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): IGuardResult => {
  const hook = path.join(root, ".claude", "hooks", "guard-automovie-owned.mjs");
  const output = spawnSync(process.execPath, [hook], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: toolName,
      tool_input: toolInput,
    }),
  });
  return { status: output.status, stderr: output.stderr };
};

/**
 * The project hook distinguishes authored files from tool-owned derivatives.
 *
 * Missing config is intentionally fail-open so the reusable hook does not
 * capture unrelated directories. Once a manifest exists, invalid config fails
 * closed and each derived root names the command that owns it.
 */
export const test_cli_ownership_guard = (): void => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-guard-"));
  let ownershipFailure: { error: unknown } | undefined;
  try {
    const root = path.join(base, "film");
    writeFiles(root, renderScaffold({ name: "guard-film" }));
    const authored = guard(root, "Write", {
      file_path: path.join(
        root,
        ".automovie",
        "design",
        "shots",
        "opening.json",
      ),
    });
    const generated = guard(root, "Write", {
      file_path: path.join(root, "generated", "film.json"),
    });
    const rendered = guard(root, "NotebookEdit", {
      notebook_path: path.join(root, "renders", "feature.mp4"),
    });
    const production = guard(root, "mcp__filesystem__write_file", {
      path: path.join(
        root,
        ".automovie",
        "productions",
        "guard-film",
        "state.json",
      ),
    });
    const bash = guard(root, "Bash", {
      command: "Set-Content generated/film.json forged",
    });
    fs.mkdirSync(path.join(root, "generated"));
    fs.symlinkSync(
      path.join(root, "generated"),
      path.join(root, "generated-alias"),
      "junction",
    );
    const aliased = guard(root, "Write", {
      file_path: path.join(root, "generated-alias", "through-link.json"),
    });
    const aliasedBash = guard(root, "Bash", {
      command: "Set-Content generated-alias/through-shell.json forged",
    });
    TestValidator.equals(
      "authored design is writable while direct, shell, MCP, and linked derived paths are blocked",
      namedFacts([
        ["authoredStatus", () => authored.status === 0],
        ["generatedStatus", () => generated.status === 2],
        ["generatedStderr", () => generated.stderr.includes("npm run compile")],
        ["renderedStatus", () => rendered.status === 2],
        ["renderedStderr", () => rendered.stderr.includes("npm run render")],
        ["productionStatus", () => production.status === 2],
        [
          "productionStderr",
          () => production.stderr.includes("npm run compile or npm run render"),
        ],
        ["bashStatus", () => bash.status === 2],
        ["bashStderr", () => bash.stderr.includes("npm run compile")],
        ["aliasedStatus", () => aliased.status === 2],
        ["aliasedStderr", () => aliased.stderr.includes("npm run compile")],
        ["aliasedBashStatus", () => aliasedBash.status === 2],
        [
          "aliasedBashStderr",
          () => aliasedBash.stderr.includes("npm run compile"),
        ],
      ]),
      {
        authoredStatus: true,
        generatedStatus: true,
        generatedStderr: true,
        renderedStatus: true,
        renderedStderr: true,
        productionStatus: true,
        productionStderr: true,
        bashStatus: true,
        bashStderr: true,
        aliasedStatus: true,
        aliasedStderr: true,
        aliasedBashStatus: true,
        aliasedBashStderr: true,
      },
    );

    const manifest = path.join(root, ".automovie", "manifest.json");
    fs.rmSync(manifest);
    const absent = guard(root, "Write", {
      file_path: path.join(root, "generated", "film.json"),
    });
    fs.writeFileSync(manifest, "{ broken manifest");
    const malformed = guard(root, "Write", {
      file_path: path.join(root, "generated", "film.json"),
    });
    TestValidator.equals(
      "missing config is fail-open but malformed existing config blocks",
      namedFacts([
        ["absentStatus", () => absent.status === 0],
        ["malformedStatus", () => malformed.status === 2],
        [
          "malformedStderr",
          () => malformed.stderr.includes("manifest.json is unreadable"),
        ],
      ]),
      {
        absentStatus: true,
        malformedStatus: true,
        malformedStderr: true,
      },
    );
  } catch (error) {
    ownershipFailure = { error };
    throw error;
  } finally {
    preserveCliRootFixtureCleanup(
      ownershipFailure,
      () => fs.rmSync(base, { force: true, recursive: true }),
      "ownership-guard fixture root",
    );
  }
};

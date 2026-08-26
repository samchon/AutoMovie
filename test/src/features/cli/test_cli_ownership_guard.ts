import { renderScaffold, writeFiles } from "automovie";
import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

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
 * A directory that does not declare `automovie` is intentionally
 * fail-open, so the reusable hook cannot capture unrelated directories when it
 * is copied out of a project. Inside a real project each derived root names the
 * command that owns it.
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
        [
          "generatedStderrIncludes",
          () => generated.stderr.includes("npm run compile"),
        ],
        ["renderedStatus", () => rendered.status === 2],
        [
          "renderedStderrIncludes",
          () => rendered.stderr.includes("npm run render"),
        ],
        ["productionStatus", () => production.status === 2],
        [
          "productionStderrIncludes",
          () => production.stderr.includes("npm run compile or npm run render"),
        ],
        ["bashStatus", () => bash.status === 2],
        ["bashStderrIncludes", () => bash.stderr.includes("npm run compile")],
        ["aliasedStatus", () => aliased.status === 2],
        [
          "aliasedStderrIncludes",
          () => aliased.stderr.includes("npm run compile"),
        ],
        ["aliasedBashStatus", () => aliasedBash.status === 2],
        [
          "aliasedBashStderrIncludes",
          () => aliasedBash.stderr.includes("npm run compile"),
        ],
      ]),
      {
        authoredStatus: true,
        generatedStatus: true,
        generatedStderrIncludes: true,
        renderedStatus: true,
        renderedStderrIncludes: true,
        productionStatus: true,
        productionStderrIncludes: true,
        bashStatus: true,
        bashStderrIncludes: true,
        aliasedStatus: true,
        aliasedStderrIncludes: true,
        aliasedBashStatus: true,
        aliasedBashStderrIncludes: true,
      },
    );

    // A review is complete only once the current bundle frames have actually
    // been opened, so the guard has to let an agent look at what it owns. It
    // guards against mutation; refusing a read would make the inspection the
    // review contract mandates impossible and push the agent into copying
    // evidence out to somewhere unowned just to see it.
    const readFrame = guard(root, "Read", {
      file_path: path.join(root, "renders", "shot", "frame.png"),
    });
    const globFrames = guard(root, "Glob", {
      pattern: "renders/**/*.png",
      path: path.join(root, "renders"),
    });
    const grepGenerated = guard(root, "Grep", {
      pattern: "shot",
      path: path.join(root, "generated"),
    });
    // Not an observation: a shell command that happens to read is still a
    // shell command, and an unrecognized tool stays blocked so the guard keeps
    // failing closed as the tool surface grows.
    const shellRead = guard(root, "Bash", {
      command: "Get-Content renders/shot/frame.png > copy.png",
    });
    const unknownTool = guard(root, "mcp__filesystem__read_file", {
      path: path.join(root, "renders", "shot", "frame.png"),
    });
    TestValidator.equals(
      "the guard blocks mutation without blocking the inspection review requires",
      namedFacts([
        ["readFrameStatus", () => readFrame.status === 0],
        ["globFramesStatus", () => globFrames.status === 0],
        ["grepGeneratedStatus", () => grepGenerated.status === 0],
        ["shellReadStatus", () => shellRead.status === 2],
        ["unknownToolStatus", () => unknownTool.status === 2],
      ]),
      {
        readFrameStatus: true,
        globFramesStatus: true,
        grepGeneratedStatus: true,
        shellReadStatus: true,
        unknownToolStatus: true,
      },
    );

    const declaration = path.join(root, "package.json");
    const original = fs.readFileSync(declaration, "utf8");
    const stripped = JSON.parse(original) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    delete stripped.dependencies?.["automovie"];
    delete stripped.devDependencies?.["automovie"];
    fs.writeFileSync(declaration, JSON.stringify(stripped, null, 2));
    const undeclared = guard(root, "Write", {
      file_path: path.join(root, "generated", "film.json"),
    });
    fs.rmSync(declaration);
    const absent = guard(root, "Write", {
      file_path: path.join(root, "generated", "film.json"),
    });
    fs.writeFileSync(declaration, original);
    const restored = guard(root, "Write", {
      file_path: path.join(root, "generated", "film.json"),
    });
    TestValidator.equals(
      "the guard arms on the declared AutoMovie dependency and nothing else",
      namedFacts([
        ["undeclaredStatus", () => undeclared.status === 0],
        ["absentStatus", () => absent.status === 0],
        ["restoredStatus", () => restored.status === 2],
        [
          "restoredStderrIncludes",
          () => restored.stderr.includes("npm run compile"),
        ],
      ]),
      {
        undeclaredStatus: true,
        absentStatus: true,
        restoredStatus: true,
        restoredStderrIncludes: true,
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

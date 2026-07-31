import { renderScaffold, writeFiles } from "@automovie/cli";
import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface IGuardResult {
  status: number | null;
  stderr: string;
}

/** Invoke the scaffold's Claude Code pre-write guard for one target. */
const guard = (root: string, filePath: string): IGuardResult => {
  const hook = path.join(root, ".claude", "hooks", "guard-automovie-owned.mjs");
  const output = spawnSync(process.execPath, [hook], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: filePath },
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
  const root = path.join(base, "film");
  try {
    writeFiles(root, renderScaffold({ name: "guard-film" }));
    const authored = guard(
      root,
      path.join(root, ".automovie", "design", "shots", "opening.json"),
    );
    const generated = guard(root, path.join(root, "generated", "film.json"));
    const rendered = guard(root, path.join(root, "renders", "feature.mp4"));
    const production = guard(
      root,
      path.join(root, ".automovie", "productions", "guard-film", "state.json"),
    );
    TestValidator.predicate(
      "authored design is writable while every derived root is blocked",
      authored.status === 0 &&
        generated.status === 2 &&
        generated.stderr.includes("pnpm compile") &&
        rendered.status === 2 &&
        rendered.stderr.includes("pnpm render") &&
        production.status === 2 &&
        production.stderr.includes("pnpm compile or pnpm render"),
    );

    const manifest = path.join(root, ".automovie", "manifest.json");
    fs.rmSync(manifest);
    const absent = guard(root, path.join(root, "generated", "film.json"));
    fs.writeFileSync(manifest, "{ broken manifest");
    const malformed = guard(root, path.join(root, "generated", "film.json"));
    TestValidator.predicate(
      "missing config is fail-open but malformed existing config blocks",
      absent.status === 0 &&
        malformed.status === 2 &&
        malformed.stderr.includes("manifest.json is unreadable"),
    );
  } finally {
    fs.rmSync(base, { force: true, recursive: true });
  }
};

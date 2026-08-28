import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const SCAFFOLD_ROOT = path.join(
  REPOSITORY_ROOT,
  "packages",
  "template",
  "scaffold",
);

/**
 * The generated project's public `npm run book` command executes its shipped
 * script rather than relying on an unregistered template-local test.
 *
 * Scenarios:
 *
 * 1. The actual package command binds grouped screenplays into one H1 → H2 →
 *    H3 edition, strips authored anchors, and leaves every source byte intact.
 * 2. The command leaves every authored source byte unchanged and publishes no
 *    group-index body or extra presentation format.
 */
export const test_cli_scaffold_book_command = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-book-cli-"));
  try {
    copy(root, "package.json");
    copy(root, "tsconfig.json");
    copy(root, "scripts/book.ts");
    fs.symlinkSync(
      path.join(REPOSITORY_ROOT, "packages", "template", "node_modules"),
      path.join(root, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
    write(
      root,
      "docs/screenplays/001-event/index.md",
      "# Event {#event}\n\nIndex-only authoring note.\n",
    );
    write(
      root,
      "docs/screenplays/001-event/001-beat.md",
      "# First beat {#first-beat}\n\n## Action {#action}\n\nIt begins.\n",
    );
    write(
      root,
      "docs/maps/001-site.md",
      "# Site plan\n\n## Extent {#extent}\n\nA bounded site.\n",
    );
    const before = snapshot(path.join(root, "docs"));

    runBook(root, ["--title", "Final Script"]);
    const screenplay = path.join(
      root,
      "artifacts",
      "final-script-screenplays.md",
    );
    assert.equal(
      fs.readFileSync(screenplay, "utf8"),
      "# Final Script\n\n## Event\n\n### First beat\n\n#### Action\n\nIt begins.\n",
    );
    assert.deepEqual(snapshot(path.join(root, "docs")), before);
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
};

/** Runs the generated package command and requires a clean process boundary. */
function runBook(root: string, args: readonly string[]): void {
  const result = invokeBook(root, args);
  assert.equal(
    result.status,
    0,
    `npm run book failed\nerror:\n${String(result.error)}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

/** Invokes the exact script authors receive in a generated package. */
function invokeBook(
  root: string,
  args: readonly string[],
): ReturnType<typeof spawnSync> & { stderr: string; stdout: string } {
  const npmArguments = ["run", "book", "--", ...args];
  const executable = process.platform === "win32" ? process.execPath : "npm";
  const commandArguments =
    process.platform === "win32"
      ? [
          path.join(
            path.dirname(process.execPath),
            "node_modules",
            "npm",
            "bin",
            "npm-cli.js",
          ),
          ...npmArguments,
        ]
      : npmArguments;
  return spawnSync(executable, commandArguments, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  }) as ReturnType<typeof spawnSync> & { stderr: string; stdout: string };
}

/** Copies one shipped scaffold file into the disposable generated consumer. */
function copy(root: string, relative: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(SCAFFOLD_ROOT, relative), target);
}

/** Writes one generated-project file. */
function write(root: string, relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

/** Captures deterministic path and byte tuples for a read-only assertion. */
function snapshot(root: string): readonly string[] {
  const records: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile())
        records.push(
          `${path.relative(root, target).replaceAll("\\", "/")}\0${fs.readFileSync(target, "utf8")}`,
        );
    }
  };
  visit(root);
  return records.sort(
    (left, right) => Number(left > right) - Number(left < right),
  );
}

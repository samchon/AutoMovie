import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const read = (relative: string): string =>
  fs.readFileSync(path.join(ROOT, relative), "utf8");

/**
 * Pin the repository-side wiring that makes `experimental/` a disposable
 * sandbox area rather than part of the tracked workspace.
 *
 * The load-bearing fact is the absence: `experimental/*` must NOT be a member
 * of `pnpm-workspace.yaml`. A member writes its own importer into the tracked
 * `pnpm-lock.yaml`, and because `experimental/` is gitignored, committing that
 * lock would describe an importer no other checkout has. The generator uses
 * `link:` and a standalone install to get the same source linking without that
 * consequence, so a later edit re-adding the glob is a regression this
 * catches.
 *
 * Scenarios:
 *
 * 1. `pnpm-workspace.yaml` lists `packages/*` and `test` and no `experimental`
 *    entry, so a sandbox never joins the root workspace.
 * 2. `.gitignore` ignores `experimental/`, so a sandbox is never committed.
 * 3. `.prettierignore` excludes `experimental/**`. Prettier does not read
 *    `.gitignore`, and the root `format` script globs `**\/*.ts`, so without
 *    this entry the formatter would rewrite sandbox sources.
 * 4. The root `experimental` script points at `internals/experimental.mjs`.
 */
export const test_workspace_experimental_wiring = (): void => {
  const workspace = read("pnpm-workspace.yaml");
  const manifest = JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
  };

  TestValidator.equals(
    "the root workspace still declares its real members",
    workspace.match(/^ {2}- (packages\/\*|test)$/gm)?.length ?? 0,
    2,
  );
  TestValidator.equals(
    "no experimental sandbox joins the root workspace",
    /^\s*-\s*experimental/m.test(workspace),
    false,
  );
  TestValidator.equals(
    "experimental sandboxes are gitignored",
    read(".gitignore")
      .split(/\r?\n/)
      .some((line) => line.trim() === "experimental/"),
    true,
  );
  TestValidator.equals(
    "the formatter does not descend into a sandbox",
    read(".prettierignore")
      .split(/\r?\n/)
      .some((line) => line.trim() === "experimental/**"),
    true,
  );
  TestValidator.equals(
    "the generator is reachable as a root script",
    manifest.scripts.experimental,
    "node internals/experimental.mjs",
  );
};

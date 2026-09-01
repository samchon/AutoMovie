import { TestValidator } from "@nestia/e2e";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { requireSourceModule } from "../internal/requireSourceModule";

const { bindProductionBook } = requireSourceModule<{
  bindProductionBook: (
    args: readonly string[],
    root?: string,
  ) => Promise<string>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/book.ts",
  ),
  ["bindProductionBook"],
);

/** Deterministic order, stated rather than left to the host locale. */
const byCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const roots: string[] = [];

const makeRoot = (name: string): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  roots.push(root);
  return root;
};

const write = (root: string, relative: string, content: string): void => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
};

/** Every file under the named directories, by path and bytes. */
const snapshot = (
  root: string,
  directories: readonly string[],
): Array<[string, string]> => {
  const found: Array<[string, string]> = [];
  const walk = (directory: string): void => {
    if (fs.existsSync(directory) === false) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else
        found.push([
          path.relative(root, target).split(path.sep).join("/"),
          fs.readFileSync(target, "utf8"),
        ]);
    }
  };
  for (const directory of directories) walk(path.join(root, directory));
  return found.sort((left, right) => byCodeUnits(left[0], right[0]));
};

/**
 * The book command binds a reader edition and refuses every malformed request.
 *
 * The command is one of the surfaces a generated project ships and the README
 * names. Its happy path had a scenario; its five refusals and its non-film
 * layer lived in `packages/template/test/`, which no npm script and no workflow
 * ever ran -- a thousand lines of assertions that had never executed once.
 *
 * Scenarios:
 *
 * 1. Binding defaults to screenplays, demotes their headings into one document,
 *    and returns the artifact path it wrote.
 * 2. An explicit layer and output bind a map reader edition where asked.
 * 3. Every authored document is byte-identical afterwards: a reader edition is
 *    derived from the docs and is never a second authority over them.
 * 4. An unknown option, a repeated one, one missing its value, a non-film layer
 *    with no title, and an unknown layer are each refused, and none of them
 *    leaves a file behind.
 */
export const test_template_production_book_command =
  async (): Promise<void> => {
    try {
      const books = makeRoot("book-command");
      write(books, "docs/screenplays/001-event/index.md", "# Event\n");
      write(
        books,
        "docs/screenplays/001-event/001-beat.md",
        "# First beat\n\n## Action {#action}\n\nIt begins.\n",
      );
      write(
        books,
        "docs/maps/001-site.md",
        "# Site plan\n\n## Extent {#extent}\n\nA bounded site.\n",
      );
      const docsBefore = snapshot(books, ["docs"]);
      const originalCwd = process.cwd();
      process.chdir(books);
      let screenplay: string;
      try {
        screenplay = await bindProductionBook(["--title", "Final Script"]);
      } finally {
        process.chdir(originalCwd);
      }
      assert.equal(
        screenplay,
        path.join(books, "artifacts", "final-script-screenplays.md"),
      );
      assert.equal(
        fs.readFileSync(screenplay, "utf8"),
        "# Final Script\n\n## Event\n\n### First beat\n\n#### Action\n\nIt begins.\n",
      );
      const customOutput = path.join(books, "reader-editions");
      const map = await bindProductionBook(
        ["--layer", "maps", "--title", "Site Book", "--output", customOutput],
        books,
      );
      assert.equal(map, path.join(customOutput, "site-book-maps.md"));
      assert.match(fs.readFileSync(map, "utf8"), /## Site plan\n\n### Extent/u);
      assert.deepEqual(snapshot(books, ["docs"]), docsBefore);

      const artifactsBefore = snapshot(books, ["artifacts", "reader-editions"]);
      for (const [args, message] of [
        [["--mystery", "x", "--title", "Book"], /Unknown book option/u],
        [["--title", "One", "--title", "Two"], /more than once/u],
        [["--title"], /requires a value/u],
        [["--layer", "maps"], /requires an explicit --title/u],
        [
          ["--layer", "unknown", "--title", "Invalid"],
          /Unknown authored document layer/u,
        ],
      ] as const) {
        await assert.rejects(() => bindProductionBook(args, books), message);
        assert.deepEqual(
          snapshot(books, ["artifacts", "reader-editions"]),
          artifactsBefore,
        );
      }

      TestValidator.equals(
        "the book command bound every edition asked for and refused the rest",
        true,
        true,
      );
    } finally {
      for (const root of roots)
        fs.rmSync(root, { force: true, recursive: true });
    }
  };

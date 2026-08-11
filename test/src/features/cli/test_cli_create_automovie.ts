import { TestValidator } from "@nestia/e2e";
import { runCreateAutoMovie } from "create-automovie";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/** The package-manager creator publishes editable source and refuses overwrite. */
export const test_cli_create_automovie = (): void => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "create-automovie-"));
  try {
    const target = path.join(base, "my-film");
    const created = runCreateAutoMovie([
      process.execPath,
      "create-automovie",
      target,
    ]);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(target, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const sentinel = path.join(target, "author-owned.txt");
    fs.writeFileSync(sentinel, "keep\n", "utf8");
    const repeated = runCreateAutoMovie([
      process.execPath,
      "create-automovie",
      target,
    ]);

    TestValidator.equals(
      "creation publishes ordinary source without hidden work and refuses overwrite",
      namedFacts([
        ["created", () => created === 0],
        [
          "source",
          () =>
            fs.existsSync(path.join(target, "src", "film.ts")) &&
            fs.existsSync(path.join(target, "docs")),
        ],
        [
          "workflows",
          () =>
            typeof manifest.scripts?.build === "string" &&
            typeof manifest.scripts?.lint === "string" &&
            typeof manifest.scripts?.render === "string" &&
            typeof manifest.scripts?.verify === "string",
        ],
        [
          "noHiddenInstall",
          () => fs.existsSync(path.join(target, "node_modules")) === false,
        ],
        ["refusedOverwrite", () => repeated === 1],
        [
          "preservedAuthorFile",
          () => fs.readFileSync(sentinel, "utf8") === "keep\n",
        ],
      ]),
      {
        created: true,
        source: true,
        workflows: true,
        noHiddenInstall: true,
        refusedOverwrite: true,
        preservedAuthorFile: true,
      },
    );
  } finally {
    fs.rmSync(base, { force: true, recursive: true });
  }
};

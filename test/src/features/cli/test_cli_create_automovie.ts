import { TestValidator } from "@nestia/e2e";
import { runCreateAutoMovie } from "create-automovie";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

interface ICreatorResult {
  status: number;
  stderr: string;
  stdout: string;
}

/** Invoke the creator while restoring both process streams before returning. */
const create = (target: string): ICreatorResult => {
  const nativeStdout = process.stdout.write;
  const nativeStderr = process.stderr.write;
  let stdout = "";
  let stderr = "";
  try {
    process.stdout.write = ((chunk: string | Uint8Array): boolean => {
      stdout +=
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
      stderr +=
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
      return true;
    }) as typeof process.stderr.write;
    const status = runCreateAutoMovie([
      process.execPath,
      "create-automovie",
      target,
    ]);
    return { status, stderr, stdout };
  } finally {
    process.stdout.write = nativeStdout;
    process.stderr.write = nativeStderr;
  }
};

/** The package-manager creator publishes editable source and refuses overwrite. */
export const test_cli_create_automovie = (): void => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "create-automovie-"));
  let failure: { error: unknown } | undefined;
  try {
    const target = path.join(base, "my-film");
    const created = create(target);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(target, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const sentinel = path.join(target, "author-owned.txt");
    fs.writeFileSync(sentinel, "keep\n", "utf8");
    const repeated = create(target);

    TestValidator.equals(
      "creation publishes ordinary source without hidden work and refuses overwrite",
      namedFacts([
        ["created", () => created.status === 0 && created.stderr === ""],
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
        [
          "refusedOverwrite",
          () => repeated.status === 1 && repeated.stderr.includes(target),
        ],
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
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveCliRootFixtureCleanup(
      failure,
      () => fs.rmSync(base, { force: true, recursive: true }),
      "create-automovie fixture root",
    );
  }
};

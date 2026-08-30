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

/**
 * The one-command creator publishes editable source and never writes twice.
 *
 * `create-automovie` is the front door: whatever it leaves behind is the whole
 * of what an author starts from, and it runs against a directory the author
 * chose rather than one the tool owns. So the two facts worth pinning are that
 * a first run produces ordinary source the author can open, and that a second
 * run over the same directory refuses rather than reconciles. What it must not
 * do is silently install, because an install the author did not ask for is
 * minutes of network work and a `node_modules` the creator would then own.
 *
 * The scenarios drive the real creator over a real temporary directory rather
 * than a rendered file map, since refusal and preservation are decisions about
 * a directory that already exists and a map has no such state.
 *
 * Scenarios:
 *
 * 1. A first run over an absent directory exits zero with nothing on stderr and
 *    leaves a directory behind, which is the successful path.
 * 2. That run installs nothing: no `node_modules` exists afterwards, so the
 *    creator has not quietly become a package manager.
 * 3. A second run over the same directory exits one and names the directory it
 *    refused, so the author is told which path stopped it rather than being
 *    handed a merged tree.
 * 4. A file the author wrote between the two runs survives the refusal byte for
 *    byte. This is the negative twin of the refusal: an exit code alone would
 *    still permit a creator that overwrote first and reported afterwards.
 */
export const test_cli_create_automovie = (): void => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "create-automovie-"));
  let failure: { error: unknown } | undefined;
  try {
    const target = path.join(base, "my-film");
    const created = create(target);
    const sentinel = path.join(target, "author-owned.txt");
    fs.writeFileSync(sentinel, "keep\n", "utf8");
    const repeated = create(target);

    TestValidator.equals(
      "creation publishes ordinary source without hidden work and refuses overwrite",
      namedFacts([
        ["created", () => created.status === 0 && created.stderr === ""],
        ["createdDirectory", () => fs.statSync(target).isDirectory()],
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
        createdDirectory: true,
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

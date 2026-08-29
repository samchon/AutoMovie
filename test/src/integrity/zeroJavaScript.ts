import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const JAVASCRIPT_EXTENSION = /\.(?:js|mjs|cjs)$/iu;

/**
 * The repository this invariant governs, derived from this module rather than
 * from the caller's working directory.
 *
 * `git ls-files` is scoped to its `cwd`, so a default of `process.cwd()` made
 * the population whatever subtree the command happened to start in. Run from
 * `test/`, which is where the runner and its `tsconfig.json` live, the entry
 * printed "No directly authored JavaScript files are present." while
 * `build/zeroJavaScriptNegativeProbe.js` sat unignored in the tree. A guard that
 * reports the same green over a narrowed population is the failure this
 * invariant exists to prevent, so the root is a property of the repository and
 * not of the shell.
 */
export const ZERO_JAVASCRIPT_ROOT = path.resolve(__dirname, "..", "..", "..");

export interface IZeroJavaScriptDependencies {
  /** List repository-relative tracked and non-ignored untracked paths. */
  readonly list: (root: string) => readonly string[];
  /** Report whether a listed path is a physically present file. */
  readonly isFile: (root: string, relative: string) => boolean;
}

export interface IZeroJavaScriptWriter {
  write(message: string): unknown;
}

export class ZeroJavaScriptError extends Error {
  public readonly files: readonly string[];

  public constructor(files: readonly string[]) {
    super(
      `Directly authored JavaScript is forbidden; replace or remove:\n${files
        .map((file) => `- ${file}`)
        .join("\n")}`,
    );
    this.name = "ZeroJavaScriptError";
    this.files = files;
  }
}

export const zeroJavaScriptDependencies: IZeroJavaScriptDependencies = {
  list: (root) => {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: root, encoding: "utf8" },
    );
    const files = output.split("\0");
    files.pop();
    return files;
  },
  isFile: (root, relative) =>
    fs
      .statSync(path.join(root, relative), { throwIfNoEntry: false })
      ?.isFile() ?? false,
};

/** Return every physically present authored JavaScript path, with no allowlist. */
export const findAuthoredJavaScript = (
  root: string,
  dependencies: IZeroJavaScriptDependencies = zeroJavaScriptDependencies,
): string[] =>
  dependencies
    .list(root)
    .filter(
      (relative) =>
        JAVASCRIPT_EXTENSION.test(relative) &&
        dependencies.isFile(root, relative),
    )
    .sort((left, right) => left.localeCompare(right));

/** Refuse any tracked or non-ignored untracked directly authored JavaScript. */
export const assertZeroJavaScript = (
  root: string,
  dependencies: IZeroJavaScriptDependencies = zeroJavaScriptDependencies,
): void => {
  const files = findAuthoredJavaScript(root, dependencies);
  if (files.length !== 0) throw new ZeroJavaScriptError(files);
};

/** Execute the repository invariant through an injectable typed CLI boundary. */
export const runZeroJavaScript = (
  root: string = ZERO_JAVASCRIPT_ROOT,
  dependencies: IZeroJavaScriptDependencies = zeroJavaScriptDependencies,
  output: IZeroJavaScriptWriter = process.stdout,
  errorOutput: IZeroJavaScriptWriter = process.stderr,
): number => {
  try {
    assertZeroJavaScript(root, dependencies);
    output.write("No directly authored JavaScript files are present.\n");
    return 0;
  } catch (error) {
    errorOutput.write(`${String(error)}\n`);
    return 1;
  }
};

/**
 * True when Node started this file rather than importing it.
 *
 * `build/tgz.ts` states the same predicate for the repository's build tools.
 * The two cannot share one definition: this package's `tsconfig.json` roots at
 * `test/src`, so a file outside it is not compilable here, and a guard that
 * decides whether a command runs at all is the wrong place to reach across that
 * boundary for three lines.
 */
export const isProcessEntry = (
  entry: string | undefined,
  file: string,
): boolean => entry !== undefined && path.resolve(entry) === path.resolve(file);

/** Publish the invariant's status to the process, isolated so it can be observed. */
export const setZeroJavaScriptExitCode = (code: number): void => {
  process.exitCode = code;
};

/** Check the invariant only when this module is the process entry. */
export const zeroJavaScriptCli = (
  entry: boolean,
  setExitCode: (code: number) => void,
): void => {
  if (entry) setExitCode(runZeroJavaScript());
};

zeroJavaScriptCli(
  isProcessEntry(process.argv[1], __filename),
  setZeroJavaScriptExitCode,
);

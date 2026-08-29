import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const JAVASCRIPT_EXTENSION = /\.(?:js|mjs|cjs)$/iu;

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
  root: string = process.cwd(),
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

if (path.resolve(process.argv[1] ?? "") === path.resolve(__filename))
  process.exitCode = runZeroJavaScript();

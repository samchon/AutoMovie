import fs from "node:fs";
import path from "node:path";

/**
 * A file URL a host path was spelled into, or a file URL taken apart by hand.
 *
 * Both are one mistake: treating `file://` as string arithmetic instead of
 * asking Node. Concatenation is right only where the path starts with a drive
 * letter — on POSIX the path's own leading slash makes the separator four — and
 * a hand-rolled strip has the mirror-image fault, taking three characters off a
 * shape that only sometimes carries them.
 *
 * This repository has paid for the pair three times. `coverageScriptShapes`
 * stripped the scheme with `url.replace(/^file:[/]{3}/u, "")` and therefore
 * reported zero measured scripts on Linux for its whole life; then a wiring
 * case built `file:///` plus the repository root and failed only on Ubuntu;
 * then the same file's second call site did it again, in the commit that fixed
 * the first. Discipline had three chances.
 */
export interface IHostFileUrlFinding {
  file: string;
  kind: "built" | "parsed";
  line: number;
  text: string;
}

/**
 * An interpolation directly after the scheme, which is where a host path goes.
 *
 * `file:///repo/packages/engine/src/${name}.ts` is a fixed synthetic address
 * with a name dropped into it and reaches no host, so the position of the
 * interpolation is the whole distinction: immediately after `file:///` the
 * value being spelled in is a path, and further along it is a path segment.
 */
const BUILT = /file:\/\/\/\$\{/u;

/** A regular expression that takes the scheme apart rather than parsing it. */
const PARSED = /\/\^?file:\[?\//u;

const SOURCE = /\.[cm]?tsx?$/u;

/** Every authored TypeScript file under one root, in code-unit order. */
export const authoredSources = (root: string): string[] => {
  const found: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort(
        (left, right) =>
          Number(left.name > right.name) - Number(left.name < right.name),
      )) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile() && SOURCE.test(entry.name)) found.push(target);
    }
  };
  walk(root);
  return found;
};

/**
 * Read one file for both shapes, ignoring the lines that describe them.
 *
 * A comment explaining why the concatenation is wrong contains the
 * concatenation, and so does this module. Skipping comment lines is what lets
 * the reason be written down at all; the check is about expressions, and an
 * expression is not a sentence about an expression.
 */
export const findHostFileUrls = (
  file: string,
  text: string,
): IHostFileUrlFinding[] => {
  const findings: IHostFileUrlFinding[] = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("*") ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*")
    )
      continue;
    const kind = BUILT.test(line)
      ? ("built" as const)
      : PARSED.test(line)
        ? ("parsed" as const)
        : null;
    if (kind !== null)
      findings.push({ file, kind, line: index + 1, text: trimmed });
  }
  return findings;
};

/** Inspect every authored source under the given roots. */
export const inspectHostFileUrls = (
  root: string,
  roots: readonly string[],
  read: (file: string) => string = (file) => fs.readFileSync(file, "utf8"),
): IHostFileUrlFinding[] =>
  roots
    .map((relative) => path.join(root, relative))
    .filter((directory) => fs.existsSync(directory))
    .flatMap((directory) => authoredSources(directory))
    .flatMap((file) =>
      findHostFileUrls(
        path.relative(root, file).replaceAll(path.sep, "/"),
        read(file),
      ),
    );

/** Say what was found and what to write instead. */
export const reportHostFileUrls = (
  findings: readonly IHostFileUrlFinding[],
  write: (line: string) => void = console.log,
): void => {
  for (const finding of findings)
    write(
      `HOST FILE URL: ${finding.file}:${finding.line} ` +
        (finding.kind === "built"
          ? "spells a host path after the scheme; build it with pathToFileURL"
          : "takes the scheme apart by hand; read it with new URL") +
        ` -- ${finding.text}`,
    );
  write(
    `host file URLs: ${findings.length} authored ${findings.length === 1 ? "expression treats" : "expressions treat"} file:// as string arithmetic`,
  );
};

export const HOST_FILE_URL_ROOTS: readonly string[] = [
  "build",
  "config",
  "packages",
  "test/src",
];

export const runHostFileUrlGate = (
  root: string,
  write: (line: string) => void = console.log,
): number => {
  const findings = inspectHostFileUrls(root, HOST_FILE_URL_ROOTS);
  reportHostFileUrls(findings, write);
  return findings.length === 0 ? 0 : 1;
};

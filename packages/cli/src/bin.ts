#!/usr/bin/env node
import * as path from "node:path";

import { renderScaffold } from "./renderScaffold";
import { writeFiles } from "./writeFiles";

const USAGE = `automovie: scaffold an automovie project

Usage:
  npx automovie start <directory> [--force]

Commands:
  start <directory>   Create <directory> and lay down the starter template:
                      an MCP server config and a direct-link engine example.

Options:
  --force             Scaffold into a non-empty directory.
  -h, --help          Show this help.
  -v, --version       Print the version.
`;

/**
 * This package's version, read at runtime from the sibling `package.json`
 * (`require`, not an `import`, so it stays outside `rootDir`). `__dirname`
 * resolves to `src` under ttsx and `lib` when published; the file sits one
 * level up in both.
 */
const packageVersion = (): string =>
  (require(path.join(__dirname, "..", "package.json")) as { version: string })
    .version;

/** Derive a valid npm package name from the target directory's basename. */
const projectNameOf = (targetDir: string): string =>
  path
    .basename(targetDir)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "") || "automovie-project";

/**
 * The `automovie` CLI entry: parse argv, render the starter, and write it to
 * the target directory. Returns the process exit code (0 success, 1 on a usage
 * or scaffold error) rather than exiting, so the logic stays unit-testable.
 *
 * @author Samchon
 */
export const run = (argv: readonly string[]): number => {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (args.includes("-v") || args.includes("--version")) {
    process.stdout.write(`${packageVersion()}\n`);
    return 0;
  }

  const [command, ...rest] = args;
  if (command !== "start") {
    process.stderr.write(`unknown command "${command}"\n\n${USAGE}`);
    return 1;
  }

  const dir = rest.find((arg) => !arg.startsWith("-"));
  if (dir === undefined) {
    process.stderr.write(`start needs a target directory\n\n${USAGE}`);
    return 1;
  }

  const targetDir = path.resolve(process.cwd(), dir);
  try {
    const files = renderScaffold({ name: projectNameOf(targetDir) });
    const written = writeFiles(targetDir, files, {
      force: rest.includes("--force"),
    });
    process.stdout.write(
      `Scaffolded ${written.length} files into ${targetDir}\n\n` +
        written
          .map((file) => `  ${path.relative(targetDir, file) || "."}`)
          .join("\n") +
        `\n\nNext:\n  cd ${dir}\n  npm install\n  npm run perform\n\n` +
        `README.md walks the MCP server config and the direct-link engine path.\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
};

/* c8 ignore start -- the process entry: run() carries the tested logic. */
if (require.main === module) process.exit(run(process.argv));
/* c8 ignore stop */

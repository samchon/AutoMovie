#!/usr/bin/env node
import { run } from "@automovie/cli";

/**
 * Delegate the package-manager creator convention to the canonical CLI.
 *
 * @evidence specifications/bootstrap/create-automovie.md#source-project-bootstrap Starts the source-owned workflow through the versioned canonical scaffold.
 */
export const runCreateAutoMovie = (
  argv: readonly string[] = process.argv,
): number =>
  run([
    argv[0] ?? process.execPath,
    "create-automovie",
    "start",
    ...argv.slice(2),
  ]);

if (require.main === module) process.exitCode = runCreateAutoMovie();

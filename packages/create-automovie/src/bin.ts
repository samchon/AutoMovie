#!/usr/bin/env node
import { run } from "@automovie/cli";

/**
 * Creates a project-owned production through the package-manager creator
 * convention.
 *
 * The adapter preserves the launch executable and user arguments, inserts the
 * canonical `start` action, and returns the canonical CLI exit status. It owns
 * no parallel template or hidden authoring state, so `create-automovie` and the
 * main CLI always materialize the same reviewable project source. Preserving
 * the complete call also makes the canonical target checks and scaffold bytes
 * part of this creator's observable contract.
 *
 * @author Samchon
 * @param argv Package-manager process arguments, including the executable and
 *   creator command positions.
 * @returns The canonical CLI exit status for the delegated scaffold operation.
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

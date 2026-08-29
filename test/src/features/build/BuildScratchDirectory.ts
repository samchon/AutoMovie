import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "node_modules",
  ".cache",
);

/**
 * One scenario's own scratch directory under the repository cache.
 *
 * `/tmp` is not usable here: an absolute POSIX path silently measured nothing on
 * Windows once already, and the cache root is the one place this repository
 * agrees is disposable and gitignored. The random suffix beside the process id
 * is what makes two calls distinct inside one process and survives a run killed
 * before its cleanup, whose recycled process id would otherwise hand a later run
 * a populated directory.
 */
export const buildScratchDirectory = (label: string): string => {
  const directory = path.join(
    CACHE,
    `automovie-build-${label}`,
    `${process.pid}-${crypto.randomUUID()}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  return directory;
};

interface IBuildScratchFailure {
  error: unknown;
}

class BuildScratchCleanupError extends AggregateError {}

/**
 * Remove one owned scratch directory without replacing the scenario's primary
 * failure. A cleanup that throws after the test already failed would otherwise
 * hide the defect behind a filesystem error.
 */
export const preserveBuildScratchCleanup = (
  failure: IBuildScratchFailure | undefined,
  directory: string,
): void => {
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new BuildScratchCleanupError(
      [failure.error, cleanupFailure],
      `build scratch ${directory} cleanup failed after the test failed.`,
    );
  }
};

import assert from "node:assert/strict";

import { isAutoMovieEvidencePhysicalFile } from "../src/walkAutoMovieProjectPopulationFiles";

/**
 * Project evidence admits exactly one pathname for one regular file.
 *
 * Scenarios:
 * 1. a non-linked regular file with one directory entry is admitted;
 * 2. the same regular bytes with two directory entries are refused; and
 * 3. symbolic links, directories, and special entries remain refused even
 *    when their numeric link count is one.
 */
const testWalkAutoMovieProjectPopulationFiles = (): void => {
  assert.equal(isAutoMovieEvidencePhysicalFile(entry("file", 1)), true);
  assert.equal(isAutoMovieEvidencePhysicalFile(entry("file", 1n)), true);
  assert.equal(isAutoMovieEvidencePhysicalFile(entry("file", 2n)), false);
  assert.equal(
    isAutoMovieEvidencePhysicalFile({
      isFile: () => true,
      isSymbolicLink: () => true,
      nlink: 1,
    }),
    false,
  );
  assert.equal(isAutoMovieEvidencePhysicalFile(entry("symlink", 1)), false);
  assert.equal(isAutoMovieEvidencePhysicalFile(entry("directory", 1)), false);
  assert.equal(isAutoMovieEvidencePhysicalFile(entry("special", 1)), false);
};

const entry = (
  kind: "directory" | "file" | "special" | "symlink",
  nlink: number | bigint,
) => ({
  isFile: () => kind === "file",
  isSymbolicLink: () => kind === "symlink",
  nlink,
});

testWalkAutoMovieProjectPopulationFiles();
process.stdout.write("production evidence physical identity canaries passed\n");

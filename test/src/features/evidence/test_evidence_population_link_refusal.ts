import { isAutoMovieEvidencePhysicalFile } from "@automovie/evidence";
import { TestValidator } from "@nestia/e2e";

const entry = (props: {
  file?: boolean;
  link?: boolean;
  nlink: number | bigint;
}) => ({
  isFile: () => props.file ?? true,
  isSymbolicLink: () => props.link ?? false,
  nlink: props.nlink,
});

/**
 * An enumerated evidence population still admits only independently owned
 * files, so a hardlink alias inside a walked tree stays refused.
 *
 * This is the half of the physical judgment that keeps its directory-entry
 * count. A walk can reach one inode through two names, and admitting both would
 * put two independent owners of one set of bytes into the graph as separate
 * contracts or sources. The identity manifest is admitted by a different
 * decision at a fixed path, and relaxing that one must not relax this one.
 *
 * Scenarios:
 *
 * 1. A single-entry regular file is admitted, whether the host reports the
 *    count as a number or as a bigint.
 * 2. A second directory entry for the same inode is refused in both numeric
 *    forms, which is the alias case the graph must never enumerate twice.
 * 3. A symbolic link is refused even when it names exactly one entry.
 * 4. An entry that is not a regular file is refused even when it names exactly
 *    one entry.
 */
export const test_evidence_population_link_refusal = (): void => {
  for (const nlink of [1, 1n])
    TestValidator.equals(
      "one directory entry is an independently owned population file",
      isAutoMovieEvidencePhysicalFile(entry({ nlink })),
      true,
    );
  for (const nlink of [2, 2n])
    TestValidator.equals(
      "a hardlink alias is refused in the walked population",
      isAutoMovieEvidencePhysicalFile(entry({ nlink })),
      false,
    );
  for (const nlink of [0, 3, 3n])
    TestValidator.equals(
      "only exactly one directory entry is admitted",
      isAutoMovieEvidencePhysicalFile(entry({ nlink })),
      false,
    );
  TestValidator.equals(
    "a symbolic link is refused with one entry",
    isAutoMovieEvidencePhysicalFile(entry({ link: true, nlink: 1n })),
    false,
  );
  TestValidator.equals(
    "a non-regular entry is refused with one entry",
    isAutoMovieEvidencePhysicalFile(entry({ file: false, nlink: 1n })),
    false,
  );
};

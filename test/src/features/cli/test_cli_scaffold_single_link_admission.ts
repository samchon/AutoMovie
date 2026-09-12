import {
  captureScaffoldFile,
  captureSingleLinkScaffoldFile,
  readScaffoldFileSnapshot,
  readSingleLinkScaffoldFileSnapshot,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { createScaffoldSnapshotFileSystem } from "../internal/createScaffoldSnapshotFileSystem";
import { throwsError } from "../internal/predicates";

/**
 * Two admissions stand side by side, and a caller picks the one its own promise
 * requires.
 *
 * A generated project's root-direct inputs carry a second directory entry while
 * a command runs, because the documented script runner mirrors them, so reading
 * one must not count entries. A caller that chooses what to operate on has the
 * opposite promise: the repository's experiment launcher may not adopt a linked
 * directory or manifest as a work target, and its only enforcement of that is
 * the admission it reads through. Pinning both against the same input is what
 * keeps a later relaxation of the strict one from passing silently.
 *
 * Scenarios:
 *
 * 1. One entry: both admissions capture and read the same file.
 * 2. Two entries: the ordinary admission still captures and reads, while the
 *    single-link admission refuses both. The two judgments differ on identical
 *    input, which is the property a caller relies on when it chooses.
 * 3. A symbolic link and a non-regular entry are refused by both, so narrowing
 *    the entry count did not become the only thing either admission checks.
 * 4. The strict refusal happens at admission, before any descriptor opens, so a
 *    refused target is never read.
 */
export const test_cli_scaffold_single_link_admission = (): void => {
  const single = createScaffoldSnapshotFileSystem();
  TestValidator.equals(
    "one entry is captured by both admissions",
    single.run(() => [
      captureScaffoldFile(single.file).identity,
      captureSingleLinkScaffoldFile(single.file).identity,
    ]),
    ["1:31", "1:31"],
  );
  TestValidator.equals(
    "one entry is read by both admissions",
    single.run(() => [
      readScaffoldFileSnapshot(single.file).bytes.toString(),
      readSingleLinkScaffoldFileSnapshot(single.file).bytes.toString(),
    ]),
    ["old", "old"],
  );

  const aliased = createScaffoldSnapshotFileSystem();
  aliased.state.links = 2n;
  TestValidator.equals(
    "the ordinary admission captures an aliased file",
    aliased.run(() => captureScaffoldFile(aliased.file).identity),
    "1:31",
  );
  TestValidator.equals(
    "the ordinary admission reads an aliased file",
    aliased.run(() => readScaffoldFileSnapshot(aliased.file).bytes.toString()),
    "old",
  );
  TestValidator.predicate(
    "the single-link admission refuses to capture it",
    throwsError(
      () => aliased.run(() => captureSingleLinkScaffoldFile(aliased.file)),
      ["is not one ordinary single-link file"],
    ),
  );
  const before = aliased.openCount();
  TestValidator.predicate(
    "the single-link admission refuses to read it",
    throwsError(
      () => aliased.run(() => readSingleLinkScaffoldFileSnapshot(aliased.file)),
      ["is not one ordinary single-link file"],
    ),
  );
  TestValidator.equals(
    "the strict refusal opened no descriptor",
    aliased.openCount(),
    before,
  );

  for (const unusable of [
    { links: 1n, symbolic: true },
    { links: 2n, symbolic: true },
  ]) {
    const linked = createScaffoldSnapshotFileSystem();
    linked.state.links = unusable.links;
    linked.state.symbolic = unusable.symbolic;
    TestValidator.predicate(
      "a symbolic link is refused by the ordinary admission",
      throwsError(
        () => linked.run(() => captureScaffoldFile(linked.file)),
        ["is not one ordinary file"],
      ),
    );
    TestValidator.predicate(
      "a symbolic link is refused by the single-link admission too",
      throwsError(() =>
        linked.run(() => captureSingleLinkScaffoldFile(linked.file)),
      ),
    );
  }
};

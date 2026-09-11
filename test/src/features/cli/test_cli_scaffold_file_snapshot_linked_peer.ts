import {
  captureScaffoldFile,
  captureScaffoldPhysicalDirectory,
  readScaffoldFileSnapshot,
  writeScaffoldFile,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { createScaffoldSnapshotFileSystem } from "../internal/createScaffoldSnapshotFileSystem";
import { throwsError } from "../internal/predicates";

/**
 * A second directory entry naming the same file is admitted where the operation
 * only observes, and refused where the write would rewrite the resident inode.
 *
 * The documented script runner mirrors every root-direct file of a generated
 * project into its own cache while a command runs, so an ordinary input such as
 * the reference-client configuration has two entries exactly when maintenance
 * reads it. Capturing and reading cannot change what the other entry shows, so
 * they admit it. Truncating and rewriting the inode would change the other
 * entry's bytes, so that writer keeps requiring the single entry. Pinning both
 * halves is what stops a later reader from taking the surviving requirement for
 * redundant leftovers.
 *
 * Scenarios:
 *
 * 1. Capture admits a file named by two directory entries and reports its exact
 *    physical generation.
 * 2. A descriptor read of that same file returns its bytes and leaves no handle
 *    open.
 * 3. A symbolic link is still refused on the read path, so relaxing the entry
 *    count did not relax the identity boundary.
 * 4. In-place replacement of a file with two entries is refused, and no
 *    truncation is attempted, so no byte the other entry shows can have changed.
 * 5. The identical replacement completes once the file has a single entry, which
 *    pins the refusal to the entry count rather than to the surrounding state.
 */
export const test_cli_scaffold_file_snapshot_linked_peer = (): void => {
  const captured = createScaffoldSnapshotFileSystem();
  captured.state.links = 2n;
  TestValidator.equals(
    "capture admits a file named by two directory entries",
    captured.run(() => captureScaffoldFile(captured.file)).identity,
    "1:31",
  );

  const read = createScaffoldSnapshotFileSystem();
  read.state.links = 2n;
  TestValidator.equals(
    "a descriptor read of a linked file returns its bytes",
    read.run(() => readScaffoldFileSnapshot(read.file)).bytes.toString(),
    "old",
  );
  TestValidator.equals(
    "the linked read closes all handles",
    read.openCount(),
    0,
  );

  const symbolic = createScaffoldSnapshotFileSystem();
  symbolic.state.links = 2n;
  symbolic.state.symbolic = true;
  TestValidator.predicate(
    "a symbolic link is still refused on the read path",
    throwsError(
      () => symbolic.run(() => readScaffoldFileSnapshot(symbolic.file)),
      ["is not one ordinary file"],
    ),
  );

  const memory = createScaffoldSnapshotFileSystem();
  memory.run(() => {
    const base = captureScaffoldPhysicalDirectory(memory.root);
    memory.state.links = 2n;
    const expected = captureScaffoldFile(memory.file);
    const request = {
      base,
      parent: base,
      target: memory.file,
      bytes: Buffer.from("new"),
      expected,
      force: true,
    };
    const refused = writeScaffoldFile(request);
    TestValidator.equals(
      "in-place replacement of a linked file is refused",
      refused.status,
      "refused",
    );
    TestValidator.equals(
      "the refusal attempted no truncation",
      memory.events.includes("truncate"),
      false,
    );
    TestValidator.equals(
      "the resident bytes are untouched",
      memory.state.bytes.toString(),
      "old",
    );

    memory.state.links = 1n;
    const completed = writeScaffoldFile({
      ...request,
      expected: captureScaffoldFile(memory.file),
    });
    TestValidator.equals(
      "the same replacement completes with one entry",
      completed.status,
      "completed",
    );
    TestValidator.equals(
      "the successor bytes are published",
      memory.state.bytes.toString(),
      "new",
    );
  });
};

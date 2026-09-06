import { readScaffoldFileSnapshot } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { createScaffoldSnapshotFileSystem } from "../internal/createScaffoldSnapshotFileSystem";

/** Reads retain descriptor identity without replacing pathname snapshot identity. */
export const test_cli_scaffold_file_snapshot_read = (): void => {
  const memory = createScaffoldSnapshotFileSystem();
  memory.state.pathDevice = 0n;
  const result = memory.run(() => readScaffoldFileSnapshot(memory.file));
  TestValidator.equals("exact read bytes", result.bytes.toString(), "old");
  TestValidator.equals(
    "pathname identity retained",
    result.snapshot.identity,
    "0:31",
  );
  TestValidator.equals(
    "descriptor identity retained separately",
    result.identity,
    "1:31",
  );
  TestValidator.equals(
    "descriptor version retains its basis",
    result.version,
    "1:31:3:2:2",
  );
  TestValidator.equals("all handles closed", memory.openCount(), 0);
  const opened = createScaffoldSnapshotFileSystem();
  opened.state.advanceChangeTimeOnOpen = true;
  const fresh = opened.run(() => readScaffoldFileSnapshot(opened.file));
  TestValidator.equals(
    "own opens preserve bytes",
    fresh.bytes.toString(),
    "old",
  );
  TestValidator.predicate(
    "final snapshot includes own open ctime",
    fresh.snapshot.version.endsWith(
      `:${opened.state.clock + opened.state.changeClock}`,
    ),
  );
  TestValidator.equals(
    "own-open read closes all handles",
    opened.openCount(),
    0,
  );
  TestValidator.equals(
    "read has no write",
    memory.events.includes("truncate"),
    false,
  );
};

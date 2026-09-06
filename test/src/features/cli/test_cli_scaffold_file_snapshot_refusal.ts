import { readScaffoldFileSnapshot } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { createScaffoldSnapshotFileSystem } from "../internal/createScaffoldSnapshotFileSystem";
import { throwsError } from "../internal/predicates";

/** Read mutation and descriptor failures cannot authorize a later write. */
export const test_cli_scaffold_file_snapshot_refusal = (): void => {
  const changed = createScaffoldSnapshotFileSystem();
  changed.state.afterRead = () => {
    changed.state.identity++;
  };
  TestValidator.predicate(
    "changed resident refuses",
    throwsError(() =>
      changed.run(() => readScaffoldFileSnapshot(changed.file)),
    ),
  );
  TestValidator.equals(
    "refused read closes all handles",
    changed.openCount(),
    0,
  );
  const failed = createScaffoldSnapshotFileSystem();
  const failure = new Error("injected read failure");
  failed.state.readFailure = failure;
  let observed: unknown;
  try {
    failed.run(() => readScaffoldFileSnapshot(failed.file));
  } catch (error) {
    observed = error;
  }
  TestValidator.predicate("read cause is retained", observed === failure);
  TestValidator.equals("failed read closes all handles", failed.openCount(), 0);
  const linked = createScaffoldSnapshotFileSystem();
  linked.state.links = 2n;
  TestValidator.predicate(
    "multiply linked input refuses",
    throwsError(() => linked.run(() => readScaffoldFileSnapshot(linked.file))),
  );
  TestValidator.equals("linked input is never opened", linked.openCount(), 0);
  for (const readFails of [false, true]) {
    const closing = createScaffoldSnapshotFileSystem();
    const closeFailure = new Error("injected close failure");
    if (readFails) {
      closing.state.readFailure = failure;
      closing.state.beforeRead = () => {
        closing.state.closeFailure = closeFailure;
      };
    } else closing.state.closeFailure = closeFailure;
    let closeResult: unknown;
    try {
      closing.run(() => readScaffoldFileSnapshot(closing.file));
    } catch (error) {
      closeResult = error;
    }
    TestValidator.predicate(
      "close failure is never success",
      closeResult instanceof Error,
    );
    if (readFails)
      TestValidator.predicate(
        "read and close causes retained",
        closeResult instanceof AggregateError &&
          closeResult.errors.includes(failure) &&
          closeResult.errors.includes(closeFailure),
      );
    TestValidator.equals(
      "failed close is not retried blindly",
      closing.openCount(),
      0,
    );
  }
  const afterClose = createScaffoldSnapshotFileSystem();
  afterClose.state.afterFinalClose = () => {
    afterClose.state.identity++;
  };
  TestValidator.predicate(
    "replacement after final close refuses",
    throwsError(() =>
      afterClose.run(() => readScaffoldFileSnapshot(afterClose.file)),
    ),
  );
  const inPlace = createScaffoldSnapshotFileSystem();
  inPlace.state.afterRead = () => {
    inPlace.state.clock++;
  };
  TestValidator.predicate(
    "same-inode write during read refuses",
    throwsError(() =>
      inPlace.run(() => readScaffoldFileSnapshot(inPlace.file)),
    ),
  );
};

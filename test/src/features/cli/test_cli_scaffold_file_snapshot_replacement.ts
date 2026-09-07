import {
  captureScaffoldFile,
  captureScaffoldPhysicalDirectory,
  writeScaffoldFile,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

import { createScaffoldSnapshotFileSystem } from "../internal/createScaffoldSnapshotFileSystem";
import { throwsError } from "../internal/predicates";

/** Explicit predecessor authority never adopts a later resident or grants force. */
export const test_cli_scaffold_file_snapshot_replacement = (): void => {
  const memory = createScaffoldSnapshotFileSystem();
  memory.run(() => {
    const base = captureScaffoldPhysicalDirectory(memory.root);
    const expected = captureScaffoldFile(memory.file);
    const props = {
      base,
      parent: base,
      target: memory.file,
      bytes: Buffer.from("new"),
      expected,
      force: true,
    };
    TestValidator.predicate(
      "snapshot alone cannot authorize overwrite",
      throwsError(() => writeScaffoldFile({ ...props, force: false })),
    );
    TestValidator.predicate(
      "snapshot must name the exact leaf",
      throwsError(() =>
        writeScaffoldFile({
          ...props,
          expected: { ...expected, path: `${memory.file}.other` },
        }),
      ),
    );
    memory.state.identity++;
    TestValidator.predicate(
      "late competitor is not recaptured",
      throwsError(() => writeScaffoldFile(props)),
    );
    TestValidator.equals(
      "competitor remains unchanged",
      memory.state.bytes.toString(),
      "old",
    );
    TestValidator.equals(
      "refusal made no destructive call",
      memory.events.includes("truncate"),
      false,
    );
    memory.state.identity--;
    memory.state.advanceChangeTimeOnOpen = true;
    const written = writeScaffoldFile(props);
    TestValidator.equals(
      "approved replacement completes",
      written.status,
      "completed",
    );
    TestValidator.equals(
      "replacement exposes its descriptor",
      written.status === "completed" ? written.fileIdentity : null,
      "1:31",
    );
    TestValidator.equals(
      "approved successor bytes",
      memory.state.bytes.toString(),
      "new",
    );
    let nativeCalls = 0;
    const exclusive = writeScaffoldFile({
      ...props,
      expected: null,
      capability: {
        publish: () => {
          nativeCalls++;
          return {
            status: "refused",
            reason: "target-competitor",
            error: new Error("occupied"),
          };
        },
      },
    });
    TestValidator.equals(
      "explicit absent slot uses exclusive native admission",
      nativeCalls,
      1,
    );
    TestValidator.equals(
      "force does not override null authority",
      exclusive.status,
      "refused",
    );
    TestValidator.equals(
      "exclusive refusal preserves existing bytes",
      memory.state.bytes.toString(),
      "new",
    );
  });
};

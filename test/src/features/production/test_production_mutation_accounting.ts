import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const { runProductionMutation, cleanupProductionAtomic } = loadSourceModule<{
  runProductionMutation: <File, Result>(props: {
    files: readonly File[];
    guard: () => void;
    apply: (file: File, published: () => void) => void;
    restore: (file: File) => void;
    complete: (committed: () => void) => Result;
  }) => Result;
  cleanupProductionAtomic: (
    temporary: string,
    failure: { error: unknown } | undefined,
    remove: () => void,
  ) => void;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/productionMutation.ts",
  ),
);

/**
 * A publication notification, not a normal return, determines rollback scope.
 *
 * Scenarios:
 * 1. Successful and empty transactions preserve their result and never restore.
 * 2. Pre-publication failure omits the current write; post-publication cleanup
 *    failure restores it and earlier writes, including deletion, in reverse order.
 * 3. A final guard failure restores the whole candidate, while a published
 *    revision retains it and reports the lost acknowledgement without rollback.
 * 4. A replaced namespace is never restored, and rollback failures preserve the
 *    original error while still attempting the remaining owned writes.
 * 5. Cleanup preserves a primary failure, including a thrown undefined value,
 *    and distinguishes cleanup after a successful operation from no publication.
 */
export const test_production_mutation_accounting = (): void => {
  const files = [
    { id: "new-payload", previous: null, next: "new" },
    { id: "manifest", previous: "old", next: "new" },
    { id: "removed", previous: "old", next: null },
  ];
  const primary = new Error("synthetic operation failure");
  const cleanup = new Error("synthetic cleanup failure");
  const identity = new Error("synthetic namespace replacement");
  const recovery = new Error("synthetic rollback failure");
  for (const stage of ["before", "after"] as const)
    for (const stop of files.keys()) {
      const resident = new Map(files.map((file) => [file.id, file.previous]));
      const restored: string[] = [];
      let caught: unknown;
      try {
        runProductionMutation({
          files,
          guard: () => undefined,
          apply: (file, published) => {
            if (file === files[stop] && stage === "before") throw primary;
            resident.set(file.id, file.next);
            published();
            if (file === files[stop] && stage === "after")
              cleanupProductionAtomic("candidate.tmp", undefined, () => {
                throw cleanup;
              });
          },
          restore: (file) => {
            restored.push(file.id);
            resident.set(file.id, file.previous);
          },
          complete: () => {
            throw new Error("failure must prevent completion");
          },
        });
      } catch (error) {
        caught = error;
      }
      TestValidator.equals(
        `rollback boundary ${stage} ${stop}`,
        restored,
        files
          .slice(0, stop + Number(stage === "after"))
          .reverse()
          .map((file) => file.id),
      );
      TestValidator.equals(
        `previous state ${stage} ${stop}`,
        [...resident],
        files.map((file) => [file.id, file.previous]),
      );
      TestValidator.predicate(
        `original failure ${stage} ${stop}`,
        stage === "before"
          ? caught === primary
          : caught instanceof AggregateError && caught.errors[0] === cleanup,
      );
    }

  for (const commit of [false, true]) {
    const restored: string[] = [];
    let caught: unknown;
    try {
      runProductionMutation({
        files,
        guard: () => undefined,
        apply: (_file, published) => published(),
        restore: (file) => {
          restored.push(file.id);
        },
        complete: (committed) => {
          if (commit) committed();
          throw primary;
        },
      });
    } catch (error) {
      caught = error;
    }
    TestValidator.equals(
      `revision boundary ${commit}`,
      restored,
      commit ? [] : [...files].reverse().map((file) => file.id),
    );
    TestValidator.predicate(
      `committed state is explicit ${commit}`,
      commit
        ? caught instanceof AggregateError &&
            caught.errors[0] === primary &&
            caught.message.includes("revision was committed")
        : caught === primary,
    );
  }

  for (const replace of [true, false]) {
    let owned = true;
    const restored: string[] = [];
    let caught: unknown;
    try {
      runProductionMutation({
        files,
        guard: () => {
          if (!owned) throw identity;
        },
        apply: (file, published) => {
          if (replace && file === files[1]) owned = false;
          published();
        },
        restore: (file) => {
          restored.push(file.id);
          if (file === files[1]) throw recovery;
        },
        complete: () => {
          throw primary;
        },
      });
    } catch (error) {
      caught = error;
    }
    TestValidator.equals(
      "replacement or incomplete rollback",
      restored,
      replace ? [] : [...files].reverse().map((file) => file.id),
    );
    TestValidator.predicate(
      "failure ordering is preserved",
      caught instanceof AggregateError &&
        (replace
          ? caught.errors[0] === identity && caught.errors[1] === identity
          : caught.errors[0] === primary && caught.errors[1] === recovery),
    );
  }

  let owned = true;
  const restores: string[] = [];
  let namespaceDuringRecovery: unknown;
  try {
    runProductionMutation({
      files,
      guard: () => {
        if (!owned) throw identity;
      },
      apply: (_file, published) => published(),
      restore: (file) => {
        restores.push(file.id);
        owned = false;
      },
      complete: () => {
        throw primary;
      },
    });
  } catch (error) {
    namespaceDuringRecovery = error;
  }
  TestValidator.equals("later rollback paths remain untouched", restores, [
    files[2]!.id,
  ]);
  TestValidator.predicate(
    "rollback guard errors follow primary failure",
    namespaceDuringRecovery instanceof AggregateError &&
      namespaceDuringRecovery.errors[0] === primary &&
      namespaceDuringRecovery.errors
        .slice(1)
        .every((error) => error === identity),
  );

  for (const values of [[], files]) {
    const published: string[] = [];
    let restored = false;
    const result = runProductionMutation({
      files: values,
      guard: () => undefined,
      apply: (file, notify) => {
        published.push(file.id);
        notify();
      },
      restore: () => {
        restored = true;
      },
      complete: (committed) => {
        committed();
        return "committed-result";
      },
    });
    TestValidator.equals("successful result", result, "committed-result");
    TestValidator.equals(
      "each write published once",
      published,
      values.map((file) => file.id),
    );
    TestValidator.predicate("success never restores", !restored);
  }
  TestValidator.equals(
    "unchanged completion needs no commit marker",
    runProductionMutation({
      files: [],
      guard: () => undefined,
      apply: () => undefined,
      restore: () => undefined,
      complete: () => "unchanged",
    }),
    "unchanged",
  );

  for (const failure of [undefined, { error: primary }, { error: undefined }]) {
    let removed = false;
    cleanupProductionAtomic("candidate.tmp", failure, () => {
      removed = true;
    });
    TestValidator.predicate("successful cleanup stays silent", removed);
    let caught: unknown;
    try {
      cleanupProductionAtomic("candidate.tmp", failure, () => {
        throw cleanup;
      });
    } catch (error) {
      caught = error;
    }
    TestValidator.predicate(
      "cleanup includes every failure in causal order",
      caught instanceof AggregateError &&
        (failure === undefined
          ? caught.errors.length === 1 &&
            caught.errors[0] === cleanup &&
            caught.message.includes("operation completed")
          : caught.errors.length === 2 &&
            caught.errors[0] === failure.error &&
            caught.errors[1] === cleanup),
    );
  }
};

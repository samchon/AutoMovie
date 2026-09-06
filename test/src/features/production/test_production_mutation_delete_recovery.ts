import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const { recoverProductionAtomicDelete } = loadSourceModule<{
  recoverProductionAtomicDelete: (props: {
    file: string;
    error: unknown;
    guard: () => void;
    quarantined: () => boolean;
    occupied: () => boolean;
    restore: () => void;
  }) => never;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/productionMutation.ts",
  ),
);

/**
 * Recovery never turns a failed deletion into a write in another namespace.
 *
 * Scenarios:
 * 1. Only a retained quarantine and an unoccupied target permit restoration.
 * 2. Each guard boundary can refuse without a later restore being attempted.
 * 3. Recovery failures follow the original failure, while successful recovery
 *    still reports that original failure, including a thrown undefined value.
 */
export const test_production_mutation_delete_recovery = (): void => {
  const primary = new Error("delete failure");
  const recovery = new Error("recovery failure");
  for (const quarantined of [false, true])
    for (const occupied of [false, true]) {
      let restored = false;
      let caught: unknown;
      try {
        recoverProductionAtomicDelete({
          file: "owned-target",
          error: primary,
          guard: () => undefined,
          quarantined: () => quarantined,
          occupied: () => occupied,
          restore: () => {
            restored = true;
          },
        });
      } catch (error) {
        caught = error;
      }
      TestValidator.equals(
        "restore only a retained unoccupied target",
        restored,
        quarantined && !occupied,
      );
      TestValidator.predicate(
        "successful recovery preserves original failure",
        caught === primary,
      );
    }
  for (const stop of [1, 2, 3]) {
    let guards = 0;
    let restored = false;
    let caught: unknown;
    try {
      recoverProductionAtomicDelete({
        file: "owned-target",
        error: primary,
        guard: () => {
          if (++guards === stop) throw recovery;
        },
        quarantined: () => true,
        occupied: () => false,
        restore: () => {
          restored = true;
        },
      });
    } catch (error) {
      caught = error;
    }
    TestValidator.equals(
      `guard ${stop} fences restoration`,
      restored,
      stop === 3,
    );
    TestValidator.predicate(
      "guard failure retains both errors",
      caught instanceof AggregateError &&
        caught.errors[0] === primary &&
        caught.errors[1] === recovery,
    );
  }
  let caught: unknown;
  try {
    recoverProductionAtomicDelete({
      file: "owned-target",
      error: undefined,
      guard: () => undefined,
      quarantined: () => true,
      occupied: () => false,
      restore: () => {
        throw recovery;
      },
    });
  } catch (error) {
    caught = error;
  }
  TestValidator.predicate(
    "undefined primary still precedes recovery failure",
    caught instanceof AggregateError &&
      caught.errors[0] === undefined &&
      caught.errors[1] === recovery,
  );
  let threw = false;
  try {
    recoverProductionAtomicDelete({
      file: "owned-target",
      error: undefined,
      guard: () => undefined,
      quarantined: () => false,
      occupied: () => false,
      restore: () => undefined,
    });
  } catch (error) {
    threw = error === undefined;
  }
  TestValidator.predicate(
    "undefined original is not mistaken for success",
    threw,
  );
};

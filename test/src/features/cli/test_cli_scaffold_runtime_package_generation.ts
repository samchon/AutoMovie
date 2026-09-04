import { TestValidator } from "@nestia/e2e";

import {
  type IRuntimePackageGenerationRegistry,
  createRuntimePackageGenerationRegistry,
  loadRuntimePackageGeneration,
  runRuntimePackageGeneration,
} from "../../../../packages/template/scaffold/scripts/runtimePackageGeneration";
import { namedFacts, rejectsError, throwsError } from "../internal/predicates";

interface IGenerationSnapshot {
  current: boolean;
  generation: string;
  key: string;
}

interface IGenerationFixture {
  cache: { identity: string } | undefined;
  loads: number;
  registry: IRuntimePackageGenerationRegistry;
  snapshot: IGenerationSnapshot;
}

const fixture = (
  key = "codec\0/root/a",
  generation = "generation-a",
): IGenerationFixture => ({
  cache: undefined,
  loads: 0,
  registry: createRuntimePackageGenerationRegistry(),
  snapshot: { current: true, generation, key },
});

const load = (
  state: IGenerationFixture,
  behavior:
    | "success"
    | "failure-before-cache"
    | "failure-after-cache" = "success",
) =>
  loadRuntimePackageGeneration({
    key: state.snapshot.key,
    generation: state.snapshot.generation,
    snapshot: state.snapshot,
    assertCurrent: () => {
      if (state.snapshot.current === false)
        throw new Error("snapshot generation changed");
    },
    observeCache: () => state.cache,
    load: () => {
      state.loads++;
      if (behavior === "failure-before-cache")
        throw new Error("loader failed before cache admission");
      state.cache = { identity: `${state.snapshot.key}:${state.loads}` };
      if (behavior === "failure-after-cache")
        throw new Error("loader failed after cache admission");
      return { execution: state.loads };
    },
    registry: state.registry,
  });

/**
 * A runtime package is executable only through the cache generation admitted
 * after its exact snapshot, never through bytes observed after Node had already
 * loaded a different resident object.
 *
 * Scenarios:
 *
 * 1. An unloaded package is reserved, loaded once, and reused only while its
 *    snapshot and exact cache token remain current.
 * 2. A different disk generation, a pre-existing cache entry, a replaced cache
 *    entry, and recursive loading all refuse without adopting an unattributed
 *    module.
 * 3. Equal versions at different physical roots remain independent keys.
 * 4. A load failure before cache admission rolls back for a safe retry, while
 *    a failure that leaves a cache entry poisons the process generation.
 * 5. An operation revalidates before and after execution, preserving operation
 *    then postcheck errors when both occur, and never starts from stale bytes.
 */
export const test_cli_scaffold_runtime_package_generation =
  async (): Promise<void> => {
    const stable = fixture();
    const first = load(stable);
    const reused = load(stable);
    TestValidator.equals(
      "one snapshotted generation owns one exact resident module",
      {
        loads: stable.loads,
        sameHandle: first === reused,
        sameModule: first.module === reused.module,
        carriedSnapshot: first.snapshot === stable.snapshot,
      },
      { loads: 1, sameHandle: true, sameModule: true, carriedSnapshot: true },
    );

    const diskReplacement = {
      ...stable,
      snapshot: {
        current: true,
        generation: "generation-b",
        key: stable.snapshot.key,
      },
    };
    const preloaded = fixture("codec\0/root/preloaded");
    preloaded.cache = { identity: "unowned" };
    const otherRoot = fixture("codec\0/root/b");
    const otherHandle = load(otherRoot);
    const recursive = fixture("codec\0/root/recursive");
    let recursiveRefusal = false;
    loadRuntimePackageGeneration({
      key: recursive.snapshot.key,
      generation: recursive.snapshot.generation,
      snapshot: recursive.snapshot,
      assertCurrent: () => undefined,
      observeCache: () => recursive.cache,
      load: () => {
        recursiveRefusal = throwsError(
          () => load(recursive),
          "loaded recursively",
        );
        recursive.cache = { identity: "recursive-owner" };
        return { execution: 1 };
      },
      registry: recursive.registry,
    });
    TestValidator.equals(
      "unowned, replaced, recursive, and sibling-root generations stay distinct",
      namedFacts([
        [
          "diskReplacement",
          () =>
            throwsError(
              () => load(diskReplacement),
              "differs from the resident module",
            ),
        ],
        [
          "preloaded",
          () =>
            throwsError(
              () => load(preloaded),
              "already present in the module cache",
            ),
        ],
        ["recursive", () => recursiveRefusal],
        ["otherRootLoaded", () => otherHandle.module.execution === 1],
      ]),
      {
        diskReplacement: true,
        preloaded: true,
        recursive: true,
        otherRootLoaded: true,
      },
    );

    stable.cache = { identity: "replacement" };
    TestValidator.predicate(
      "a loaded handle refuses replacement of its exact cache entry",
      throwsError(() => first.assertCurrent(), "no longer owns"),
    );

    const retry = fixture("codec\0/root/retry");
    const failedBeforeCache = throwsError(
      () => load(retry, "failure-before-cache"),
      "loader failed before cache admission",
    );
    const retried = load(retry);
    const poisoned = fixture("codec\0/root/poisoned");
    const failedAfterCache = throwsError(
      () => load(poisoned, "failure-after-cache"),
      "loader failed after cache admission",
    );
    const poisonedRefusal = throwsError(
      () => load(poisoned),
      "unattributable resident cache entry",
    );
    TestValidator.equals(
      "only a cache-free load failure permits retry",
      {
        failedBeforeCache,
        retryLoads: retry.loads,
        retryResult: retried.module.execution,
        failedAfterCache,
        poisonedRefusal,
        poisonedLoads: poisoned.loads,
      },
      {
        failedBeforeCache: true,
        retryLoads: 2,
        retryResult: 2,
        failedAfterCache: true,
        poisonedRefusal: true,
        poisonedLoads: 1,
      },
    );

    const unobservable = fixture("codec\0/root/unobservable");
    const unobservableRefusal = throwsError(
      () =>
        loadRuntimePackageGeneration({
          key: unobservable.snapshot.key,
          generation: unobservable.snapshot.generation,
          snapshot: unobservable.snapshot,
          assertCurrent: () => undefined,
          observeCache: () => undefined,
          load: () => ({ execution: 1 }),
          registry: unobservable.registry,
        }),
      "without an observable cache entry",
    );
    TestValidator.predicate(
      "a loader that cannot expose its resident entry is not attributable",
      unobservableRefusal,
    );

    const operationState = fixture("codec\0/root/operation");
    const operationHandle = load(operationState);
    const success = await runRuntimePackageGeneration(
      operationHandle,
      (module) => module.execution + 1,
    );
    operationState.snapshot.current = false;
    let staleOperationRan = false;
    const stalePrecheck = await rejectsError(async () => {
      await runRuntimePackageGeneration(operationHandle, () => {
        staleOperationRan = true;
      });
    }, "snapshot generation changed");
    operationState.snapshot.current = true;
    const operationOnly = await rejectsError(
      () =>
        runRuntimePackageGeneration(operationHandle, () => {
          throw new Error("operation-only failure");
        }),
      "operation-only failure",
    );
    let combined: unknown;
    try {
      await runRuntimePackageGeneration(operationHandle, () => {
        operationState.snapshot.current = false;
        throw new Error("operation failed");
      });
    } catch (error) {
      combined = error;
    }
    const errors = combined instanceof AggregateError ? combined.errors : [];
    TestValidator.equals(
      "operations are fenced on both sides and preserve dual failure order",
      {
        success,
        stalePrecheck,
        staleOperationRan,
        operationOnly,
        aggregate: combined instanceof AggregateError,
        messages: errors.map((error) =>
          error instanceof Error ? error.message : String(error),
        ),
      },
      {
        success: 2,
        stalePrecheck: true,
        staleOperationRan: false,
        operationOnly: true,
        aggregate: true,
        messages: ["operation failed", "snapshot generation changed"],
      },
    );

    operationState.snapshot.current = true;
    TestValidator.predicate(
      "a postcheck-only generation change refuses the returned operation value",
      await rejectsError(async () => {
        await runRuntimePackageGeneration(operationHandle, () => {
          operationState.snapshot.current = false;
          return 3;
        });
      }, "snapshot generation changed"),
    );

    const defaultRegistry = fixture(
      "codec\0/default/b07",
      "generation-default",
    );
    const defaultHandle = loadRuntimePackageGeneration({
      key: defaultRegistry.snapshot.key,
      generation: defaultRegistry.snapshot.generation,
      snapshot: defaultRegistry.snapshot,
      assertCurrent: () => undefined,
      observeCache: () => defaultRegistry.cache,
      load: () => {
        defaultRegistry.cache = { identity: "default" };
        return { execution: 1 };
      },
    });
    TestValidator.equals(
      "the process-global registry applies when isolation is not requested",
      defaultHandle.module.execution,
      1,
    );
  };

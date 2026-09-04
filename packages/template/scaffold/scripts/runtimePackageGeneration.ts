import { createRequire } from "node:module";

import {
  type IRuntimePackageSnapshot,
  assertRuntimePackageSnapshotCurrent,
  snapshotRuntimePackage,
} from "./runtimePackageSnapshot";

/**
 * One loaded module whose cache entry and package snapshot are one generation.
 */
export interface IRuntimePackageGenerationHandle<Snapshot, Module> {
  /** Assert both the sealed package bytes and the exact resident cache entry. */
  assertCurrent: () => void;
  /** Module object loaded only after its package generation was reserved. */
  module: Module;
  /** Snapshot that directly identifies the loaded module generation. */
  snapshot: Snapshot;
}

interface IRuntimePackageGenerationEntry<Snapshot, Module> {
  generation: string;
  handle?: IRuntimePackageGenerationHandle<Snapshot, Module>;
  state: "loading" | "loaded" | "poisoned";
}

const registryEntries = Symbol.for(
  "automovie.runtime-package-loader.entries.v1",
);

/** Isolated generation registry used by tests and explicitly isolated hosts. */
export interface IRuntimePackageGenerationRegistry {
  [registryEntries]: Map<
    string,
    IRuntimePackageGenerationEntry<unknown, unknown>
  >;
}

/** Create an empty module-generation registry. */
export const createRuntimePackageGenerationRegistry =
  (): IRuntimePackageGenerationRegistry => ({ [registryEntries]: new Map() });

const registrySymbol = Symbol.for("automovie.runtime-package-loader.v1");
const sharedRegistry = (() => {
  const owner = globalThis as typeof globalThis & {
    [registrySymbol]?: IRuntimePackageGenerationRegistry;
  };
  return (owner[registrySymbol] ??= createRuntimePackageGenerationRegistry());
})();

/**
 * Snapshot, cache admission, module load, and post-load validation form one
 * indivisible generation boundary. A cache entry that predates this boundary
 * is deliberately unowned and can only be made attributable in a new process.
 */
export const loadRuntimePackageGeneration = <
  Snapshot,
  Module,
  CacheToken,
>(props: {
  /** Stable physical package and exact loader-entry key. */
  key: string;
  /** Physical snapshot generation identity. */
  generation: string;
  /** Snapshot carried by the returned executable handle. */
  snapshot: Snapshot;
  /** Revalidate the exact bytes represented by `snapshot`. */
  assertCurrent: () => void;
  /** Return the resident loader-cache entry identity, or `undefined`. */
  observeCache: () => CacheToken | undefined;
  /** Load the module through the cache observed above. */
  load: () => Module;
  /** Omit only when the process-global registry is intended. */
  registry?: IRuntimePackageGenerationRegistry;
}): IRuntimePackageGenerationHandle<Snapshot, Module> => {
  if (props.key.length === 0 || props.generation.length === 0)
    throw new Error("Runtime package generation identity is invalid.");
  props.assertCurrent();
  const registry = props.registry ?? sharedRegistry;
  const prior = registry[registryEntries].get(props.key) as
    | IRuntimePackageGenerationEntry<Snapshot, Module>
    | undefined;
  if (prior !== undefined) {
    if (prior.generation !== props.generation)
      throw new Error(
        `Runtime package generation "${props.key}" differs from the resident module. Start a new process with the current installation.`,
      );
    if (prior.state === "loading")
      throw new Error(
        `Runtime package generation "${props.key}" was loaded recursively. Start a new process before retrying.`,
      );
    if (prior.state === "poisoned" || prior.handle === undefined)
      throw new Error(
        `Runtime package generation "${props.key}" has an unattributable resident cache entry. Start a new process before retrying.`,
      );
    prior.handle.assertCurrent();
    return prior.handle;
  }
  if (props.observeCache() !== undefined)
    throw new Error(
      `Runtime package generation "${props.key}" was already present in the module cache before it was snapshotted. Start a new process before retrying.`,
    );

  const entry: IRuntimePackageGenerationEntry<Snapshot, Module> = {
    generation: props.generation,
    state: "loading",
  };
  registry[registryEntries].set(props.key, entry);
  let module: Module;
  try {
    module = props.load();
  } catch (error) {
    if (props.observeCache() === undefined)
      registry[registryEntries].delete(props.key);
    else entry.state = "poisoned";
    throw error;
  }

  const cacheToken = props.observeCache();
  if (cacheToken === undefined) {
    entry.state = "poisoned";
    throw new Error(
      `Runtime package generation "${props.key}" loaded without an observable cache entry. Start a new process before retrying.`,
    );
  }
  try {
    props.assertCurrent();
  } catch (error) {
    entry.state = "poisoned";
    throw error;
  }

  const handle: IRuntimePackageGenerationHandle<Snapshot, Module> = {
    module,
    snapshot: props.snapshot,
    assertCurrent: () => {
      props.assertCurrent();
      if (
        registry[registryEntries].get(props.key) !== entry ||
        entry.state !== "loaded" ||
        props.observeCache() !== cacheToken
      )
        throw new Error(
          `Runtime package generation "${props.key}" no longer owns its resident module cache entry. Start a new process before retrying.`,
        );
    },
  };
  entry.handle = handle;
  entry.state = "loaded";
  handle.assertCurrent();
  return handle;
};

const residentRequire = createRequire(import.meta.url);

/** Snapshot and load one CommonJS entry before it can become resident. */
export const loadResidentRuntimePackage = <Module>(props: {
  entry?: string;
  packageName: string;
}): IRuntimePackageGenerationHandle<IRuntimePackageSnapshot, Module> => {
  const snapshot = snapshotRuntimePackage({
    entry: props.entry ?? residentRequire.resolve(props.packageName),
    moduleClosure: true,
    packageName: props.packageName,
  });
  return loadRuntimePackageGeneration({
    key: `${snapshot.package}\0${snapshot.entry}`,
    generation: snapshot.fingerprint,
    snapshot,
    assertCurrent: () => assertRuntimePackageSnapshotCurrent(snapshot),
    observeCache: () => residentRequire.cache[snapshot.entry],
    load: () => residentRequire(snapshot.entry) as Module,
  });
};

class RuntimePackageGenerationOperationError extends AggregateError {}

/**
 * Execute through a generation handle and preserve operation/postcheck failure
 * order when both fail.
 */
export const runRuntimePackageGeneration = async <Snapshot, Module, Output>(
  handle: IRuntimePackageGenerationHandle<Snapshot, Module>,
  operation: (module: Module) => Output | Promise<Output>,
): Promise<Output> => {
  handle.assertCurrent();
  let operationFailure: { error: unknown } | undefined;
  let output: Output | undefined;
  try {
    output = await operation(handle.module);
  } catch (error) {
    operationFailure = { error };
  }
  let postcheckFailure: { error: unknown } | undefined;
  try {
    handle.assertCurrent();
  } catch (error) {
    postcheckFailure = { error };
  }
  if (operationFailure !== undefined && postcheckFailure !== undefined)
    throw new RuntimePackageGenerationOperationError(
      [operationFailure.error, postcheckFailure.error],
      "Runtime package generation changed after its operation failed.",
    );
  if (operationFailure !== undefined) throw operationFailure.error;
  if (postcheckFailure !== undefined) throw postcheckFailure.error;
  return output!;
};

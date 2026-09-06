import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";

/** Filesystem effect port used by synchronous production storage operations. */
export type AutoMovieFileSystem = typeof fs;

const storage = new AsyncLocalStorage<AutoMovieFileSystem>();

/** Return the invocation-local filesystem, or Node's native implementation. */
export const currentAutoMovieFileSystem = (): AutoMovieFileSystem =>
  storage.getStore() ?? fs;

/** Run one production operation with an isolated filesystem dependency. */
export const withAutoMovieFileSystem = <T>(
  fileSystem: AutoMovieFileSystem,
  task: () => T,
): T => storage.run(fileSystem, task);

/** Namespace-compatible dispatcher used by production modules. */
export const autoMovieFileSystem: AutoMovieFileSystem = new Proxy(
  {} as AutoMovieFileSystem,
  {
    get: (_target, property) =>
      Reflect.get(currentAutoMovieFileSystem(), property),
  },
);

import fs from "node:fs";
import path from "node:path";

import { loadSourceModule } from "./loadSourceModule";

interface IFileSystemRuntime {
  autoMovieFileSystem: typeof fs;
  currentAutoMovieFileSystem: () => typeof fs;
  withAutoMovieFileSystem: <T>(fileSystem: typeof fs, task: () => T) => T;
}

export interface ITestFileSystemCall {
  operation: string;
  arguments: readonly unknown[];
}

export interface ITestFileSystem {
  fileSystem: typeof fs;
  calls: () => readonly ITestFileSystemCall[];
}

const runtime = loadSourceModule<IFileSystemRuntime>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/project/fileSystem.ts",
  ),
);

/** Create a mutable, receipt-recording filesystem isolated from Node's module. */
export const createTestFileSystem = (
  faults: Partial<typeof fs> = {},
): ITestFileSystem => {
  const calls: ITestFileSystemCall[] = [];
  const overrides = new Map<PropertyKey, unknown>(
    Reflect.ownKeys(faults).map((property): [PropertyKey, unknown] => [
      property,
      Reflect.get(faults, property),
    ]),
  );
  const fileSystem = new Proxy({} as typeof fs, {
    get: (target, property) => {
      const value = overrides.has(property)
        ? overrides.get(property)
        : Object.prototype.hasOwnProperty.call(target, property)
          ? Reflect.get(target, property)
          : Reflect.get(fs, property);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        calls.push({ operation: String(property), arguments: args });
        return Reflect.apply(value, fileSystem, args);
      };
    },
    set: (_target, property, value) => {
      overrides.set(property, value);
      return true;
    },
  }) as typeof fs;
  return { fileSystem, calls: () => [...calls] };
};

/** Execute one test case through its own production filesystem context. */
export const withTestFileSystem = <T>(
  fileSystem: typeof fs,
  task: () => T,
): T => runtime.withAutoMovieFileSystem(fileSystem, task);

/** Give each invocation of a scenario its own mutable filesystem adapter. */
export const isolatedFileSystemTest = <T>(
  task: (fileSystem: typeof fs) => T,
): (() => T) =>
  function isolatedFileSystemInvocation(): T {
    const { fileSystem } = createTestFileSystem();
    return withTestFileSystem(fileSystem, () => task(fileSystem));
  };

/** Observe the active dependency for a pure isolation assertion. */
export const currentTestFileSystem = (): typeof fs =>
  runtime.currentAutoMovieFileSystem();

/** Call the same dispatcher used by production storage modules. */
export const productionTestFileSystem = (): typeof fs =>
  runtime.autoMovieFileSystem;

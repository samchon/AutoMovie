import { TestValidator } from "@nestia/e2e";
import {
  type IAutoMovieMaintenanceDirectoryIO,
  assertAutoMovieMaintenanceMarkdownInventory,
  readAutoMovieMaintenanceMarkdownPaths,
} from "automovie";
import path from "node:path";

import { throwsError } from "../internal/predicates";

/** A directory-only walk rejects aliases and closes added/removed siblings. */
export const test_cli_maintenance_markdown_inventory = (): void => {
  const root = {
    path: path.resolve("maintenance-project"),
    real: path.resolve("maintenance-project"),
    identity: "root",
  };
  const entries = new Map<
    string,
    ReturnType<IAutoMovieMaintenanceDirectoryIO["list"]>
  >([
    [
      path.join(root.path, "docs"),
      [
        { name: "b.md", kind: "file" },
        { name: "a.md", kind: "file" },
        { name: "extra", kind: "directory" },
        { name: "ignored.ts", kind: "file" },
        { name: "other", kind: "other" },
      ],
    ],
    [path.join(root.path, "docs", "extra"), [{ name: "c.md", kind: "file" }]],
  ]);
  let assertions = 0;
  const io: IAutoMovieMaintenanceDirectoryIO = {
    assert: () => {
      assertions++;
    },
    capture: (target) => {
      if (!entries.has(target))
        throw Object.assign(new Error("absent"), { code: "ENOENT" });
      return { path: target, real: target, identity: target };
    },
    list: (directory) => entries.get(directory)!,
  };
  const files = readAutoMovieMaintenanceMarkdownPaths(root, "docs", io);
  TestValidator.equals("deterministic nested inventory", files, [
    "docs/a.md",
    "docs/b.md",
    "docs/extra/c.md",
  ]);
  TestValidator.predicate(
    "root and parents repeatedly checked",
    assertions > 10,
  );
  TestValidator.equals(
    "missing ordinary directory is empty",
    readAutoMovieMaintenanceMarkdownPaths(root, "missing", io),
    [],
  );
  assertAutoMovieMaintenanceMarkdownInventory(files, [...files]);
  for (const changed of [
    [],
    [...files, "docs/new.md"],
    [files[1]!, files[0]!, files[2]!],
  ])
    TestValidator.predicate(
      "population change refuses",
      throwsError(() =>
        assertAutoMovieMaintenanceMarkdownInventory(files, changed),
      ),
    );
  for (const relative of [
    ".",
    "..",
    "../outside",
    path.resolve(root.path, "../outside"),
  ])
    TestValidator.predicate(
      "lexical escape refuses",
      throwsError(() =>
        readAutoMovieMaintenanceMarkdownPaths(root, relative, io),
      ),
    );
  for (const name of ["", ".", "..", "a/b", "a\\b", "a\0b"])
    TestValidator.predicate(
      "invalid child refuses",
      throwsError(() =>
        readAutoMovieMaintenanceMarkdownPaths(root, "docs", {
          ...io,
          list: () => [{ name, kind: "file" }],
        }),
      ),
    );
  TestValidator.predicate(
    "linked entry refuses",
    throwsError(() =>
      readAutoMovieMaintenanceMarkdownPaths(root, "docs", {
        ...io,
        list: () => [{ name: "dangling", kind: "link" }],
      }),
    ),
  );
  TestValidator.predicate(
    "linked parent refuses",
    throwsError(() =>
      readAutoMovieMaintenanceMarkdownPaths(root, "docs", {
        ...io,
        capture: (target) => ({
          path: target,
          real: path.resolve(root.path, "../elsewhere"),
          identity: "other",
        }),
      }),
    ),
  );
  TestValidator.predicate(
    "changed physical root refuses",
    throwsError(() =>
      readAutoMovieMaintenanceMarkdownPaths(root, "docs", {
        ...io,
        assert: () => {
          throw new Error("changed");
        },
      }),
    ),
  );
  TestValidator.predicate(
    "capture failure is not absence",
    throwsError(() =>
      readAutoMovieMaintenanceMarkdownPaths(root, "docs", {
        ...io,
        capture: () => {
          throw new Error("denied");
        },
      }),
    ),
  );
};

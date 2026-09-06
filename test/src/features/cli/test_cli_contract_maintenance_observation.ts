import { TestValidator } from "@nestia/e2e";
import {
  type IAutoMovieMaintenanceObservationIO,
  assertAutoMovieMaintenanceGeneration,
  assertAutoMovieMaintenanceObservation,
  autoMovieMaintenanceFileFromSnapshot,
  observeAutoMovieMaintenanceFiles,
} from "automovie";
import * as path from "node:path";

import { contractMaintenanceFailure } from "../internal/contractMaintenanceHarness";

/**
 * Maintenance observes every physical ancestor of source and target paths,
 * including the source-only work of an already-published rename.
 *
 * Scenarios:
 * 1. Ordinary nested inputs, duplicate requested paths, absent leaves and an
 *    absent intermediate directory produce a closed, byte-exact inventory.
 * 2. Linked ancestors, physical escapes, changed root or parent and file
 *    generation changes refuse without granting any mutation authority.
 * 3. Invalid UTF-8 is refused, a UTF-8 BOM is retained, and native versions
 *    omit only change time while retaining identity, size and modification.
 */
export const test_cli_contract_maintenance_observation = (): void => {
  const root = path.resolve("maintenance-observation");
  const directory = (relative: string) => ({
    path: path.resolve(root, relative),
    real: path.resolve(root, relative),
    identity: `directory:${relative}`,
  });
  const directories = new Map(
    [directory(""), directory("docs"), directory("docs/legacy")].map(
      (value) => [value.path, value],
    ),
  );
  const sources = new Map<
    string,
    {
      bytes: Uint8Array;
      snapshot: { path: string; identity: string; version: string };
      identity: string;
      version: string;
    }
  >();
  const missing = (): never => {
    throw Object.assign(new Error("missing"), { code: "ENOENT" });
  };
  const source = (
    relative: string,
    bytes: Uint8Array,
    identity = relative,
    version = `${identity}:12:50:70`,
  ) => {
    const target = path.resolve(root, relative);
    sources.set(target, {
      bytes,
      snapshot: { path: target, identity, version },
      identity,
      version,
    });
  };
  const io: IAutoMovieMaintenanceObservationIO = {
    directory: (target) => directories.get(target) ?? missing(),
    assertDirectory: (expected) => {
      const current = directories.get(expected.path);
      if (
        current?.identity !== expected.identity ||
        current.real !== expected.real
      )
        throw new Error("changed directory");
    },
    file: (target) => sources.get(target) ?? missing(),
    assertFile: (snapshot) => {
      const current = sources.get(snapshot.path)?.snapshot;
      if (
        current?.identity !== snapshot.identity ||
        current.version !== snapshot.version
      )
        throw new Error("changed file before reopen");
    },
  };
  source("docs/legacy/source.md", Buffer.from("same"));
  source("docs/bom.md", Buffer.from("\ufeffbody"));
  const observed = observeAutoMovieMaintenanceFiles({
    root,
    paths: [
      "docs/legacy/source.md",
      "docs/legacy/source.md",
      "docs/missing.md",
      "docs/absent/target.md",
      "docs/bom.md",
    ],
    io,
  });
  TestValidator.equals(
    "existing bytes and BOM survive exactly",
    { ...observed.sources },
    { "docs/bom.md": "\ufeffbody", "docs/legacy/source.md": "same" },
  );
  TestValidator.equals(
    "absent leaves and ancestors remain absent",
    [
      observed.files["docs/missing.md"],
      observed.files["docs/absent/target.md"],
    ],
    [null, null],
  );
  TestValidator.equals(
    "stable observation is reusable",
    { ...assertAutoMovieMaintenanceObservation(observed, io).sources },
    { ...observed.sources },
  );
  TestValidator.equals(
    "empty population still pins root",
    observeAutoMovieMaintenanceFiles({ root: directory(""), paths: [], io })
      .directories.length,
    1,
  );
  TestValidator.equals(
    "observation order is byte-independent code-unit order with duplicates removed",
    Object.keys(
      observeAutoMovieMaintenanceFiles({
        root,
        paths: ["z.md", "a.md", "Z.md", "é.md", "a.md"],
        io,
      }).files,
    ),
    ["Z.md", "a.md", "z.md", "é.md"],
  );
  TestValidator.equals(
    "native token omits only ctime",
    autoMovieMaintenanceFileFromSnapshot(
      { identity: "4:9", version: "4:9:12:50:70" },
      "body",
    ),
    { identity: "4:9", source: "body", version: "4:9:12:50" },
  );
  const extended = observeAutoMovieMaintenanceFiles({
    root,
    paths: [...Object.keys(observed.files), "new.md"],
    io,
  });
  assertAutoMovieMaintenanceGeneration(observed, extended);
  for (const altered of [
    { ...observed, descriptors: {} },
    {
      ...observed,
      descriptors: { ...observed.descriptors, "docs/bom.md": null },
    },
    {
      ...observed,
      descriptors: {
        ...observed.descriptors,
        "docs/missing.md": observed.descriptors["docs/bom.md"]!,
      },
    },
    { ...observed, sources: {} },
    {
      ...observed,
      sources: { ...observed.sources, "docs/missing.md": "unexpected" },
    },
  ])
    for (const before of [false, true])
      TestValidator.predicate(
        "subset comparison rejects inconsistent descriptor and byte presence",
        contractMaintenanceFailure(() =>
          assertAutoMovieMaintenanceGeneration(
            before ? altered : observed,
            before ? observed : altered,
          ),
        ) instanceof Error,
      );
  TestValidator.predicate(
    "subset comparison requires every prior input",
    contractMaintenanceFailure(() =>
      assertAutoMovieMaintenanceGeneration(extended, observed),
    ) instanceof Error,
  );
  for (const current of [
    { ...observed, root: { ...observed.root, identity: "different" } },
    { ...observed, root: { ...observed.root, path: "different" } },
    { ...observed, root: { ...observed.root, real: "different" } },
    { ...observed, directories: [] },
    {
      ...observed,
      directories: observed.directories.map((entry) => ({
        ...entry,
        identity: "different",
      })),
    },
    {
      ...observed,
      directories: observed.directories.map((entry) => ({
        ...entry,
        real: "different",
      })),
    },
  ])
    TestValidator.predicate(
      "pure extension rejects changed roots and ancestors",
      contractMaintenanceFailure(() =>
        assertAutoMovieMaintenanceGeneration(observed, current),
      ) instanceof Error,
    );

  for (const invalid of [
    "",
    "/outside",
    "../outside",
    "docs/../outside",
    "docs//file",
    "docs/./file",
    "docs\\file",
    "docs/\0file",
    "C:/outside",
  ])
    TestValidator.predicate(
      `${JSON.stringify(invalid)} refuses`,
      contractMaintenanceFailure(() =>
        observeAutoMovieMaintenanceFiles({ root, paths: [invalid], io }),
      ) instanceof Error,
    );
  for (const error of [
    new Error("permission"),
    null,
    "failure",
    { code: "ENOTDIR" },
    {},
  ])
    TestValidator.predicate(
      "non-missing ancestor errors stay errors",
      contractMaintenanceFailure(() =>
        observeAutoMovieMaintenanceFiles({
          root,
          paths: ["other/file"],
          io: {
            ...io,
            directory: (target) =>
              target === root
                ? directory("")
                : (() => {
                    // eslint-disable-next-line typescript/only-throw-error -- the reader must propagate every non-missing host exception without normalizing its identity
                    throw error;
                  })(),
          },
        }),
      ) === error,
    );

  const originalParent = directories.get(path.join(root, "docs", "legacy"))!;
  for (const changed of [
    { ...originalParent, real: path.resolve(root, "..", "outside") },
    { ...originalParent, real: path.join(root, "docs") },
  ]) {
    directories.set(originalParent.path, changed);
    TestValidator.predicate(
      "linked or aliased ancestor refuses source-only resume",
      contractMaintenanceFailure(() =>
        observeAutoMovieMaintenanceFiles({
          root,
          paths: ["docs/legacy/source.md"],
          io,
        }),
      ) instanceof Error,
    );
  }
  directories.set(originalParent.path, originalParent);
  for (const changed of [
    { ...originalParent, identity: "replaced" },
    { ...directory(""), identity: "root-replaced" },
  ]) {
    directories.set(changed.path, changed);
    TestValidator.predicate(
      "parent and root replacement reject prior observation",
      contractMaintenanceFailure(() =>
        assertAutoMovieMaintenanceObservation(observed, io),
      ) instanceof Error,
    );
    directories.set(
      changed.path,
      changed.path === root ? directory("") : originalParent,
    );
  }
  const key = path.join(root, "docs", "legacy", "source.md");
  const originalFile = sources.get(key)!;
  for (const changed of [
    {
      ...originalFile,
      snapshot: { ...originalFile.snapshot, identity: "replacement" },
    },
    {
      ...originalFile,
      snapshot: { ...originalFile.snapshot, version: "new-version" },
    },
    { ...originalFile, bytes: Buffer.from("competitor") },
    { ...originalFile, identity: "descriptor-competitor" },
    { ...originalFile, version: `${originalFile.identity}:12:51:70` },
  ]) {
    sources.set(key, changed);
    TestValidator.predicate(
      "file identity, generation and byte competitor refuses",
      contractMaintenanceFailure(() =>
        assertAutoMovieMaintenanceObservation(observed, io),
      ) instanceof Error,
    );
  }
  sources.delete(key);
  TestValidator.predicate(
    "disappeared source refuses",
    contractMaintenanceFailure(() =>
      assertAutoMovieMaintenanceObservation(observed, io),
    ) instanceof Error,
  );
  sources.set(key, originalFile);
  for (const change of [
    { identity: "changed-during-read" },
    { version: `${originalFile.identity}:12:51:70` },
  ])
    TestValidator.predicate(
      "a generation changed after admission still refuses",
      contractMaintenanceFailure(() =>
        assertAutoMovieMaintenanceObservation(observed, {
          ...io,
          file: (target) => {
            const resident = io.file(target);
            return target === key
              ? { ...resident, snapshot: { ...resident.snapshot, ...change } }
              : resident;
          },
        }),
      ) instanceof Error,
    );
  let reopened = false;
  TestValidator.equals(
    "own-open ctime drift retains exact admitted bytes",
    assertAutoMovieMaintenanceObservation(observed, {
      ...io,
      file: (target) => {
        const resident = io.file(target);
        reopened = true;
        return {
          ...resident,
          version: `${resident.identity}:12:50:99`,
          snapshot: {
            ...resident.snapshot,
            version: `${resident.identity}:12:50:99`,
          },
        };
      },
    }).sources["docs/legacy/source.md"],
    "same",
  );
  TestValidator.predicate("ctime twin really reopens admitted files", reopened);
  source("docs/missing.md", Buffer.from("competitor"));
  TestValidator.predicate(
    "claimed absent destination refuses",
    contractMaintenanceFailure(() =>
      assertAutoMovieMaintenanceObservation(observed, io),
    ) instanceof Error,
  );
  source("docs/invalid.md", Uint8Array.from([0xc0, 0xaf]));
  TestValidator.predicate(
    "invalid UTF-8 refuses lossy authority",
    contractMaintenanceFailure(() =>
      observeAutoMovieMaintenanceFiles({
        root,
        paths: ["docs/invalid.md"],
        io,
      }),
    ) instanceof Error,
  );
  TestValidator.predicate(
    "mismatched descriptor path refuses",
    contractMaintenanceFailure(() =>
      observeAutoMovieMaintenanceFiles({
        root,
        paths: ["docs/bom.md"],
        io: {
          ...io,
          file: () => ({
            ...originalFile,
            snapshot: { ...originalFile.snapshot, path: "different" },
          }),
        },
      }),
    ) instanceof Error,
  );
  TestValidator.predicate(
    "root reached through link refuses",
    contractMaintenanceFailure(() =>
      observeAutoMovieMaintenanceFiles({
        root: { ...directory(""), real: path.resolve(root, "..", "outside") },
        paths: [],
        io: { ...io, assertDirectory: () => {} },
      }),
    ) instanceof Error,
  );
};

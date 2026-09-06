import type {
  IScaffoldFileSnapshot,
  IScaffoldParentPublicationRequest,
  IScaffoldPhysicalDirectory,
  ScaffoldFilePublicationOutcome,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import type {
  ILibraryPublicationFile,
  ILibraryPublicationIO,
} from "../internal/libraryReviewPublicationFixture";
import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

type Observation = {
  root: IScaffoldPhysicalDirectory;
  directories: readonly IScaffoldPhysicalDirectory[];
  files: Readonly<Record<string, IScaffoldFileSnapshot | null>>;
  descriptors: Readonly<Record<string, { identity: string; version: string }>>;
  sources: Readonly<Record<string, string>>;
};
type Move = {
  source: {
    parent: IScaffoldPhysicalDirectory;
    name: string;
    file: ILibraryPublicationFile;
  };
  target: {
    parent: IScaffoldPhysicalDirectory;
    name: string;
    file: ILibraryPublicationFile | null;
  };
};
interface FileSystem {
  observe(props: {
    root: string | IScaffoldPhysicalDirectory;
    paths: readonly string[];
  }): Observation;
  assertDirectory(directory: IScaffoldPhysicalDirectory): void;
  file(
    snapshot: { identity: string; version: string },
    source: string,
  ): ILibraryPublicationFile;
  publish(
    request: IScaffoldParentPublicationRequest,
  ): ScaffoldFilePublicationOutcome;
  move(request: Move): void;
  sync(directory: IScaffoldPhysicalDirectory): void;
}
const runtime = loadSourceModule<{
  createLibraryReviewPublicationIO: (props: {
    root: string;
    target: string;
    fileSystem: FileSystem;
  }) => ILibraryPublicationIO;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/libraryReviewPublicationFileSystem.ts",
  ),
);

/**
 * Physical sidecar publication composes the shared native capabilities.
 *
 * Scenarios:
 *
 * 1. An existing physical parent supplies exclusive staging and no-replace
 *    native moves with the descriptor identity, exact source and version.
 * 2. Missing, linked or replaced parents/leaves and escaped paths refuse before
 *    mutation; empty slots stay distinct from unreadable or invalid UTF-8 input.
 * 3. Refused/partial creation, sync errors and missing, replaced or changed
 *    stage readback preserve their exact cause without any deletion callback.
 */
export const test_cli_library_review_publication_filesystem = (): void => {
  const rootPath = path.resolve("library-publication-unit");
  const root: IScaffoldPhysicalDirectory = {
    identity: "root",
    path: rootPath,
    real: rootPath,
  };
  const parent: IScaffoldPhysicalDirectory = {
    identity: "parent",
    path: path.join(rootPath, "docs"),
    real: path.join(rootPath, "docs"),
  };
  const target = "docs/subject.review.json";
  const resident: ILibraryPublicationFile = {
    identity: "descriptor-resident",
    source: "valid UTF-8 source",
    version: "descriptor-resident:1:2",
  };
  let current: ILibraryPublicationFile | null = resident;
  let directories = [root, parent];
  let observeError: Error | undefined;
  let directoryError: Error | undefined;
  let syncError: Error | undefined;
  let moveError: Error | undefined;
  let mutationAfterMove: (() => void) | undefined;
  let outcome: ScaffoldFilePublicationOutcome = {
    status: "completed",
    fileIdentity: resident.identity,
    parentIdentity: "parent",
  };
  const assertions: string[] = [];
  const publishes: IScaffoldParentPublicationRequest[] = [];
  const moves: Move[] = [];
  const syncs: string[] = [];
  const fs: FileSystem = {
    observe: (props) => {
      if (observeError !== undefined) throw observeError;
      return {
        root,
        directories,
        files: Object.fromEntries(
          props.paths.map((relative) => [
            relative,
            current === null
              ? null
              : {
                  identity: "path-stat-identity",
                  path: path.resolve(root.path, relative),
                  version: "path-stat-version",
                },
          ]),
        ),
        descriptors: Object.fromEntries(
          props.paths.flatMap((relative) =>
            current === null
              ? []
              : [
                  [
                    relative,
                    { identity: current.identity, version: current.version },
                  ],
                ],
          ),
        ),
        sources: Object.fromEntries(
          props.paths.flatMap((relative) =>
            current === null ? [] : [[relative, current.source]],
          ),
        ),
      };
    },
    assertDirectory: (directory) => {
      if (directoryError !== undefined) throw directoryError;
      assertions.push(directory.identity);
    },
    file: (snapshot, source) => ({
      identity: snapshot.identity,
      source,
      version: snapshot.version,
    }),
    publish: (request) => {
      publishes.push(request);
      return outcome;
    },
    move: (request) => {
      if (moveError !== undefined) throw moveError;
      moves.push(request);
      mutationAfterMove?.();
    },
    sync: (directory) => {
      if (syncError !== undefined) throw syncError;
      syncs.push(directory.identity);
    },
  };
  const create = () =>
    runtime.createLibraryReviewPublicationIO({
      root: rootPath,
      target,
      fileSystem: fs,
    });
  const io = create();
  TestValidator.equals(
    "read carries descriptor not path identity",
    io.read(target),
    resident,
  );
  current = null;
  TestValidator.equals("absence preserved", io.read(target), null);
  current = resident;
  TestValidator.equals(
    "successful stage preserves native identity",
    io.stage(`${target}.after`, resident.source),
    resident,
  );
  TestValidator.equals(
    "exclusive create receives exact parent and bytes",
    publishes[0],
    {
      bytes: Array.from(Buffer.from(resident.source, "utf8")),
      childName: "subject.review.json.after",
      expectedParentIdentity: "parent",
      parentPath: parent.path,
    },
  );
  TestValidator.equals("staging syncs held parent", syncs, ["parent"]);
  io.move({ path: target, file: resident }, `${target}.before`);
  TestValidator.equals("native move never requests overwrite", moves[0], {
    source: { parent, name: "subject.review.json", file: resident },
    target: { parent, name: "subject.review.json.before", file: null },
  });
  TestValidator.equals(
    "root and parent are reasserted",
    assertions.includes("root") && assertions.includes("parent"),
    true,
  );
  for (const relative of [
    "other/subject.review.json",
    "docs\\subject.review.json",
    "docs/subject\\review.json",
    "../subject.review.json",
  ]) {
    TestValidator.equals(
      "read cannot leave captured parent",
      throwsError(() => io.read(relative), "left its captured parent"),
      true,
    );
    TestValidator.equals(
      "stage cannot leave captured parent",
      throwsError(
        () => io.stage(relative, "bytes"),
        "left its captured parent",
      ),
      true,
    );
    TestValidator.equals(
      "move source cannot leave parent",
      throwsError(
        () => io.move({ path: relative, file: resident }, target),
        "left its captured parent",
      ),
      true,
    );
    TestValidator.equals(
      "move destination cannot leave parent",
      throwsError(
        () => io.move({ path: target, file: resident }, relative),
        "left its captured parent",
      ),
      true,
    );
  }
  directories = [root];
  TestValidator.equals(
    "missing parent is not created",
    throwsError(create, "parent is absent"),
    true,
  );
  directories = [root, parent];
  for (const cause of [
    "linked parent",
    "linked leaf",
    "replaced ancestor",
    "invalid UTF-8",
  ]) {
    observeError = new Error(cause);
    TestValidator.equals(
      "observation refusal preserved",
      throwsError(create, cause),
      true,
    );
    TestValidator.equals(
      "reopened refusal preserved",
      throwsError(() => io.read(target), cause),
      true,
    );
  }
  observeError = undefined;
  directoryError = new Error("parent changed identity");
  TestValidator.equals(
    "bound assertion refuses changed parent",
    throwsError(() => io.assertBound(), "parent changed identity"),
    true,
  );
  TestValidator.equals(
    "stage refuses changed parent",
    throwsError(() => io.stage(target, "bytes"), "parent changed identity"),
    true,
  );
  directoryError = undefined;
  for (const failed of [
    {
      status: "refused" as const,
      reason: "target-competitor" as const,
      error: new Error("preexisting temporary"),
    },
    {
      status: "partial" as const,
      bytesWritten: 3,
      parentIdentity: "parent",
      error: "short write",
    },
  ]) {
    outcome = failed;
    TestValidator.equals(
      "staging failure names actual effect",
      throwsError(
        () => io.stage(`${target}.after`, resident.source),
        failed.error instanceof Error ? failed.error.message : failed.error,
      ),
      true,
    );
  }
  outcome = {
    status: "completed",
    fileIdentity: resident.identity,
    parentIdentity: "parent",
  };
  syncError = new Error("directory flush failed");
  TestValidator.equals(
    "flush failure preserved",
    throwsError(
      () => io.stage(`${target}.after`, resident.source),
      "directory flush failed",
    ),
    true,
  );
  syncError = undefined;
  for (const staged of [
    null,
    { ...resident, identity: "replacement" },
    { ...resident, source: "different bytes" },
  ]) {
    current = staged;
    TestValidator.equals(
      "changed staged readback refused",
      throwsError(
        () => io.stage(`${target}.after`, resident.source),
        "staged generation changed",
      ),
      true,
    );
  }
  current = resident;
  moveError = new Error("native rename failed without overwrite");
  TestValidator.equals(
    "rename failure preserved",
    throwsError(
      () => io.move({ path: target, file: resident }, `${target}.before`),
      "native rename failed",
    ),
    true,
  );
  moveError = undefined;
  mutationAfterMove = () => {
    directoryError = new Error("parent replaced during move");
  };
  TestValidator.equals(
    "post-move parent check retained",
    throwsError(
      () => io.move({ path: target, file: resident }, `${target}.before`),
      "parent replaced during move",
    ),
    true,
  );
};

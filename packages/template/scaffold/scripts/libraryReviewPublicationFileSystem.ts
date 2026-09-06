import {
  type IScaffoldPhysicalDirectory,
  assertScaffoldPhysicalDirectory,
  publishNativeScaffoldFile,
} from "@automovie/template";
import {
  autoMovieMaintenanceFileFromSnapshot,
  observeAutoMovieMaintenanceFiles,
  renameAutoMovieMaintenanceFile,
  syncAutoMovieMaintenanceDirectory,
} from "automovie";
import path from "node:path";

import type { ILibraryReviewPublicationIO } from "./libraryReviewPublication";

/**
 * Native effects are injected as capabilities, not recreated by an OS fixture.
 *
 * @author Samchon
 */
export interface ILibraryReviewPublicationFileSystem {
  observe: typeof observeAutoMovieMaintenanceFiles;
  assertDirectory: typeof assertScaffoldPhysicalDirectory;
  file: typeof autoMovieMaintenanceFileFromSnapshot;
  publish: typeof publishNativeScaffoldFile;
  move: typeof renameAutoMovieMaintenanceFile;
  sync: typeof syncAutoMovieMaintenanceDirectory;
}

/** Production wiring shares the same physical ownership protocol as maintenance. */
export const libraryReviewPublicationFileSystem: ILibraryReviewPublicationFileSystem =
  {
    observe: observeAutoMovieMaintenanceFiles,
    assertDirectory: assertScaffoldPhysicalDirectory,
    file: autoMovieMaintenanceFileFromSnapshot,
    publish: publishNativeScaffoldFile,
    move: renameAutoMovieMaintenanceFile,
    sync: syncAutoMovieMaintenanceDirectory,
  };

/**
 * Retain every physical ancestor of an adjacent sidecar before reading it.
 * The design file already owns its parent, so publication never creates a
 * missing directory. Native exclusive creation and no-replace movement are
 * shared with contract maintenance; this adapter grants no pathname overwrite.
 */
export const createLibraryReviewPublicationIO = (props: {
  root: string;
  target: string;
  fileSystem: ILibraryReviewPublicationFileSystem;
}): ILibraryReviewPublicationIO => {
  const { fileSystem } = props;
  const observed = fileSystem.observe({
    root: props.root,
    paths: [props.target],
  });
  const parentPath = path.dirname(
    path.resolve(observed.root.path, props.target),
  );
  const parent = observed.directories.find(
    (directory: IScaffoldPhysicalDirectory) => directory.path === parentPath,
  );
  if (parent === undefined)
    throw new Error(
      `Library review sidecar parent is absent: ${props.target}.`,
    );
  const assertBound = (): void => {
    for (const directory of observed.directories)
      fileSystem.assertDirectory(directory);
  };
  const slot = (relative: string): string => {
    const absolute = path.resolve(observed.root.path, relative);
    if (path.dirname(absolute) !== parent.path || relative.includes("\\"))
      throw new Error(
        `Library review publication left its captured parent: ${relative}.`,
      );
    return path.basename(absolute);
  };
  const read: ILibraryReviewPublicationIO["read"] = (relative) => {
    slot(relative);
    assertBound();
    const current = fileSystem.observe({
      root: observed.root,
      paths: [relative],
    });
    assertBound();
    const snapshot = current.files[relative]!;
    return snapshot === null
      ? null
      : fileSystem.file(
          current.descriptors[relative]!,
          current.sources[relative]!,
        );
  };
  return {
    assertBound,
    read,
    stage: (relative, source) => {
      const childName = slot(relative);
      assertBound();
      const outcome = fileSystem.publish({
        bytes: Array.from(Buffer.from(source, "utf8")),
        childName,
        expectedParentIdentity: parent.identity,
        parentPath: parent.path,
      });
      if (outcome.status !== "completed")
        throw new Error(
          `Library review exclusive staging ${outcome.status}: ${outcome.error instanceof Error ? outcome.error.message : String(outcome.error)}; retained slot: ${relative}.`,
          { cause: outcome },
        );
      fileSystem.sync(parent);
      const staged = read(relative);
      if (
        staged === null ||
        staged.identity !== outcome.fileIdentity ||
        staged.source !== source
      )
        throw new Error(
          `Library review staged generation changed: ${relative}.`,
        );
      return staged;
    },
    move: (source, target) => {
      const sourceName = slot(source.path);
      const targetName = slot(target);
      assertBound();
      fileSystem.move({
        source: { parent, name: sourceName, file: source.file },
        target: { parent, name: targetName, file: null },
      });
      assertBound();
    },
  };
};

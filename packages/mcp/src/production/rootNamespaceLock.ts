import fs from "node:fs";
import path from "node:path";

import { acquireCommitLock, releaseCommitLock } from "../project/commitLock";

const siblingLockPath = (parentReal: string, name: string): string =>
  path.join(parentReal, `.${name}.automovie-root.lock`);

const ensureDirectory = (directory: string): string => {
  const linked = lstatOrNull(directory);
  if (linked !== null) {
    if (fs.statSync(directory).isDirectory() === false)
      throw new Error(
        `Production project parent "${directory}" is not a directory.`,
      );
    return fs.realpathSync(directory);
  }
  const parent = path.dirname(directory);
  if (parent === directory)
    throw new Error(
      `Production project parent "${directory}" does not exist as a physical directory.`,
    );
  const parentReal = ensureDirectory(parent);
  const lockPath = siblingLockPath(parentReal, path.basename(directory));
  const token = acquireCommitLock(lockPath);
  try {
    const current = lstatOrNull(directory);
    if (current === null) fs.mkdirSync(directory);
    else if (
      current.isSymbolicLink() ||
      fs.statSync(directory).isDirectory() === false
    )
      throw new Error(
        `Production project parent "${directory}" is not a physical directory.`,
      );
    return fs.realpathSync(directory);
  } finally {
    releaseCommitLock(lockPath, token);
  }
};

/**
 * Create missing project parents one physical directory at a time.
 *
 * Each step is protected by a sibling lock in its already-existing physical
 * parent, so concurrent recursive opens cannot publish different path kinds.
 */
export const ensureProductionRootParent = (rootDirectory: string): void => {
  const root = path.resolve(rootDirectory);
  ensureDirectory(path.dirname(root));
};

/**
 * Stable lock path outside the mutable project root.
 *
 * Resolving the immediate parent collapses ancestor junction and symlink
 * aliases. The sibling filename retains native filesystem case semantics and
 * remains the same before and after the project root itself is created.
 */
export const productionRootNamespaceLockPath = (
  rootDirectory: string,
): string => {
  const root = path.resolve(rootDirectory);
  const linked = lstatOrNull(root);
  const name =
    linked !== null && linked.isSymbolicLink() === false
      ? path.basename(fs.realpathSync(root))
      : path.basename(root);
  return siblingLockPath(fs.realpathSync(path.dirname(root)), name);
};

const lstatOrNull = (file: string): fs.Stats | null => {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

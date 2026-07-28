import path from "node:path";

/**
 * Stable lock path outside the mutable project root.
 *
 * Keeping this reservation in the physical parent prevents a project root
 * rename, rollback, or junction replacement from moving the lock itself.
 */
export const productionRootNamespaceLockPath = (
  rootDirectory: string,
): string => {
  const root = path.resolve(rootDirectory);
  return path.join(
    path.dirname(root),
    `.${path.basename(root)}.automovie-root.lock`,
  );
};

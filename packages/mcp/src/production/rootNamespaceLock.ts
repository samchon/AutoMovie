import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Stable lock path outside the mutable project root.
 *
 * A temporary-machine namespace keyed by the complete resolved path remains
 * stable before and after missing parents are created, and cannot move with a
 * project-root rename, rollback, or junction replacement.
 */
export const productionRootNamespaceLockPath = (
  rootDirectory: string,
): string => {
  const root = path.resolve(rootDirectory);
  const identity = root.toLowerCase();
  const namespace = path.join(os.tmpdir(), "automovie-root-locks");
  fs.mkdirSync(namespace, { recursive: true });
  return path.join(
    namespace,
    `${createHash("sha256").update(identity).digest("hex")}.lock`,
  );
};

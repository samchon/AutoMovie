import fs from "node:fs";
import path from "node:path";

import { isAutoMovieEvidenceIdentityFile } from "./isAutoMovieEvidenceIdentityFile";

/**
 * Read the tracked package identity without inventing a missing description.
 *
 * The manifest sits at one fixed path and is read exactly once, so admission
 * asks only that the entry be a regular file that is not a symbolic link.
 *
 * The host boundary is a required argument rather than a default, because every
 * refusal and parse failure here is pure logic over one stat and one string. A
 * default would put the only unexercised lines of this module inside it, and
 * reaching them would require a generated installation to exist.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Reads the identity manifest from its fixed path under the admission this unit states for a manifest rather than for an enumerated population member.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Calls the manifest admission judgment instead of the population judgment and preserves the symlink and non-regular refusals it keeps.
 * @author Samchon
 */
export const readAutoMovieProductionPackageIdentity = (
  root: string,
  io: {
    read: (file: string) => string;
    stat: (file: string) => Pick<fs.Stats, "isFile" | "isSymbolicLink">;
  },
): { packageName: string; description: string } => {
  const location = path.join(root, "package.json");
  if (!isAutoMovieEvidenceIdentityFile(io.stat(location)))
    throw new Error(
      `${location}: package identity must be one regular, non-symlink file.`,
    );
  const manifest = JSON.parse(io.read(location)) as {
    name?: unknown;
    description?: unknown;
  };
  if (typeof manifest.name !== "string" || manifest.name.trim() === "")
    throw new Error(`${root}: package.json declares no package name.`);
  return {
    packageName: manifest.name,
    description:
      typeof manifest.description === "string"
        ? manifest.description.trim()
        : "",
  };
};

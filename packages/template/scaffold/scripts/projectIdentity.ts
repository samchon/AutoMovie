import fs from "node:fs";
import path from "node:path";

/**
 * The production namespace a generated project already declares for itself.
 *
 * A project's identity is written once, in `package.json`, and every tool that
 * opens the project already reads that file. A second declaration could only
 * restate it or disagree with it, and the disagreement is the failure mode:
 * renaming the package would silently leave the production state under the old
 * namespace. So the namespace is derived from the package name rather than
 * configured, and a project that renames itself renames its production with it.
 *
 * The read is strict on purpose. A missing, unparsable, or nameless
 * `package.json` is not a project this harness can open, and guessing a
 * namespace from the directory would put state under a name nothing else
 * knows.
 */
export const readAutoMovieProjectProductionId = (root: string): string => {
  const file = path.join(root, "package.json");
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    throw new Error(
      `Project manifest "${file}" is unreadable. Run project scripts from a generated AutoMovie project root.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      `Project manifest "${file}" is not valid JSON. Repair it before opening the production.`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    throw new Error(
      `Project manifest "${file}" is not a JSON object. Repair it before opening the production.`,
    );
  const name: unknown = (parsed as { name?: unknown }).name;
  if (typeof name !== "string" || name.trim() !== name || name.length === 0)
    throw new Error(
      `Project manifest "${file}" declares no trimmed non-empty "name". The production namespace is that name.`,
    );
  return name;
};

/**
 * The production namespace of the project the current script is running in.
 *
 * Every shipped script resolves the project from the working directory, so the
 * namespace resolves from the same place rather than from a second host input.
 */
export const currentAutoMovieProductionId = (): string =>
  readAutoMovieProjectProductionId(process.cwd());

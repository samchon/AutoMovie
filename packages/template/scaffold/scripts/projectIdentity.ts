import { AutoMovieProductionProject } from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

/** Why the generated host selected one stable production namespace. */
export type IAutoMovieProjectProductionSelection =
  | { kind: "fresh-seed"; productionId: string }
  | { kind: "registered"; productionId: string };

/**
 * Select package name only before a project has registered production state.
 *
 * @param packageName Current package display/distribution identity.
 * @param registered Exact registered production ids, or null when no registry exists.
 * @param hasOwnedState Whether production-owned state exists without a registry.
 */
export const selectAutoMovieProjectProductionId = (props: {
  packageName: string;
  registered: readonly string[] | null;
  hasOwnedState: boolean;
}): IAutoMovieProjectProductionSelection => {
  if (props.registered === null) {
    if (props.hasOwnedState)
      throw new Error(
        "AutoMovie production state exists without a valid registry. Recover or migrate that state before selecting a new package-name seed.",
      );
    return { kind: "fresh-seed", productionId: props.packageName };
  }
  if (props.registered.length === 1)
    return { kind: "registered", productionId: props.registered[0]! };
  throw new Error(
    props.registered.length === 0
      ? "The AutoMovie production registry is empty. Recover or migrate it before opening the project."
      : `This project contains ${props.registered.length} registered productions (${props.registered.join(", ")}). Generated commands require an explicit production selection.`,
  );
};

/**
 * The production namespace a generated project already declares for itself.
 *
 * A package name seeds the first production. After initialization the valid
 * registry is authoritative, so an ordinary package rename cannot register a
 * second empty production or strand the authored namespace. A project with
 * several registered productions requires an explicit host selection rather
 * than using whichever id happens to equal the package name.
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
  const registryPath = path.join(root, "automovie", "productions.json");
  let registered: readonly string[] | null = null;
  if (fs.existsSync(registryPath))
    try {
      registered = AutoMovieProductionProject.registeredProductionIds(root);
    } catch (error) {
      throw new Error(
        `Production registry "${registryPath}" is unreadable or invalid (${errorMessage(error)}). Recover it before opening the project.`,
      );
    }
  return selectAutoMovieProjectProductionId({
    packageName: name,
    registered,
    hasOwnedState: registered === null && hasProductionOwnedState(root),
  }).productionId;
};

/**
 * The production namespace of the project the current script is running in.
 *
 * Every shipped script resolves the project from the working directory, so the
 * namespace resolves from the same place rather than from a second host input.
 */
export const currentAutoMovieProductionId = (): string =>
  readAutoMovieProjectProductionId(process.cwd());

const hasProductionOwnedState = (root: string): boolean => {
  const automovie = path.join(root, "automovie");
  if (fs.existsSync(path.join(automovie, "incarnation.json"))) return true;
  for (const directory of [
    path.join(automovie, "productions"),
    path.join(root, "generated"),
    path.join(root, "render"),
  ])
    if (
      fs.existsSync(directory) &&
      fs.readdirSync(directory, { withFileTypes: true }).length !== 0
    )
      return true;
  const design = path.join(automovie, "design");
  if (fs.existsSync(design) === false) return false;
  return fs
    .readdirSync(design, { withFileTypes: true })
    .some((entry) => entry.name !== ".gitkeep" && entry.name !== "shared");
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

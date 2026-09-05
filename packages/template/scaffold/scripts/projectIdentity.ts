import type { AutoMovieModelArchetypeRegistry } from "@automovie/archetypes";
import {
  AutoMovieProductionProject,
  parseAutoMovieStructuredJson,
} from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

/**
 * Why the generated host selected one stable production namespace.
 *
 * @author Samchon
 */
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
        "AutoMovie production state exists without a valid registry. Restore automovie/productions.json from version control, or remove the orphaned production state, before a package-name seed may register a production.",
      );
    return { kind: "fresh-seed", productionId: props.packageName };
  }
  if (props.registered.length === 1)
    return { kind: "registered", productionId: props.registered[0]! };
  throw new Error(
    props.registered.length === 0
      ? "The AutoMovie production registry is empty. Restore automovie/productions.json from version control before opening the project."
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
  let raw: Uint8Array;
  try {
    raw = fs.readFileSync(file);
  } catch {
    throw new Error(
      `Project manifest "${file}" is unreadable. Run project scripts from a generated AutoMovie project root.`,
    );
  }
  let parsed: unknown;
  try {
    parsed = parseAutoMovieStructuredJson({ record: file, bytes: raw });
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
 * Open the declared production for mutation.
 *
 * The strict read above refuses a project this harness must not touch, and
 * the project store then selects the namespace itself, under its own root
 * lease. Handing the store the id read a moment earlier would reopen the
 * window this closes: a registry another command created between the read and
 * the open would be answered by appending the package-name seed beside it as a
 * second, empty production. With no requested id the store reads the registry
 * inside the lease and either selects the one registered production or seeds
 * the same package name this read validated.
 */
export const openAutoMovieProjectProduction = (
  root: string,
  archetypes?: AutoMovieModelArchetypeRegistry,
): AutoMovieProductionProject => {
  readAutoMovieProjectProductionId(root);
  return AutoMovieProductionProject.open(root, undefined, archetypes);
};

/**
 * Open the declared production without creating or repairing any state.
 *
 * The same strict read runs first, and the store's read-only registration
 * then requires exactly one initialized production, so a fresh or ambiguous
 * project is refused by name rather than initialized by a check.
 */
export const openAutoMovieProjectProductionReadOnly = (
  root: string,
): AutoMovieProductionProject => {
  readAutoMovieProjectProductionId(root);
  return AutoMovieProductionProject.openReadOnly(root);
};

/**
 * The production namespace of the project the current script is running in.
 *
 * Every shipped script resolves the project from the working directory, so the
 * namespace resolves from the same place rather than from a second host input.
 */
export const currentAutoMovieProductionId = (): string =>
  readAutoMovieProjectProductionId(process.cwd());

/**
 * Whether production-owned state exists that a fresh registry would strand.
 *
 * The store's own legacy layout, a `production.json` directly under the design
 * root, is not orphaned state: the store reads that record's id and migrates
 * the layout on the next mutable open, and it refuses any other requested id
 * by name. A lone `incarnation.json` is not either, because the store writes
 * it before the registry on a first open and completes that open without
 * stranding anything on the next attempt.
 */
const hasProductionOwnedState = (root: string): boolean => {
  const automovie = path.join(root, "automovie");
  const design = path.join(automovie, "design");
  if (fs.existsSync(path.join(design, "production.json"))) return false;
  for (const directory of [
    path.join(automovie, "productions"),
    path.join(root, "generated"),
    path.join(root, "renders"),
  ])
    if (
      fs.existsSync(directory) &&
      fs.readdirSync(directory, { withFileTypes: true }).length !== 0
    )
      return true;
  if (fs.existsSync(design) === false) return false;
  return fs.readdirSync(design, { withFileTypes: true }).some(
    (entry) =>
      entry.name !== ".gitkeep" &&
      (entry.name !== "shared" ||
        fs
          .readdirSync(path.join(design, entry.name), {
            withFileTypes: true,
          })
          .some((child) => child.name !== ".gitkeep")),
  );
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

import type { AutoMovieModelArchetypeRegistry } from "@automovie/archetypes";
import {
  AutoMovieProductionProject,
  parseAutoMovieStructuredJson,
} from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

import { hasProductionArtifactEntries } from "./productionArtifactEntries";

/**
 * Why the generated host selected one stable production namespace.
 *
 * @author Samchon
 */
export type IAutoMovieProjectProductionSelection =
  | { kind: "fresh-seed"; productionId: string }
  | { kind: "registered"; productionId: string };

/**
 * What the generated host found at `automovie/productions.json` before it
 * chose a namespace.
 *
 * @author Samchon
 */
export type IAutoMovieProjectRegistryObservation =
  | {
      /** No registry resides in this checkout. */
      kind: "absent";
      /** Whether production-owned state exists that a seed would strand. */
      hasOwnedState: boolean;
    }
  | {
      /** A registry resides but the project store refused it. */
      kind: "invalid";
      /** The store's refusal, which names what is wrong with the record. */
      reason: string;
    }
  | {
      /** The project store validated the registry. */
      kind: "valid";
      /** Exactly the registered production ids. */
      productions: readonly string[];
    };

/**
 * Select package name only before a project has registered production state.
 *
 * `automovie/productions.json` is tracked beside the design records it names,
 * so a new clone reads the registration its origin checkout wrote and selects
 * the same production. From then on the registration is authoritative: an
 * ordinary package rename keeps selecting the one registered production, and a
 * project with several registered productions is refused by name rather than
 * resolved through whichever id happens to equal the package name.
 *
 * A missing registry beside production-owned state, an invalid registry, and
 * an empty one are refused rather than seeded, because a seed would register a
 * second, empty production over state some checkout already registered. Each
 * refusal names only a recovery that can be performed: the tracked file, the
 * ignore exception an older project still lacks, or an explicit registration
 * through the project API.
 *
 * @param props.packageName Current package display/distribution identity.
 * @param props.registry What the host found at the registry path.
 */
export const selectAutoMovieProjectProductionId = (props: {
  packageName: string;
  registry: IAutoMovieProjectRegistryObservation;
}): IAutoMovieProjectProductionSelection => {
  const registry = props.registry;
  if (registry.kind === "absent") {
    if (registry.hasOwnedState)
      throw new Error(
        "AutoMovie production state exists but automovie/productions.json, the tracked registry naming the production that owns it, is absent. Restore it from version control. A project whose .gitignore still ignores that file must add !automovie/productions.json after automovie/* and commit the registry from the checkout that registered the production. If no checkout holds it, register the owning production explicitly with AutoMovieProductionProject.open(root, productionId); a package-name seed never adopts existing state.",
      );
    return { kind: "fresh-seed", productionId: props.packageName };
  }
  if (registry.kind === "invalid")
    throw new Error(
      `The AutoMovie production registry automovie/productions.json is unreadable or invalid (${registry.reason}). Restore it from version control or correct it as stated before opening the project.`,
    );
  if (registry.productions.length === 1)
    return { kind: "registered", productionId: registry.productions[0]! };
  throw new Error(
    registry.productions.length === 0
      ? "The AutoMovie production registry automovie/productions.json registers no production. Restore the registration from version control, or register a production explicitly with AutoMovieProductionProject.open(root, productionId)."
      : `This project registers ${registry.productions.length} productions (${registry.productions.join(", ")}). Generated commands take no production selection and open only a single-production project, so open the intended production explicitly with AutoMovieProductionProject.open(root, productionId).`,
  );
};

/**
 * The production namespace a generated project already declares for itself.
 *
 * A package name seeds the first production. After initialization the valid
 * registry is authoritative, so an ordinary package rename cannot register a
 * second empty production or strand the authored namespace. A project with
 * several registered productions requires an explicit host selection rather
 * than using whichever id happens to equal the package name. The registry is
 * tracked, so a new checkout of the same history answers with the same id.
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
  let registry: IAutoMovieProjectRegistryObservation;
  if (fs.existsSync(path.join(root, "automovie", "productions.json")) === false)
    registry = { kind: "absent", hasOwnedState: hasProductionOwnedState(root) };
  else
    try {
      registry = {
        kind: "valid",
        productions: AutoMovieProductionProject.registeredProductionIds(root),
      };
    } catch (error) {
      registry = { kind: "invalid", reason: errorMessage(error) };
    }
  return selectAutoMovieProjectProductionId({ packageName: name, registry })
    .productionId;
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
 * project is refused by name rather than initialized by a check. A new clone
 * reads the tracked registration but holds no incarnation of its own yet, so
 * its first read-only command asks for one build instead of issuing one.
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
 * stranding anything on the next attempt. A production's own incarnation under
 * `automovie/productions` is written only after the registry names that
 * production, so finding one without a registry is orphaned state like any
 * other entry there.
 */
const hasProductionOwnedState = (root: string): boolean => {
  const automovie = path.join(root, "automovie");
  const design = path.join(automovie, "design");
  if (fs.existsSync(path.join(design, "production.json"))) return false;
  for (const [namespace, directory] of [
    ["productions", path.join(automovie, "productions")],
    ["generated", path.join(root, "generated")],
    ["renders", path.join(root, "renders")],
  ] as const)
    if (
      fs.existsSync(directory) &&
      hasProductionArtifactEntries({
        directory: namespace,
        entries: fs
          .readdirSync(directory, { withFileTypes: true })
          .map((entry) => ({ name: entry.name, isFile: entry.isFile() })),
      })
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

import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";
import type {
  IAutoMovieDefinedShotContract,
  IAutoMovieDesignMutationOutput,
  IAutoMovieDesignTarget,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  compareCodeUnits,
  findAutoMovieProjectRoot,
} from "@automovie/production";

import { assertAutoMovieNoArguments } from "./commandArguments";
import { readAutoMovieProjectProductionId } from "./projectIdentity";

assertAutoMovieNoArguments("design", process.argv.slice(2));

/** The project this invocation belongs to, found from the host's own seed. */
const projectRoot = findAutoMovieProjectRoot(process.cwd());

/** The production namespace that project declares in its own package manifest. */
const productionId = readAutoMovieProjectProductionId(projectRoot);

/**
 * Production-owned design emitter entry point.
 *
 * After reviewing settings and the applicable design/source branches, add
 * explicit imports and {@link emit} calls in the marked block below.
 * Keep the screenplay index hand-authored: it records semantic coverage that
 * cannot be derived from prose without comparing the prose with itself.
 *
 * This generic shell owns no production record. Its initial run fails, while
 * its inventory check remains after authorship so a design record no current
 * source derives cannot survive as plausible residue.
 */
const project = AutoMovieProductionProject.open(
  projectRoot,
  productionId,
  createAutoMovieArchetypeRegistry(AUTOMOVIE_PRIMITIVE_ARCHETYPES),
);

/** Stable comparable identity for one project-owned design record. */
const address = (target: IAutoMovieDesignTarget): string =>
  target.kind === "production" || target.kind === "world"
    ? target.kind
    : `${target.kind} "${target.id}"`;

/** Every record derived by this exact emitter run. */
const derived = new Set<string>();

/**
 * Store one derived record without invalidating dependants when its bytes did
 * not change. Registration occurs inside this call so ownership cannot drift
 * into a second hand-maintained inventory.
 */
const emit = (
  label: string,
  target: IAutoMovieDesignTarget,
  value: unknown,
  store: () => IAutoMovieDesignMutationOutput,
): void => {
  derived.add(address(target));
  const current = project.design(target);
  if (current !== null && JSON.stringify(current) === JSON.stringify(value)) {
    process.stdout.write(`unchanged ${label}\n`);
    return;
  }
  const output = store();
  if (output.accepted === false)
    throw new Error(
      `Derived design "${label}" was refused: ${output.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
    );
  process.stdout.write(
    `${current === null ? "created" : "updated"} ${label}\n`,
  );
};

/**
 * Add source module/export identity to one typed shot contract before emitting
 * it through `project.setShotContract`.
 */
const shotContract = (
  defined: { id: string; contract: IAutoMovieDefinedShotContract },
  source: IAutoMovieShotContract["source"],
): IAutoMovieShotContract => {
  const { beat, ...measured } = defined.contract;
  return { id: defined.id, beat, source, ...measured };
};

// AUTHOR PRODUCTION IMPORTS ABOVE AND EMIT CALLS HERE. Emit a production record
// before records measured against its frame clock; emit referenced model tiers
// before the recipe that names them; emit shots before their acceptance cases.
// Use shotContract(...) for each imported shot and state its module and export.

const inventory = project.inventory();
const resident: IAutoMovieDesignTarget[] = [
  ...(inventory.production ? [{ kind: "production" } as const] : []),
  ...(inventory.world ? [{ kind: "world" } as const] : []),
  ...inventory.models.map((id) => ({ kind: "model", id }) as const),
  ...inventory.formations.map((id) => ({ kind: "formation", id }) as const),
  ...inventory.shots.map((id) => ({ kind: "shot", id }) as const),
  ...inventory.acceptance.map((id) => ({ kind: "acceptance", id }) as const),
];
const orphaned = resident
  .filter((target) => derived.has(address(target)) === false)
  .map(
    (target) => `  ${project.designRecordPath(target)}  (${address(target)})`,
  )
  .sort(compareCodeUnits);
if (orphaned.length !== 0)
  throw new Error(
    [
      `${orphaned.length} resident design record(s) are derived by no source in this script:`,
      ...orphaned,
      "",
      "Derive each record from its current owner above or delete the named file.",
    ].join("\n"),
  );

if (derived.size === 0)
  throw new Error(
    [
      "No production design emitter has been authored.",
      "Select a production kind in lint.config.ts, complete and review settings,",
      "author the applicable design and source branches, then add explicit",
      "imports and emit calls to scripts/emitDesign.ts.",
    ].join(" "),
  );

// Keep these helpers live in the blank shell and available to authoring edits.
void emit;
void shotContract;

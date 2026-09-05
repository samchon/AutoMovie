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
  AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
  type IAutoMovieDesignDerivationBasis,
  type IAutoMovieDesignProducerEntry,
  autoMovieDesignTargetAddress,
  findAutoMovieProjectRoot,
  runAutoMovieDesignDerivation,
} from "@automovie/production";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { assertAutoMovieNoArguments } from "./commandArguments";
import { openAutoMovieProjectProduction } from "./projectIdentity";

assertAutoMovieNoArguments("design", process.argv.slice(2));

/** The project this invocation belongs to, found from the host's own seed. */
const projectRoot = findAutoMovieProjectRoot(process.cwd());

/** This emitter's own project-relative path, which every record's basis names. */
const EMITTER_PATH = "scripts/emitDesign.ts";

/**
 * Production-owned design emitter entry point.
 *
 * After reviewing settings and the applicable design/source branches, add
 * explicit imports and {@link derive} calls in the marked block below. Keep
 * the screenplay index hand-authored: it records semantic coverage that cannot
 * be derived from prose without comparing the prose with itself.
 *
 * Every declared target is evaluated twice against one frozen producer basis
 * (this emitter's bytes, the named source export, its transitive runtime
 * imports and the toolchain), compared with the live basis, and only then
 * stored. A result that differs between the two evaluations, a basis that moved
 * during the run, or a resident record no entry derives refuses the whole run
 * before any record is written.
 *
 * This generic shell owns no production record. Its initial run fails, while
 * its inventory check remains after authorship so a design record no current
 * source derives cannot survive as plausible residue.
 */
const project = openAutoMovieProjectProduction(
  projectRoot,
  createAutoMovieArchetypeRegistry(AUTOMOVIE_PRIMITIVE_ARCHETYPES),
);

/** Every record this emitter derives, in the order it publishes them. */
const plan: IAutoMovieDesignProducerEntry[] = [];

/**
 * Declare one derived record: the exact source export it comes from, how to
 * evaluate it from that export, and the typed project setter that stores it.
 *
 * `source.selector` names the member of the export the value comes from when
 * the export itself is not the record: `"design()"` for a unit whose recipe is
 * its `design` method, or `"[0]"` for one element of an acceptance array. Leave
 * it `null` when the named export is the record. Declare a production record
 * before records measured against its frame clock, referenced model tiers
 * before the recipe that names them, and shots before their acceptance cases.
 */
const derive = <T>(
  target: IAutoMovieDesignTarget,
  source: IAutoMovieDesignDerivationBasis["source"],
  evaluate: () => T,
  store: (value: T) => IAutoMovieDesignMutationOutput,
): void => {
  plan.push({
    target: autoMovieDesignTargetAddress(target),
    recordPath: project.designRecordPath(target),
    source,
    evaluate,
    store: (value) => store(value as T),
  });
};

/**
 * Add source module/export identity to one typed shot contract before deriving
 * it through `project.setShotContract`.
 */
const shotContract = (
  defined: { id: string; contract: IAutoMovieDefinedShotContract },
  source: IAutoMovieShotContract["source"],
): IAutoMovieShotContract => {
  const { beat, ...measured } = defined.contract;
  return { id: defined.id, beat, source, ...measured };
};

// AUTHOR PRODUCTION IMPORTS ABOVE AND DERIVE CALLS HERE. Use shotContract(...)
// for each imported shot and state its module and export in both the derive
// source and the contract source.

const inventory = project.inventory();
const resident: IAutoMovieDesignTarget[] = [
  ...(inventory.production ? [{ kind: "production" } as const] : []),
  ...(inventory.world ? [{ kind: "world" } as const] : []),
  ...inventory.models.map((id) => ({ kind: "model", id }) as const),
  ...inventory.formations.map((id) => ({ kind: "formation", id }) as const),
  ...inventory.shots.map((id) => ({ kind: "shot", id }) as const),
  ...inventory.acceptance.map((id) => ({ kind: "acceptance", id }) as const),
];
const run = runAutoMovieDesignDerivation({
  production: project.productionId,
  emitter: {
    path: EMITTER_PATH,
    bytes: fs.readFileSync(path.join(projectRoot, ...EMITTER_PATH.split("/"))),
  },
  tool: {
    production: AUTOMOVIE_PRODUCTION_COMPILER_VERSION,
    typescript: ts.version,
    node: process.versions.node,
  },
  readSource: (source) => project.readSource(source),
  resident: resident.map((target) => ({
    target: autoMovieDesignTargetAddress(target),
    recordPath: project.designRecordPath(target),
    value: project.design(target),
  })),
  entries: plan,
});
for (const outcome of run.outcomes)
  process.stdout.write(`${outcome.state} ${outcome.recordPath}\n`);

if (plan.length === 0)
  throw new Error(
    [
      "No production design emitter has been authored.",
      "Select a production kind in lint.config.ts, complete and review settings,",
      "author the applicable design and source branches, then add explicit",
      "imports and derive calls to scripts/emitDesign.ts.",
    ].join(" "),
  );

// Keep these helpers live in the blank shell and available to authoring edits.
void derive;
void shotContract;

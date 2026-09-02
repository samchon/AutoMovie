import { readAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledShotSource,
  IAutoMovieFluidDomain,
  IAutoMovieServiceNetwork,
  IAutoMovieWaterFeature,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  autoMovieMaterializedLibraryEnvironments,
  encodeAutoMoviePathSegment,
  findAutoMovieProjectRoot,
} from "@automovie/production";
import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "automovie";
import fs from "node:fs";
import path from "node:path";

import { productionEvidence } from "../lint.config";
import {
  collectAutoMovieBuildingRecords,
  collectAutoMovieMaterializedEnvironments,
  describeAutoMovieBuildingGaps,
  describeAutoMovieBuildingRecords,
  describeAutoMovieBuildingReport,
} from "./buildingRecords";
import { deriveAutoMovieBuildingReport } from "./buildingReport";
import { planAutoMovieBuildingSidecars } from "./buildingSidecars";
import { productionBuildingStudies } from "./productionStudies";
import { readAutoMovieProjectProductionId } from "./projectIdentity";

/** The project this invocation belongs to, found from the host's own seed. */
const projectRoot = findAutoMovieProjectRoot(process.cwd());

/** The production namespace that project declares in its own package manifest. */
const productionId = readAutoMovieProjectProductionId(projectRoot);

/**
 * Derive the construction documents and performance studies of every building
 * this production stages.
 *
 * ## Why this is a script and not a compile step
 *
 * A drawing, a schedule, a take-off and a performance study are questions an
 * author asks about a design. None of them is part of a frame, so none of them
 * is compiler output: the compiler owns what the renderer draws, and a sheet
 * somebody orders material from is not that. They are also not shot source. A
 * shot or film build function runs in a deterministic no-I/O sandbox that may
 * import only the engine names on its published surface, and every derivation
 * below is off that surface on purpose — it writes files, and a build function
 * that wrote a file would not be deterministic.
 *
 * So this is the third place, and the one the guides name for this work: an
 * ordinary Node script with the whole engine available, reading compiler-owned
 * state and writing sidecars nobody compiles.
 *
 * ## What it reads
 *
 * Current generated state, never source. A building reaches this script the way
 * it reaches the renderer — a subject contributed it, the compiler validated
 * and retained it — so a sheet is a projection of exactly the bytes a frame was
 * drawn from. Requiring the state to be `current` is what makes that true: a
 * stale compile would produce documents for a design that no longer exists.
 *
 * ## What it writes
 *
 * `reports/<building>/`: one `report.json` carrying every derived record, and
 * one `.svg` per sheet. The files are deterministic, so re-deriving an
 * unchanged design rewrites identical bytes, and they are tracked rather than
 * ignored on purpose: a take-off is worth diffing across revisions, and a phase
 * or a variant is only legible beside the one it replaced.
 *
 * They are sidecars, never sources. Editing one changes nothing; correct the
 * design and derive again.
 *
 * Nothing here removes a sidecar. Rename a building or a view and its old files
 * stay where they were, still naming the revision they were derived from, which
 * is why the revision is in them: this directory is yours, and a derivation
 * that deleted files it had not written would be the worse trade. Delete a
 * stale folder yourself.
 */
const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({
    root: projectRoot,
    productionId,
  }),
);

const NEWLINE = String.fromCharCode(10);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Collect one fold from every compiled shot, one record per id.
 *
 * Two shots staging one building carry one record each, and they are the same
 * record: the compiler copies the source's own declaration into every artifact
 * that stages it. So the id is the identity, and deriving both copies would put
 * one sheet on the page twice and make the take-off double the concrete.
 *
 * Two _different_ records wearing one id is a different fact, and this refuses
 * rather than picking. The compiler publishes building ids across shots but
 * does not compare the records behind them, so a divergence reaches here
 * intact; a document silently derived from whichever shot happened to be read
 * first is exactly the kind of evidence nobody can act on.
 */
const staged = <T extends { id: string }>(
  select: (shot: IAutoMovieCompiledShotSource) => readonly T[] | undefined,
  what: string,
): T[] => {
  const found = new Map<string, { record: T; from: string; json: string }>();
  for (const [shot, compiled] of state.generated.shots)
    for (const record of select(compiled) ?? []) {
      const json = JSON.stringify(record);
      const seen = found.get(record.id);
      if (seen === undefined) {
        found.set(record.id, { record, from: shot, json });
        continue;
      }
      if (seen.json !== json)
        throw new Error(
          `shots "${seen.from}" and "${shot}" stage two different ${what} records under the id "${record.id}". One id is one record; rename one of them, or share the subject that emits it.`,
        );
    }
  return [...found.values()]
    .map((entry) => entry.record)
    .sort((left, right) => compareCodeUnits(left.id, right.id));
};

/**
 * Every built environment this project's last compile published, by its own id.
 *
 * A shot stages an environment to photograph it; a library materializes one as
 * the delivered work itself. This report counted only the first, so a library
 * production -- the shape that delivers buildings and no timeline at all --
 * read as having nothing to draw, count or state. The author of four buildings
 * would run the report and be told their production stages no built
 * environment, which is true and useless.
 *
 * Read through the same published index the review command reads, so the
 * report and the review gate describe one set of buildings rather than two. A
 * library that has published nothing yields none rather than failing: the
 * index is absent before the first materialization, and an author who has not
 * reached that point is not in error.
 */
const materialized = (): IAutoMovieBuiltEnvironment[] => {
  // No guard around these two reads. The cases one would catch -- a project
  // with no compiler-owned tree, a library before its first compile -- are
  // both refused above this line already: `requireCurrentAutoMovieProjectState`
  // runs at module level and stops an uncompiled or stale project, and
  // importing `../lint.config` validates the evidence declaration before this
  // file runs at all. A catch here would be a branch no run can take, and it
  // would swallow the reader's own refusal of an owner addressed without its
  // anchor -- which is exactly the defect this command carried in silence.
  const project = AutoMovieProductionProject.openReadOnly(
    projectRoot,
    productionId,
  );
  return collectAutoMovieMaterializedEnvironments({
    owners: readAutoMovieProductionEvidence({
      root: projectRoot,
      productionEvidence,
    }).designOwners,
    resolve: autoMovieMaterializedLibraryEnvironments({
      read: (relative) => project.readGeneratedFile(relative),
    }),
  });
};

const environments = collectAutoMovieBuildingRecords({
  materialized: materialized(),
  staged: staged((shot) => shot.builtEnvironments, "built environment"),
});

const serviceNetworks: IAutoMovieServiceNetwork[] = staged(
  (shot) => shot.serviceNetworks,
  "service network",
);
const fluidDomains: IAutoMovieFluidDomain[] = staged(
  (shot) => shot.fluidDomains,
  "fluid domain",
);
const waterFeatures: IAutoMovieWaterFeature[] = staged(
  (shot) => shot.waterFeatures,
  "water feature",
);

/**
 * The environmental questions this production asks, and the domains it requires
 * an answer for.
 *
 * Every list is empty in a fresh scaffold, and that is the honest state rather than
 * a placeholder. A daylight study needs a workplane somebody chose to measure;
 * an envelope study needs a build-up whose thermal conductivity somebody
 * measured; a room-acoustic study needs an absorption coefficient; a
 * ventilation study needs the supply flow the plant actually delivers. This
 * repository ships no material catalogue and no climate data, so none of those
 * numbers can come from here, and a study invented out of defaults would be
 * indistinguishable from one that was measured.
 *
 * Declare yours here. `daylight` and `envelope` additionally read the site, so
 * they need the production design to carry an `environmentContext`; without one
 * the gap names the missing site rather than a run solved against a sun nobody
 * placed and an outdoor air nobody stated.
 */
const reportRoot = path.join(state.root, "reports");

/**
 * Write one sidecar, creating the directory the first time it is needed.
 *
 * The reported path is POSIX on every host, so two machines deriving one design
 * print one log and a reader comparing them is comparing the derivation rather
 * than the separator their operating system happened to use.
 */
const emit = (file: string, text: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
  const relative = path.relative(state.root, file).split(path.sep).join("/");
  process.stdout.write(`wrote ${relative}\n`);
};

if (environments.length === 0)
  process.stdout.write(
    "no built environment is staged or materialized by this production, so there is nothing to draw, count or study. Contribute one from a shot's source and compile before deriving.\n",
  );

for (const { environment, source } of environments) {
  const report = deriveAutoMovieBuildingReport({
    environment,
    revision: state.generated.manifest.inputFingerprint,
    serviceNetworks,
    fluidDomains,
    waterFeatures,
    context: state.generated.design.production.environmentContext ?? null,
    studies: productionBuildingStudies,
  });
  for (const sidecar of planAutoMovieBuildingSidecars({
    encode: encodeAutoMoviePathSegment,
    id: environment.id,
    report,
  }))
    emit(path.join(reportRoot, ...sidecar.segments), sidecar.text);

  for (const line of describeAutoMovieBuildingReport({
    gaps: report.gaps.length,
    id: environment.id,
    networks: report.services.length,
    quantitySubjects: report.quantities.findings.length,
    runs: report.runs.length,
    schedules: report.schedules,
    sheets: report.sheets.length,
    source,
  }))
    process.stdout.write(line + NEWLINE);
  for (const line of describeAutoMovieBuildingGaps(report.gaps))
    process.stdout.write(line + NEWLINE);
}

// The tally a reviewer reads before deciding what a claim about this production
// may rest on. A materialized building has no frames at all, so a review citing
// one has to cite these drawings; saying so once here is cheaper than
// rediscovering it per building. With nothing to report the line above already
// said so, and a tally of zeroes beside it would only invite reading it as a
// result.
if (environments.length !== 0)
  process.stdout.write(
    describeAutoMovieBuildingRecords(environments) + NEWLINE,
  );

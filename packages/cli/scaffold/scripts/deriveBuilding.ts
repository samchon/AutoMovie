import {
  loadAutoMovieProjectState,
  requireCurrentAutoMovieProjectState,
} from "@automovie/cli";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledShotSource,
  IAutoMovieFluidDomain,
  IAutoMovieServiceNetwork,
  IAutoMovieWaterFeature,
} from "@automovie/interface";
import {
  encodeAutoMoviePathSegment,
  findAutoMovieProjectRoot,
} from "@automovie/mcp";
import fs from "node:fs";
import path from "node:path";

import config from "../automovie.config";
import {
  type IAutoMovieBuildingGap,
  type IAutoMovieBuildingStudies,
  deriveAutoMovieBuildingReport,
} from "./buildingReport";

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
 */
const state = requireCurrentAutoMovieProjectState(
  loadAutoMovieProjectState({
    root: findAutoMovieProjectRoot(process.cwd()),
    productionId: config.productionId,
  }),
);

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Collect one fold from every compiled shot, keeping the first record per id.
 *
 * Two shots staging one building carry one record each, and they are the same
 * record: the compiler copies the source's own declaration into every artifact
 * that stages it. Deriving twice would put the same sheet on the page twice and
 * make the take-off double the concrete.
 */
const staged = <T extends { id: string }>(
  select: (shot: IAutoMovieCompiledShotSource) => readonly T[] | undefined,
): T[] => {
  const found = new Map<string, T>();
  for (const shot of state.generated.shots.values())
    for (const record of select(shot) ?? [])
      if (found.has(record.id) === false) found.set(record.id, record);
  return [...found.values()].sort((left, right) =>
    compareCodeUnits(left.id, right.id),
  );
};

const environments: IAutoMovieBuiltEnvironment[] = staged(
  (shot) => shot.builtEnvironments,
);
const serviceNetworks: IAutoMovieServiceNetwork[] = staged(
  (shot) => shot.serviceNetworks,
);
const fluidDomains: IAutoMovieFluidDomain[] = staged(
  (shot) => shot.fluidDomains,
);
const waterFeatures: IAutoMovieWaterFeature[] = staged(
  (shot) => shot.waterFeatures,
);

/**
 * The environmental questions this production asks, and the domains it requires
 * an answer for.
 *
 * Every list is empty in the starter, and that is the honest state rather than
 * a placeholder. A daylight study needs a workplane somebody chose to measure;
 * an envelope study needs a build-up whose thermal conductivity somebody
 * measured; a room-acoustic study needs an absorption coefficient; a
 * ventilation study needs the supply flow the plant actually delivers. This
 * repository ships no material catalogue and no climate data, so none of those
 * numbers can come from here, and a study invented out of defaults would be
 * indistinguishable from one that was measured.
 *
 * Declare yours here. `daylight` additionally needs the production design to
 * carry an `environmentContext`; without one the run is reported `not-run`
 * naming the missing site rather than solved against a sun nobody placed.
 */
const studies: IAutoMovieBuildingStudies = {
  daylight: [],
  envelope: [],
  acoustic: [],
  air: [],
  // One required domain, because a report over nothing would clear everything.
  // Widen it as the production takes on obligations; every required domain
  // nobody answered forces the report to `incomplete`.
  required: ["daylight"],
};

const reportRoot = path.join(state.root, "reports");

/** Write one sidecar, creating the directory the first time it is needed. */
const emit = (file: string, text: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
  process.stdout.write(`wrote ${path.relative(state.root, file)}\n`);
};

/** Print one gap the way its own record states it, never as a bare count. */
const announce = (gap: IAutoMovieBuildingGap): void => {
  process.stdout.write(`  ${gap.status} ${gap.subject}: ${gap.reason}\n`);
};

if (environments.length === 0)
  process.stdout.write(
    "no built environment is staged by this production, so there is nothing to draw, count or study. Contribute one from a shot's source and compile before deriving.\n",
  );

for (const environment of environments) {
  const report = deriveAutoMovieBuildingReport({
    environment,
    revision: state.generated.manifest.inputFingerprint,
    serviceNetworks,
    fluidDomains,
    waterFeatures,
    context: state.generated.design.production.environmentContext ?? null,
    studies,
  });
  const directory = path.join(
    reportRoot,
    encodeAutoMoviePathSegment(environment.id),
  );
  for (const sheet of report.sheets)
    emit(
      path.join(directory, `${encodeAutoMoviePathSegment(sheet.view.id)}.svg`),
      `${sheet.svg}\n`,
    );
  emit(
    path.join(directory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  process.stdout.write(
    `${environment.id}: ${report.sheets.length} sheet(s), ${report.schedules
      .map((schedule) => `${schedule.total} ${schedule.subject}(s)`)
      .join(", ")}, ${report.quantities.findings.length} quantity subject(s), ${
      report.services.length
    } network(s), ${report.runs.length} analysis run(s)\n`,
  );
  process.stdout.write(
    `${environment.id}: ${report.gaps.length} declared gap(s)\n`,
  );
  for (const gap of report.gaps) announce(gap);
}

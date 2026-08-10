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

const environments: IAutoMovieBuiltEnvironment[] = staged(
  (shot) => shot.builtEnvironments,
  "built environment",
);
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

/**
 * Print each gap once, with its remedy and how many artifacts declared it.
 *
 * Every sheet declares the same three limits of the drawing derivation, so a
 * work of two units prints thirty-six copies of them unless they are collapsed,
 * and the gaps that are actually about this building disappear underneath. The
 * sidecar still carries every row beside the artifact that raised it; this is
 * the reading, and the remedy is half of what a gap is for.
 */
const announce = (gaps: readonly IAutoMovieBuildingGap[]): void => {
  const counted = new Map<
    string,
    { gap: IAutoMovieBuildingGap; count: number }
  >();
  for (const gap of gaps) {
    const seen = counted.get(`${gap.status}\n${gap.reason}\n${gap.remedy}`);
    if (seen === undefined)
      counted.set(`${gap.status}\n${gap.reason}\n${gap.remedy}`, {
        gap,
        count: 1,
      });
    else ++seen.count;
  }
  for (const entry of counted.values())
    process.stdout.write(
      `  ${entry.gap.status} ${entry.gap.subject}${
        entry.count === 1 ? "" : ` (and ${entry.count - 1} more like it)`
      }: ${entry.gap.reason}\n    remedy: ${entry.gap.remedy}\n`,
    );
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
  announce(report.gaps);
}

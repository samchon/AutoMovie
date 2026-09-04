import type {
  IAutoMovieEvidenceConfigProps,
  readAutoMovieProductionEvidence,
} from "@automovie/evidence";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieCompiledShotSource,
  IAutoMovieEnvironmentContext,
  IAutoMovieFluidDomain,
  IAutoMovieServiceNetwork,
  IAutoMovieWaterFeature,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  autoMovieMaterializedLibraryEnvironments,
  encodeAutoMoviePathSegment,
} from "@automovie/production";
import fs from "node:fs";
import path from "node:path";

import {
  collectAutoMovieStagedRecords,
  deriveAutoMovieBuildingActions,
} from "./buildingDerivation";
import {
  collectAutoMovieBuildingRecords,
  collectAutoMovieMaterializedEnvironments,
  describeAutoMovieBuildingRecords,
} from "./buildingRecords";
import { deriveAutoMovieBuildingReport } from "./buildingReport";
import { productionBuildingStudies } from "./productionStudies";

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
 * below is off that surface on purpose : it writes files, and a build function
 * that wrote a file would not be deterministic.
 *
 * So this is the third place, and the one the guides name for this work: an
 * ordinary Node script with the whole engine available, reading compiler-owned
 * state and writing sidecars nobody compiles.
 *
 * ## What it reads
 *
 * Current generated state, never source. A building reaches this script the way
 * it reaches the renderer : a subject contributed it, the compiler validated
 * and retained it : so a sheet is a projection of exactly the bytes a frame was
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
export const runAutoMovieBuildingDerivation = (props: {
  /** Production namespace that project declares. */
  productionId: string;
  /** Authoring declaration the design owners are read through. */
  evidence: IAutoMovieEvidenceConfigProps;
  /** Reader for that declaration, injected so a fixture can supply its own. */
  read: typeof readAutoMovieProductionEvidence;
  /** Where a sidecar lands and what it says, injected for the same reason. */
  write?: (file: string, text: string) => void;
  /** Where a line goes. */
  say?: (line: string) => void;
  /**
   * The project's current compiled state.
   *
   * Passed in rather than loaded here, and stated structurally, so this file
   * needs nothing the generated project's own runtime supplies. It is exactly
   * what the derivation reads and nothing else: the entry beside this one loads
   * it and refuses a stale or uncompiled project before calling.
   */
  state: {
    root: string;
    generated: {
      kind: "brief" | "film" | "library";
      shots: Iterable<readonly [string, IAutoMovieCompiledShotSource]>;
      libraryEnvironments: Iterable<
        readonly [string, IAutoMovieBuiltEnvironment]
      >;
      manifest: { inputFingerprint: string };
      design: {
        production: {
          environmentContext?: IAutoMovieEnvironmentContext;
        } | null;
      };
    };
  };
}): void => {
  // One root, taken from the state. Two; a caller's and the state's; can
  // disagree, and a report drawn from one tree into another tree's directory is
  // exactly the kind of result nobody can trace.
  const projectRoot = props.state.root;
  const productionId = props.productionId;
  const say =
    props.say ?? ((line: string) => void process.stdout.write(line + NEWLINE));
  const state = props.state;

  const NEWLINE = String.fromCharCode(10);

  const staged = <T extends { id: string }>(
    select: (shot: IAutoMovieCompiledShotSource) => readonly T[] | undefined,
    what: string,
  ): T[] =>
    collectAutoMovieStagedRecords({
      shots: [...state.generated.shots],
      select: select as (compiled: never) => readonly T[] | undefined,
      what,
    });

  /**
   * Every built environment this project's last compile published, by its own id.
   *
   * A shot stages an environment to photograph it; a library materializes one as
   * the delivered work itself. This report counted only the first, so a library
   * production; the shape that delivers buildings and no timeline at all;
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
    if (state.generated.kind === "library")
      return [...state.generated.libraryEnvironments].map(
        ([, environment]) => environment,
      );
    // No guard around these two reads. The cases one would catch; a project
    // with no compiler-owned tree, a library before its first compile; are
    // both refused above this line already: `requireCurrentAutoMovieProjectState`
    // runs at module level and stops an uncompiled or stale project, and
    // importing `../lint.config` validates the evidence declaration before this
    // file runs at all. A catch here would be a branch no run can take, and it
    // would swallow the reader's own refusal of an owner addressed without its
    // anchor; which is exactly the defect this command carried in silence.
    const project = AutoMovieProductionProject.openReadOnly(
      projectRoot,
      productionId,
    );
    return collectAutoMovieMaterializedEnvironments({
      owners: props.read({
        root: projectRoot,
        productionEvidence: props.evidence,
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
  const emit =
    props.write ??
    ((file: string, text: string): void => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, "utf8");
      const relative = path
        .relative(state.root, file)
        .split(path.sep)
        .join("/");
      say(`wrote ${relative}`);
    });

  for (const action of deriveAutoMovieBuildingActions({
    encode: encodeAutoMoviePathSegment,
    records: environments,
    report: ({ environment }) =>
      deriveAutoMovieBuildingReport({
        environment,
        revision: state.generated.manifest.inputFingerprint,
        serviceNetworks,
        fluidDomains,
        waterFeatures,
        context: state.generated.design.production?.environmentContext ?? null,
        studies: productionBuildingStudies,
      }),
    tally: describeAutoMovieBuildingRecords,
  }))
    if (action.kind === "write")
      emit(
        path.join(reportRoot, ...action.sidecar.segments),
        action.sidecar.text,
      );
    else say(action.line);
};

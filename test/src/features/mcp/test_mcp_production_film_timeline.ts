import { scaffoldAssetDirectory } from "@automovie/cli";
import {
  IAutoMovieAssetManifest,
  IAutoMovieFilmEdit,
  IAutoMovieFilmTimeline,
  IAutoMoviePrepareReviewOutput,
  IAutoMovieReviewEvidence,
  IAutoMovieShotContract,
  IAutoMovieSubmitReviewInput,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
  compareCodeUnits,
  digestAutoMovieBytes,
  parseAutoMovieFilmTimeline,
  selectAutoMovieFilmReviewFrames,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";

import { namedFacts } from "../internal/predicates";
import {
  fixtureWorldDesign,
  productionCompileSucceeded,
  productionDesign,
  productionFixture,
  setProductionFixtureShotContract,
  testCaptureRuntimeIdentity,
  worldDesign,
} from "./productionFixtures";

const editSource = (edit: unknown): string =>
  `export const film = { build() { return ${JSON.stringify(edit)}; } };\n`;

const writeEditSource = (
  root: string,
  filmPath: string,
  edit: IAutoMovieFilmEdit,
): void => {
  const manifestPath = path.join(root, ".automovie/assets.json");
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as IAutoMovieAssetManifest;
  for (const asset of manifest.assets) {
    const retained = asset.uses.filter(
      (use) => use.production !== "fixture-film",
    );
    asset.uses = [
      ...retained,
      ...edit.tracks.audio
        .filter((cue) => cue.asset === asset.path)
        .map((cue) => ({
          production: "fixture-film",
          consumer: { kind: "audio-cue" as const, id: cue.id },
          reason: `The film timeline consumes ${asset.path} through ${cue.id}.`,
        })),
    ];
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  fs.writeFileSync(filmPath, editSource(edit));
};

const diagnosticCodes = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): Set<string> => new Set(output.diagnostics.map((item) => item.code));

const throws = (closure: () => unknown): boolean => {
  try {
    closure();
    return false;
  } catch {
    return true;
  }
};

interface IFilmSourceFixtureFailure {
  error: unknown;
}

interface IFilmSourceFixtureCleanup {
  cleanup: () => unknown;
  resource: string;
}

class FilmSourceFixtureCleanupError extends AggregateError {}

/** Attempt each independent film-source cleanup without hiding failure. */
export const preserveFilmSourceFixtureCleanup = (
  failure: IFilmSourceFixtureFailure | undefined,
  resources: readonly IFilmSourceFixtureCleanup[],
): void => {
  const cleanupFailures: Array<{ error: unknown; resource: string }> = [];
  for (const resource of resources)
    try {
      resource.cleanup();
    } catch (error) {
      cleanupFailures.push({ error, resource: resource.resource });
    }
  if (cleanupFailures.length === 1 && failure === undefined)
    throw cleanupFailures[0]!.error;
  if (cleanupFailures.length !== 0)
    throw new FilmSourceFixtureCleanupError(
      [
        ...(failure === undefined ? [] : [failure.error]),
        ...cleanupFailures.map((entry) => entry.error),
      ],
      `Film-source fixture cleanup failed${
        failure === undefined ? "" : " after the test failed"
      }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
    );
};

interface IFilmTimelineFixtureFailure {
  error: unknown;
}

class FilmTimelineFixtureCleanupError extends AggregateError {}

/** Dispose the film-timeline fixture without replacing its failure. */
export const preserveFilmTimelineFixtureCleanup = (
  failure: IFilmTimelineFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new FilmTimelineFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Film-timeline fixture teardown failed after the test failed.",
    );
  }
};

const captureBytes = (): Uint8Array => {
  const png = new PNG({ width: 16, height: 16 });
  png.data.fill(200);
  png.data[0] = 0;
  return PNG.sync.write(png);
};

const filmWorksheet = (
  project: AutoMovieProductionProject,
  prepared: IAutoMoviePrepareReviewOutput,
): IAutoMovieSubmitReviewInput => {
  const scenarios = [...project.graph().acceptance.values()]
    .filter((scenario) => {
      if (scenario.required === false) return false;
      if (prepared.outcomes.some((outcome) => outcome.scenario === scenario.id))
        return true;
      const criterion = scenario.criterion;
      if (criterion.kind !== "frame") return false;
      const shot =
        criterion.shot ??
        (scenario.target.kind === "shot" ? scenario.target.id : undefined);
      return prepared.frames.some(
        (frame) =>
          frame.target.kind === "shot" &&
          frame.target.id === shot &&
          frame.reviewFrame === criterion.frame &&
          frame.pass === criterion.pass,
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id));
  const frame = prepared.frames[0];
  if (frame === undefined)
    throw new Error(
      `Film worksheet requires current prepared frame evidence:\n${JSON.stringify(
        {
          target: prepared.target,
          diagnostics: prepared.diagnostics,
          outcomes: prepared.outcomes,
        },
        null,
        2,
      )}`,
    );
  const frameEvidence = {
    kind: "frame" as const,
    target: frame.target,
    reviewFrame: frame.reviewFrame,
    bundle: frame.bundle,
    frame: frame.frame,
    time: frame.time,
    pass: frame.pass,
    digest: frame.digest,
  };
  return {
    target: prepared.target,
    preparedFingerprint: prepared.fingerprint,
    observations:
      "The exact canonical film cut and its current frame were inspected.",
    checks: prepared.requiredCriteria.map((criterion, index) => ({
      criterion,
      verdict: "pass",
      observation: `${criterion} is established by current film evidence ${index}.`,
      evidence:
        criterion === "acceptance-scenarios"
          ? scenarios.flatMap((scenario): IAutoMovieReviewEvidence[] => {
              const contractEvidence: IAutoMovieReviewEvidence = {
                kind: "acceptance",
                scenario: scenario.id,
                exactValue: scenario,
              };
              const scenarioCriterion = scenario.criterion;
              if (scenarioCriterion.kind === "frame") {
                const shot =
                  scenarioCriterion.shot ??
                  (scenario.target.kind === "shot"
                    ? scenario.target.id
                    : undefined);
                const evidence = prepared.frames.find(
                  (candidate) =>
                    candidate.target.kind === "shot" &&
                    candidate.target.id === shot &&
                    candidate.reviewFrame === scenarioCriterion.frame &&
                    candidate.pass === scenarioCriterion.pass,
                )!;
                return [
                  contractEvidence,
                  {
                    kind: "frame" as const,
                    target: evidence.target,
                    reviewFrame: evidence.reviewFrame,
                    bundle: evidence.bundle,
                    frame: evidence.frame,
                    time: evidence.time,
                    pass: evidence.pass,
                    digest: evidence.digest,
                  },
                ];
              }
              const outcome = prepared.outcomes.find(
                (candidate) => candidate.scenario === scenario.id,
              )!;
              return [
                contractEvidence,
                {
                  kind: "outcome" as const,
                  scenario: scenario.id,
                  exactValue: outcome,
                },
              ];
            })
          : [frameEvidence],
      ...(criterion === "acceptance-scenarios"
        ? { acceptanceScenarios: scenarios.map((scenario) => scenario.id) }
        : {}),
    })),
    corrections: [],
    completionBasis: prepared.requiredCriteria.join(", "),
    complete: true,
  };
};

const baseEdit = (): IAutoMovieFilmEdit => ({
  id: "fixture-film",
  omissions: [],
  tracks: {
    video: [
      {
        shot: "opening",
        sourceIn: { frame: 0 },
        sourceOut: { seconds: 6 },
        start: { frame: 0 },
        handles: { head: { frame: 0 }, tail: { frame: 0 } },
        transitionIn: { kind: "cut" },
        transitionOut: { kind: "cut" },
      },
    ],
    audio: [],
    captions: [],
    effects: [],
  },
});

const twoShotEdit = (): IAutoMovieFilmEdit => {
  const edit = baseEdit();
  edit.tracks.video[0]!.handles.tail = { seconds: 0.5 };
  edit.tracks.video[0]!.transitionOut = {
    kind: "dissolve",
    duration: { seconds: 0.5 },
  };
  edit.tracks.video.push({
    shot: "answer",
    sourceIn: { frame: 0 },
    sourceOut: { seconds: 6 },
    start: { seconds: 5.5 },
    handles: { head: { seconds: 0.5 }, tail: { seconds: 0.5 } },
    transitionIn: { kind: "dissolve", duration: { seconds: 0.5 } },
    transitionOut: { kind: "fade", duration: { seconds: 0.5 } },
  });
  edit.tracks.audio.push({
    id: "silent-guide",
    asset: "public/audio/starter-tone.json",
    sourceDuration: { seconds: 11.5 },
    sourceOffset: { frame: 0 },
    start: { frame: 0 },
    duration: { seconds: 11.5 },
    gain: 0,
    fadeIn: { frame: 0 },
    fadeOut: { frame: 0 },
    bus: "ambience",
  });
  edit.tracks.captions.push({
    id: "signal-caption",
    text: "Signal.",
    language: "en",
    start: { seconds: 1 },
    end: { seconds: 2 },
  });
  return edit;
};

/** Film source compiles into one frame-exact artifact shared downstream. */
export const test_mcp_production_film_timeline = async (): Promise<void> => {
  let filmTimelineFailure: IFilmTimelineFixtureFailure | undefined;
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    const filmPath = path.join(fixture.root, "src/film.ts");
    const originalSource = fs.readFileSync(filmPath);
    const first = compiler.compile({ scope: "source" });
    const firstSucceeded = productionCompileSucceeded(
      "initial film timeline fixture",
      first,
    );
    const timelinePath = path.join(
      fixture.root,
      "generated/fixture-film/film-timeline.json",
    );
    const editPath = path.join(
      fixture.root,
      "generated/fixture-film/contracts/film-edit.json",
    );
    const firstTimelineBytes = fs.readFileSync(timelinePath);
    const firstTimelineMtime = fs.statSync(timelinePath).mtimeMs;
    const timeline = JSON.parse(
      firstTimelineBytes.toString("utf8"),
    ) as IAutoMovieFilmTimeline;
    const compiledEdit = JSON.parse(fs.readFileSync(editPath, "utf8"));
    const reopened = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    const reopenedSucceeded = productionCompileSucceeded(
      "reopened film timeline fixture",
      reopened,
    );
    TestValidator.equals(
      "valid film materializes deterministic edit and timeline bytes",
      namedFacts([
        ["firstSucceeded", () => firstSucceeded],
        [
          "timelineIdFixture",
          () => firstSucceeded && timeline.id === "fixture-film",
        ],
        [
          "timelineTotalFrames",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144,
        ],
        [
          "timelineSegmentsLength",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1,
        ],
        [
          "timelineSegments0",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening",
        ],
        [
          "timelineSegments02",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0,
        ],
        [
          "timelineSegments03",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144,
        ],
        [
          "compiledEditSourcePath",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144 &&
            compiledEdit.source.path === "src/film.ts",
        ],
        [
          "compiledEditSourceExport",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144 &&
            compiledEdit.source.path === "src/film.ts" &&
            compiledEdit.source.export === "film",
        ],
        [
          "compiledEditInputFingerprintFirst",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144 &&
            compiledEdit.source.path === "src/film.ts" &&
            compiledEdit.source.export === "film" &&
            compiledEdit.inputFingerprint === first.compiler.inputFingerprint,
        ],
        [
          "timelineInputFingerprintFirst",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144 &&
            compiledEdit.source.path === "src/film.ts" &&
            compiledEdit.source.export === "film" &&
            compiledEdit.inputFingerprint === first.compiler.inputFingerprint &&
            timeline.inputFingerprint === first.compiler.inputFingerprint,
        ],
        [
          "reopenedSucceeded",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144 &&
            compiledEdit.source.path === "src/film.ts" &&
            compiledEdit.source.export === "film" &&
            compiledEdit.inputFingerprint === first.compiler.inputFingerprint &&
            timeline.inputFingerprint === first.compiler.inputFingerprint &&
            reopenedSucceeded,
        ],
        [
          "reopenedCompilerInputFingerprint",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144 &&
            compiledEdit.source.path === "src/film.ts" &&
            compiledEdit.source.export === "film" &&
            compiledEdit.inputFingerprint === first.compiler.inputFingerprint &&
            timeline.inputFingerprint === first.compiler.inputFingerprint &&
            reopenedSucceeded &&
            reopened.compiler.inputFingerprint ===
              first.compiler.inputFingerprint,
        ],
        [
          "reopenedMaterializedEvery",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144 &&
            compiledEdit.source.path === "src/film.ts" &&
            compiledEdit.source.export === "film" &&
            compiledEdit.inputFingerprint === first.compiler.inputFingerprint &&
            timeline.inputFingerprint === first.compiler.inputFingerprint &&
            reopenedSucceeded &&
            reopened.compiler.inputFingerprint ===
              first.compiler.inputFingerprint &&
            reopened.materialized.every((file) => file.status === "unchanged"),
        ],
        [
          "fsReadFileSyncTimelinePath",
          () =>
            firstSucceeded &&
            timeline.id === "fixture-film" &&
            timeline.totalFrames === 144 &&
            timeline.segments.length === 1 &&
            timeline.segments[0]?.shot === "opening" &&
            timeline.segments[0]?.sourceInFrame === 0 &&
            timeline.segments[0]?.endFrame === 144 &&
            compiledEdit.source.path === "src/film.ts" &&
            compiledEdit.source.export === "film" &&
            compiledEdit.inputFingerprint === first.compiler.inputFingerprint &&
            timeline.inputFingerprint === first.compiler.inputFingerprint &&
            reopenedSucceeded &&
            reopened.compiler.inputFingerprint ===
              first.compiler.inputFingerprint &&
            reopened.materialized.every(
              (file) => file.status === "unchanged",
            ) &&
            fs.readFileSync(timelinePath).equals(firstTimelineBytes),
        ],
        [
          "fsStatSyncTimelinePath",
          () => fs.statSync(timelinePath).mtimeMs === firstTimelineMtime,
        ],
        [
          "fsReadFileSyncFilmPath",
          () => fs.readFileSync(filmPath).equals(originalSource),
        ],
      ]),
      {
        firstSucceeded: true,
        timelineIdFixture: true,
        timelineTotalFrames: true,
        timelineSegmentsLength: true,
        timelineSegments0: true,
        timelineSegments02: true,
        timelineSegments03: true,
        compiledEditSourcePath: true,
        compiledEditSourceExport: true,
        compiledEditInputFingerprintFirst: true,
        timelineInputFingerprintFirst: true,
        reopenedSucceeded: true,
        reopenedCompilerInputFingerprint: true,
        reopenedMaterializedEvery: true,
        fsReadFileSyncTimelinePath: true,
        fsStatSyncTimelinePath: true,
        fsReadFileSyncFilmPath: true,
      },
    );

    const compileEdit = (
      mutate: (edit: IAutoMovieFilmEdit) => void,
    ): ReturnType<AutoMovieProductionCompiler["compile"]> => {
      const edit = baseEdit();
      mutate(edit);
      writeEditSource(fixture.root, filmPath, edit);
      return compiler.compile({ scope: "source" });
    };
    const cases: Array<{
      name: string;
      code: string;
      mutate(edit: IAutoMovieFilmEdit): void;
    }> = [
      {
        name: "film id",
        code: "film-id-mismatch",
        mutate: (edit) => {
          edit.id = "wrong-film";
        },
      },
      {
        name: "off-grid time",
        code: "film-time-off-grid",
        mutate: (edit) => {
          edit.tracks.video[0]!.start = { seconds: 0.1 };
        },
      },
      {
        name: "unknown shot",
        code: "film-shot-unknown",
        mutate: (edit) => {
          edit.tracks.video[0]!.shot = "missing";
        },
      },
      {
        name: "duplicate shot",
        code: "film-shot-accounting-invalid",
        mutate: (edit) => {
          edit.tracks.video.push(structuredClone(edit.tracks.video[0]!));
        },
      },
      {
        name: "shot both used and omitted",
        code: "film-shot-accounting-invalid",
        mutate: (edit) => {
          edit.omissions.push({ shot: "opening", reason: "duplicate claim" });
        },
      },
      {
        name: "blank omission",
        code: "film-shot-accounting-invalid",
        mutate: (edit) => {
          edit.tracks.video = [];
          edit.omissions.push({ shot: "opening", reason: " " });
        },
      },
      {
        name: "unknown omission",
        code: "film-shot-unknown",
        mutate: (edit) => {
          edit.omissions.push({
            shot: "missing",
            reason: "This shot is not present.",
          });
        },
      },
      {
        name: "unaccounted shot",
        code: "film-shot-unaccounted",
        mutate: (edit) => {
          edit.tracks.video = [];
        },
      },
      {
        name: "source range",
        code: "film-source-range-invalid",
        mutate: (edit) => {
          edit.tracks.video[0]!.sourceOut = { seconds: 7 };
        },
      },
      {
        name: "nonzero first placement",
        code: "film-global-order-invalid",
        mutate: (edit) => {
          edit.tracks.video[0]!.start = { frame: 1 };
        },
      },
      {
        name: "terminal dissolve",
        code: "film-transition-invalid",
        mutate: (edit) => {
          edit.tracks.video[0]!.transitionOut = {
            kind: "dissolve",
            duration: { seconds: 0.5 },
          };
        },
      },
      {
        name: "zero transition",
        code: "film-transition-invalid",
        mutate: (edit) => {
          edit.tracks.video[0]!.transitionIn = {
            kind: "fade",
            duration: { frame: 0 },
          };
        },
      },
      {
        name: "off-grid transition",
        code: "film-time-off-grid",
        mutate: (edit) => {
          edit.tracks.video[0]!.transitionIn = {
            kind: "fade",
            duration: { seconds: 0.1 },
          };
        },
      },
      {
        name: "transition handle",
        code: "film-transition-handle-missing",
        mutate: (edit) => {
          edit.tracks.video[0]!.transitionIn = {
            kind: "fade",
            duration: { seconds: 7 },
          };
        },
      },
      {
        name: "audio ownership",
        code: "film-audio-cue-invalid",
        mutate: (edit) => {
          edit.tracks.audio.push({
            id: "bad-audio",
            asset: "outside.wav",
            sourceDuration: { seconds: 1 },
            sourceOffset: { seconds: 0.75 },
            start: { seconds: 5.5 },
            duration: { seconds: 1 },
            gain: 5,
            fadeIn: { seconds: 0.75 },
            fadeOut: { seconds: 0.75 },
            bus: "music",
          });
        },
      },
      {
        name: "off-grid audio fade",
        code: "film-time-off-grid",
        mutate: (edit) => {
          edit.tracks.audio.push({
            id: "off-grid-audio",
            asset: "public/audio/starter-tone.json",
            sourceDuration: { seconds: 6 },
            sourceOffset: { frame: 0 },
            start: { frame: 0 },
            duration: { seconds: 1 },
            gain: 1,
            fadeIn: { frame: 0 },
            fadeOut: { seconds: 0.1 },
            bus: "dialogue",
          });
        },
      },
      {
        name: "caption range",
        code: "film-caption-cue-invalid",
        mutate: (edit) => {
          edit.tracks.captions.push({
            id: "bad-caption",
            text: " ",
            language: "not_a_language",
            speaker: " ",
            start: { seconds: 5 },
            end: { seconds: 4 },
          });
        },
      },
      {
        name: "off-grid caption end",
        code: "film-time-off-grid",
        mutate: (edit) => {
          edit.tracks.captions.push({
            id: "off-grid-caption",
            text: "Signal.",
            language: "en",
            start: { frame: 0 },
            end: { seconds: 0.1 },
          });
        },
      },
      {
        name: "effect support",
        code: "film-effect-cue-invalid",
        mutate: (edit) => {
          edit.tracks.effects.push({
            id: "bad-effect",
            recipe: "world-zone",
            zone: "missing",
            start: { frame: 0 },
            duration: { seconds: 7 },
            intensity: 2,
          });
        },
      },
      {
        name: "effect ordering",
        code: "film-effect-cue-invalid",
        mutate: (edit) => {
          edit.tracks.effects.push(
            {
              id: "later-effect",
              recipe: "world-zone",
              zone: "signal-smoke",
              start: { frame: 2 },
              duration: { frame: 1 },
              intensity: 0.5,
            },
            {
              id: "earlier-effect",
              recipe: "world-zone",
              zone: "signal-smoke",
              start: { frame: 1 },
              duration: { frame: 1 },
              intensity: 0.5,
            },
          );
        },
      },
    ];
    for (const testCase of cases) {
      const output = compileEdit(testCase.mutate);
      TestValidator.equals(
        `${testCase.name} is refused without publishing a partial film`,
        namedFacts([
          ["outputSuccess", () => output.success === false],
          [
            "diagnosticCodesOutputHas",
            () => diagnosticCodes(output).has(testCase.code),
          ],
          [
            "readFileSyncTimelinePathEquals",
            () => fs.readFileSync(timelinePath).equals(firstTimelineBytes),
          ],
        ]),
        {
          outputSuccess: true,
          diagnosticCodesOutputHas: true,
          readFileSyncTimelinePathEquals: true,
        },
      );
    }

    // `targetRuntimeSeconds` states the film's intended finished length, so an
    // edit that has not reached it yet is an unfinished production rather than
    // an authoring error. Refusing it at `source` would make the target
    // impossible to declare before the film exists to fill it. Delivery is
    // where the two must agree, and `review` judges the assembled film, so the
    // gap binds from there on.
    const short = baseEdit();
    short.tracks.video[0]!.sourceOut = { seconds: 5 };
    writeEditSource(fixture.root, filmPath, short);
    const shortSource = compiler.compile({ scope: "source" });
    const shortSourceGap = shortSource.diagnostics.filter(
      (item) => item.code === "film-runtime-mismatch",
    );
    const shortReview = compiler.compile({ scope: "review" });
    const shortReviewGap = shortReview.diagnostics.filter(
      (item) => item.code === "film-runtime-mismatch",
    );
    TestValidator.equals(
      "an edit short of its intended runtime warns while authoring and refuses at review",
      namedFacts([
        ["sourceSucceeded", () => shortSource.success === true],
        [
          "sourceWarns",
          () =>
            shortSourceGap.length === 1 &&
            shortSourceGap[0]!.category === "warning",
        ],
        [
          "sourceNamesTheGap",
          () => shortSourceGap[0]!.message.includes("does not yet fill"),
        ],
        [
          "reviewRefuses",
          () =>
            shortReviewGap.length === 1 &&
            shortReviewGap[0]!.category === "error",
        ],
        ["reviewFailed", () => shortReview.success === false],
      ]),
      {
        sourceSucceeded: true,
        sourceWarns: true,
        sourceNamesTheGap: true,
        reviewRefuses: true,
        reviewFailed: true,
      },
    );
    // The negative twin: an edit that exactly fills the declared runtime raises
    // the diagnostic at neither scope, so the warning tracks the real gap
    // rather than firing on every authoring compile.
    writeEditSource(fixture.root, filmPath, baseEdit());
    TestValidator.equals(
      "an edit that fills its runtime raises the gap at no scope",
      namedFacts([
        [
          "source",
          () =>
            diagnosticCodes(compiler.compile({ scope: "source" })).has(
              "film-runtime-mismatch",
            ),
        ],
        [
          "review",
          () =>
            diagnosticCodes(compiler.compile({ scope: "review" })).has(
              "film-runtime-mismatch",
            ),
        ],
      ]),
      { source: false, review: false },
    );

    const captioned = baseEdit();
    captioned.tracks.captions.push({
      id: "spoken-caption",
      text: "Signal.",
      language: "en",
      speaker: "sentinel",
      start: { frame: 0 },
      end: { frame: 1 },
    });
    writeEditSource(fixture.root, filmPath, captioned);
    TestValidator.predicate(
      "a present non-blank caption speaker remains valid",
      productionCompileSucceeded(
        "non-blank caption speaker",
        compiler.compile({ scope: "source" }),
      ),
    );

    project.setWorldDesign(worldDesign());
    const compileEffect = (
      mutate: (cue: IAutoMovieFilmEdit["tracks"]["effects"][number]) => void,
    ): ReturnType<AutoMovieProductionCompiler["compile"]> => {
      const edit = baseEdit();
      const cue: IAutoMovieFilmEdit["tracks"]["effects"][number] = {
        id: "effect",
        recipe: "world-zone",
        zone: "signal-smoke",
        start: { frame: 0 },
        duration: { frame: 1 },
        intensity: 0.5,
      };
      mutate(cue);
      edit.tracks.effects.push(cue);
      writeEditSource(fixture.root, filmPath, edit);
      return compiler.compile({ scope: "source" });
    };
    const effectFailures = [
      compileEffect((cue) => {
        cue.duration = { seconds: 0.1 };
      }),
      compileEffect((cue) => {
        cue.duration = { frame: 0 };
      }),
      compileEffect((cue) => {
        cue.start = { seconds: 6 };
        cue.duration = { frame: 1 };
      }),
      compileEffect((cue) => {
        cue.intensity = -0.1;
      }),
      compileEffect((cue) => {
        cue.intensity = 1.1;
      }),
    ];
    const orderedEffects = baseEdit();
    orderedEffects.tracks.effects.push(
      {
        id: "later-effect",
        recipe: "world-zone",
        zone: "signal-smoke",
        start: { frame: 2 },
        duration: { frame: 1 },
        intensity: 0.5,
      },
      {
        id: "earlier-effect",
        recipe: "world-zone",
        zone: "signal-smoke",
        start: { frame: 1 },
        duration: { frame: 1 },
        intensity: 0.5,
      },
    );
    writeEditSource(fixture.root, filmPath, orderedEffects);
    effectFailures.push(compiler.compile({ scope: "source" }));
    TestValidator.predicate(
      "every effect time, duration, intensity and ordering boundary is refused",
      effectFailures.every((output) =>
        diagnosticCodes(output).has(
          output.diagnostics.some(
            (diagnostic) => diagnostic.code === "film-time-off-grid",
          )
            ? "film-time-off-grid"
            : "film-effect-cue-invalid",
        ),
      ),
    );
    project.setWorldDesign(fixtureWorldDesign());

    fs.writeFileSync(filmPath, "export const wrong = {};\n");
    TestValidator.predicate(
      "missing named film export is diagnosed",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-export-missing",
      ),
    );
    fs.writeFileSync(
      filmPath,
      "export const film = { async build() { return {}; } };\n",
    );
    TestValidator.predicate(
      "async film source is forbidden",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-capability-forbidden",
      ),
    );
    fs.writeFileSync(
      filmPath,
      "export const film = { build() { return { id: 'fixture-film' }; } };\n",
    );
    TestValidator.predicate(
      "film output schema is exact",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-export-invalid",
      ),
    );
    fs.rmSync(filmPath);
    TestValidator.predicate(
      "missing film source is a source-owned refusal",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-path-missing",
      ),
    );
    fs.writeFileSync(filmPath, originalSource);
    const outsideFilmRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-film-source-outside-"),
    );
    let filmSourceFixtureFailure: IFilmSourceFixtureFailure | undefined;
    try {
      const outsideFilm = path.join(outsideFilmRoot, "film.ts");
      fs.writeFileSync(outsideFilm, originalSource);
      fs.rmSync(filmPath);
      fs.symlinkSync(outsideFilm, filmPath);
      TestValidator.predicate(
        "film source cannot escape its declared source root through a symlink",
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          "source-path-outside-root",
        ),
      );
    } catch (error) {
      filmSourceFixtureFailure = { error };
      throw error;
    } finally {
      preserveFilmSourceFixtureCleanup(filmSourceFixtureFailure, [
        {
          resource: "resident film source",
          cleanup: (): void => {
            fs.rmSync(filmPath, { force: true });
            fs.writeFileSync(filmPath, originalSource);
          },
        },
        {
          resource: "outside film-source root",
          cleanup: () =>
            fs.rmSync(outsideFilmRoot, { force: true, recursive: true }),
        },
      ]);
    }

    const answer = JSON.parse(
      fs.readFileSync(
        path.join(
          scaffoldAssetDirectory(),
          ".automovie/design/shots/answer.json",
        ),
        "utf8",
      ),
    ) as IAutoMovieShotContract;
    project.setProductionDesign(
      productionDesign({ targetRuntimeSeconds: 11.5 }),
    );
    setProductionFixtureShotContract(project, answer);
    project.setAcceptanceScenario({
      id: "film-runtime",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: "==",
        value: 11.5,
      },
      required: true,
    });
    project.setAcceptanceScenario({
      id: "film-opening-event",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "event",
        shot: "opening",
        event: "signal-raised",
        expectation:
          "The actual compiled signal sample remains inside the finished edit.",
      },
      required: true,
    });
    writeEditSource(fixture.root, filmPath, twoShotEdit());
    const twoShot = compiler.compile({ scope: "source" });
    const twoShotSucceeded = productionCompileSucceeded(
      "two-shot film timeline",
      twoShot,
    );
    const twoShotTimeline = JSON.parse(
      fs.readFileSync(timelinePath, "utf8"),
    ) as IAutoMovieFilmTimeline;
    const overlapFrame = new AutoMovieProductionOracleService(project).query({
      request: { query: "film-time", at: { frame: 132 } },
    });
    TestValidator.equals(
      "cut, dissolve and fade law materializes an overlap without changing total frames",
      namedFacts([
        ["twoShotSucceeded", () => twoShotSucceeded],
        [
          "twoShotTimelineTotalFrames",
          () => twoShotSucceeded && twoShotTimeline.totalFrames === 276,
        ],
        [
          "twoShotTimelineSegments0",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut",
        ],
        [
          "twoShotTimelineSegments02",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
            twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve",
        ],
        [
          "twoShotTimelineSegments1",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
            twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve",
        ],
        [
          "twoShotTimelineSegments12",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
            twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionOut.kind === "fade",
        ],
        [
          "twoShotTimelineSegments13",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
            twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionOut.kind === "fade" &&
            twoShotTimeline.segments[1]?.startFrame === 132,
        ],
        [
          "twoShotTimelineTracksAudio",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
            twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionOut.kind === "fade" &&
            twoShotTimeline.segments[1]?.startFrame === 132 &&
            twoShotTimeline.tracks.audio.length === 1,
        ],
        [
          "twoShotTimelineTracksCaptions",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
            twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionOut.kind === "fade" &&
            twoShotTimeline.segments[1]?.startFrame === 132 &&
            twoShotTimeline.tracks.audio.length === 1 &&
            twoShotTimeline.tracks.captions.length === 1,
        ],
        [
          "overlapFrameResultKind",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
            twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionOut.kind === "fade" &&
            twoShotTimeline.segments[1]?.startFrame === 132 &&
            twoShotTimeline.tracks.audio.length === 1 &&
            twoShotTimeline.tracks.captions.length === 1 &&
            overlapFrame.result?.kind === "measurement",
        ],
        [
          "overlapFrameResultValues",
          () =>
            twoShotSucceeded &&
            twoShotTimeline.totalFrames === 276 &&
            twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
            twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve" &&
            twoShotTimeline.segments[1]?.transitionOut.kind === "fade" &&
            twoShotTimeline.segments[1]?.startFrame === 132 &&
            twoShotTimeline.tracks.audio.length === 1 &&
            twoShotTimeline.tracks.captions.length === 1 &&
            overlapFrame.result?.kind === "measurement" &&
            overlapFrame.result.values.shot === "answer",
        ],
      ]),
      {
        twoShotSucceeded: true,
        twoShotTimelineTotalFrames: true,
        twoShotTimelineSegments0: true,
        twoShotTimelineSegments02: true,
        twoShotTimelineSegments1: true,
        twoShotTimelineSegments12: true,
        twoShotTimelineSegments13: true,
        twoShotTimelineTracksAudio: true,
        twoShotTimelineTracksCaptions: true,
        overlapFrameResultKind: true,
        overlapFrameResultValues: true,
      },
    );
    const answerSourcePath = path.join(fixture.root, answer.source.module);
    const answerSourceBytes = fs.readFileSync(answerSourcePath);
    fs.rmSync(answerSourcePath);
    const missingAnswerSource = compiler.compile({ scope: "source" });
    fs.writeFileSync(answerSourcePath, answerSourceBytes);
    TestValidator.predicate(
      "film continuity tolerates one absent compiled realization while source diagnostics retain ownership",
      diagnosticCodes(missingAnswerSource).has("source-path-missing"),
    );
    const filmReview = new AutoMovieProductionReviewService(project).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    TestValidator.equals(
      "film review consumes canonical overlap runtime and exposes film source evidence",
      namedFacts([
        [
          "filmReviewOutcomesSome",
          () =>
            filmReview.outcomes.some(
              (outcome) =>
                outcome.kind === "metric" &&
                outcome.scenario === "film-runtime" &&
                outcome.actual === 11.5 &&
                outcome.passed,
            ),
        ],
        [
          "filmReviewQuotableSome",
          () =>
            filmReview.quotable.some(
              (selector) =>
                selector.kind === "source" && selector.path === "src/film.ts",
            ),
        ],
      ]),
      { filmReviewOutcomesSome: true, filmReviewQuotableSome: true },
    );
    const invalidTwoShotCases: Array<{
      code: string;
      mutate(edit: IAutoMovieFilmEdit): void;
    }> = [
      {
        code: "film-transition-mismatch",
        mutate: (edit) => {
          edit.tracks.video[1]!.transitionIn = { kind: "cut" };
        },
      },
      {
        code: "film-global-order-invalid",
        mutate: (edit) => {
          edit.tracks.video[1]!.start = { seconds: 5 };
        },
      },
      {
        code: "film-transition-handle-missing",
        mutate: (edit) => {
          edit.tracks.video[1]!.handles.head = { frame: 0 };
        },
      },
      {
        code: "film-state-handoff-unverifiable",
        mutate: (edit) => {
          edit.tracks.video[1]!.sourceIn = { frame: 1 };
        },
      },
    ];
    for (const testCase of invalidTwoShotCases) {
      const edit = twoShotEdit();
      testCase.mutate(edit);
      writeEditSource(fixture.root, filmPath, edit);
      TestValidator.predicate(
        `${testCase.code} blocks two-shot publication`,
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          testCase.code,
        ),
      );
    }
    const opening = structuredClone(project.graph().shots.get("opening")!);
    const openingWithoutClosing = structuredClone(opening);
    openingWithoutClosing.closing = [];
    setProductionFixtureShotContract(project, openingWithoutClosing);
    const trimmedOpeningBoundary = twoShotEdit();
    trimmedOpeningBoundary.tracks.video[1]!.sourceIn = { frame: 1 };
    writeEditSource(fixture.root, filmPath, trimmedOpeningBoundary);
    TestValidator.predicate(
      "a trimmed boundary rejects a claimed current opening even without a previous closing claim",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "film-state-handoff-unverifiable",
      ),
    );
    setProductionFixtureShotContract(project, opening);
    const mismatched = structuredClone(answer);
    mismatched.opening[0]!.predicates[0]!.value = 90;
    setProductionFixtureShotContract(project, mismatched);
    writeEditSource(fixture.root, filmPath, twoShotEdit());
    TestValidator.predicate(
      "adjacent compiled opening and closing state predicates must match",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "film-state-handoff-mismatch",
      ),
    );
    setProductionFixtureShotContract(project, answer);
    project.setProductionDesign(productionDesign({ targetRuntimeSeconds: 6 }));
    const omitted = baseEdit();
    omitted.omissions.push({
      shot: "answer",
      reason: "The alternate answer is intentionally excluded.",
    });
    writeEditSource(fixture.root, filmPath, omitted);
    const legalOmission = compiler.compile({ scope: "source" });
    const legalOmissionSucceeded = productionCompileSucceeded(
      "film omission",
      legalOmission,
    );
    const omissionReview = new AutoMovieProductionReviewService(
      project,
    ).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    const currentManifest = project.generatedManifest()!;
    const currentTimelineBytes =
      project.readGeneratedFile("film-timeline.json");
    const validTimeline = parseAutoMovieFilmTimeline({
      manifest: currentManifest,
      fingerprint: legalOmission.compiler.inputFingerprint,
      read: () => currentTimelineBytes,
    });
    const invalidTimelineBytes = Buffer.from("{}");
    const invalidTimelineManifest = structuredClone(currentManifest);
    invalidTimelineManifest.files.find(
      (file) => file.path === "film-timeline.json",
    )!.digest = digestAutoMovieBytes(invalidTimelineBytes);
    const staleTimeline = structuredClone(validTimeline);
    staleTimeline.inputFingerprint =
      `sha256:${"0".repeat(64)}` as typeof staleTimeline.inputFingerprint;
    const staleTimelineBytes = Buffer.from(JSON.stringify(staleTimeline));
    const staleTimelineManifest = structuredClone(currentManifest);
    staleTimelineManifest.files.find(
      (file) => file.path === "film-timeline.json",
    )!.digest = digestAutoMovieBytes(staleTimelineBytes);
    const timelineFilePath = path.join(
      fixture.root,
      "generated/fixture-film/film-timeline.json",
    );
    const generatedManifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/generated-manifest.json",
    );
    const gapTimeline = structuredClone(validTimeline);
    gapTimeline.segments[0]!.startFrame = 1;
    const gapTimelineBytes = Buffer.from(JSON.stringify(gapTimeline));
    const gapManifest = structuredClone(currentManifest);
    gapManifest.files.find(
      (file) => file.path === "film-timeline.json",
    )!.digest = digestAutoMovieBytes(gapTimelineBytes);
    fs.writeFileSync(timelineFilePath, gapTimelineBytes);
    fs.writeFileSync(generatedManifestPath, JSON.stringify(gapManifest));
    const gapFrame = new AutoMovieProductionOracleService(project).query({
      request: {
        query: "film-time",
        at: { frame: 0 },
      },
    });
    fs.writeFileSync(timelineFilePath, invalidTimelineBytes);
    fs.writeFileSync(
      generatedManifestPath,
      JSON.stringify(invalidTimelineManifest),
    );
    const invalidTimelineReviewService = new AutoMovieProductionReviewService(
      project,
      () => legalOmission,
    );
    const invalidTimelineReview = invalidTimelineReviewService.prepare({
      target: { kind: "film", id: validTimeline.id },
    });
    const invalidTimelineSubmission = invalidTimelineReviewService.submit({
      target: { kind: "film", id: validTimeline.id },
      preparedFingerprint: invalidTimelineReview.fingerprint,
      observations: "The current film timeline is invalid.",
      checks: [],
      corrections: [],
      completionBasis: "Timeline validation blocks completion.",
      complete: true,
    });
    const residentReadGenerated = project.readGeneratedFile;
    const nonErrorTimelineReview = (() => {
      project.readGeneratedFile = ((relativePath: string) => {
        if (relativePath === "film-timeline.json") {
          const iterator = (function* (): Generator<void> {
            yield;
          })();
          iterator.next();
          return iterator.throw("non-error timeline read failure") as never;
        }
        return residentReadGenerated.call(project, relativePath);
      }) as typeof project.readGeneratedFile;
      let invalidTimelineFailure: IFilmTimelineFixtureFailure | undefined;
      try {
        return invalidTimelineReviewService.prepare({
          target: { kind: "film", id: validTimeline.id },
        });
      } catch (error) {
        invalidTimelineFailure = { error };
        throw error;
      } finally {
        preserveFilmTimelineFixtureCleanup(invalidTimelineFailure, () => {
          project.readGeneratedFile = residentReadGenerated;
        });
      }
    })();
    fs.writeFileSync(timelineFilePath, currentTimelineBytes);
    fs.writeFileSync(generatedManifestPath, JSON.stringify(currentManifest));
    TestValidator.equals(
      "an explicit current-shot omission controls review evidence and shared timeline validation",
      namedFacts([
        ["legalOmissionSucceeded", () => legalOmissionSucceeded],
        [
          "validTimelineOmissions0",
          () =>
            legalOmissionSucceeded &&
            validTimeline.omissions[0]?.shot === "answer",
        ],
        [
          "gapFrameResult",
          () =>
            legalOmissionSucceeded &&
            validTimeline.omissions[0]?.shot === "answer" &&
            gapFrame.result === null,
        ],
        [
          "gapFrameDiagnostics0",
          () =>
            legalOmissionSucceeded &&
            validTimeline.omissions[0]?.shot === "answer" &&
            gapFrame.result === null &&
            gapFrame.diagnostics[0]?.message.includes(
              "no owning video segment",
            ),
        ],
        [
          "invalidTimelineReviewFramesLength",
          () => invalidTimelineReview.frames.length === 0,
        ],
        [
          "invalidTimelineReviewDiagnosticsSome",
          () =>
            invalidTimelineReview.diagnostics.some(
              (diagnostic) => diagnostic.code === "review-evidence-stale",
            ),
        ],
        [
          "invalidTimelineSubmissionDiagnosticsSome",
          () =>
            invalidTimelineSubmission.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "review-acceptance-coverage-incomplete",
            ),
        ],
        [
          "nonErrorTimelineReviewDiagnosticsSome",
          () =>
            nonErrorTimelineReview.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "review-evidence-stale" &&
                diagnostic.message.includes("non-error timeline read failure"),
            ),
        ],
        [
          "omissionReviewDiagnosticsEvery",
          () =>
            omissionReview.diagnostics.every(
              (diagnostic) =>
                diagnostic.code !== "review-evidence-missing" ||
                diagnostic.target.startsWith("answer:") === false,
            ),
        ],
        [
          "throwsParseAutoMovieFilmTimelineManifest",
          () =>
            throws(() =>
              parseAutoMovieFilmTimeline({
                manifest: null,
                fingerprint: legalOmission.compiler.inputFingerprint,
                read: () => currentTimelineBytes,
              }),
            ),
        ],
        [
          "throwsParseAutoMovieFilmTimelineManifest2",
          () =>
            throws(() =>
              parseAutoMovieFilmTimeline({
                manifest: currentManifest,
                fingerprint: legalOmission.compiler.inputFingerprint,
                read: () => invalidTimelineBytes,
              }),
            ),
        ],
        [
          "throwsParseAutoMovieFilmTimelineManifest3",
          () =>
            throws(() =>
              parseAutoMovieFilmTimeline({
                manifest: invalidTimelineManifest,
                fingerprint: legalOmission.compiler.inputFingerprint,
                read: () => invalidTimelineBytes,
              }),
            ),
        ],
        [
          "throwsParseAutoMovieFilmTimelineManifest4",
          () =>
            throws(() =>
              parseAutoMovieFilmTimeline({
                manifest: staleTimelineManifest,
                fingerprint: legalOmission.compiler.inputFingerprint,
                read: () => staleTimelineBytes,
              }),
            ),
        ],
      ]),
      {
        legalOmissionSucceeded: true,
        validTimelineOmissions0: true,
        gapFrameResult: true,
        gapFrameDiagnostics0: true,
        invalidTimelineReviewFramesLength: true,
        invalidTimelineReviewDiagnosticsSome: true,
        invalidTimelineSubmissionDiagnosticsSome: true,
        nonErrorTimelineReviewDiagnosticsSome: true,
        omissionReviewDiagnosticsEvery: true,
        throwsParseAutoMovieFilmTimelineManifest: true,
        throwsParseAutoMovieFilmTimelineManifest2: true,
        throwsParseAutoMovieFilmTimelineManifest3: true,
        throwsParseAutoMovieFilmTimelineManifest4: true,
      },
    );
    const openingWithBoundaryEvents = structuredClone(
      project.graph().shots.get("opening")!,
    );
    const signalEvent = openingWithBoundaryEvents.events[0]!;
    openingWithBoundaryEvents.events.push(
      {
        ...structuredClone(signalEvent),
        id: "source-in-boundary",
        window: { from: 2, to: 4 },
      },
      {
        ...structuredClone(signalEvent),
        id: "source-out-boundary",
        window: { from: 4, to: 6 },
      },
    );
    setProductionFixtureShotContract(project, openingWithBoundaryEvents);
    project.setProductionDesign(productionDesign({ targetRuntimeSeconds: 2 }));
    project.setAcceptanceScenario({
      id: "film-runtime",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "metric",
        metric: "runtime-seconds",
        operator: "==",
        value: 2,
      },
      required: true,
    });
    project.setAcceptanceScenario({
      id: "film-source-in-event",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "event",
        shot: "opening",
        event: "source-in-boundary",
        expectation: "An event exactly on sourceIn belongs to the film.",
      },
      required: true,
    });
    project.setAcceptanceScenario({
      id: "film-source-out-event",
      target: { kind: "film", id: "fixture-film" },
      criterion: {
        kind: "event",
        shot: "opening",
        event: "source-out-boundary",
        expectation: "An event exactly on sourceOut is outside the film.",
      },
      required: true,
    });
    const trimmed = baseEdit();
    trimmed.tracks.video[0]!.sourceIn = { seconds: 3 };
    trimmed.tracks.video[0]!.sourceOut = { seconds: 5 };
    trimmed.omissions.push({
      shot: "answer",
      reason: "The alternate answer remains excluded from the shorter cut.",
    });
    writeEditSource(fixture.root, filmPath, trimmed);
    const legalTrim = compiler.compile({ scope: "source" });
    const legalTrimSucceeded = productionCompileSucceeded(
      "film trim",
      legalTrim,
    );
    const trimTimeline = JSON.parse(
      fs.readFileSync(timelinePath, "utf8"),
    ) as IAutoMovieFilmTimeline;
    const trimSelection = selectAutoMovieFilmReviewFrames(
      trimTimeline.segments[0]!,
      project.graph().shots.get("opening")!,
      trimTimeline.fps,
    );
    const trimReview = new AutoMovieProductionReviewService(project).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    const captureOracle = new AutoMovieProductionOracleService(
      project,
      async () => ({
        bytes: captureBytes(),
        runtimeIdentity: testCaptureRuntimeIdentity(),
        width: 16,
        height: 16,
      }),
    );
    const capturedTrimEntry = await captureOracle.preview({
      target: { kind: "shot", id: "opening" },
      time: 3,
      pass: "beauty",
      width: 16,
      height: 16,
    });
    const completeTrimReview = new AutoMovieProductionReviewService(
      project,
    ).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    const trimWorksheet = filmWorksheet(project, completeTrimReview);
    const trimSubmission = new AutoMovieProductionReviewService(project).submit(
      trimWorksheet,
    );
    const submittedAcceptance = trimWorksheet.checks.find(
      (check) => check.criterion === "acceptance-scenarios",
    )?.acceptanceScenarios;
    TestValidator.equals(
      "a legal trim uses one in-range fallback and submits exact half-open event coverage",
      namedFacts([
        ["legalTrimSucceeded", () => legalTrimSucceeded],
        [
          "trimSelectionLength",
          () => legalTrimSucceeded && trimSelection.length === 1,
        ],
        [
          "trimSelection0Id",
          () =>
            legalTrimSucceeded &&
            trimSelection.length === 1 &&
            trimSelection[0]?.id === "film-segment-entry",
        ],
        [
          "trimSelection0Index",
          () =>
            legalTrimSucceeded &&
            trimSelection.length === 1 &&
            trimSelection[0]?.id === "film-segment-entry" &&
            trimSelection[0]?.index === 72,
        ],
        [
          "trimSelection0Time",
          () =>
            legalTrimSucceeded &&
            trimSelection.length === 1 &&
            trimSelection[0]?.id === "film-segment-entry" &&
            trimSelection[0]?.index === 72 &&
            trimSelection[0]?.time === 3,
        ],
        [
          "trimSelection0Passes",
          () =>
            legalTrimSucceeded &&
            trimSelection.length === 1 &&
            trimSelection[0]?.id === "film-segment-entry" &&
            trimSelection[0]?.index === 72 &&
            trimSelection[0]?.time === 3 &&
            trimSelection[0]?.passes[0] === "beauty",
        ],
        [
          "trimReviewDiagnosticsSome",
          () =>
            legalTrimSucceeded &&
            trimSelection.length === 1 &&
            trimSelection[0]?.id === "film-segment-entry" &&
            trimSelection[0]?.index === 72 &&
            trimSelection[0]?.time === 3 &&
            trimSelection[0]?.passes[0] === "beauty" &&
            trimReview.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "review-evidence-missing" &&
                diagnostic.target === "opening:film-segment-entry:beauty",
            ),
        ],
        [
          "trimReviewDiagnosticsEvery",
          () =>
            trimReview.diagnostics.every(
              (diagnostic) =>
                (diagnostic.code !== "review-evidence-missing" ||
                  diagnostic.target.includes("signal-apex") === false) &&
                (diagnostic.code !== "review-outcome-missing" ||
                  diagnostic.message.includes("film-opening-event") === false),
            ),
        ],
        ["capturedTrimEntryCaptured", () => capturedTrimEntry.captured],
        [
          "completeTrimReviewOutcomesSome",
          () =>
            completeTrimReview.outcomes.some(
              (outcome) => outcome.scenario === "film-source-in-event",
            ),
        ],
        [
          "completeTrimReviewOutcomesEvery",
          () =>
            completeTrimReview.outcomes.every(
              (outcome) =>
                outcome.scenario !== "film-opening-event" &&
                outcome.scenario !== "film-source-out-event",
            ),
        ],
        [
          "submittedAcceptanceJoinFilm",
          () =>
            submittedAcceptance?.join(",") ===
            "film-runtime,film-source-in-event",
        ],
        ["trimSubmissionAccepted", () => trimSubmission.accepted],
        [
          "trimSubmissionStateComplete",
          () => trimSubmission.state === "complete",
        ],
      ]),
      {
        legalTrimSucceeded: true,
        trimSelectionLength: true,
        trimSelection0Id: true,
        trimSelection0Index: true,
        trimSelection0Time: true,
        trimSelection0Passes: true,
        trimReviewDiagnosticsSome: true,
        trimReviewDiagnosticsEvery: true,
        capturedTrimEntryCaptured: true,
        completeTrimReviewOutcomesSome: true,
        completeTrimReviewOutcomesEvery: true,
        submittedAcceptanceJoinFilm: true,
        trimSubmissionAccepted: true,
        trimSubmissionStateComplete: true,
      },
    );
    const realizationPath = path.join(
      fixture.root,
      "generated/fixture-film/realizations/opening.json",
    );
    const realizationBytes = fs.readFileSync(realizationPath);
    const realization = JSON.parse(realizationBytes.toString("utf8")) as {
      events: Array<{ id: string }>;
    };
    const corruptions: Array<{ name: string; bytes: Uint8Array }> = [
      {
        name: "valid realization missing the event",
        bytes: Buffer.from(
          JSON.stringify({
            ...realization,
            events: realization.events.filter(
              (event) => event.id !== "source-in-boundary",
            ),
          }),
        ),
      },
      { name: "schema-invalid realization", bytes: Buffer.from("{}") },
      { name: "malformed realization", bytes: Buffer.from("{") },
    ];
    for (const corruption of corruptions) {
      fs.writeFileSync(realizationPath, corruption.bytes);
      const corruptReviewService = new AutoMovieProductionReviewService(
        project,
      );
      const refused = corruptReviewService.prepare({
        target: { kind: "film", id: "fixture-film" },
      });
      const corruptWorksheet: IAutoMovieSubmitReviewInput = {
        ...trimWorksheet,
        preparedFingerprint: refused.fingerprint,
        checks: trimWorksheet.checks.map((check) =>
          check.criterion !== "acceptance-scenarios"
            ? check
            : {
                ...check,
                acceptanceScenarios: check.acceptanceScenarios?.filter(
                  (scenario) => scenario !== "film-source-in-event",
                ),
                evidence: check.evidence.filter(
                  (evidence) =>
                    !(
                      (evidence.kind === "acceptance" ||
                        evidence.kind === "outcome") &&
                      evidence.scenario === "film-source-in-event"
                    ),
                ),
              },
        ),
      };
      const corruptSubmission = corruptReviewService.submit(corruptWorksheet);
      TestValidator.equals(
        `${corruption.name} retains required event coverage and refuses review`,
        {
          // Coverage is retained either way: the required scenario is settled
          // as an outcome, or it is reported as one the corrupted realization
          // can no longer settle. What must never happen is the third thing --
          // the scenario quietly leaving the required set, which is what makes
          // a submission that omits it look complete.
          retainsRequiredCoverage:
            refused.outcomes.some(
              (outcome) => outcome.scenario === "film-source-in-event",
            ) ||
            refused.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "review-outcome-missing" &&
                diagnostic.message.includes("film-source-in-event"),
            ),
          namesEveryRequiredScenario: ["film-runtime", "film-source-in-event"]
            .filter((scenario) =>
              refused.diagnostics.some(
                (diagnostic) =>
                  diagnostic.code === "review-outcome-missing" &&
                  diagnostic.message.includes(scenario),
              ),
            )
            .sort(compareCodeUnits),
          accepted: corruptSubmission.accepted,
          reportsIncompleteCoverage: corruptSubmission.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "review-acceptance-coverage-incomplete" &&
              diagnostic.message.includes("film-source-in-event"),
          ),
        },
        {
          retainsRequiredCoverage: true,
          namesEveryRequiredScenario: ["film-runtime", "film-source-in-event"],
          accepted: false,
          reportsIncompleteCoverage: true,
        },
      );
    }
    fs.writeFileSync(realizationPath, realizationBytes);
  } catch (error) {
    filmTimelineFailure = { error };
    throw error;
  } finally {
    preserveFilmTimelineFixtureCleanup(filmTimelineFailure, () =>
      fixture.dispose(),
    );
  }
};

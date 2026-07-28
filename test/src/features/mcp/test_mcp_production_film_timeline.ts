import { scaffoldAssetDirectory } from "@automovie/cli";
import {
  IAutoMovieFilmEdit,
  IAutoMovieFilmTimeline,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionOracleService,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  productionDesign,
  productionFixture,
  shotContract,
} from "./productionFixtures";

const editSource = (edit: unknown): string =>
  `export const film = { build() { return ${JSON.stringify(edit)}; } };\n`;

const diagnosticCodes = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): Set<string> => new Set(output.diagnostics.map((item) => item.code));

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
export const test_mcp_production_film_timeline = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    const filmPath = path.join(fixture.root, "src/film.ts");
    const originalSource = fs.readFileSync(filmPath);
    const first = compiler.compile({ scope: "source" });
    const timelinePath = path.join(
      fixture.root,
      "generated/film-timeline.json",
    );
    const editPath = path.join(
      fixture.root,
      "generated/contracts/film-edit.json",
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
    TestValidator.predicate(
      "valid film materializes deterministic edit and timeline bytes",
      first.success &&
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
        reopened.success &&
        reopened.compiler.inputFingerprint ===
          first.compiler.inputFingerprint &&
        reopened.materialized.every((file) => file.status === "unchanged") &&
        fs.readFileSync(timelinePath).equals(firstTimelineBytes) &&
        fs.statSync(timelinePath).mtimeMs === firstTimelineMtime &&
        fs.readFileSync(filmPath).equals(originalSource),
    );

    const compileEdit = (
      mutate: (edit: IAutoMovieFilmEdit) => void,
    ): ReturnType<AutoMovieProductionCompiler["compile"]> => {
      const edit = baseEdit();
      mutate(edit);
      fs.writeFileSync(filmPath, editSource(edit));
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
        name: "runtime",
        code: "film-runtime-mismatch",
        mutate: (edit) => {
          edit.tracks.video[0]!.sourceOut = { seconds: 5 };
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
    ];
    for (const testCase of cases) {
      const output = compileEdit(testCase.mutate);
      TestValidator.predicate(
        `${testCase.name} is refused without publishing a partial film`,
        output.success === false &&
          diagnosticCodes(output).has(testCase.code) &&
          fs.readFileSync(timelinePath).equals(firstTimelineBytes),
      );
    }

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
    project.setShotContract(answer);
    fs.writeFileSync(filmPath, editSource(twoShotEdit()));
    const twoShot = compiler.compile({ scope: "source" });
    const twoShotTimeline = JSON.parse(
      fs.readFileSync(timelinePath, "utf8"),
    ) as IAutoMovieFilmTimeline;
    TestValidator.predicate(
      "cut, dissolve and fade law materializes an overlap without changing total frames",
      twoShot.success &&
        twoShotTimeline.totalFrames === 276 &&
        twoShotTimeline.segments[0]?.transitionIn.kind === "cut" &&
        twoShotTimeline.segments[0]?.transitionOut.kind === "dissolve" &&
        twoShotTimeline.segments[1]?.transitionIn.kind === "dissolve" &&
        twoShotTimeline.segments[1]?.transitionOut.kind === "fade" &&
        twoShotTimeline.segments[1]?.startFrame === 132 &&
        twoShotTimeline.tracks.audio.length === 1 &&
        twoShotTimeline.tracks.captions.length === 1 &&
        new AutoMovieProductionOracleService(project).query({
          request: { query: "film-time", at: { frame: 132 } },
        }).result?.kind === "measurement" &&
        new AutoMovieProductionOracleService(project).query({
          request: { query: "film-time", at: { frame: 132 } },
        }).result?.values.shot === "answer",
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
      fs.writeFileSync(filmPath, editSource(edit));
      TestValidator.predicate(
        `${testCase.code} blocks two-shot publication`,
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          testCase.code,
        ),
      );
    }
    const mismatched = structuredClone(answer);
    mismatched.opening[0]!.predicates[0]!.value = 90;
    project.setShotContract(mismatched);
    fs.writeFileSync(filmPath, editSource(twoShotEdit()));
    TestValidator.predicate(
      "adjacent compiled opening and closing state predicates must match",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "film-state-handoff-mismatch",
      ),
    );
    project.setShotContract(answer);
    project.setProductionDesign(productionDesign({ targetRuntimeSeconds: 6 }));
    const omitted = baseEdit();
    omitted.omissions.push({
      shot: "answer",
      reason: "The alternate answer is intentionally excluded.",
    });
    fs.writeFileSync(filmPath, editSource(omitted));
    const legalOmission = compiler.compile({ scope: "source" });
    TestValidator.predicate(
      "an explicit current-shot omission satisfies narrative accounting",
      legalOmission.success &&
        (
          JSON.parse(
            fs.readFileSync(timelinePath, "utf8"),
          ) as IAutoMovieFilmTimeline
        ).omissions[0]?.shot === "answer",
    );
  } finally {
    fixture.dispose();
  }
};

import {
  IAutoMovieCaptionReadabilityProfile,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import {
  AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION,
  compileAutoMovieProduction,
  inspectAutoMovieCaptionReadability,
  inspectAutoMovieProduction,
  openAutoMovieProduction,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  rewriteSource,
} from "./productionFixtures";

const boundary = (value: number, inclusive = true) => ({
  value,
  inclusive,
});

const profile = (
  language: string,
  props?: {
    inclusive?: boolean;
    segmentation?: { algorithm: string; version: string };
  },
): IAutoMovieCaptionReadabilityProfile => ({
  id: `readability-${language}`,
  version: 1,
  language,
  segmentation: props?.segmentation ?? AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION,
  maxGraphemesPerSecond: boundary(2, props?.inclusive ?? true),
  maxLinesPerCue: boundary(2, props?.inclusive ?? true),
  maxGraphemesPerLine: boundary(2, props?.inclusive ?? true),
  minDurationFrames: boundary(12, props?.inclusive ?? true),
  minGapFrames: boundary(2, props?.inclusive ?? true),
});

const timeline = (): IAutoMovieFilmTimeline => ({
  version: 1,
  compiler: "caption-readability-test",
  inputFingerprint: "sha256:caption-readability-test",
  sourceDigest: "sha256:caption-readability-source",
  id: "caption-readability-test",
  fps: 24,
  totalFrames: 120,
  segments: [],
  omissions: [],
  tracks: {
    audio: [],
    effects: [],
    captions: [
      {
        id: "inclusive-equality",
        text: "A",
        language: "en",
        startFrame: 0,
        endFrame: 12,
      },
      {
        id: "all-breaches",
        text: "漢字語\n字幕列\n長文",
        language: "en",
        startFrame: 13,
        endFrame: 24,
      },
      {
        id: "authored-empty-line",
        text: "\nZ",
        language: "en",
        startFrame: 26,
        endFrame: 38,
      },
      {
        id: "measure-only",
        text: "e\u0301🙂",
        language: "fr",
        startFrame: 40,
        endFrame: 52,
      },
      {
        id: "unsupported-segmentation",
        text: "X",
        language: "zz",
        startFrame: 54,
        endFrame: 66,
      },
      {
        id: "exclusive-first",
        text: "A",
        language: "ex",
        startFrame: 68,
        endFrame: 80,
      },
      {
        id: "exclusive-gap",
        text: "B",
        language: "ex",
        startFrame: 82,
        endFrame: 94,
      },
    ],
  },
});

/** Inspection reports measurements without inventing thresholds or content. */
export const test_mcp_production_caption_readability_inspection = (): void => {
  const report = inspectAutoMovieCaptionReadability(timeline(), [
    profile("en"),
    profile("zz", {
      segmentation: { algorithm: "unavailable", version: "1" },
    }),
    {
      ...profile("ex", { inclusive: false }),
      maxLinesPerCue: boundary(1, false),
      maxGraphemesPerLine: boundary(1, false),
    },
  ]);
  const cue = (id: string) =>
    report.cues.find((entry) => entry.measurement.cue === id)!;

  TestValidator.equals(
    "inclusive boundaries pass while every exceeded dimension is named",
    namedFacts([
      [
        "inclusiveEquality",
        () => {
          const outcome = cue("inclusive-equality").outcome;
          return outcome.status === "evaluated" && outcome.passed;
        },
      ],
      [
        "allBreaches",
        () => {
          const outcome = cue("all-breaches").outcome;
          return (
            outcome.status === "evaluated" &&
            outcome.breaches.join(",") ===
              "graphemes-per-second,lines-per-cue,graphemes-per-line,duration-frames,gap-frames"
          );
        },
      ],
      [
        "emptyLineMeasured",
        () =>
          cue("authored-empty-line").measurement.lines === 2 &&
          cue("authored-empty-line").measurement.graphemes === 1 &&
          cue("authored-empty-line").measurement.maxLineGraphemes === 1,
      ],
      [
        "combinedGraphemes",
        () => cue("measure-only").measurement.graphemes === 2,
      ],
    ]),
    {
      inclusiveEquality: true,
      allBreaches: true,
      emptyLineMeasured: true,
      combinedGraphemes: true,
    },
  );

  TestValidator.equals(
    "missing and unsupported profiles never become a verdict",
    {
      missing: cue("measure-only").outcome,
      unsupported: cue("unsupported-segmentation").outcome,
    },
    {
      missing: {
        status: "not-run",
        segmentation: null,
        reason: "caption-readability-profile-not-declared",
      },
      unsupported: {
        status: "not-run",
        segmentation: { algorithm: "unavailable", version: "1" },
        reason: "caption-grapheme-segmentation-unsupported",
      },
    },
  );
  TestValidator.equals(
    "exclusive equality fails every applicable boundary",
    {
      first: cue("exclusive-first").outcome,
      second: cue("exclusive-gap").outcome,
    },
    {
      first: {
        status: "evaluated",
        profile: "readability-ex",
        segmentation: AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION,
        passed: false,
        breaches: [
          "graphemes-per-second",
          "lines-per-cue",
          "graphemes-per-line",
          "duration-frames",
        ],
      },
      second: {
        status: "evaluated",
        profile: "readability-ex",
        segmentation: AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION,
        passed: false,
        breaches: [
          "graphemes-per-second",
          "lines-per-cue",
          "graphemes-per-line",
          "duration-frames",
          "gap-frames",
        ],
      },
    },
  );
};

/** Public inspection reads only the current generated film timeline. */
export const test_mcp_production_caption_readability_inspection_delivery =
  (): void => {
    const fixture = productionFixture();
    try {
      TestValidator.equals(
        "uncompiled production has no caption inspection artifact",
        inspectAutoMovieProduction(
          openAutoMovieProduction({
            projectRoot: fixture.root,
            productionId: "fixture-film",
          }),
        ).captionReadability,
        { version: 1, cues: [] },
      );
      const filmPath = path.join(fixture.root, "src/film.ts");
      fs.writeFileSync(
        filmPath,
        rewriteSource(
          fs.readFileSync(filmPath, "utf8"),
          "captions: [],",
          `captions: [{
          id: "inspection-caption",
          text: "e\\u0301🙂",
          language: "en",
          start: { frame: 0 },
          end: { frame: 12 },
        }],`,
        ),
      );
      const compile = compileAutoMovieProduction({
        projectRoot: fixture.root,
        productionId: "fixture-film",
        scope: "source",
      });
      if (
        productionCompileSucceeded(
          "caption readability inspection",
          compile,
        ) === false
      )
        throw new Error("Caption readability fixture did not compile.");
      const timelinePath = path.join(
        fixture.root,
        "generated/fixture-film/film-timeline.json",
      );
      const editPath = path.join(
        fixture.root,
        "generated/fixture-film/contracts/film-edit.json",
      );
      const timelineBytes = fs.readFileSync(timelinePath);
      const editBytes = fs.readFileSync(editPath);
      const inspection = inspectAutoMovieProduction(
        openAutoMovieProduction({
          projectRoot: fixture.root,
          productionId: "fixture-film",
        }),
      );
      const delivered = inspection.captionReadability.cues[0]!;

      TestValidator.equals(
        "public inspection delivers measure-only facts without changing compiled film bytes",
        namedFacts([
          [
            "measureOnly",
            () =>
              delivered.measurement.cue === "inspection-caption" &&
              delivered.measurement.graphemes === 2 &&
              delivered.measurement.durationFrames === 12 &&
              delivered.outcome.status === "not-run",
          ],
          [
            "timelineUnchanged",
            () => fs.readFileSync(timelinePath).equals(timelineBytes),
          ],
          ["editUnchanged", () => fs.readFileSync(editPath).equals(editBytes)],
        ]),
        { measureOnly: true, timelineUnchanged: true, editUnchanged: true },
      );
    } finally {
      fixture.dispose();
    }
  };

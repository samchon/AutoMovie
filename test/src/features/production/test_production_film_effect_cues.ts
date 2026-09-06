import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  completedProductionFixture,
  rewriteSource,
} from "./productionFixtures";

/** One film-owned effect cue on the fixture's plaza haze zone. */
const filmCue = (start: string, duration: string): string =>
  [
    "        effects: [",
    "          {",
    '            id: "film-haze",',
    '            recipe: "world-zone",',
    '            zone: "plaza-haze",',
    `            start: ${start},`,
    `            duration: ${duration},`,
    "            intensity: 0.5,",
    "          },",
    "        ],",
  ].join("\n");

/**
 * Film-owned effect cues are placed on the exact rational frame grid and may
 * not overlap a zone a shot cue already owns on the frames it owns.
 *
 * The completed fixture's opening shot activates the plaza haze zone for its
 * whole duration, so a film cue on that zone is refused while the shot plays
 * and accepted once the shot has ended.
 *
 * Scenarios:
 *
 * 1. A film cue inside the opening shot's activation is refused as an owner
 *    conflict; the same cue after the shot ends is accepted and published.
 * 2. A cue start that sits off the production frame grid is refused by name.
 * 3. A caption cue whose speaker is blank is refused by name.
 * 4. Shot cue seconds are projected onto film frames by the half-open rational
 *    boundary: a shot cue ending at 0.3 seconds at 24 fps owns frame 7, so a
 *    film cue on frame 7 conflicts and one on frame 8 does not, where the
 *    rounded float product would have freed frame 7.
 */
export const test_production_film_effect_cues = (): void => {
  const fixture = completedProductionFixture();
  try {
    const filmPath = path.join(fixture.root, "src", "film.ts");
    const shotPath = path.join(fixture.root, "src", "shots", "opening.ts");
    const authoredFilm = fs.readFileSync(filmPath, "utf8");
    const authoredShot = fs.readFileSync(shotPath, "utf8");
    const compile = (props: {
      effects?: string;
      captions?: string;
      shotCueEnd?: string;
    }): {
      success: boolean;
      effects: string[];
      grid: string[];
      captions: string[];
    } => {
      let film = authoredFilm;
      if (props.effects !== undefined)
        film = rewriteSource(film, "        effects: [],", props.effects);
      if (props.captions !== undefined)
        film = rewriteSource(
          film,
          '            language: "en",',
          `            language: "en",\n${props.captions}`,
        );
      fs.writeFileSync(filmPath, film, "utf8");
      fs.writeFileSync(
        shotPath,
        props.shotCueEnd === undefined
          ? authoredShot
          : rewriteSource(
              authoredShot,
              '              zone: "plaza-haze",\n              start: 0,\n              end: context.contract.durationSeconds,',
              `              zone: "plaza-haze",\n              start: 0,\n              end: ${props.shotCueEnd},`,
            ),
        "utf8",
      );
      const output = new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
      ).compile({ scope: "source" });
      const messages = (code: string): string[] =>
        output.diagnostics
          .filter((diagnostic) => diagnostic.code === code)
          .map((diagnostic) => diagnostic.message);
      return {
        success: output.success,
        effects: messages("film-effect-cue-invalid"),
        grid: messages("film-time-off-grid"),
        captions: messages("film-caption-cue-invalid"),
      };
    };

    const conflicting = compile({
      effects: filmCue("{ seconds: 1 }", "{ seconds: 1 }"),
    });
    const afterShot = compile({
      effects: filmCue("{ seconds: 8 }", "{ seconds: 1 }"),
    });
    const offGrid = compile({
      effects: filmCue("{ seconds: 8.3 }", "{ seconds: 1 }"),
    });
    const blankSpeaker = compile({ captions: '            speaker: "   ",' });
    const frameSeven = compile({
      effects: filmCue("{ frame: 7 }", "{ frame: 1 }"),
      shotCueEnd: "0.3",
    });
    const frameEight = compile({
      effects: filmCue("{ frame: 8 }", "{ frame: 1 }"),
      shotCueEnd: "0.3",
    });
    TestValidator.equals(
      "film effect cues are placed on the exact grid and refused inside a shot-owned zone interval",
      {
        conflicting: {
          refused: conflicting.effects.length === 1,
          namesZone: conflicting.effects[0]?.includes("plaza-haze"),
        },
        afterShot: {
          success: afterShot.success,
          effects: afterShot.effects,
          grid: afterShot.grid,
        },
        offGrid: offGrid.grid.map((message) => message.split(".")[0]),
        blankSpeaker: blankSpeaker.captions.length,
        frameSeven: frameSeven.effects.length,
        frameEight: frameEight.effects.length,
      },
      {
        conflicting: { refused: true, namesZone: true },
        afterShot: { success: true, effects: [], grid: [] },
        offGrid: [
          "film-haze effect start does not resolve to one non-negative safe production frame at 24 fps",
        ],
        blankSpeaker: 1,
        frameSeven: 1,
        frameEight: 0,
      },
    );
  } finally {
    fixture.dispose();
  }
};

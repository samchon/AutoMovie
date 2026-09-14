import {
  type IAutoMovieFilmEffectClock,
  productionFilmFrameForShotTime,
  projectProductionShotEffectFilmIntervals,
} from "@automovie/engine";
import type { IAutoMovieFilmTimelineSegment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { filmEffectRefusal } from "./filmEffectRuntimeFixtures";

const segment = (
  shot: string,
  sourceInFrame: number,
  sourceOutFrame: number,
  startFrame: number,
): IAutoMovieFilmTimelineSegment => ({
  shot,
  sourceInFrame,
  sourceOutFrame,
  startFrame,
  endFrame: startFrame + sourceOutFrame - sourceInFrame,
  headHandleFrames: 0,
  tailHandleFrames: 0,
  transitionIn: { kind: "cut" },
  transitionOut: { kind: "cut" },
});

/**
 * Shot seconds map to film frames by exact rational boundaries, not rounding.
 *
 * A shot cue owns source frame `f` when `start <= f / rate < end`, and a shot
 * review second belongs to the largest frame whose boundary is at or before
 * it. Expectations are that exact rational rule applied by hand. Four inputs
 * are chosen where the float estimate `seconds * rate` lands one ulp on the
 * wrong side of an integer: `0.28 * 25` rounds up past frame 7, `1.16 * 25`
 * rounds down below frame 29, the double above `32 / 24` estimates exactly
 * 32, and the double below `34 / 24` estimates exactly 34.
 *
 * Scenarios:
 *
 * 1. A cue realized by two occurrences of its shot projects once per occurrence
 *    trimmed to each segment; a cue outside its segment's source range and a
 *    shot absent from the compiled set project nothing.
 * 2. The four float-boundary witnesses project to frames 7, 29 and 33 on
 *    their exact boundary, and a cue starting at zero starts at frame zero.
 * 3. A non-finite or negative start, an end not after its start, an infinite
 *    end, and a start beyond any safe-integer frame are refused as input, and
 *    so is a clock whose display rate contradicts its rational rate.
 * 4. A shot second realized exactly once maps to its film frame, including
 *    zero and both float-boundary witnesses; a second realized twice, never,
 *    or on an unknown shot maps to `null`, as do a NaN, negative, infinite, or
 *    unrepresentable second, and the contradictory clock is refused.
 */
export const test_film_effect_shot_frame_projection = (): void => {
  const clock: IAutoMovieFilmEffectClock = {
    fps: 24,
    segments: [
      segment("s1", 0, 48, 0),
      segment("s2", 10, 30, 48),
      segment("s1", 24, 48, 68),
      segment("ghost", 0, 10, 92),
    ],
  };
  const effect = (
    id: string,
    start: number,
    end: number,
    zone = "yard",
  ): { id: string; zone: string; start: number; end: number } => ({
    id,
    zone,
    start,
    end,
  });
  TestValidator.equals(
    "every occurrence is trimmed to its segment",
    projectProductionShotEffectFilmIntervals({
      timeline: clock,
      shots: new Map([
        ["s1", { effects: [effect("c1", 0.5, 1.25)] }],
        [
          "s2",
          { effects: [effect("c2", 0, 0.25, "gate"), effect("c3", 1, 2)] },
        ],
      ]),
    }),
    [
      { cue: "c1", shot: "s1", zone: "yard", startFrame: 12, endFrame: 30 },
      { cue: "c3", shot: "s2", zone: "yard", startFrame: 62, endFrame: 68 },
      { cue: "c1", shot: "s1", zone: "yard", startFrame: 68, endFrame: 74 },
    ],
  );

  const at25: IAutoMovieFilmEffectClock = {
    fps: 25,
    segments: [segment("w", 0, 100, 0)],
  };
  TestValidator.equals(
    "float estimates are corrected onto the exact boundary",
    [
      projectProductionShotEffectFilmIntervals({
        timeline: at25,
        shots: new Map([["w", { effects: [effect("witness", 0.28, 1.16)] }]]),
      }),
      projectProductionShotEffectFilmIntervals({
        timeline: { fps: 24, segments: [segment("w", 0, 100, 0)] },
        shots: new Map([
          [
            "w",
            {
              effects: [
                effect("above", 1.3333333333333335, 1.5),
                effect("zero", 0, 0.125),
              ],
            },
          ],
        ]),
      }),
    ],
    [
      [
        {
          cue: "witness",
          shot: "w",
          zone: "yard",
          startFrame: 7,
          endFrame: 29,
        },
      ],
      [
        { cue: "above", shot: "w", zone: "yard", startFrame: 33, endFrame: 36 },
        { cue: "zero", shot: "w", zone: "yard", startFrame: 0, endFrame: 3 },
      ],
    ],
  );
  TestValidator.equals(
    "an invalid or unrepresentable interval and a contradictory clock are refused",
    [
      effect("nan", Number.NaN, 1),
      effect("negative", -0.5, 1),
      effect("empty", 0.5, 0.5),
      effect("infinite", 0, Number.POSITIVE_INFINITY),
      effect("huge", 1e300, 2e300),
    ]
      .map((item) =>
        filmEffectRefusal(() =>
          projectProductionShotEffectFilmIntervals({
            timeline: clock,
            shots: new Map([["s1", { effects: [item] }]]),
          }),
        ),
      )
      .concat(
        filmEffectRefusal(() =>
          projectProductionShotEffectFilmIntervals({
            timeline: {
              ...clock,
              frameRate: { numerator: 25, denominator: 1 },
            },
            shots: new Map(),
          }),
        ),
      ),
    Array.from({ length: 6 }, () => "film-effect-input-invalid"),
  );

  const frame = (
    shot: string,
    time: number,
    timeline: IAutoMovieFilmEffectClock = clock,
  ): number | null => productionFilmFrameForShotTime({ timeline, shot, time });
  TestValidator.equals(
    "a second realized exactly once maps to its film frame",
    [
      frame("s1", 0.5),
      frame("s1", 0),
      frame("s2", 1),
      frame("w", 1.4166666666666665, {
        fps: 24,
        segments: [segment("w", 0, 100, 0)],
      }),
      frame("w", 1.16, at25),
    ],
    [12, 0, 62, 33, 29],
  );
  TestValidator.equals(
    "a repeated, absent, unknown, or invalid second maps to null",
    [
      frame("s1", 1.5),
      frame("s2", 0.1),
      frame("unknown", 0.5),
      frame("s1", Number.NaN),
      frame("s1", -1),
      frame("s1", Number.POSITIVE_INFINITY),
      frame("s1", 1e300),
    ],
    [null, null, null, null, null, null, null],
  );
  TestValidator.equals(
    "a contradictory clock is refused before any second is mapped",
    filmEffectRefusal(() =>
      frame("s1", 0.5, {
        ...clock,
        frameRate: { numerator: 25, denominator: 1 },
      }),
    ),
    "film-effect-input-invalid",
  );
};

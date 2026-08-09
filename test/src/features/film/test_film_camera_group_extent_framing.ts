import {
  FRAMING_AIM_FRACTION,
  FRAMING_HEIGHT_FRACTION,
  IAutoMovieFramedSubject,
  compileCameraMove,
} from "@automovie/engine";
import { IAutoMovieCamera, IAutoMovieCameraAction } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose } from "../internal/predicates";

/** One figure's height, and the point a `wide` frame aims at on it. */
const HEIGHT = 1.7;
const AIM = HEIGHT * FRAMING_AIM_FRACTION.wide;

/**
 * A 90 degree vertical field of view, so `tan(fovY / 2) = 1` and every distance
 * below is half its visible span. Staged straight back along +Z from the aim
 * point, so the staged bearing is +Z and the solved key's z IS the distance.
 */
const camera = (): IAutoMovieCamera => ({
  id: "cam",
  transform: {
    translation: { x: 0, y: AIM, z: 10 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  fovY: 90,
  near: 0.1,
  far: 10_000,
});

const WIDE: IAutoMovieCameraAction = {
  verb: "frame",
  actor: "cam",
  start: 0,
  duration: "auto",
  framing: "wide",
  move: "static",
  on: { kind: "group", nodes: ["left", "right"] },
};

/** How far back the solve stood the camera from its subject's aim point. */
const framedDistance = (
  subject: IAutoMovieFramedSubject,
  aspect?: number,
): number => {
  const clip = compileCameraMove({
    clipId: "clip",
    camera: camera(),
    entries: [{ action: WIDE, subject }],
    shotDuration: 2,
    aspect,
  });
  return clip === null ? Number.NaN : clip.tracks[0]!.values[2]!;
};

/** One body, standing where a crowd's box would be centred. */
const FIGURE: IAutoMovieFramedSubject = {
  base: { x: 0, y: 0, z: 0 },
  height: HEIGHT,
  at: null,
};

/** The same place, occupied by a mass `radius * 2` meters across. */
const crowd = (radius: number): IAutoMovieFramedSubject => ({
  ...FIGURE,
  radius,
});

/** What the frame must show, as a multiple of the subject's own size. */
const SHOWN = FRAMING_HEIGHT_FRACTION.wide;

/** The vertical fit alone: the whole solve before a subject could be wide. */
const VERTICAL = (HEIGHT * SHOWN) / 2;

/** The horizontal fit for a mass `radius * 2` across, on a frame `aspect` wide. */
const horizontal = (radius: number, aspect = 1): number =>
  (radius * 2 * SHOWN) / 2 / aspect;

/**
 * A camera can frame a crowd: the framing distance is solved from the subject's
 * real extent, not from one figure's height.
 *
 * The defect this pins is that `wide` on two thousand figures used to solve the
 * same distance as `wide` on the one person standing at their centroid, because
 * height was the only dimension the solve could read. A mass is the opposite
 * shape from a body — a hundred meters across and one and a half tall — so the
 * frame has to hold its width, and the camera stands at whichever of the two
 * fits demands the greater distance.
 *
 * The oracle is the arithmetic itself. With `tan(fovY / 2) = 1` the framed
 * distance is half the visible span, `wide` shows four times the subject, so a
 * 1.7 m figure sits at 3.4 m and a 40 m crowd at 80 m on a square frame.
 *
 * Scenarios:
 *
 * 1. One figure is the vertical fit exactly, with or without a raster, and a
 *    subject that states a zero radius is that same figure: the shot that
 *    existed before a subject could be wide is byte-for-byte the shot it is
 *    now.
 * 2. A crowd at that same place frames further back than the figure, at the
 *    distance its width demands.
 * 3. A crowd twice as wide frames twice as far back again, so the solve tracks the
 *    extent rather than merely noticing that one was present.
 * 4. A wider delivery raster brings the same crowd closer, because the frame
 *    itself got wider; a raster that describes nothing (absent, zero) falls
 *    back to the square frame, the widest subject any raster of that height
 *    could fail to hold.
 */
export const test_film_camera_group_extent_framing = (): void => {
  TestValidator.equals(
    "one body is framed from its height alone, exactly as before",
    namedFacts([
      ["figure", () => nclose(framedDistance(FIGURE), VERTICAL)],
      ["rasterIrrelevant", () => nclose(framedDistance(FIGURE, 16 / 9), 3.4)],
      ["zeroRadius", () => nclose(framedDistance(crowd(0)), VERTICAL)],
    ]),
    { figure: true, rasterIrrelevant: true, zeroRadius: true },
  );

  TestValidator.equals(
    "a crowd is framed from the width of the crowd",
    namedFacts([
      ["furtherThanTheFigure", () => framedDistance(crowd(20)) > VERTICAL],
      ["oracle", () => nclose(framedDistance(crowd(20)), horizontal(20))],
      ["eighty", () => nclose(framedDistance(crowd(20)), 80)],
    ]),
    { furtherThanTheFigure: true, oracle: true, eighty: true },
  );

  TestValidator.equals(
    "a crowd that grows is framed further back still",
    namedFacts([
      ["grew", () => framedDistance(crowd(40)) > framedDistance(crowd(20))],
      ["oracle", () => nclose(framedDistance(crowd(40)), horizontal(40))],
      ["twiceAsFar", () => nclose(framedDistance(crowd(40)), 160)],
    ]),
    { grew: true, oracle: true, twiceAsFar: true },
  );

  TestValidator.equals(
    "the delivery raster is the horizontal half of the fit",
    namedFacts([
      [
        "wideRasterComesCloser",
        () => framedDistance(crowd(20), 16 / 9) < framedDistance(crowd(20)),
      ],
      [
        "wideRasterOracle",
        () => nclose(framedDistance(crowd(20), 16 / 9), horizontal(20, 16 / 9)),
      ],
      [
        "stillFurtherThanTheFigure",
        () => framedDistance(crowd(20), 16 / 9) > VERTICAL,
      ],
      [
        "noRasterIsSquare",
        () => nclose(framedDistance(crowd(20), 0), framedDistance(crowd(20))),
      ],
    ]),
    {
      wideRasterComesCloser: true,
      wideRasterOracle: true,
      stillFurtherThanTheFigure: true,
      noRasterIsSquare: true,
    },
  );
};

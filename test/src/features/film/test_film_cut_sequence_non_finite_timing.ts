import { cutSequence } from "@automovie/engine";
import {
  IAutoMovieAssembleApplication,
  IAutoMovieShot,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const SHOT: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene-duel",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 3,
};

const run = (props: {
  fps?: number;
  entries?: IAutoMovieAssembleApplication.IEntry[];
}) =>
  cutSequence(
    {
      type: "write",
      sequence: { id: "seq-finite", name: "finite timing" },
      fps: props.fps ?? 24,
      entries: props.entries ?? [
        { shot: "shot:beat-1", trim: null, transition: null },
      ],
      pacing: "n/a",
      continuity: "n/a",
    },
    [SHOT],
  );

const hasFiniteViolation = (
  cut: ReturnType<typeof run>,
  path: string,
): boolean =>
  cut.success === false &&
  hasViolation(cut, "range", path) &&
  cut.violations.some(
    (v) =>
      v.kind === "range" &&
      v.path.includes(path) &&
      v.expected.includes("finite"),
  );

/**
 * Pins non-finite timing gates in the ASSEMBLE consumer before they feed
 * runtime arithmetic or sequence emission.
 *
 * Scenarios:
 *
 * 1. `fps: Infinity` yields `range` on `$input.fps`.
 * 2. `trim.start: NaN` yields `range` on `.trim.start`.
 * 3. `trim.duration: Infinity` yields `range` on `.trim.duration`.
 * 4. `transition.duration: Infinity` yields `range` on `.transition.duration`.
 */
export const test_film_cut_sequence_non_finite_timing = (): void => {
  const infiniteFps = run({ fps: Number.POSITIVE_INFINITY });
  TestValidator.equals("infinite fps fails", infiniteFps.success, false);
  TestValidator.predicate(
    "infinite fps rejected",
    hasFiniteViolation(infiniteFps, "$input.fps"),
  );

  const nanTrimStart = run({
    entries: [
      {
        shot: "shot:beat-1",
        trim: { start: Number.NaN, duration: 1 },
        transition: null,
      },
    ],
  });
  TestValidator.equals(
    "non-finite trim start fails",
    nanTrimStart.success,
    false,
  );
  TestValidator.predicate(
    "non-finite trim start rejected",
    hasFiniteViolation(nanTrimStart, "$input.entries[0].trim.start"),
  );

  const infiniteTrimDuration = run({
    entries: [
      {
        shot: "shot:beat-1",
        trim: { start: 0, duration: Number.POSITIVE_INFINITY },
        transition: null,
      },
    ],
  });
  TestValidator.equals(
    "non-finite trim duration fails",
    infiniteTrimDuration.success,
    false,
  );
  TestValidator.predicate(
    "non-finite trim duration rejected",
    hasFiniteViolation(infiniteTrimDuration, "$input.entries[0].trim.duration"),
  );

  const infiniteTransitionDuration = run({
    entries: [
      { shot: "shot:beat-1", trim: null, transition: null },
      {
        shot: "shot:beat-1",
        trim: null,
        transition: {
          kind: "crossDissolve",
          duration: Number.POSITIVE_INFINITY,
        },
      },
    ],
  });
  TestValidator.equals(
    "non-finite transition duration fails",
    infiniteTransitionDuration.success,
    false,
  );
  TestValidator.predicate(
    "non-finite transition duration rejected",
    hasFiniteViolation(
      infiniteTransitionDuration,
      "$input.entries[1].transition.duration",
    ),
  );
};

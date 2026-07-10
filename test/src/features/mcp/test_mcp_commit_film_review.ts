import {
  IAutoMovieScript,
  IAutoMovieSequence,
  IAutoMovieShot,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpWritableSlate,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();

const script: IAutoMovieScript = {
  logline: "one beat, one cut",
  theme: "editorial accountability",
  cast: [],
  beats: [
    {
      id: "beat-1",
      name: "the beat",
      summary: "the only beat",
      durationHint: 1,
    },
  ],
};

const shot: IAutoMovieShot = {
  id: "shot:beat-1",
  name: null,
  scene: "scene-1",
  camera: "camera",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 1,
};

const slate: IAutoMovieMcpWritableSlate = {
  script,
  scene: {
    id: "scene-1",
    name: null,
    nodes: [],
    cameras: [
      {
        id: "camera",
        transform: IDENTITY_TRANSFORM,
        fovY: 45,
        near: 0.1,
        far: 100,
      },
    ],
    lights: [],
  },
  shots: [shot],
  beatEnds: [],
  notes: [],
  film: null,
};

const film: IAutoMovieSequence = {
  id: "seq-1",
  name: null,
  fps: 24,
  shots: [{ shot: shot.id, trim: null, transition: null }],
};

/**
 * The one irreversible editorial gate demands a pre-commit self-review (#1131):
 * the cut's authoring stage justifies pacing and continuity, but nothing forced
 * the agent to SELF-CHECK the final cut-list against that intent before
 * persisting it — the same evidence discipline every erase/set already carries.
 * `review` is declared BEFORE the film payload because schema-reflected tools
 * present properties in declaration order and the model fills them in that
 * order: reasoning ahead of the artifact it steers is chain-of-thought by
 * construction.
 *
 * Scenarios:
 *
 * 1. A blank review refuses at `$input.review` with the film slice untouched.
 * 2. Negative twin: a reasoned commit persists the identical film.
 */
export const test_mcp_commit_film_review = (): void => {
  // 1. a blank review refuses and persists nothing
  const blank = app.commitFilm({ review: "   ", slate, film });
  TestValidator.equals("a blank review refuses", blank.committed, false);
  TestValidator.predicate(
    "the refusal is located at the review",
    hasViolation(blank.validation, "type", "$input.review"),
  );
  TestValidator.equals(
    "the refused commit leaves the film slice empty",
    blank.slate!.film,
    null,
  );

  // 2. negative twin: the reasoned commit persists the identical film
  const reasoned = app.commitFilm({
    review:
      "one shot plays whole at 24 fps; no trims or transitions to cross-check",
    slate,
    film,
  });
  TestValidator.equals("a reasoned commit persists", reasoned.committed, true);
  TestValidator.equals(
    "the committed film is intact",
    reasoned.slate!.film,
    film,
  );
};

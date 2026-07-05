import { cutSequence } from "@automovie/engine";
import { IAutoMovieShot } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const shot = (id: string, duration: number): IAutoMovieShot => ({
  id,
  name: null,
  scene: "scene-duel",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration,
});

/**
 * Assembly joins entries to built shots by id. Duplicate built shot ids make
 * the selected duration/order ambiguous because a map would silently keep one
 * of them.
 *
 * Scenario: two supplied shots share `shot:beat-1`; the duplicate entry fails
 * at its own source path instead of letting the sequence pick one implicitly.
 */
export const test_film_cut_sequence_duplicate_shot_ids = (): void => {
  const cut = cutSequence(
    {
      type: "write",
      sequence: { id: "seq-duplicate-shot", name: "ambiguous source shots" },
      fps: 24,
      entries: [
        {
          shot: "shot:beat-1",
          trim: { start: 0, duration: 2.5 },
          transition: null,
        },
      ],
      pacing: "n/a",
      continuity: "n/a",
    },
    [shot("shot:beat-1", 1), shot("shot:beat-1", 3)],
  );

  TestValidator.equals("duplicate shot ids fail", cut.success, false);
  TestValidator.predicate(
    "duplicate shot id violation",
    cut.success === false && hasViolation(cut, "type", "$shots[1].id"),
  );
};

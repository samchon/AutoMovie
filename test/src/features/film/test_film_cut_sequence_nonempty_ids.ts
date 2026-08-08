import { cutSequence } from "@automovie/engine";
import { IAutoMovieShot } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation, namedFacts } from "../internal/predicates";

const shot = (id: string): IAutoMovieShot => ({
  id,
  name: null,
  scene: "scene-duel",
  camera: "cam-main",
  cameraMotion: null,
  performances: [],
  objectMotions: [],
  duration: 3,
});

/**
 * Assembly creates the sequence artifact and stores shot references inside it.
 * Blank ids can pass the shot-existence check when a built shot carries the
 * same blank id, but they are not usable stable cut-list references.
 *
 * Scenario: a blank sequence id and a whitespace-only entry shot id fail at
 * their own fields.
 */
export const test_film_cut_sequence_nonempty_ids = (): void => {
  const cut = cutSequence(
    {
      sequence: { id: "", name: "blank sequence" },
      fps: 24,
      entries: [{ shot: " ", trim: null, transition: null }],
      pacing: "n/a",
      continuity: "n/a",
    },
    [shot(" ")],
  );

  TestValidator.equals("blank cut ids fail", cut.success, false);
  TestValidator.equals(
    "sequence id violation",
    namedFacts([
      ["refused", () => cut.success === false],
      [
        "violated",
        () =>
          cut.success === false &&
          hasViolation(cut, "type", "$input.sequence.id"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "entry shot id violation",
    namedFacts([
      ["refused", () => cut.success === false],
      [
        "violated",
        () =>
          cut.success === false &&
          hasViolation(cut, "type", "$input.entries[0].shot"),
      ],
    ]),
    { refused: true, violated: true },
  );
};

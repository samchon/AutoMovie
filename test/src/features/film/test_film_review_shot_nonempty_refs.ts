import { reviewShot } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

/**
 * `reviewShot()` consumes script and review writes directly. A matching blank
 * beat id can satisfy the script membership and note coherence checks while
 * still returning a review keyed by an unusable beat.
 *
 * Scenario: blank review beat and note beat references fail at their own fields
 * even when the script carries a matching blank beat.
 */
export const test_film_review_shot_nonempty_refs = (): void => {
  const script = makeScriptWrite({
    beats: [
      {
        id: " ",
        name: "blank beat",
        summary: "a beat with an unusable id",
        durationHint: 1,
      },
    ],
  });

  const reviewed = reviewShot(script, {
    beat: " ",
    observations: "the pass is keyed by a blank beat.",
    verdict: "revise",
    notes: [
      {
        beat: " ",
        tier: "structural",
        issue: "the correction target cannot be addressed.",
        suggestion: "name the beat before filing review notes.",
      },
    ],
  });

  TestValidator.equals("blank review refs fail", reviewed.success, false);
  TestValidator.equals(
    "blank review beat violation",
    namedFacts([
      ["refused", () => reviewed.success === false],
      [
        "violated",
        () =>
          reviewed.success === false &&
          hasViolation(reviewed, "type", "$input.beat"),
      ],
    ]),
    { refused: true, violated: true },
  );
  TestValidator.equals(
    "blank note beat violation",
    namedFacts([
      ["refused", () => reviewed.success === false],
      [
        "violated",
        () =>
          reviewed.success === false &&
          hasViolation(reviewed, "type", "$input.notes[0].beat"),
      ],
    ]),
    { refused: true, violated: true },
  );
};

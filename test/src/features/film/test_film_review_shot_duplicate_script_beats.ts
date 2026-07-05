import { reviewShot } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Reviews key the verdict and correction backlog by script beat id. Duplicate
 * script beat ids let one review stand for multiple planned beats, so the
 * ambiguity must be rejected before the next blocking/performance round reads
 * the backlog.
 *
 * Scenario: the script contains two `beat-1` entries while the review otherwise
 * forms a valid pass; review fails at the duplicate script beat source path.
 */
export const test_film_review_shot_duplicate_script_beats = (): void => {
  const baseScript = makeScriptWrite();

  const reviewed = reviewShot(
    makeScriptWrite({
      beats: [
        baseScript.beats[0]!,
        {
          ...baseScript.beats[0]!,
          name: "the duplicate review beat",
          summary: "another planned beat sharing the same review key",
        },
      ],
    }),
    {
      type: "write",
      beat: "beat-1",
      observations: "the pass is keyed by an ambiguous beat.",
      verdict: "pass",
      notes: [],
    },
  );

  TestValidator.equals(
    "duplicate script beat ids fail",
    reviewed.success,
    false,
  );
  TestValidator.predicate(
    "duplicate script beat id violation",
    reviewed.success === false &&
      hasViolation(reviewed, "type", "$script.beats[1].id"),
  );
};

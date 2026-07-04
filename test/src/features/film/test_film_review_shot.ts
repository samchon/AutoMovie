import { reviewShot } from "@automovie/engine";
import { IautomovieReviewNote } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite } from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

const NOTE: IautomovieReviewNote = {
  beat: "beat-1",
  tier: "physical",
  issue: "left foot skates at t=1.2s during the strike",
  suggestion: "anchor the plant foot before the strike's key instant",
};

/**
 * Pins the REVIEW consumer's loop-closing gates: a verdict must leave the
 * re-perform loop something to run on ??a revise carries its backlog, a pass
 * declares it empty, and every note is filed on the beat this review judges.
 *
 * Scenarios:
 *
 * 1. `pass` with no notes ??success, empty backlog.
 * 2. `revise` with one located note ??success carrying the backlog verbatim.
 * 3. `revise` with zero notes ??`type` on `$input.notes` (nothing to fix).
 * 4. `pass` still carrying a note ??`type` on `$input.notes` (contradiction).
 * 5. A note filed on "beat-2" inside a review of "beat-1" ??`type` on
 *    `$input.notes[0].beat`; an unknown beat also reports on `$input.beat`.
 */
export const test_film_review_shot = (): void => {
  const passed = reviewShot(makeScriptWrite(), {
    type: "write",
    beat: "beat-1",
    observations: "the strike lands, the camera catches it, weight reads.",
    verdict: "pass",
    notes: [],
  });
  TestValidator.equals("pass succeeds", passed.success, true);
  if (passed.success === true)
    TestValidator.equals("pass carries no backlog", passed.notes, []);

  const revised = reviewShot(makeScriptWrite(), {
    type: "write",
    beat: "beat-1",
    observations: "the strike connects but the footing slides.",
    verdict: "revise",
    notes: [NOTE],
  });
  TestValidator.equals("revise succeeds", revised.success, true);
  if (revised.success === true)
    TestValidator.equals("revise carries the backlog", revised.notes, [NOTE]);

  const empty = reviewShot(makeScriptWrite(), {
    type: "write",
    beat: "beat-1",
    observations: "something is off.",
    verdict: "revise",
    notes: [],
  });
  TestValidator.predicate(
    "empty revise rejected",
    empty.success === false && hasViolation(empty, "type", "$input.notes"),
  );

  const contradicted = reviewShot(makeScriptWrite(), {
    type: "write",
    beat: "beat-1",
    observations: "fine, mostly.",
    verdict: "pass",
    notes: [NOTE],
  });
  TestValidator.predicate(
    "pass with open notes rejected",
    contradicted.success === false &&
      hasViolation(contradicted, "type", "$input.notes"),
  );

  const misfiled = reviewShot(makeScriptWrite(), {
    type: "write",
    beat: "beat-99",
    observations: "reviewing the wrong reel.",
    verdict: "revise",
    notes: [{ ...NOTE, beat: "beat-2" }],
  });
  TestValidator.predicate(
    "unknown beat and misfiled note rejected",
    misfiled.success === false &&
      hasViolation(misfiled, "type", "$input.beat") &&
      hasViolation(misfiled, "type", "$input.notes[0].beat"),
  );
};

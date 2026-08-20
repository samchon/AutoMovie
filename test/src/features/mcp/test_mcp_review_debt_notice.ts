import type { IAutoMovieDiagnostic } from "@automovie/interface";
import { openAutoMovieProduction } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
} from "./productionFixtures";

const CODE = "review-incomplete";

const owedNotices = (diagnostics: readonly IAutoMovieDiagnostic[]) =>
  diagnostics.filter((diagnostic) => diagnostic.code === CODE);

/**
 * What the review gate says, whichever state each target is in.
 *
 * The gate spells the state into the code — `review-missing`, `review-stale`,
 * `review-revise`, `asset-review-*` — so counting one code would count almost
 * nothing and read as the gate being silent.
 */
const gateReports = (diagnostics: readonly IAutoMovieDiagnostic[]) =>
  diagnostics.filter(
    (diagnostic) =>
      diagnostic.code.startsWith("review-") ||
      diagnostic.code.startsWith("asset-review-"),
  );

/**
 * The compile an author actually runs says how much review is owed.
 *
 * `#2058` measured the failure it answers: an agent finished a production and
 * never called a review tool at all — zero invocations and zero errors, which
 * is a tool never reached rather than one that refused. Five channels already
 * carried the review names, and every one of them sat on a command that is
 * terminal or optional. `compile` at `source` scope is the command that runs
 * dozens of times while the film is being built, and it said nothing.
 *
 * So the notice is not a sixth channel. It is one of the five moved to where
 * the author is, and it is deliberately a single line: the objection the issue
 * raises against per-target reporting is that a source compile carrying dozens
 * of warnings teaches an author to scroll past compile output, which costs more
 * than it buys. The gate at `review` scope is what reports per target, and this
 * must not duplicate it.
 *
 * Scenarios:
 *
 * 1. The starter owes review on more than one target, so a per-target report
 *    here would be the flood the issue argues against.
 * 2. A `source` compile carries exactly one notice however many are owed, and
 *    it is a warning: an incomplete review is the normal state of a film being
 *    built, and this compile does not gate on it.
 * 3. The line names the count and the first owed target, so an author can act
 *    on it without running a second command first.
 * 4. At `review` scope the gate owns the report, and the one-line notice is not
 *    repeated beside it.
 */
export const test_mcp_review_debt_notice = (): void => {
  const fixture = productionFixture();
  try {
    // Built through the product's own wiring: a compiler constructed without
    // the queue provider sees an empty queue and would pass this by measuring
    // nothing.
    const services = openAutoMovieProduction({ projectRoot: fixture.root });
    const source = services.compiler.compile({ scope: "source" });
    const owed = services.review
      .queue(services.compileStatus())
      .entries.filter((entry) => entry.state !== "complete");
    const notices = owedNotices(source.diagnostics);
    const notice = notices[0];
    const reviewed = services.compiler.compile({ scope: "review" }).diagnostics;

    TestValidator.equals(
      "a source compile owns one line of review debt and the gate owns the rest",
      namedFacts([
        ["the starter owes more than one review", () => owed.length > 1],
        [
          "the source compile succeeds",
          () => productionCompileSucceeded("review debt", source),
        ],
        ["and carries exactly one notice", () => notices.length === 1],
        ["which is a warning", () => notice?.category === "warning"],
        // How many are owed is stable across both readings — the starter has
        // submitted no review, so nothing is complete under any snapshot — but
        // which state a given entry is in is not, because the compiler builds
        // its queue with a snapshot this test does not have. So the count is
        // checked against the queue and the target only by shape.
        [
          "naming how many are owed",
          () => notice?.message.includes(`${owed.length} review`) === true,
        ],
        [
          "and the first target it should look at, by kind and state",
          () =>
            /starting with a [a-z]+ target \([a-z]+\)/u.test(
              notice?.message ?? "",
            ),
        ],
        // The gate reports per target. Two reports of one fact is the flood the
        // single line exists to avoid.
        [
          "the review gate reports per target",
          () => gateReports(reviewed).length > 1,
        ],
        [
          "without repeating the one-line notice",
          () =>
            notice !== undefined &&
            reviewed.every((entry) => entry.message !== notice.message),
        ],
      ]),
      {
        "the starter owes more than one review": true,
        "the source compile succeeds": true,
        "and carries exactly one notice": true,
        "which is a warning": true,
        "naming how many are owed": true,
        "and the first target it should look at, by kind and state": true,
        "the review gate reports per target": true,
        "without repeating the one-line notice": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

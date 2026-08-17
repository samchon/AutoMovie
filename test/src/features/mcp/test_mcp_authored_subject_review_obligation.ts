import { openAutoMovieProduction } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionFixture,
  rewriteSource,
} from "./productionFixtures";

/**
 * A prototype this production authored is a review target of its own.
 *
 * The review completeness rules enumerate frames, intervals, and work stages, and
 * an authored thing is in none of those populations, so a production could satisfy
 * every clause while nobody had looked at anything it built. `#1902` is the
 * demonstration and not the hypothesis: an oriel window that was one box, fourteen
 * headless polearms, and half-timber braces at 4.6 degrees all passed compile,
 * lint, module verification, the test suite, and a 24-view capture catalogue,
 * because no obligation existed at the level of an object.
 *
 * The unit is the prototype rather than the placement. One measured production
 * carried 3,474 placings of 192 authored prototypes and 2,392 of those placings
 * were the same slate, so a per-placement obligation would be unusable and a
 * per-prototype one is the work. A design-declared recipe is already an `asset`
 * target and a compiler-owned runtime model is not this production's to answer
 * for, so neither is counted here.
 *
 * When it binds is the other half. A building accumulates prototypes while it is
 * still being massed, so the obligation is reported at `review` scope and refused
 * at `final`: visible while there is still time to act, binding when the thing
 * ships.
 *
 * Scenarios:
 *
 * 1. A shot whose source authors its own models compiles, and the review queue
 *    lists one subject target per authored prototype, addressed through the shot
 *    that carries it.
 * 2. Those targets are missing rather than complete, which is what makes them an
 *    obligation, and the design-declared recipes stay `asset` targets rather than
 *    appearing twice.
 * 3. At `review` scope an unreviewed prototype is a warning, so massing is not
 *    blocked, and at `final` scope the same entry is an error.
 */
export const test_mcp_authored_subject_review_obligation = (): void => {
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(sourcePath, "utf8");
    const withImport = rewriteSource(
      original,
      'import { defineShot } from "@automovie/engine";',
      [
        'import { defineShot } from "@automovie/engine";',
        'import { ExamplePlacementSuite } from "../examples/props";',
      ].join("\n"),
    );
    const withSuite = rewriteSource(
      withImport,
      "  const performer = soloist.render(context, { from: openingAbduction });",
      [
        "  const performer = soloist.render(context, { from: openingAbduction });",
        "  const placement = new ExamplePlacementSuite().design();",
      ].join("\n"),
    );
    const withRecords = rewriteSource(
      withSuite,
      "  return {\n    actors:",
      [
        "  return {",
        "    models: [...(placement.models ?? [])],",
        "    props: [...(placement.props ?? [])],",
        "    builtEnvironments: [...(placement.builtEnvironments ?? [])],",
        "    actors:",
      ].join("\n"),
    );
    fs.writeFileSync(
      sourcePath,
      rewriteSource(
        withRecords,
        "    stage: {\n      scene:",
        "    stage: {\n      set: [...(placement.set ?? [])],\n      scene:",
      ),
      "utf8",
    );

    // Wired the way the product wires it. A compiler built without the queue
    // provider gates against an empty queue, which would pass this case by
    // measuring nothing.
    const services = openAutoMovieProduction({ projectRoot: fixture.root });
    const compiled = services.compiler.compile({ scope: "source" });
    const queue = services.review.queue(services.compileStatus());
    const subjects = queue.entries.filter(
      (entry) => entry.target.kind === "subject",
    );
    const assets = queue.entries.filter(
      (entry) => entry.target.kind === "asset",
    );

    TestValidator.equals(
      "the queue owes a review for every prototype the source authored",
      namedFacts([
        [
          "the fixture compiles",
          () => productionCompileSucceeded("authored subject", compiled),
        ],
        ["the queue lists authored prototypes", () => subjects.length > 0],
        [
          "each one is addressed as a prototype through its own shot",
          () =>
            subjects.every(
              (entry) =>
                entry.target.kind === "subject" &&
                entry.target.subject.startsWith("prototype:") &&
                entry.target.shot.length > 0,
            ),
        ],
        [
          "none of them is already satisfied",
          () => subjects.every((entry) => entry.state === "missing"),
        ],
        [
          "a design recipe stays one asset target and not two",
          () =>
            assets.length > 0 &&
            subjects.some(
              (entry) =>
                entry.target.kind === "subject" &&
                assets.some(
                  (asset) =>
                    asset.target.kind === "asset" &&
                    entry.target.kind === "subject" &&
                    entry.target.subject === `prototype:${asset.target.id}`,
                ),
            ) === false,
        ],
      ]),
      {
        "the fixture compiles": true,
        "the queue lists authored prototypes": true,
        "each one is addressed as a prototype through its own shot": true,
        "none of them is already satisfied": true,
        "a design recipe stays one asset target and not two": true,
      },
    );

    const scoped = (scope: "review" | "final"): string[] => {
      const output = services.compiler.lint({ scope });
      const keys = subjects.map((entry) =>
        entry.target.kind === "subject"
          ? `subject:${entry.target.shot}:${entry.target.subject}`
          : "",
      );
      return [
        ...new Set(
          output.diagnostics
            .filter((diagnostic) =>
              keys.some((key) => diagnostic.target === key),
            )
            .map((diagnostic) => diagnostic.category),
        ),
      ];
    };

    TestValidator.equals(
      "an unreviewed prototype is reported while massing and refused at delivery",
      { review: scoped("review"), final: scoped("final") },
      { review: ["warning"], final: ["error"] },
    );
  } finally {
    fixture.dispose();
  }
};

import type { readAutoMovieProductionEvidence } from "@automovie/evidence";
import type { IAutoMovieLibraryReviewPopulation } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  LIBRARY_OWNER,
  LIBRARY_PLAN,
  libraryAuthoring,
  libraryFixture,
} from "./libraryFixtures";

const command = require(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/library-review.ts",
  ),
) as {
  runLibraryReviewCommand: (props: {
    argv: readonly string[];
    root: string;
    productionId: string;
    evidence: Record<string, never>;
    read: typeof readAutoMovieProductionEvidence;
  }) => IAutoMovieLibraryReviewPopulation;
};

/** The exact owner address every derived refusal and requirement is written at. */
const OWNER = `library:spaces:${LIBRARY_OWNER}`;

/**
 * A materialized building charges its owner the observations it derives.
 *
 * The derivation and the review gate were built and proved before anything fed
 * them, so `environments` was never supplied on the production path and the
 * required population of every real owner was the empty set. This is the end of
 * that: one project on disk, compiled through the ordinary compiler, and the
 * building it published becomes the denominator both the compiler and the
 * shipped offline command charge the same owner.
 *
 * The expected population is the one the envelope derivation was calibrated on:
 * a four-walled hall with one roof, one floor and one door derives twelve
 * exterior observations (setting, four facades, four corners, roof, underside,
 * entrance) and nine interior stations (four centre cardinals, four inward
 * corners, one threshold), twenty-one in all.
 *
 * Scenarios:
 *
 * 1. Before any compile the offline command derives nothing, because nothing has
 *    been published for it to derive from.
 * 2. After a source compile the same command derives all twenty-one, each
 *    addressed to the branch and H2 that owes it.
 * 3. A review-scope compile refuses the owner once per derived observation its
 *    plan neither opens nor waives, at that observation's own address.
 * 4. The exterior and interior roles are the ones the topology produced, and the
 *    interior stations carry the point an eye was proved to stand at.
 * 5. Deleting the published building withdraws the derived population, so the
 *    charge follows the artifact rather than the design document.
 */
export const test_production_library_derived_population = (): void => {
  const fixture = libraryFixture();
  try {
    const project = AutoMovieProductionProject.openReadOnly(fixture.root);
    const inspect = (): IAutoMovieLibraryReviewPopulation =>
      command.runLibraryReviewCommand({
        argv: ["inspect"],
        root: fixture.root,
        productionId: project.productionId,
        evidence: {},
        read: (() =>
          libraryAuthoring({
            root: fixture.root,
          })) as unknown as typeof readAutoMovieProductionEvidence,
      });
    const before = inspect();
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      libraryAuthoring({ root: fixture.root }),
    ).compile({ scope: "source" });
    const after = inspect();
    const reviewed = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(fixture.root),
      libraryAuthoring({ root: fixture.root }),
    ).lint({ scope: "review" });
    // Only the refusals the derivation produced. The plan's own observation is
    // also refused at review, for having no receipt rather than for being
    // unopened, and counting the two together would let a derived observation
    // go missing behind an unrelated refusal.
    const derived = new Set(after.required.map((entry) => entry.id));
    const refusals = reviewed.diagnostics.filter((diagnostic) =>
      [...derived].some((id) => diagnostic.target === `${OWNER}:${id}`),
    );
    const planRefusals = reviewed.diagnostics.filter(
      (diagnostic) => diagnostic.target === `${OWNER}:plan-section-elevation`,
    );

    TestValidator.equals(
      "an owner with no published building derives nothing",
      { required: before.required.length, compiled: compiled.success },
      { required: 0, compiled: true },
    );

    TestValidator.equals(
      "the published building becomes the population both readers charge",
      {
        required: after.required.length,
        refusals: refusals.length,
        branches: [...new Set(after.required.map((entry) => entry.branch))],
        owners: [...new Set(after.required.map((entry) => entry.owner))],
        roles: [...new Set(after.required.map((entry) => entry.role))].sort(
          (left, right) => (left < right ? -1 : left > right ? 1 : 0),
        ),
      },
      {
        required: 21,
        refusals: 21,
        branches: ["spaces"],
        owners: [LIBRARY_OWNER],
        roles: [
          "context",
          "corner",
          "entrance",
          "facade",
          "interior-center",
          "interior-corner",
          "interior-threshold",
          "roof",
          "underside",
        ],
      },
    );

    TestValidator.equals(
      "each derived observation is addressed and refused on its own terms",
      namedFacts([
        [
          "the four exposed facades are each charged once",
          () =>
            after.required.filter((entry) => entry.role === "facade").length ===
            4,
        ],
        [
          "the east elevation is refused at its own address",
          () =>
            refusals.some(
              (diagnostic) =>
                diagnostic.target ===
                  `${OWNER}:building:hall-house/house/facade/wall-east` &&
                diagnostic.code === "review-evidence-missing",
            ),
        ],
        [
          "every interior station carries an eye proved inside its room",
          () =>
            after.required
              .filter((entry) => entry.role.startsWith("interior-"))
              .every(
                (entry) => entry.pose !== null && entry.pose.space === "hall",
              ),
        ],
        [
          "and nine of them, one per station the room derives",
          () =>
            after.required.filter((entry) => entry.role.startsWith("interior-"))
              .length === 9,
        ],
        [
          "the plan's own observation is refused for its missing receipt",
          () =>
            planRefusals.length === 1 &&
            planRefusals[0]!.message.includes("has no artifact receipt"),
        ],
      ]),
      {
        "the four exposed facades are each charged once": true,
        "the east elevation is refused at its own address": true,
        "every interior station carries an eye proved inside its room": true,
        "and nine of them, one per station the room derives": true,
        "the plan's own observation is refused for its missing receipt": true,
      },
    );

    // The other half of a closed population: it has to be payable. Opening
    // every derived observation removes every closure refusal, so the gate is
    // charging a finite set an author can actually discharge rather than an
    // open-ended one nothing can close. What replaces them is the ordinary
    // missing-receipt refusal at the same addresses, which is the next thing
    // the author owes rather than the same thing again.
    const plan = JSON.parse(fixture.read(LIBRARY_PLAN)!) as {
      units: Array<{ observations: Array<{ id: string; evidence: string }> }>;
    };
    plan.units[0]!.observations = [...derived].map((id) => ({
      id,
      evidence: "artifact",
    }));
    fixture.write(LIBRARY_PLAN, `${JSON.stringify(plan, null, 2)}\n`);
    const opened = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.openReadOnly(fixture.root),
      libraryAuthoring({ root: fixture.root }),
    ).lint({ scope: "review" });
    const unopened = (
      diagnostics: readonly { target: string; message: string }[],
    ): number =>
      diagnostics.filter(
        (diagnostic) =>
          [...derived].some((id) => diagnostic.target === `${OWNER}:${id}`) &&
          diagnostic.message.includes("may never remove one"),
      ).length;
    TestValidator.equals(
      "a plan that opens the whole derived population closes it",
      {
        unopenedBefore: unopened(reviewed.diagnostics),
        unopenedAfter: unopened(opened.diagnostics),
        owedReceipts: opened.diagnostics.filter(
          (diagnostic) =>
            [...derived].some((id) => diagnostic.target === `${OWNER}:${id}`) &&
            diagnostic.message.includes("has no artifact receipt"),
        ).length,
      },
      { unopenedBefore: 21, unopenedAfter: 0, owedReceipts: 21 },
    );
    fixture.writeGenerated("library/index.json", "not json\n");
    TestValidator.equals(
      "an unreadable published index withdraws the derived population",
      inspect().required.length,
      0,
    );
  } finally {
    fixture.dispose();
  }
};

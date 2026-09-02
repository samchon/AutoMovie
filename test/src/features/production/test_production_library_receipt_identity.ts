import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieLibraryReviewPopulation,
} from "@automovie/interface";
import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";
import {
  LIBRARY_PLAN,
  LIBRARY_SOURCE,
  libraryAuthoring,
  libraryFixture,
  librarySourceModule,
} from "./libraryFixtures";

const consumer = requireSourceModule<{
  readAutoMovieLibraryReviewRequirements: (props: {
    authoring: IAutoMovieProductionEvidence;
    project: unknown;
    compileFingerprint: AutoMovieContentDigest;
  }) => IAutoMovieLibraryReviewPopulation;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/libraryReviewEvidenceConsumer.ts",
  ),
  ["readAutoMovieLibraryReviewRequirements"],
);

const COMPILE = `sha256:${"1".repeat(64)}` as AutoMovieContentDigest;

/**
 * A receipt's identity carries four digests, and each of them moves alone.
 *
 * A receipt is current while its identity matches the owner's. That identity is
 * the design unit's digest, a fingerprint over the owner's source, the compile
 * that produced the generated tree, and a digest of the plan itself -- four
 * separate answers to "is this observation still about the thing it was taken
 * of". Only the source one had a probe, so three of the four could have been
 * dropped from the identity, or wired to the same input, and every scenario
 * would have stayed green.
 *
 * Each case changes exactly one input and reads all four digests. What it
 * asserts is not only that the receipt goes stale -- that would pass with all
 * four wired together -- but that the other three hold, which is what proves
 * they are four answers and not one repeated.
 *
 * Scenarios:
 *
 * 1. A reviewed design unit's digest moves the `design` digest alone.
 * 2. Editing the owner's source moves `source` alone.
 * 3. A different compile moves `generated` alone.
 * 4. Adding an observation to the plan moves `plan` alone.
 */
export const test_production_library_receipt_identity = (): void => {
  const fixture = libraryFixture();
  try {
    const identity = (props: {
      authoring?: IAutoMovieProductionEvidence;
      compileFingerprint?: AutoMovieContentDigest;
    }) => {
      const population = consumer.readAutoMovieLibraryReviewRequirements({
        authoring: props.authoring ?? libraryAuthoring({ root: fixture.root }),
        project: AutoMovieProductionProject.openReadOnly(fixture.root),
        compileFingerprint: props.compileFingerprint ?? COMPILE,
      });
      return population.owners[0]!.identity;
    };
    const base = identity({});

    /** Which of the four digests differ from the baseline, by name. */
    const moved = (other: typeof base): string[] =>
      (["design", "generated", "plan", "source"] as const).filter(
        (field) => other[field] !== base[field],
      );

    const designMoved = moved(
      identity({
        authoring: libraryAuthoring({
          root: fixture.root,
          digest: "b".repeat(64),
        }),
      }),
    );
    const generatedMoved = moved(
      identity({
        compileFingerprint:
          `sha256:${"2".repeat(64)}` as AutoMovieContentDigest,
      }),
    );

    // The plan is read from disk, so these two are taken in order and each
    // restores what it changed before the next is measured.
    const currentPlan = fixture.read(LIBRARY_PLAN)!;
    const widened = JSON.parse(currentPlan) as {
      units: Array<{ observations: unknown[] }>;
    };
    widened.units[0]!.observations.push({
      id: "plan-extra-elevation",
      evidence: "artifact",
    });
    fixture.write(LIBRARY_PLAN, `${JSON.stringify(widened, null, 2)}\n`);
    const planMoved = moved(identity({}));
    fixture.write(LIBRARY_PLAN, currentPlan);

    const currentSource = fixture.read(LIBRARY_SOURCE)!;
    fixture.write(
      LIBRARY_SOURCE,
      librarySourceModule({ environmentId: "hall-annex" }),
    );
    const sourceMoved = moved(identity({}));
    fixture.write(LIBRARY_SOURCE, currentSource);

    TestValidator.equals(
      "each of the receipt identity's four digests answers its own input",
      namedFacts([
        [
          "theBaselineIsFourDistinctDigests",
          () =>
            new Set([base.design, base.generated, base.plan, base.source])
              .size === 4,
        ],
        [
          "aReviewedDesignDigestMovesDesignAlone",
          () => designMoved.join(",") === "design",
        ],
        [
          "aDifferentCompileMovesGeneratedAlone",
          () => generatedMoved.join(",") === "generated",
        ],
        [
          // Adding an observation is the change an author makes most often, and
          // it has to stale every receipt under that plan: the population the
          // owner owes is not what it was when they were taken.
          "aWidenedPlanMovesPlanAlone",
          () => planMoved.join(",") === "plan",
        ],
        [
          "anEditedSourceMovesSourceAlone",
          () => sourceMoved.join(",") === "source",
        ],
        [
          // Restored, so a later reader of this fixture sees what it started
          // with rather than the last case's edit.
          "everyChangeWasPutBack",
          () => moved(identity({})).length === 0,
        ],
      ]),
      {
        theBaselineIsFourDistinctDigests: true,
        aReviewedDesignDigestMovesDesignAlone: true,
        aDifferentCompileMovesGeneratedAlone: true,
        aWidenedPlanMovesPlanAlone: true,
        anEditedSourceMovesSourceAlone: true,
        everyChangeWasPutBack: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

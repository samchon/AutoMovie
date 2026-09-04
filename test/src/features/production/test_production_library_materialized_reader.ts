import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  autoMovieMaterializedLibraryEnvironments,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  LIBRARY_ANCHOR,
  LIBRARY_DESIGN,
  LIBRARY_SECOND_ANCHOR,
  libraryAuthoring,
  libraryFixture,
} from "./libraryFixtures";

/**
 * The buildings a library published, reopened by the two commands that need
 * them after the compile that made them has ended.
 *
 * The compiler answers this from memory while it is running. Nothing else can:
 * `building:report` draws a library's delivered work and `library:review`
 * inspects what an owner owes, and both run as their own commands, after the
 * compile, from the published index alone. That reader had no scenario of its
 * own -- it was reached only through a film fixture, which publishes no library
 * index, so the path where it finds something never ran.
 *
 * Scenarios:
 *
 * 1. After a materializing compile, the owner that published a building gets
 *    it back, as the record its own source returned.
 * 2. An owner that published nothing gets an empty population rather than
 *    another owner's building, because the index is addressed by design owner
 *    and a report that answered by position would draw the wrong work.
 * 3. Before any compile there is no index, and the reader yields nothing rather
 *    than failing: a library that has not compiled yet is not in error, and the
 *    two commands say so themselves in their own words.
 */
export const test_production_library_materialized_reader = (): void => {
  const fixture = libraryFixture();
  try {
    const currentAuthoringEvidence = () =>
      libraryAuthoring({ root: fixture.root });
    const authoring = currentAuthoringEvidence();
    const before = autoMovieMaterializedLibraryEnvironments({
      read: (relative) =>
        AutoMovieProductionProject.openReadOnly(fixture.root).readGeneratedFile(
          relative,
        ),
    })({
      branch: "spaces",
      owner: `${LIBRARY_DESIGN}#${LIBRARY_ANCHOR}`,
      anchor: LIBRARY_ANCHOR,
    });
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      authoring,
      currentAuthoringEvidence,
    ).compile({ scope: "source" });
    const resolve = autoMovieMaterializedLibraryEnvironments({
      read: (relative) =>
        AutoMovieProductionProject.openReadOnly(fixture.root).readGeneratedFile(
          relative,
        ),
    });
    const published = resolve({
      branch: "spaces",
      // The design owner's full address, which is how the index is keyed.
      owner: `${LIBRARY_DESIGN}#${LIBRARY_ANCHOR}`,
      anchor: LIBRARY_ANCHOR,
    });
    const other = resolve({
      branch: "spaces",
      owner: `${LIBRARY_DESIGN}#${LIBRARY_SECOND_ANCHOR}`,
      anchor: LIBRARY_SECOND_ANCHOR,
    });

    TestValidator.equals(
      "a published building reopens for the owner that published it",
      namedFacts([
        ["theCompileSucceeded", () => compiled.success],
        [
          // The record its own source returned, not a name standing for it.
          "theOwnerGetsItsBuildingBack",
          () =>
            published.map((environment) => environment.id).join(",") ===
              "hall-house" &&
            (published[0]?.buildings ?? []).map((unit) => unit.id).join(",") ===
              "house",
        ],
        [
          // Addressed by design owner. A reader answering by position would
          // hand this anchor the other one's work.
          "anOwnerThatPublishedNothingGetsNothing",
          () => other.length === 0,
        ],
        [
          "beforeAnyCompileThereIsNothingRatherThanAFailure",
          () => before.length === 0,
        ],
        [
          // An empty answer is a real one for an owner that published nothing,
          // so it cannot also mean "you addressed this wrongly". `building:
          // report` passed the document path alone and read no materialized
          // building for as long as that stood, while reporting that it had
          // looked, because nothing distinguished the two.
          "anOwnerAddressedWithoutItsAnchorIsRefused",
          () => {
            try {
              resolve({
                branch: "spaces",
                owner: LIBRARY_DESIGN,
                anchor: LIBRARY_ANCHOR,
              });
              return false;
            } catch (error) {
              return (
                error instanceof Error &&
                error.message.includes('not by "docs/spaces/hall.md" alone')
              );
            }
          },
        ],
      ]),
      {
        theCompileSucceeded: true,
        theOwnerGetsItsBuildingBack: true,
        anOwnerThatPublishedNothingGetsNothing: true,
        beforeAnyCompileThereIsNothingRatherThanAFailure: true,
        anOwnerAddressedWithoutItsAnchorIsRefused: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

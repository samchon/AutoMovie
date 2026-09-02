import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  autoMovieMaterializedLibraryContexts,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { analysisContext } from "../internal/analysisFixtures";
import { namedFacts } from "../internal/predicates";
import {
  LIBRARY_ANCHOR,
  LIBRARY_DESIGN,
  LIBRARY_SECOND_ANCHOR,
  LIBRARY_SOURCE,
  libraryAuthoring,
  libraryFixture,
  librarySourceModule,
} from "./libraryFixtures";

/**
 * The world a map owner adopted, reopened after the compile that accepted it.
 *
 * The derivation charges a map owner against what that owner contributed, so
 * the contribution has to survive the compile and be readable from the tree by
 * the commands that run afterwards. Nothing published a context before this:
 * the production design carried exactly one for the whole production, and it
 * belonged to nobody.
 *
 * Scenarios:
 *
 * 1. A source that returns a context compiles, and the owner that returned it
 *    reads it back as the record its own module produced.
 * 2. An owner that adopted none reads none, because the index is addressed by
 *    design owner and a reader answering by position would hand one owner the
 *    other's world.
 * 3. The address refusal names contexts rather than environments, so an author
 *    who passed a document path alone is told which reader refused them.
 */
export const test_production_library_map_materialization = (): void => {
  const fixture = libraryFixture();
  try {
    const context = analysisContext({ id: "hall-site" });
    fixture.write(
      LIBRARY_SOURCE,
      librarySourceModule({ contexts: JSON.stringify([context]) }),
    );
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      libraryAuthoring({ root: fixture.root }),
    ).compile({ scope: "source" });
    const resolve = autoMovieMaterializedLibraryContexts({
      read: (relative) =>
        AutoMovieProductionProject.openReadOnly(fixture.root).readGeneratedFile(
          relative,
        ),
    });
    const published = resolve({
      branch: "spaces",
      owner: `${LIBRARY_DESIGN}#${LIBRARY_ANCHOR}`,
      anchor: LIBRARY_ANCHOR,
    });

    TestValidator.equals(
      "an adopted world survives the compile and reopens for its owner",
      namedFacts([
        ["theCompileAcceptedTheContribution", () => compiled.success],
        [
          // The record its own module returned, not a name standing for it.
          "theOwnerReadsBackTheWorldItAdopted",
          () =>
            published.map((entry) => entry.id).join(",") === "hall-site" &&
            published[0]?.instants.length === context.instants.length,
        ],
        [
          "anOwnerThatAdoptedNoneReadsNone",
          () =>
            resolve({
              branch: "spaces",
              owner: `${LIBRARY_DESIGN}#${LIBRARY_SECOND_ANCHOR}`,
              anchor: LIBRARY_SECOND_ANCHOR,
            }).length === 0,
        ],
        [
          // An empty answer is a real one for an owner that adopted nothing, so
          // it cannot also mean "you addressed this wrongly", and the refusal
          // has to name which reader it came from.
          "anOwnerAddressedWithoutItsAnchorIsRefusedAsContexts",
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
                error.message.includes("library contexts are addressed")
              );
            }
          },
        ],
      ]),
      {
        theCompileAcceptedTheContribution: true,
        theOwnerReadsBackTheWorldItAdopted: true,
        anOwnerThatAdoptedNoneReadsNone: true,
        anOwnerAddressedWithoutItsAnchorIsRefusedAsContexts: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  autoMovieMaterializedLibraryContexts,
  autoMovieMaterializedLibraryEnvironments,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { analysisContext } from "../internal/analysisFixtures";
import { namedFacts } from "../internal/predicates";
import {
  LIBRARY_MAP_ANCHOR,
  LIBRARY_MAP_DESIGN,
  LIBRARY_MAP_OWNER,
  LIBRARY_MAP_SECOND_ANCHOR,
  LIBRARY_MAP_SECOND_OWNER,
  LIBRARY_MAP_SOURCE,
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
 * 4. An index written before contexts existed still yields its buildings. The
 *    index is validated exactly, so a required field would have failed the
 *    whole document and handed both commands an empty population -- silently,
 *    which is the exact failure this field was added to end.
 * 5. Two owners adopting one context id are refused.
 * 6. A world that is not a world is refused where it was returned. The
 *    compiler validates a contributed context the way it validates a building
 *    and a model, and nothing had ever handed it a bad one. Two answers to "what is
 *    north here" cannot both stand, and a report reading whichever landed
 *    second would measure one owner's work against the other's world.
 */
export const test_production_library_map_materialization = (): void => {
  const fixture = libraryFixture();
  try {
    const currentMapAuthoringEvidence = (anchors?: readonly string[]) => () =>
      libraryAuthoring({ root: fixture.root, branch: "maps", anchors });
    const context = analysisContext({ id: "hall-site" });
    fixture.write(
      LIBRARY_MAP_SOURCE,
      librarySourceModule({
        design: LIBRARY_MAP_OWNER,
        environments: "[]",
        contexts: JSON.stringify([context]),
      }),
    );
    const compiled = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      currentMapAuthoringEvidence()(),
      currentMapAuthoringEvidence(),
    ).compile({ scope: "source" });
    const resolve = autoMovieMaterializedLibraryContexts({
      read: (relative) =>
        AutoMovieProductionProject.openReadOnly(fixture.root).readGeneratedFile(
          relative,
        ),
    });
    const published = resolve({
      branch: "maps",
      owner: LIBRARY_MAP_OWNER,
      anchor: LIBRARY_MAP_ANCHOR,
    });
    const generated = AutoMovieProductionProject.openReadOnly(
      fixture.root,
    ).generatedManifest();

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
              branch: "maps",
              owner: LIBRARY_MAP_SECOND_OWNER,
              anchor: LIBRARY_MAP_SECOND_ANCHOR,
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
                branch: "maps",
                owner: LIBRARY_MAP_DESIGN,
                anchor: LIBRARY_MAP_ANCHOR,
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
        [
          "theGeneratedContextNamesItsExactMapOwner",
          () =>
            generated?.files
              .find((file) => file.path === "library/contexts/hall-site.json")
              ?.sourceTargets.join(",") === `library:maps:${LIBRARY_MAP_OWNER}`,
        ],
      ]),
      {
        theCompileAcceptedTheContribution: true,
        theOwnerReadsBackTheWorldItAdopted: true,
        anOwnerThatAdoptedNoneReadsNone: true,
        anOwnerAddressedWithoutItsAnchorIsRefusedAsContexts: true,
        theGeneratedContextNamesItsExactMapOwner: true,
      },
    );
    const index = JSON.parse(
      Buffer.from(
        AutoMovieProductionProject.openReadOnly(fixture.root).readGeneratedFile(
          "library/index.json",
        ),
      ).toString("utf8"),
    ) as { owners: Array<Record<string, unknown>> };
    for (const owner of index.owners) delete owner.contexts;
    const older = autoMovieMaterializedLibraryEnvironments({
      read: (relative) =>
        relative === "library/index.json"
          ? Buffer.from(JSON.stringify(index))
          : AutoMovieProductionProject.openReadOnly(
              fixture.root,
            ).readGeneratedFile(relative),
    })({
      branch: "maps",
      owner: LIBRARY_MAP_OWNER,
      anchor: LIBRARY_MAP_ANCHOR,
    });

    // And the same index read for contexts yields none rather than throwing.
    // That is the upgrade a map owner actually meets: an owner whose index
    // entry predates the field is an owner that adopted no world, which is a
    // real answer, not a fault.
    const olderContexts = autoMovieMaterializedLibraryContexts({
      read: (relative) =>
        relative === "library/index.json"
          ? Buffer.from(JSON.stringify(index))
          : AutoMovieProductionProject.openReadOnly(
              fixture.root,
            ).readGeneratedFile(relative),
    })({
      branch: "maps",
      owner: LIBRARY_MAP_OWNER,
      anchor: LIBRARY_MAP_ANCHOR,
    });

    TestValidator.equals(
      "a context-only index from before contexts existed still answers both readers",
      { buildings: older.length !== 0, worlds: olderContexts.length },
      { buildings: false, worlds: 0 },
    );

    fixture.write(
      LIBRARY_MAP_SOURCE,
      librarySourceModule({
        design: LIBRARY_MAP_OWNER,
        environments: "[]",
        // A north of no length. Every direction in a context is a direction,
        // and one that points nowhere makes every elevation drawn against it
        // arbitrary rather than wrong in a way anybody could see.
        contexts: JSON.stringify([{ ...context, north: { x: 0, y: 0, z: 0 } }]),
      }),
    );
    const malformed = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      currentMapAuthoringEvidence()(),
      currentMapAuthoringEvidence(),
    ).compile({ scope: "source" });

    TestValidator.equals(
      "a world that is not a world is refused where it was returned",
      {
        refused: malformed.success === false,
        named: malformed.diagnostics.some((diagnostic) =>
          diagnostic.message.includes("north"),
        ),
      },
      { refused: true, named: true },
    );

    fixture.write(
      LIBRARY_MAP_SOURCE,
      librarySourceModule({
        design: LIBRARY_MAP_OWNER,
        environments: "[]",
        contexts: JSON.stringify([context]),
        second: {
          exportName: "annex",
          design: LIBRARY_MAP_SECOND_OWNER,
          environmentId: "hall-annex",
          environments: "[]",
          contexts: JSON.stringify([context]),
        },
      }),
    );
    const currentCollidedAuthoringEvidence = currentMapAuthoringEvidence([
      LIBRARY_MAP_ANCHOR,
      LIBRARY_MAP_SECOND_ANCHOR,
    ]);
    const collided = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      currentCollidedAuthoringEvidence(),
      currentCollidedAuthoringEvidence,
    );
    const clash = collided.compile({ scope: "source" });

    TestValidator.equals(
      "one adopted world is published by one owner",
      {
        refused: clash.success === false,
        named: clash.diagnostics.some((diagnostic) =>
          diagnostic.message.includes(
            'Library environment context "hall-site"',
          ),
        ),
      },
      { refused: true, named: true },
    );
  } finally {
    fixture.dispose();
  }
};

import assert from "node:assert/strict";

import {
  type IAutoMovieFilmPopulationTransitionReceipt,
  type IAutoMovieLibraryPopulationTransitionReceipt,
  type IValidateAutoMoviePopulationTransitionProps,
  createAutoMovieRetainedPilotHost,
  validateAutoMoviePopulationTransition,
} from "../src/AutoMoviePopulationTransition";

const filmSource =
  "# Event\n\n## Beat {#beat}\n\n<!-- @evidence contracts/local.md#rule The event owns the beat. -->\n\nAction.\n";
const filmHost = { path: "docs/treatments/001-beat.md", source: filmSource };
const filmReceipt: IAutoMovieFilmPopulationTransitionReceipt = {
  version: 1,
  kind: "film",
  productionLocation: "C:\\productions\\film",
  owner: "director",
  pilotScope: { mode: "first-pilot", partitionGroup: "001-opening" },
  reviewedBranches: ["treatments", "scripts", "screenplays"],
  retainedHosts: [createAutoMovieRetainedPilotHost(filmHost)],
};
const film = (
  overrides: Partial<IValidateAutoMoviePopulationTransitionProps> = {},
): IValidateAutoMoviePopulationTransitionProps => ({
  kind: "film" as const,
  productionLocation: "C:\\productions\\film",
  owner: "director",
  receipt: filmReceipt,
  stages: {
    treatments: "draft",
    scripts: "draft",
    screenplays: "draft",
    settings: "review",
  },
  hosts: [filmHost],
  ...overrides,
});

/**
 * Complete-production reset is bound to one exact passed pilot.
 *
 * Scenarios:
 *
 * 1. Exact film and library receipts accept a complete paired reset.
 * 2. Missing receipt, mismatched kind/root/owner/partition/stage, changed body
 *    or tags, renamed retained hosts, and new tagged hosts fail closed.
 * 3. An unrelated reviewed branch does not inherit or revoke reset authority.
 */
assert.doesNotThrow(() => validateAutoMoviePopulationTransition(film()));
assert.doesNotThrow(() =>
  validateAutoMoviePopulationTransition(
    film({
      stages: { ...film().stages, unrelated: "evidence" },
    }),
  ),
);
assert.doesNotThrow(() =>
  validateAutoMoviePopulationTransition(
    film({
      hosts: [
        filmHost,
        {
          path: "docs/treatments/002-new.md",
          source: "# New\n\nDraft body.\n",
        },
      ],
    }),
  ),
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({ receipt: undefined }) as Parameters<
        typeof validateAutoMoviePopulationTransition
      >[0],
    ),
  /requires a transition receipt/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({ receipt: { ...filmReceipt, version: 2 } as never }),
    ),
  /receipt version 1/u,
);
assert.throws(
  () => validateAutoMoviePopulationTransition(film({ kind: "library" })),
  /does not match/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({ productionLocation: "C:\\productions\\other" }),
    ),
  /location does not match/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({ receipt: { ...filmReceipt, owner: " " } }),
    ),
  /non-empty owner/u,
);
assert.throws(
  () => validateAutoMoviePopulationTransition(film({ owner: " " })),
  /non-empty current owner/u,
);
assert.throws(
  () => validateAutoMoviePopulationTransition(film({ owner: "producer" })),
  /owner does not match/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        receipt: {
          ...filmReceipt,
          pilotScope: { mode: "complete-production" } as never,
        },
      }),
    ),
  /must describe a first pilot/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        receipt: {
          ...filmReceipt,
          pilotScope: { mode: "first-pilot", partitionGroup: "002-late" },
        } as unknown as IAutoMovieFilmPopulationTransitionReceipt,
      }),
    ),
  /exact 001/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        receipt: { ...filmReceipt, reviewedBranches: ["scripts"] as never },
      }),
    ),
  /complete reviewed narrative ladder/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({ stages: { ...film().stages, scripts: "review" } }),
    ),
  /scripts to move to draft/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        hosts: [
          { ...filmHost, source: filmSource.replace("Action.", "Revision.") },
        ],
      }),
    ),
  /authored body changed/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        hosts: [
          {
            ...filmHost,
            source: filmSource.replace("owns the beat", "owns the exact beat"),
          },
        ],
      }),
    ),
  /evidence tags changed/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        hosts: [{ ...filmHost, path: "docs/treatments/001-renamed.md" }],
      }),
    ),
  /new reset host cannot carry/u,
);
assert.throws(
  () =>
    createAutoMovieRetainedPilotHost({
      path: "docs\\treatments\\001-beat.md",
      source: filmSource,
    }),
  /normalized project-relative host path/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({ receipt: { ...filmReceipt, retainedHosts: [] } }),
    ),
  /requires a retained pilot host/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        receipt: {
          ...filmReceipt,
          retainedHosts: [
            { ...filmReceipt.retainedHosts[0]!, bodySha256: "invalid" },
          ],
        },
      }),
    ),
  /invalid SHA-256 identity/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        receipt: {
          ...filmReceipt,
          retainedHosts: [
            filmReceipt.retainedHosts[0]!,
            filmReceipt.retainedHosts[0]!,
          ],
        },
      }),
    ),
  /repeated in the receipt/u,
);
assert.throws(
  () => validateAutoMoviePopulationTransition(film({ hosts: [] })),
  /absent from the reset population/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({ hosts: [filmHost, filmHost] }),
    ),
  /repeated in the current population/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition(
      film({
        hosts: [
          filmHost,
          {
            path: "docs/treatments/002-new.md",
            source:
              "# New\n\n## Beat {#new}\n\n<!-- @evidence contracts/local.md#rule New tag. -->\n",
          },
        ],
      }),
    ),
  /new reset host cannot carry/u,
);

const libraryHost = {
  path: "docs/models/001-model.md",
  source: "# Model\n\n## Form {#form}\n\nBody.\n",
};
const librarySourceHost = {
  path: "src/models/Subject.ts",
  source: [
    "/**",
    " * @evidence docs/models/001-model.md#form Retained source metadata.",
    " * @author Model Author",
    " */",
    "export class Subject {}",
    "",
  ].join("\n"),
};
const libraryReceipt: IAutoMovieLibraryPopulationTransitionReceipt = {
  version: 1,
  kind: "library",
  productionLocation: "C:\\productions\\library",
  owner: "asset-author",
  pilotScope: { mode: "first-pilot" },
  reviewedPairs: [{ design: "models", source: "modelSources" }],
  retainedHosts: [
    createAutoMovieRetainedPilotHost(libraryHost),
    createAutoMovieRetainedPilotHost(librarySourceHost),
  ],
};
assert.doesNotThrow(() =>
  validateAutoMoviePopulationTransition({
    kind: "library",
    productionLocation: "C:\\productions\\library",
    owner: "asset-author",
    receipt: libraryReceipt,
    stages: { models: "draft", modelSources: "draft" },
    hosts: [libraryHost, librarySourceHost],
  }),
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition({
      kind: "library",
      productionLocation: "C:\\productions\\library",
      owner: "asset-author",
      receipt: libraryReceipt,
      stages: { models: "draft", modelSources: "review" },
      hosts: [libraryHost, librarySourceHost],
    }),
  /models and modelSources to move to draft/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition({
      kind: "library",
      productionLocation: "C:\\productions\\library",
      owner: "asset-author",
      receipt: libraryReceipt,
      stages: {
        models: "draft",
        modelSources: "draft",
        spaces: "draft",
        spaceSources: "draft",
      },
      hosts: [libraryHost, librarySourceHost],
    }),
  /cannot lower unrecorded pair spaces\/spaceSources/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition({
      kind: "library",
      productionLocation: "C:\\productions\\library",
      owner: "asset-author",
      receipt: {
        ...libraryReceipt,
        reviewedPairs: [{ design: "scripts", source: "filmSources" }],
      } as unknown as IAutoMovieLibraryPopulationTransitionReceipt,
      stages: { scripts: "draft", filmSources: "draft" },
      hosts: [libraryHost, librarySourceHost],
    }),
  /recognized design\/source branch pair/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition({
      kind: "library",
      productionLocation: "C:\\productions\\library",
      owner: "asset-author",
      receipt: { ...libraryReceipt, reviewedPairs: [] },
      stages: {},
      hosts: [libraryHost, librarySourceHost],
    }),
  /one exact reviewed design\/source branch pair/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition({
      kind: "library",
      productionLocation: "C:\\productions\\library",
      owner: "asset-author",
      receipt: libraryReceipt,
      stages: { models: "draft", modelSources: "draft" },
      hosts: [
        libraryHost,
        {
          ...librarySourceHost,
          source: librarySourceHost.source.replace(
            "class Subject",
            "class Actor",
          ),
        },
      ],
    }),
  /authored body changed/u,
);
assert.throws(
  () =>
    validateAutoMoviePopulationTransition({
      kind: "library",
      productionLocation: "C:\\productions\\library",
      owner: "asset-author",
      receipt: libraryReceipt,
      stages: { models: "draft", modelSources: "draft" },
      hosts: [
        libraryHost,
        {
          ...librarySourceHost,
          source: librarySourceHost.source.replace(
            "Model Author",
            "Different Author",
          ),
        },
      ],
    }),
  /authored body changed/u,
);

process.stdout.write("population transition provenance passed\n");

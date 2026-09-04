import type { IAutoMovieMaterializedLibrary } from "@automovie/interface";
import { autoMovieLibraryArtifactSourceTargets } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

/**
 * Every owner-produced library artifact preserves its exact source target.
 *
 * Scenarios:
 *
 * 1. Environment, model, and context families from one owner resolve to the
 *    same branch and reviewed H2 while the aggregate index stays library-wide.
 * 2. Encoded context ids use the same portable segment rule as publication.
 * 3. An unowned or multiply owned artifact fails instead of falling back to the
 *    aggregate target.
 */
export const test_production_library_context_targets = (): void => {
  const index: IAutoMovieMaterializedLibrary = {
    version: 1,
    compiler: "automovie.production.v1",
    production: "library",
    inputFingerprint:
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    owners: [
      {
        branch: "spaces",
        owner: "docs/spaces/hall.md#hall",
        source: "src/spaces/hall.ts",
        export: "hall",
        sourceDigest:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        environments: ["hall"],
        models: ["bench"],
        contexts: ["site/entry"],
      },
    ],
  };
  const target = "library:spaces:docs/spaces/hall.md#hall";

  TestValidator.equals(
    "library artifact target projection is exact and fail closed",
    namedFacts([
      [
        "indexRemainsAggregate",
        () =>
          JSON.stringify(
            autoMovieLibraryArtifactSourceTargets("library/index.json", index),
          ) === '["library"]',
      ],
      [
        "environmentKeepsOwner",
        () =>
          autoMovieLibraryArtifactSourceTargets(
            "library/environments/hall.json",
            index,
          )[0] === target,
      ],
      [
        "modelKeepsOwner",
        () =>
          autoMovieLibraryArtifactSourceTargets(
            "models/bench.json",
            index,
          )[0] === target,
      ],
      [
        "encodedContextKeepsOwner",
        () =>
          autoMovieLibraryArtifactSourceTargets(
            "library/contexts/site%2Fentry.json",
            index,
          )[0] === target,
      ],
      [
        "unownedArtifactIsRefused",
        () =>
          throwsError(
            () =>
              autoMovieLibraryArtifactSourceTargets(
                "library/contexts/other.json",
                index,
              ),
            "has no exact owner",
          ),
      ],
      [
        "multiplyOwnedArtifactIsRefused",
        () =>
          throwsError(
            () =>
              autoMovieLibraryArtifactSourceTargets(
                "library/contexts/site%2Fentry.json",
                {
                  ...index,
                  owners: [index.owners[0]!, index.owners[0]!],
                },
              ),
            "has 2 owners",
          ),
      ],
    ]),
    {
      indexRemainsAggregate: true,
      environmentKeepsOwner: true,
      modelKeepsOwner: true,
      encodedContextKeepsOwner: true,
      unownedArtifactIsRefused: true,
      multiplyOwnedArtifactIsRefused: true,
    },
  );
};

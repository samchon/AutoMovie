import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

type Row = {
  capability: string;
  consumer: string | null;
  inapplicableReason: string | null;
  kind: "film" | "brief" | "library";
  owner: string | null;
  route: string | null;
  serializer: string | null;
};

const unit = loadSourceModule<{
  AUTO_MOVIE_AUTHORING_REACHABILITY: readonly Row[];
  AUTO_MOVIE_CAMERA_ACTIONS: readonly string[];
  inspectAutoMovieAuthoringReachability: (rows: readonly Row[]) => string[];
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/src/authoringReachability.ts",
  ),
);

/** The shipped capability matrix names every route or its honest absence. */
export const test_cli_authoring_reachability = (): void => {
  const rows = unit.AUTO_MOVIE_AUTHORING_REACHABILITY;
  const first = rows[0]!;
  TestValidator.equals(
    "authoring reachability is a typed owner-to-consumer matrix",
    namedFacts([
      [
        "shippedMatrixIsComplete",
        () => unit.inspectAutoMovieAuthoringReachability(rows).length === 0,
      ],
      [
        "cameraVocabularyIsTheExecutableUnion",
        () =>
          unit.AUTO_MOVIE_CAMERA_ACTIONS.join(",") ===
          "static,follow,orbit,push-in,truck,whip",
      ],
      [
        "missingConsumerIsLocated",
        () =>
          unit
            .inspectAutoMovieAuthoringReachability([
              { ...first, consumer: null },
            ])
            .includes(`${first.kind}:${first.capability} has no consumer.`),
      ],
      [
        "duplicateAndMixedInapplicabilityAreRefused",
        () => {
          const impossible: Row = {
            capability: "film-sources",
            consumer: "compiler",
            inapplicableReason: "library has no film",
            kind: "library",
            owner: null,
            route: null,
            serializer: null,
          };
          const findings = unit.inspectAutoMovieAuthoringReachability([
            impossible,
            impossible,
          ]);
          return (
            findings.includes("library:film-sources is duplicated.") &&
            findings.filter((finding) => finding.includes("mixes")).length === 2
          );
        },
      ],
    ]),
    {
      cameraVocabularyIsTheExecutableUnion: true,
      duplicateAndMixedInapplicabilityAreRefused: true,
      missingConsumerIsLocated: true,
      shippedMatrixIsComplete: true,
    },
  );
};

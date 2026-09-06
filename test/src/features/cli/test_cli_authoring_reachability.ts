import { AUTO_MOVIE_EXTERNAL_MODEL_INGEST_PROFILES } from "@automovie/ingest";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

/**
 * Loosely typed row so an invalid kind, capability, field, or route can be
 * handed to the inspector without a cast.
 */
interface IRow {
  capability: string;
  choices: readonly string[] | null;
  consumer: string | null;
  field: string | null;
  inapplicableReason: string | null;
  kind: string;
  owner: string | null;
  route: string | null;
  serializer: string | null;
}

const unit = loadSourceModule<{
  AUTO_MOVIE_AUTHORING_PRODUCTION_KINDS: readonly string[];
  AUTO_MOVIE_AUTHORING_REACHABILITY: readonly IRow[];
  AUTO_MOVIE_CAMERA_ACTIONS: readonly string[];
  inspectAutoMovieAuthoringReachability: (rows: readonly IRow[]) => string[];
  isAutoMovieAuthoringProductionKind: (value: unknown) => boolean;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/src/authoringReachability.ts",
  ),
);

/** The exact camera move literals `IAutoMovieActionCall` accepts for `frame`. */
const CAMERA_MOVES = "static,follow,orbit,push-in,truck,whip";

const inspect = (rows: readonly IRow[]): string[] =>
  unit.inspectAutoMovieAuthoringReachability(rows);

/**
 * The shipped capability matrix names every field route or its honest absence,
 * and its inspector refuses any matrix that would leave the author guessing.
 *
 * Scenarios:
 * 1. The shipped matrix passes its own inspector, its kinds are the closed
 *    ladder set, and the kind predicate accepts exactly those strings.
 * 2. Every production-design field has one row per kind: film and brief rows
 *    route to the reviewed production source, library rows carry the exact
 *    inapplicable reason naming the field and no route.
 * 3. The camera rows carry the executable six-move union and the inspection
 *    rows carry the ingest package's own profile vocabulary.
 * 4. Missing owner, serializer, consumer, and route each produce a located
 *    finding on an applicable row.
 * 5. An empty matrix reports every expected address missing, a dropped row is
 *    named, a duplicated row is named, and an inapplicable row that also
 *    claims a consumer is refused as mixed.
 * 6. Unknown kind, unknown capability, a field on a non-field capability, a
 *    field row without a field, an unknown field, an unknown route, and a
 *    repository-local owner are each refused.
 * 7. Empty, blank, and repeated choices are refused; a blank inapplicable
 *    reason is refused; a valid closed choice list is accepted.
 */
export const test_cli_authoring_reachability = (): void => {
  const rows = unit.AUTO_MOVIE_AUTHORING_REACHABILITY;
  const first = rows[0]!;
  const fieldRows = rows.filter(
    (row) => row.capability === "production-design-field",
  );
  const fieldsOf = (kind: string): string =>
    fieldRows
      .filter((row) => row.kind === kind)
      .map((row) => row.field)
      .join(",");
  const libraryExternalMotions = fieldRows.find(
    (row) => row.kind === "library" && row.field === "externalMotions",
  )!;
  TestValidator.equals(
    "authoring reachability is a typed owner-to-consumer matrix",
    namedFacts([
      ["shippedMatrixIsComplete", () => inspect(rows).length === 0],
      [
        "kindsAreTheClosedLadderSet",
        () =>
          unit.AUTO_MOVIE_AUTHORING_PRODUCTION_KINDS.join(",") ===
            "film,brief,library" &&
          ["film", "brief", "library"].every((kind) =>
            unit.isAutoMovieAuthoringProductionKind(kind),
          ) &&
          unit.isAutoMovieAuthoringProductionKind("episode") === false &&
          unit.isAutoMovieAuthoringProductionKind("toString") === false &&
          unit.isAutoMovieAuthoringProductionKind(1) === false,
      ],
      [
        "everyProductionFieldHasOneRowPerKind",
        () => {
          const filmFields = fieldsOf("film");
          const distinct = new Set(filmFields.split(","));
          return (
            distinct.size > 0 &&
            distinct.size === filmFields.split(",").length &&
            fieldsOf("brief") === filmFields &&
            fieldsOf("library") === filmFields &&
            fieldRows.length === distinct.size * 3
          );
        },
      ],
      [
        "timedFieldRowsRouteToTheReviewedProductionSource",
        () =>
          fieldRows
            .filter((row) => row.kind !== "library")
            .every(
              (row) =>
                row.inapplicableReason === null &&
                row.owner === "docs/settings -> src/production.ts" &&
                row.serializer ===
                  "scripts/emitDesign.ts -> AutoMovieProductionProject.setProductionDesign" &&
                row.consumer !== null &&
                row.route !== null,
            ),
      ],
      [
        "libraryFieldRowsAreHonestlyInapplicable",
        () =>
          fieldRows
            .filter((row) => row.kind === "library")
            .every(
              (row) =>
                row.inapplicableReason?.endsWith(
                  `no library path reads production-design.${row.field}.`,
                ) === true &&
                row.consumer === null &&
                row.owner === null &&
                row.route === null &&
                row.choices === null,
            ) &&
          libraryExternalMotions.inapplicableReason!.includes(
            "production-design.externalMotions",
          ),
      ],
      [
        "cameraVocabularyIsTheExecutableUnion",
        () => {
          const camera = rows.filter(
            (row) => row.capability === "camera-actions",
          );
          return (
            unit.AUTO_MOVIE_CAMERA_ACTIONS.join(",") === CAMERA_MOVES &&
            camera.length === 3 &&
            camera
              .filter((row) => row.kind !== "library")
              .every((row) => row.choices?.join(",") === CAMERA_MOVES) &&
            camera.find((row) => row.kind === "library")!.inapplicableReason !==
              null
          );
        },
      ],
      [
        "externalInspectorPublishesTheIngestProfiles",
        () => {
          const inspection = rows.filter(
            (row) => row.capability === "external-model-inspection",
          );
          return (
            inspection.length === 3 &&
            inspection.every(
              (row) =>
                row.choices?.join(",") ===
                  AUTO_MOVIE_EXTERNAL_MODEL_INGEST_PROFILES.join(",") &&
                row.route ===
                  ".agents/skills/source-authoring/models-and-motions.md",
            )
          );
        },
      ],
      [
        "missingRouteFieldsAreLocated",
        () =>
          (
            [
              ["owner", { ...first, owner: null }],
              ["serializer", { ...first, serializer: " " }],
              ["consumer", { ...first, consumer: null }],
              ["route", { ...first, route: null }],
            ] as const
          ).every(([name, row]) =>
            inspect([row]).includes(
              `${first.kind}:${first.capability} has no ${name}.`,
            ),
          ),
      ],
      [
        "missingDuplicateAndMixedRowsAreRefused",
        () => {
          const mixed: IRow = {
            capability: "film-sources",
            choices: null,
            consumer: "compiler",
            field: null,
            inapplicableReason: "library has no film",
            kind: "library",
            owner: null,
            route: null,
            serializer: null,
          };
          const findings = inspect([mixed, mixed]);
          return (
            inspect([]).filter((finding) => finding.endsWith(" is missing."))
              .length === rows.length &&
            inspect(rows.slice(1)).join("\n") ===
              `${first.kind}:${first.capability} is missing.` &&
            findings.includes("library:film-sources is duplicated.") &&
            findings.filter((finding) =>
              finding.endsWith("mixes an inapplicable reason with a route."),
            ).length === 2
          );
        },
      ],
      [
        "unknownKindCapabilityFieldAndRouteAreRefused",
        () => {
          const fieldRow = fieldRows[0]!;
          const cases: ReadonlyArray<readonly [IRow, string]> = [
            [
              { ...first, kind: "episode" },
              'names unknown production kind "episode".',
            ],
            [
              { ...first, capability: "telepathy" },
              'names unknown capability "telepathy".',
            ],
            [{ ...first, field: "title" }, "takes no production design field."],
            [
              { ...fieldRow, field: null },
              "must name one production design field.",
            ],
            [
              { ...fieldRow, field: "budget" },
              "must name one production design field.",
            ],
            [
              { ...first, route: ".agents/skills/source-authoring/missing.md" },
              'names unknown generated-project route ".agents/skills/source-authoring/missing.md".',
            ],
            [
              { ...first, owner: "packages/template/scaffold/src/examples" },
              "names a repository path instead of its generated-project owner.",
            ],
          ];
          return cases.every(([row, fragment]) =>
            inspect([row]).some((finding) => finding.endsWith(fragment)),
          );
        },
      ],
      [
        "choiceListsAndReasonsMustBeWellFormed",
        () => {
          const inapplicable = rows.find(
            (row) => row.inapplicableReason !== null,
          )!;
          const choicesFinding = `${first.kind}:${first.capability} has invalid closed choices.`;
          return (
            inspect([{ ...first, choices: [] }]).includes(choicesFinding) &&
            inspect([{ ...first, choices: ["a", " "] }]).includes(
              choicesFinding,
            ) &&
            inspect([{ ...first, choices: ["a", "a"] }]).includes(
              choicesFinding,
            ) &&
            inspect([{ ...first, choices: ["a", "b"] }]).includes(
              choicesFinding,
            ) === false &&
            inspect([{ ...inapplicable, inapplicableReason: " " }]).includes(
              `${inapplicable.kind}:${inapplicable.capability}${
                inapplicable.field === null ? "" : `:${inapplicable.field}`
              } has a blank inapplicable reason.`,
            )
          );
        },
      ],
    ]),
    {
      cameraVocabularyIsTheExecutableUnion: true,
      choiceListsAndReasonsMustBeWellFormed: true,
      everyProductionFieldHasOneRowPerKind: true,
      externalInspectorPublishesTheIngestProfiles: true,
      kindsAreTheClosedLadderSet: true,
      libraryFieldRowsAreHonestlyInapplicable: true,
      missingDuplicateAndMixedRowsAreRefused: true,
      missingRouteFieldsAreLocated: true,
      shippedMatrixIsComplete: true,
      timedFieldRowsRouteToTheReviewedProductionSource: true,
      unknownKindCapabilityFieldAndRouteAreRefused: true,
    },
  );
};

import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";

type Row = {
  capability: string;
  choices: readonly string[] | null;
  consumer: string | null;
  field: string | null;
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

/**
 * The shipped capability matrix names every field route or its honest absence.
 *
 * Scenarios:
 * 1. Every production-design field appears once per shape and the exact camera
 *    and inspection choices travel in the queried rows.
 * 2. Library-only inapplicability remains explicit for timed external motion.
 * 3. Missing, duplicate, malformed, mixed, repository-local, and nonexistent
 *    route rows each produce a located finding.
 */
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
            "static,follow,orbit,push-in,truck,whip" &&
          rows
            .filter((row) => row.capability === "camera-actions")
            .filter((row) => row.inapplicableReason === null)
            .every(
              (row) =>
                row.choices?.join(",") ===
                "static,follow,orbit,push-in,truck,whip",
            ),
      ],
      [
        "everyProductionFieldHasOneShapeRow",
        () => {
          const fields = rows.filter(
            (row) => row.capability === "production-design-field",
          );
          const names = new Set(fields.map((row) => row.field));
          return (
            fields.length === 60 &&
            names.size === 20 &&
            [...names].every(
              (field) =>
                fields.filter((row) => row.field === field).length === 3,
            )
          );
        },
      ],
      [
        "libraryExternalMotionIsHonestlyInapplicable",
        () => {
          const row = rows.find(
            (candidate) =>
              candidate.kind === "library" &&
              candidate.capability === "production-design-field" &&
              candidate.field === "externalMotions",
          );
          return (
            row?.inapplicableReason?.includes("no timed") === true &&
            row.consumer === null
          );
        },
      ],
      [
        "externalInspectorPublishesEveryProfile",
        () =>
          rows
            .filter((row) => row.capability === "external-model-inspection")
            .every(
              (row) =>
                row.choices?.join(",") ===
                "gltf-static-v1,gltf-humanoid-v1,gltf-motion-v1,vrm-humanoid-v1",
            ),
      ],
      [
        "missingRouteFieldsAreLocated",
        () => {
          const missing = [
            ["owner", { ...first, owner: null }],
            ["serializer", { ...first, serializer: " " }],
            ["consumer", { ...first, consumer: null }],
            ["route", { ...first, route: null }],
          ] as const;
          return missing.every(([name, row]) =>
            unit
              .inspectAutoMovieAuthoringReachability([row])
              .includes(`${first.kind}:${first.capability} has no ${name}.`),
          );
        },
      ],
      [
        "missingDuplicateAndMixedInapplicabilityAreRefused",
        () => {
          const impossible: Row = {
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
          const findings = unit.inspectAutoMovieAuthoringReachability([
            impossible,
            impossible,
          ]);
          return (
            unit
              .inspectAutoMovieAuthoringReachability([])
              .filter((finding) => finding.endsWith(" is missing.")).length ===
              rows.length &&
            unit
              .inspectAutoMovieAuthoringReachability(rows.slice(1))
              .includes(`${first.kind}:${first.capability} is missing.`) &&
            findings.includes("library:film-sources is duplicated.") &&
            findings.filter((finding) => finding.includes("mixes")).length === 2
          );
        },
      ],
      [
        "nonexistentAndRepositoryLocalRoutesAreRefused",
        () => {
          const unknownRoute = {
            ...first,
            route: ".agents/skills/source-authoring/missing.md",
          } as Row;
          const repositoryOwner = {
            ...first,
            owner: "packages/template/scaffold/src/examples",
          };
          const nonexistentOwner = {
            ...first,
            owner: "docs/does-not-exist",
          };
          return (
            unit
              .inspectAutoMovieAuthoringReachability([unknownRoute])
              .some((finding) =>
                finding.includes("unknown generated-project route"),
              ) &&
            unit
              .inspectAutoMovieAuthoringReachability([repositoryOwner])
              .some((finding) => finding.includes("repository path")) &&
            unit
              .inspectAutoMovieAuthoringReachability([nonexistentOwner])
              .some((finding) =>
                finding.includes("unknown generated-project owner"),
              )
          );
        },
      ],
      [
        "capabilityAndFieldShapeMustAgree",
        () =>
          unit
            .inspectAutoMovieAuthoringReachability([
              { ...first, field: "title" },
            ])
            .some((finding) => finding.includes("capability/field relation")),
      ],
      [
        "wrongShapeAndInventedConsumerAreRefused",
        () => {
          const wrongShape = unit.inspectAutoMovieAuthoringReachability([
            null as unknown as Row,
            {} as Row,
            { ...first, choices: ["", ""] },
            { ...first, inapplicableReason: undefined } as unknown as Row,
          ]);
          const inventedConsumer = unit.inspectAutoMovieAuthoringReachability([
            { ...first, consumer: "imaginary compiler" },
          ]);
          return (
            wrongShape.includes("row 0 has an invalid shape.") &&
            wrongShape.some((finding) =>
              finding.includes("unknown production kind undefined"),
            ) &&
            wrongShape.some((finding) =>
              finding.includes("invalid closed choices"),
            ) &&
            wrongShape.some((finding) =>
              finding.includes("blank inapplicable reason"),
            ) &&
            inventedConsumer.some((finding) =>
              finding.includes("noncanonical consumer"),
            )
          );
        },
      ],
      [
        "unknownKindCapabilityAndBlankReasonAreRefused",
        () => {
          const unknownKind = { ...first, kind: "episode" } as unknown as Row;
          const unknownCapability = {
            ...first,
            capability: "telepathy",
          };
          const blankReason = rows.find(
            (row) => row.inapplicableReason !== null,
          )!;
          return (
            unit
              .inspectAutoMovieAuthoringReachability([unknownKind])
              .some((finding) => finding.includes("unknown production kind")) &&
            unit
              .inspectAutoMovieAuthoringReachability([unknownCapability])
              .some((finding) => finding.includes("unknown capability")) &&
            unit
              .inspectAutoMovieAuthoringReachability([
                { ...blankReason, inapplicableReason: " " },
              ])
              .some((finding) => finding.includes("blank inapplicable reason"))
          );
        },
      ],
    ]),
    {
      cameraVocabularyIsTheExecutableUnion: true,
      capabilityAndFieldShapeMustAgree: true,
      everyProductionFieldHasOneShapeRow: true,
      externalInspectorPublishesEveryProfile: true,
      libraryExternalMotionIsHonestlyInapplicable: true,
      missingDuplicateAndMixedInapplicabilityAreRefused: true,
      missingRouteFieldsAreLocated: true,
      nonexistentAndRepositoryLocalRoutesAreRefused: true,
      shippedMatrixIsComplete: true,
      unknownKindCapabilityAndBlankReasonAreRefused: true,
      wrongShapeAndInventedConsumerAreRefused: true,
    },
  );
};

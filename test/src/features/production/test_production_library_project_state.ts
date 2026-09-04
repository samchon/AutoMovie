import type {
  AutoMovieContentDigest,
  IAutoMovieGeneratedManifest,
  IAutoMovieMaterializedLibrary,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { inspectAutoMovieLibraryProjectState } from "../../../../packages/production/src/production/libraryProjectState";
import { namedFacts } from "../internal/predicates";
import {
  LIBRARY_ANCHOR,
  LIBRARY_DESIGN,
  LIBRARY_SOURCE,
  libraryAuthoring,
} from "./libraryFixtures";

const hash = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}` as AutoMovieContentDigest;
const owner = {
  branch: "spaces",
  stage: "review",
  enforced: true,
  relationship: "lineage" as const,
  sourcePath: LIBRARY_SOURCE,
  exportName: "hall",
  symbolKind: "property" as const,
  sourceDigest: hash("2"),
  targetPath: LIBRARY_DESIGN,
  targetAnchor: LIBRARY_ANCHOR,
  reviewed: true,
};
const index: IAutoMovieMaterializedLibrary = {
  version: 1,
  compiler: "automovie.compiler.v9",
  production: "library-fixture",
  inputFingerprint: hash("1"),
  owners: [
    {
      branch: "spaces",
      owner: `${LIBRARY_DESIGN}#${LIBRARY_ANCHOR}`,
      source: LIBRARY_SOURCE,
      export: "hall",
      sourceDigest: hash("2"),
      environments: ["hall"],
      models: ["bench"],
      contexts: ["site"],
    },
  ],
};
const bytes = (value: unknown): Uint8Array =>
  Buffer.from(JSON.stringify(value));
const paths = [
  "library/index.json",
  "library/environments/hall.json",
  "models/bench.json",
  "library/contexts/site.json",
];
const manifest = (extra: string[] = []): IAutoMovieGeneratedManifest =>
  ({
    version: 1,
    compiler: {
      packageVersion: "1.0.0",
      protocolVersion: "automovie.compiler.v9",
    },
    inputFingerprint: hash("1"),
    files: [...paths, ...extra].map((path) => ({
      path,
      owner: "compiler",
      digest: hash("3"),
      sourceTargets: ["library"],
    })),
  }) as IAutoMovieGeneratedManifest;
const inspect = (props: {
  evidence?: ReturnType<typeof libraryAuthoring>;
  library?: unknown;
  files?: readonly string[];
  extra?: string[];
}) => {
  const resident = new Set(props.files ?? paths);
  return inspectAutoMovieLibraryProjectState({
    production: "library-fixture",
    compiler: "automovie.compiler.v9",
    inputFingerprint: hash("1"),
    authoringEvidence:
      props.evidence === undefined
        ? undefined
        : { ...props.evidence, sourceOwners: [owner] },
    manifest: manifest(props.extra),
    readFile: (path) =>
      resident.has(path)
        ? path === "library/index.json"
          ? bytes(props.library ?? index)
          : bytes({ id: path })
        : null,
  });
};

/**
 * Current project state authenticates library shape and exact owner closure.
 *
 * Scenarios:
 *
 * 1. A complete graph-bound index and every declared artifact reopens cleanly.
 * 2. Missing evidence, timed residue, missing files, malformed identity, owner drift, and duplicate artifact ownership remain distinct refusals.
 * 3. Duplicate JSON members and duplicate owner identities are rejected before a library state can become current.
 */
export const test_production_library_project_state = (): void => {
  const evidence = libraryAuthoring({ root: "C:/project" });
  TestValidator.equals(
    "library project-state reopening is discriminated and fail closed",
    namedFacts([
      [
        "completeLibraryReopens",
        () => inspect({ evidence }).problems.length === 0,
      ],
      [
        "evidenceIsRequired",
        () => inspect({}).problems[0]?.code === "authoring-evidence-required",
      ],
      [
        "timedResidueRejected",
        () =>
          inspect({ evidence, extra: ["contracts/world.json"] }).problems.some(
            (problem) => problem.code === "generated-shape-mismatch",
          ),
      ],
      [
        "missingIndexRejected",
        () =>
          inspect({ evidence, files: paths.slice(1) }).problems.some(
            (problem) => problem.code === "generated-file-missing",
          ),
      ],
      [
        "missingArtifactRejected",
        () =>
          inspect({
            evidence,
            files: paths.filter((path) => path !== "models/bench.json"),
          }).problems.some((problem) => problem.path === "models/bench.json"),
      ],
      [
        "indexIdentityRejected",
        () =>
          inspect({
            evidence,
            library: { ...index, production: "other" },
          }).problems.some(
            (problem) => problem.code === "library-index-invalid",
          ),
      ],
      [
        "ownerDigestRejected",
        () =>
          inspect({
            evidence,
            library: {
              ...index,
              owners: [{ ...index.owners[0]!, sourceDigest: hash("9") }],
            },
          }).problems.some(
            (problem) => problem.code === "library-owner-mismatch",
          ),
      ],
      [
        "duplicateArtifactOwnerRejected",
        () =>
          inspect({
            evidence,
            library: {
              ...index,
              owners: [
                index.owners[0]!,
                { ...index.owners[0]!, export: "annex" },
              ],
            },
          }).problems.some((problem) => problem.path === "models/bench.json"),
      ],
      [
        "malformedIndexRejected",
        () =>
          inspect({ evidence, library: { version: 2 } }).problems[0]?.code ===
          "library-index-invalid",
      ],
      [
        "duplicateJsonMemberRejected",
        () => {
          const result = inspectAutoMovieLibraryProjectState({
            production: "library-fixture",
            compiler: "automovie.compiler.v9",
            inputFingerprint: hash("1"),
            authoringEvidence: { ...evidence, sourceOwners: [owner] },
            manifest: manifest(),
            readFile: (path) =>
              path === "library/index.json"
                ? Buffer.from('{"version":1,"version":1}')
                : bytes({}),
          });
          return result.problems[0]?.code === "library-index-invalid";
        },
      ],
    ]),
    {
      completeLibraryReopens: true,
      evidenceIsRequired: true,
      timedResidueRejected: true,
      missingIndexRejected: true,
      missingArtifactRejected: true,
      indexIdentityRejected: true,
      ownerDigestRejected: true,
      duplicateArtifactOwnerRejected: true,
      malformedIndexRejected: true,
      duplicateJsonMemberRejected: true,
    },
  );
};

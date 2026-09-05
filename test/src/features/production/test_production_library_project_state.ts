import type {
  AutoMovieContentDigest,
  IAutoMovieGeneratedManifest,
  IAutoMovieMaterializedLibrary,
} from "@automovie/interface";
import { inspectAutoMovieLibraryProjectState } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

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
  branch: "spaceSources",
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
 * 4. Every index shape refusal is named: extra or missing members, malformed
 *    identity, repeated or unsorted owners, malformed owner fields, and
 *    repeated or unsorted artifact ids; an index the manifest does not own,
 *    evidence without source owners, an unenforced binding, a reviewed binding
 *    without an owner entry, a production-source owner, and a foreign-branch
 *    owner each join to their exact problems.
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
                { ...index.owners[0]!, export: "annex" },
                index.owners[0]!,
              ],
            },
          }).problems.some((problem) => problem.path === "models/bench.json"),
      ],
      [
        "duplicateDesignOwnerRejected",
        () => {
          const result = inspect({
            evidence,
            library: {
              ...index,
              owners: [
                {
                  ...index.owners[0]!,
                  environments: [],
                  models: [],
                  contexts: [],
                },
                {
                  ...index.owners[0]!,
                  // Sorts after every letter so the index stays in canonical
                  // order and the refusal is the duplicated owner, not the order.
                  export: "~annex",
                  environments: [],
                  models: [],
                  contexts: [],
                },
              ],
            },
          });
          return (
            result.index === null &&
            result.problems.some((problem) =>
              problem.message.includes("appears more than once"),
            )
          );
        },
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
      duplicateDesignOwnerRejected: true,
      malformedIndexRejected: true,
      duplicateJsonMemberRejected: true,
    },
  );

  const firstOwner = index.owners[0]!;
  const parseFailure = (library: unknown): string | undefined =>
    inspect({ evidence, library }).problems.find(
      (problem) => problem.code === "library-index-invalid",
    )?.message;
  const direct = (props: {
    sourceOwners?: (typeof owner)[];
    library?: unknown;
    manifestFiles?: readonly string[];
  }) =>
    inspectAutoMovieLibraryProjectState({
      production: "library-fixture",
      compiler: "automovie.compiler.v9",
      inputFingerprint: hash("1"),
      authoringEvidence: {
        ...evidence,
        sourceOwners: props.sourceOwners ?? [],
      },
      manifest: {
        ...manifest(),
        files: manifest().files.filter((file) =>
          (props.manifestFiles ?? paths).includes(file.path),
        ),
      },
      readFile: (path) =>
        path === "library/index.json"
          ? bytes(props.library ?? index)
          : bytes({ id: path }),
    });
  TestValidator.equals(
    "the index parser names every shape refusal and owner joins are exact",
    {
      extraMember: parseFailure({ ...index, extra: 1 }),
      malformedIdentity: parseFailure({ ...index, compiler: 1 }),
      repeatedOwner: parseFailure({
        ...index,
        owners: [firstOwner, firstOwner],
      }),
      unsortedOwners: parseFailure({
        ...index,
        owners: [{ ...firstOwner, export: "zeta" }, firstOwner],
      }),
      malformedOwner: parseFailure({
        ...index,
        owners: [{ ...firstOwner, sourceDigest: "sha256:short" }],
      }),
      ownerExtraMember: parseFailure({
        ...index,
        owners: [{ ...firstOwner, note: "extra" }],
      }),
      repeatedEnvironment: parseFailure({
        ...index,
        owners: [{ ...firstOwner, environments: ["hall", "hall"] }],
      }),
      unsortedModels: parseFailure({
        ...index,
        owners: [{ ...firstOwner, models: ["z", "bench"] }],
      }),
      unmanifestedIndex: direct({
        sourceOwners: [owner],
        manifestFiles: paths.slice(1),
      }).problems.map((problem) => problem.code),
      evidenceWithoutSourceOwners: direct({}).problems.map(
        (problem) => problem.code,
      ),
      unenforcedBindingIgnored: direct({
        sourceOwners: [{ ...owner, enforced: false }],
      }).problems.map((problem) => problem.code),
      reviewedBindingWithoutOwner: direct({
        sourceOwners: [owner, { ...owner, exportName: "annex" }],
      }).problems.map((problem) => problem.message.includes("annex")),
      productionSourceOwner: direct({
        sourceOwners: [
          {
            ...owner,
            branch: "productionSources",
            targetPath: "docs/settings/production.md",
            targetAnchor: "production",
          },
        ],
        library: {
          ...index,
          owners: [
            {
              ...firstOwner,
              branch: "productionSources",
              owner: "docs/settings/production.md#production",
              environments: [],
              models: [],
              contexts: [],
            },
          ],
        },
      }).problems.map((problem) => problem.code),
      foreignBranchOwner: direct({
        sourceOwners: [owner],
        library: {
          ...index,
          owners: [{ ...firstOwner, branch: "materials" }],
        },
      }).problems.map((problem) => problem.code),
    },
    {
      extraMember:
        "Library index object has unexpected or missing members: compiler, extra, inputFingerprint, owners, production, version.",
      malformedIdentity: "Library index identity or owners are malformed.",
      repeatedOwner: "Library index repeats an owner identity.",
      unsortedOwners: "Library index owners are not in canonical order.",
      malformedOwner: "Library index owner 0 is malformed.",
      ownerExtraMember:
        "Library index object has unexpected or missing members: branch, contexts, environments, export, models, note, owner, source, sourceDigest.",
      repeatedEnvironment: "Library index owner 0 repeats a environment id.",
      unsortedModels:
        "Library index owner 0 model ids are not in canonical order.",
      unmanifestedIndex: ["generated-file-missing"],
      evidenceWithoutSourceOwners: ["library-owner-mismatch"],
      unenforcedBindingIgnored: ["library-owner-mismatch"],
      reviewedBindingWithoutOwner: [true],
      productionSourceOwner: [
        "generated-shape-mismatch",
        "generated-shape-mismatch",
        "generated-shape-mismatch",
      ],
      foreignBranchOwner: ["library-owner-mismatch", "library-owner-mismatch"],
    },
  );
};

import {
  type IAutoMovieProductionEvidence,
  type IAutoMovieProductionEvidenceSourceOwnerBinding,
  createBlankAutoMovieProductionEvidence,
} from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieGeneratedManifest,
  IAutoMovieShotContract,
} from "@automovie/interface";
import type {
  IAutoMovieFingerprintField,
  IAutoMovieProductionContentInput,
  IAutoMovieProductionDesignGraph,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";
import {
  type ISourceStatusSnapshot,
  productionModule,
  textDigest,
} from "./sourceStatusFixtures";

const { acquireAutoMovieProductionSourceSnapshot } = loadSourceModule<{
  acquireAutoMovieProductionSourceSnapshot(props: {
    project: object;
    authoring: IAutoMovieProductionEvidence | undefined;
    documents: readonly string[];
    listFiles: (root: string) => string[];
  }): ISourceStatusSnapshot | null;
}>(productionModule("acquireAutoMovieProductionSourceSnapshot.ts"));
const identity = loadSourceModule<{
  authoringEvidenceFingerprintFields(
    evidence: IAutoMovieProductionEvidence | undefined,
  ): IAutoMovieFingerprintField[];
  contentFingerprintFields(
    inputs: readonly IAutoMovieProductionContentInput[],
  ): IAutoMovieFingerprintField[];
  productionBuildInputFingerprint(
    productionId: string,
    graph: IAutoMovieProductionDesignGraph,
    sourceFields: readonly IAutoMovieFingerprintField[],
    contentFields: readonly IAutoMovieFingerprintField[],
  ): AutoMovieContentDigest;
}>(productionModule("productionBuildIdentity.ts"));
const { captureAutoMovieLibraryAuthoringSnapshot } = loadSourceModule<{
  captureAutoMovieLibraryAuthoringSnapshot(props: {
    root: string;
    evidence: IAutoMovieProductionEvidence;
    readSource: (path: string) => Uint8Array;
  }): { digest: AutoMovieContentDigest };
}>(productionModule("libraryAuthoringSnapshot.ts"));
const { libraryBuildInputFingerprint } = loadSourceModule<{
  libraryBuildInputFingerprint(props: {
    production: string;
    snapshot: { digest: AutoMovieContentDigest };
    derivedFields: readonly IAutoMovieFingerprintField[];
  }): AutoMovieContentDigest;
}>(productionModule("libraryBuildInputFingerprint.ts"));
const { canonicalizeAutoMovieJson } = loadSourceModule<{
  canonicalizeAutoMovieJson(value: unknown): string;
}>(productionModule("contentIdentity.ts"));

const ROOT = path.join(path.parse(process.cwd()).root, "workspace", "harbor");
const OPENING = "export const opening = defineShot({ beats: 3 });\n";
const HALL = "export const hall = { width: 4 };\n";
const HALL_EDITED = "export const hall = { width: 5 };\n";

const CONTENT: IAutoMovieProductionContentInput[] = [
  {
    path: "src/shots/opening.ts",
    source: true,
    render: false,
    bytes: Buffer.from(OPENING, "utf8"),
  },
  {
    path: "public/textures/sail.png",
    source: false,
    render: true,
    bytes: Buffer.from([7, 8, 9]),
  },
];

const GRAPH: IAutoMovieProductionDesignGraph = {
  production: null,
  models: new Map(),
  world: null,
  formations: new Map(),
  shots: new Map([
    [
      "opening",
      {
        id: "opening",
        source: { module: "src/shots/opening.ts", export: "opening" },
      } as unknown as IAutoMovieShotContract,
    ],
  ]),
  acceptance: new Map(),
};

const SCREENPLAY_INDEX = {
  version: 1,
  treatment: { path: "docs/treatment.md", sequences: [] },
};

const DOCUMENTS = new Map<string, string>([
  ["docs/screenplays/001-harbor.md", "INT. HARBOR - NIGHT"],
  ["docs/treatment.md", "A harbor at night."],
]);

const GENERATED = new Map<string, Uint8Array>([
  ["shots/opening.json", Buffer.from("compiled opening", "utf8")],
  ["manifests/compile.json", Buffer.from("compiled registry", "utf8")],
]);

const manifestOf = (): IAutoMovieGeneratedManifest => ({
  version: 1,
  builder: { packageVersion: "0.1.0", protocolVersion: "unit" },
  inputFingerprint: textDigest("an earlier compile"),
  files: [
    {
      path: "shots/opening.json",
      owner: "builder",
      digest: textDigest("compiled opening"),
      sourceTargets: ["shot:opening"],
    },
  ],
});

const sourceOwner = (props: {
  branch: string;
  text: string;
  sourcePath: string;
  exportName: string;
  targetPath: string;
}): IAutoMovieProductionEvidenceSourceOwnerBinding => ({
  branch: props.branch,
  stage: "review",
  enforced: true,
  relationship: "lineage",
  sourcePath: props.sourcePath,
  exportName: props.exportName,
  symbolKind: "property",
  sourceDigest: textDigest(props.text),
  targetPath: props.targetPath,
  targetAnchor: props.exportName,
  reviewed: true,
});

const filmEvidenceOf = (): IAutoMovieProductionEvidence => ({
  root: ROOT,
  packageName: "harbor",
  description: "",
  configuration: {
    ...createBlankAutoMovieProductionEvidence(ROOT, "english"),
    kind: "film",
    settings: "review",
    shots: "review",
  },
  manifest: {
    kind: "film",
    language: "english",
    populationScope: { mode: "complete-production" },
    branches: [
      { name: "settings", stage: "review" },
      { name: "shots", stage: "review" },
    ],
    bindings: [],
    localBindings: [],
    localAudits: [],
    topology: { branches: [], expected: [], declarations: [], diagnostics: [] },
  },
  designBranches: [],
  designOwners: [],
  sourceOwners: [
    sourceOwner({
      branch: "shots",
      text: OPENING,
      sourcePath: "src/shots/opening.ts",
      exportName: "opening",
      targetPath: "docs/screenplays/001-harbor.md",
    }),
  ],
  contracts: [],
  contractRules: [],
  reviewAlarms: { alarms: [], questionPasteChecked: false },
});

const libraryEvidenceOf = (root: string): IAutoMovieProductionEvidence => {
  const sourceBinding = {
    branch: "spaceSources",
    stage: "review",
    enforced: true,
    root: ".",
    files: ["src/spaces/**/*.ts"],
    symbols: ["property"],
    paths: ["src/spaces/hall.ts"],
  };
  return {
    root,
    packageName: "harbor",
    description: "",
    configuration: {
      ...createBlankAutoMovieProductionEvidence(root, "english"),
      kind: "library",
      settings: "review",
      spaces: "review",
      spaceSources: "review",
    },
    manifest: {
      kind: "library",
      language: "english",
      populationScope: { mode: "complete-production" },
      branches: [
        { name: "settings", stage: "review" },
        { name: "spaces", stage: "review" },
        { name: "spaceSources", stage: "review" },
      ],
      bindings: [],
      localBindings: [],
      localAudits: [],
      topology: {
        branches: [],
        expected: [],
        declarations: [],
        diagnostics: [],
      },
    },
    designBranches: [
      { branch: "spaces", designStage: "review", sourceBinding },
    ],
    designOwners: [
      {
        branch: "spaces",
        path: "docs/spaces/hall.md",
        title: "Hall",
        units: [{ anchor: "hall", title: "Hall", digest: "a".repeat(64) }],
        sourceBinding,
      },
    ],
    sourceOwners: [
      sourceOwner({
        branch: "spaceSources",
        text: HALL,
        sourcePath: "src/spaces/hall.ts",
        exportName: "hall",
        targetPath: "docs/spaces/hall.md",
      }),
    ],
    contracts: [],
    contractRules: [],
    reviewAlarms: { alarms: [], questionPasteChecked: false },
  };
};

const projectOf = (overrides: Record<string, unknown> = {}) => ({
  root: ROOT,
  productionId: "harbor",
  archetypes: undefined,
  revision: () => 3,
  graph: () => GRAPH,
  readSource: (file: string): Uint8Array => {
    if (file === "src/shots/opening.ts") return Buffer.from(OPENING, "utf8");
    if (file === "src/spaces/hall.ts") return Buffer.from(HALL, "utf8");
    throw new Error(`Source "${file}" does not exist.`);
  },
  contentInputs: () => CONTENT,
  manifest: () => ({}),
  screenplayIndex: () => SCREENPLAY_INDEX,
  readProseDocument: (file: string): string | null =>
    DOCUMENTS.get(file) ?? null,
  generatedManifest: () => manifestOf(),
  generatedRoot: () => path.join(ROOT, "generated", "harbor"),
  readGeneratedFile: (file: string): Uint8Array => {
    const bytes = GENERATED.get(file);
    if (bytes === undefined)
      throw new Error(`Generated file "${file}" is a symlink or junction.`);
    return bytes;
  },
  ...overrides,
});

const listed = (root: string): string[] =>
  ["shots/opening.json", "stray.lnk", "manifests/compile.json"].map((file) =>
    path.join(root, ...file.split("/")),
  );

/**
 * A fresh source snapshot names every input a gate answer depends on.
 *
 * Nothing is executed. A timed production's input identity must be the
 * builder's own field projection over the current evidence, design, source and
 * content, and a library's must be its namespace-bound identity over the
 * resident authoring snapshot and content closure, with the resident digest
 * beside it. The screenplay index, requested documents and every entry under the
 * builder-owned root are read as they stand. A revision that moves during the
 * read, or an identity that cannot be derived, leaves no snapshot, and a read
 * the project handle refuses propagates.
 *
 * Scenarios:
 *
 * 1. A timed production reports its revision, the builder field projection of
 *    its evidence, shot source, absent film source and content, no resident
 *    digest, the canonical screenplay index digest, the requested documents
 *    once each in path order with an absent one as `null`, and every generated
 *    entry in path order with an unreadable one as `null`.
 * 2. A timed production without authoring evidence hashes no owner-binding
 *    field, and a production without a screenplay index or generated manifest
 *    reports both as `null` and an empty generated root.
 * 3. A revision that moves between the first and last read, and an identity whose
 *    design cannot be read, report no snapshot.
 * 4. A screenplay read the project handle refuses propagates its error.
 * 5. A library reports its resident authoring digest and its namespace-bound
 *    identity over that snapshot and content. Another namespace moves only the
 *    identity, a source edit moves both, and evidence from another checkout is
 *    refused.
 */
export const test_production_source_snapshot_acquisition = (): void => {
  const filmEvidence = filmEvidenceOf();
  const manifest = manifestOf();
  const timed = acquireAutoMovieProductionSourceSnapshot({
    project: projectOf(),
    authoring: filmEvidence,
    documents: [
      "docs/treatment.md",
      "docs/screenplays/001-harbor.md",
      "docs/treatment.md",
      "docs/missing.md",
    ],
    listFiles: listed,
  });
  TestValidator.equals("a timed snapshot names every gate input", timed, {
    revision: 3,
    inputFingerprint: identity.productionBuildInputFingerprint(
      "harbor",
      GRAPH,
      [
        ...identity.authoringEvidenceFingerprintFields(filmEvidence),
        {
          role: "source:opening",
          kind: "typescript",
          payload: Buffer.from(OPENING, "utf8"),
        },
        { role: "source:film", kind: "absent", payload: new Uint8Array() },
      ],
      identity.contentFingerprintFields(CONTENT),
    ),
    resident: null,
    screenplay: textDigest(canonicalizeAutoMovieJson(SCREENPLAY_INDEX)),
    documents: [
      { path: "docs/missing.md", digest: null },
      {
        path: "docs/screenplays/001-harbor.md",
        digest: textDigest("INT. HARBOR - NIGHT"),
      },
      { path: "docs/treatment.md", digest: textDigest("A harbor at night.") },
    ],
    generated: {
      inputFingerprint: manifest.inputFingerprint,
      manifest: textDigest(canonicalizeAutoMovieJson(manifest)),
      files: [
        {
          path: "manifests/compile.json",
          digest: textDigest("compiled registry"),
        },
        { path: "shots/opening.json", digest: textDigest("compiled opening") },
        { path: "stray.lnk", digest: null },
      ],
    },
  });

  TestValidator.equals(
    "a timed production without evidence hashes no owner edges",
    acquireAutoMovieProductionSourceSnapshot({
      project: projectOf(),
      authoring: undefined,
      documents: [],
      listFiles: () => [],
    })?.inputFingerprint,
    identity.productionBuildInputFingerprint(
      "harbor",
      GRAPH,
      [
        {
          role: "source:opening",
          kind: "typescript",
          payload: Buffer.from(OPENING, "utf8"),
        },
        { role: "source:film", kind: "absent", payload: new Uint8Array() },
      ],
      identity.contentFingerprintFields(CONTENT),
    ),
  );

  const bare = acquireAutoMovieProductionSourceSnapshot({
    project: projectOf({
      screenplayIndex: () => null,
      generatedManifest: () => null,
    }),
    authoring: filmEvidence,
    documents: [],
    listFiles: () => [],
  });
  TestValidator.equals(
    "a production without screenplay or output reports both absent",
    { screenplay: bare?.screenplay, generated: bare?.generated },
    {
      screenplay: null,
      generated: { inputFingerprint: null, manifest: null, files: [] },
    },
  );

  const revisions = [3, 4];
  TestValidator.equals(
    "a moving revision or an underivable identity leaves no snapshot",
    {
      movingRevision: acquireAutoMovieProductionSourceSnapshot({
        project: projectOf({ revision: () => revisions.shift() }),
        authoring: filmEvidence,
        documents: [],
        listFiles: listed,
      }),
      unreadableDesign: acquireAutoMovieProductionSourceSnapshot({
        project: projectOf({
          graph: () => {
            throw new Error("Shot contract opening fails its schema.");
          },
        }),
        authoring: filmEvidence,
        documents: [],
        listFiles: listed,
      }),
    },
    { movingRevision: null, unreadableDesign: null },
  );
  TestValidator.equals(
    "a refused read propagates its own error",
    throwsError(
      () =>
        acquireAutoMovieProductionSourceSnapshot({
          project: projectOf({
            screenplayIndex: () => {
              throw new Error("Production state incarnation changed.");
            },
          }),
          authoring: filmEvidence,
          documents: [],
          listFiles: listed,
        }),
      "incarnation changed",
    ),
    true,
  );

  const library = (
    overrides: Record<string, unknown>,
    evidence: IAutoMovieProductionEvidence = libraryEvidenceOf(ROOT),
  ): ISourceStatusSnapshot =>
    acquireAutoMovieProductionSourceSnapshot({
      project: projectOf(overrides),
      authoring: evidence,
      documents: [],
      listFiles: listed,
    })!;
  const libraryIdentity = (production: string, hall: string) => {
    const snapshot = captureAutoMovieLibraryAuthoringSnapshot({
      root: ROOT,
      evidence: libraryEvidenceOf(ROOT),
      readSource: () => Buffer.from(hall, "utf8"),
    });
    return {
      resident: snapshot.digest,
      inputFingerprint: libraryBuildInputFingerprint({
        production,
        snapshot,
        derivedFields: identity.contentFingerprintFields(CONTENT),
      }),
    };
  };
  const base = library({});
  const annex = library({ productionId: "harbor-annex" });
  const edited = library({
    readSource: () => Buffer.from(HALL_EDITED, "utf8"),
  });
  TestValidator.equals(
    "a library snapshot carries its resident guard and namespace-bound identity",
    [base, annex, edited].map((snapshot) => ({
      resident: snapshot.resident,
      inputFingerprint: snapshot.inputFingerprint,
    })),
    [
      libraryIdentity("harbor", HALL),
      libraryIdentity("harbor-annex", HALL),
      libraryIdentity("harbor", HALL_EDITED),
    ],
  );
  TestValidator.equals(
    "the namespace moves only the identity and a source edit moves both",
    {
      annexResidentKept: annex.resident === base.resident,
      annexIdentityMoved: annex.inputFingerprint !== base.inputFingerprint,
      editResidentMoved: edited.resident !== base.resident,
      editIdentityMoved: edited.inputFingerprint !== base.inputFingerprint,
    },
    {
      annexResidentKept: true,
      annexIdentityMoved: true,
      editResidentMoved: true,
      editIdentityMoved: true,
    },
  );
  TestValidator.equals(
    "library evidence from another checkout is refused",
    throwsError(
      () =>
        library(
          {},
          libraryEvidenceOf(
            path.join(path.parse(ROOT).root, "elsewhere", "harbor"),
          ),
        ),
      "belongs to",
    ),
    true,
  );
};

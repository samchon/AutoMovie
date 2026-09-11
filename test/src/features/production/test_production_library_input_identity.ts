import {
  type IAutoMovieProductionEvidence,
  createBlankAutoMovieProductionEvidence,
} from "@automovie/evidence";
import type {
  AutoMovieContentDigest,
  IAutoMovieGeneratedManifest,
} from "@automovie/interface";
import {
  AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
  type IAutoMovieFingerprintField,
  type IAutoMovieProductionContentInput,
  canonicalizeAutoMovieJson,
  digestAutoMovieBytes,
  inspectAutoMovieLibraryProjectState,
  materializeAutoMovieLibraryFiles,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

/** The resident snapshot fields this scenario reads; the rest stays opaque. */
interface ISnapshot {
  root: string;
  digest: AutoMovieContentDigest;
  configuration: { location: string };
  sources: readonly { path: string; digest: AutoMovieContentDigest | null }[];
}

/** A portable projection, compared only through its canonical encoding. */
type IPortable = Readonly<Record<string, unknown>> & {
  configuration: Readonly<Record<string, unknown>>;
};

const productionModule = (file: string): string =>
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production",
    file,
  );

const snapshots = loadSourceModule<{
  captureAutoMovieLibraryAuthoringSnapshot(props: {
    root: string;
    evidence: IAutoMovieProductionEvidence;
    readSource: (path: string) => Uint8Array;
  }): ISnapshot;
  sameAutoMovieLibraryAuthoringSnapshot(
    left: ISnapshot,
    right: ISnapshot,
  ): boolean;
}>(productionModule("libraryAuthoringSnapshot.ts"));
const { portableAutoMovieLibraryAuthoringSnapshot } = loadSourceModule<{
  portableAutoMovieLibraryAuthoringSnapshot(snapshot: ISnapshot): IPortable;
}>(productionModule("portableAutoMovieLibraryAuthoringSnapshot.ts"));
const { libraryBuildInputFingerprint } = loadSourceModule<{
  libraryBuildInputFingerprint(props: {
    production: string;
    snapshot: ISnapshot;
    derivedFields: readonly IAutoMovieFingerprintField[];
  }): AutoMovieContentDigest;
}>(productionModule("libraryBuildInputFingerprint.ts"));
const { contentFingerprintFields } = loadSourceModule<{
  contentFingerprintFields(
    inputs: readonly IAutoMovieProductionContentInput[],
  ): IAutoMovieFingerprintField[];
}>(productionModule("productionBuildIdentity.ts"));

const HALL = "src/spaces/hall.ts";
const SHARED = "src/spaces/shared.ts";
const HELPER = "src/shared/geometry.ts";
const ASSET = "public/textures/stone.png";
const INDEX = "library/index.json";
const WINDOWS = "D:\\a\\x";
const POSIX = "/home/b/x";

/** Every fact one library attempt can differ by in this scenario. */
interface IVariant {
  /** Checkout root the evidence was read from. */
  root: string;
  /** Registered production namespace. */
  production: string;
  /** Graph-selected owner source. */
  hall: string;
  /** Helper inside the selected source population. */
  shared: string;
  /** Imported helper outside the selected source population. */
  helper: string;
  /** Adopted asset bytes. */
  asset: Uint8Array;
  /** Verified derived output bytes. */
  derived: Uint8Array;
  /** Authored target anchor of the owner edge. */
  anchor: string;
  /** Digest of the reviewed design H2. */
  unit: string;
  /** One selected configuration choice outside the owner branches. */
  materials: "disabled" | "draft";
  /** Whether the checkout wrote CRLF line endings and a byte order mark. */
  crlf: boolean;
}

const BASE: IVariant = {
  root: WINDOWS,
  production: "harbor",
  hall: 'import { width } from "./shared";\nexport const hall = { width };\n',
  shared: "export const width = 4;\n",
  helper: "export const span = 2;\n",
  asset: Buffer.from([1, 2, 3]),
  derived: Buffer.from("[0,1]\n", "utf8"),
  anchor: "hall",
  unit: "a".repeat(64),
  materials: "disabled",
  crlf: false,
};

const checkout = (text: string, crlf: boolean): Uint8Array =>
  crlf
    ? Buffer.from(`\ufeff${text.replaceAll("\n", "\r\n")}`, "utf8")
    : Buffer.from(text, "utf8");

const evidenceOf = (variant: IVariant): IAutoMovieProductionEvidence => {
  const sourceBinding = {
    branch: "spaceSources",
    stage: "review",
    enforced: true,
    root: ".",
    files: ["src/spaces/**/*.ts"],
    symbols: ["property"],
    paths: [HALL, SHARED],
  };
  return {
    root: variant.root,
    packageName: "harbor",
    description: "",
    configuration: {
      ...createBlankAutoMovieProductionEvidence(variant.root, "english"),
      kind: "library",
      settings: "review",
      spaces: "review",
      spaceSources: "review",
      materials: variant.materials,
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
        units: [{ anchor: "hall", title: "Hall", digest: variant.unit }],
        sourceBinding,
      },
    ],
    sourceOwners: [
      {
        branch: "spaceSources",
        stage: "review",
        enforced: true,
        relationship: "lineage",
        sourcePath: HALL,
        exportName: "hall",
        symbolKind: "property",
        sourceDigest: digestAutoMovieBytes(Buffer.from(variant.hall, "utf8")),
        targetPath: "docs/spaces/hall.md",
        targetAnchor: variant.anchor,
        reviewed: true,
      },
    ],
    contracts: [],
    contractRules: [],
    reviewAlarms: { alarms: [], questionPasteChecked: false },
  };
};

const capture = (
  variant: IVariant,
  builderRoot: string = variant.root,
): ISnapshot =>
  snapshots.captureAutoMovieLibraryAuthoringSnapshot({
    root: builderRoot,
    evidence: evidenceOf(variant),
    readSource: (file) => {
      if (file === HALL) return checkout(variant.hall, variant.crlf);
      if (file === SHARED) return checkout(variant.shared, variant.crlf);
      throw new Error(`Unselected source ${file} was read.`);
    },
  });

const fingerprint = (
  variant: IVariant,
  snapshot: ISnapshot = capture(variant),
): AutoMovieContentDigest =>
  libraryBuildInputFingerprint({
    production: variant.production,
    snapshot,
    derivedFields: [
      ...contentFingerprintFields([
        {
          path: HELPER,
          source: true,
          render: false,
          bytes: checkout(variant.helper, variant.crlf),
        },
        { path: ASSET, source: false, render: true, bytes: variant.asset },
      ]),
      { role: "derived-output", kind: "file", payload: variant.derived },
    ],
  });

const publish = (
  production: string,
  inputFingerprint: AutoMovieContentDigest,
) => {
  const publication = materializeAutoMovieLibraryFiles({
    production,
    builder: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
    inputFingerprint,
    results: [],
  });
  const bytes = publication.files.get(INDEX)!;
  const manifest: IAutoMovieGeneratedManifest = {
    version: 1,
    builder: {
      packageVersion: "0.0.0",
      protocolVersion: AUTOMOVIE_PRODUCTION_BUILD_PROTOCOL,
    },
    inputFingerprint,
    files: [
      {
        path: INDEX,
        owner: "builder",
        digest: digestAutoMovieBytes(bytes),
        sourceTargets: ["library"],
      },
    ],
  };
  return { index: publication.index, manifest, bytes };
};

const reopen = (
  production: string,
  published: ReturnType<typeof publish>,
): string[] =>
  inspectAutoMovieLibraryProjectState({
    production,
    builder: published.manifest.builder.protocolVersion,
    inputFingerprint: published.manifest.inputFingerprint,
    authoringEvidence: { ...evidenceOf(BASE), sourceOwners: [] },
    manifest: published.manifest,
    readFile: (file) => (file === INDEX ? published.bytes : null),
  }).problems.map((problem) => problem.code);

/**
 * A library input identity names what was built, not where it was built.
 *
 * The authoring snapshot is acquired inside one checkout, so it carries the
 * builder root and the declaration's absolute location beside the facts a
 * library result depends on. The publication guard must keep comparing those
 * resident facts, and the result identity must not see them. The same work
 * under one namespace in two checkouts therefore shares one identity, while the
 * namespace and every result-changing input still move it.
 *
 * Scenarios:
 *
 * 1. The same evidence and source bytes captured at `D:\a\x` and `/home/b/x` read
 *    the same normalized sources and keep different resident digests, so the
 *    guard refuses one against the other and accepts a repeated acquisition.
 *    Their portable projections lack exactly the root, the location and the
 *    digest over them, restore the resident snapshot when those three facts
 *    are put back, and are equal. The two checkouts, a CRLF and byte-order-mark
 *    checkout, and a repeated acquisition give one library input fingerprint.
 * 2. Evidence read from one checkout is refused by the other checkout's builder
 *    root, a separate assertion from the shared identity.
 * 3. Another namespace gives another fingerprint. Each published index records
 *    the namespace and the fingerprint that bound it, and the library state
 *    reader opens an index only under its own namespace.
 * 4. A selected source edit, a helper edit inside the selected population, an
 *    imported helper edit outside it, an owner anchor change, a design unit
 *    change, a configuration choice, an adopted asset edit, and a derived
 *    output edit each move the fingerprint. A line-ending-only helper edit does
 *    not.
 */
export const test_production_library_input_identity = (): void => {
  const windows = capture(BASE);
  const posix = capture({ ...BASE, root: POSIX });
  const recaptured = capture(BASE);
  const selectedSources = [
    { path: HALL, digest: digestAutoMovieBytes(Buffer.from(BASE.hall)) },
    { path: SHARED, digest: digestAutoMovieBytes(Buffer.from(BASE.shared)) },
  ];
  TestValidator.equals(
    "both checkouts read the same normalized selected sources",
    [windows.sources, posix.sources],
    [selectedSources, selectedSources],
  );
  TestValidator.equals(
    "the resident guard still tells the checkouts apart",
    namedFacts([
      ["residentDigestsDiffer", () => windows.digest !== posix.digest],
      [
        "guardRefusesOtherCheckout",
        () =>
          snapshots.sameAutoMovieLibraryAuthoringSnapshot(windows, posix) ===
          false,
      ],
      [
        "guardAcceptsRepeatedAcquisition",
        () =>
          snapshots.sameAutoMovieLibraryAuthoringSnapshot(windows, recaptured),
      ],
    ]),
    {
      residentDigestsDiffer: true,
      guardRefusesOtherCheckout: true,
      guardAcceptsRepeatedAcquisition: true,
    },
  );

  const portable = portableAutoMovieLibraryAuthoringSnapshot(windows);
  TestValidator.equals(
    "the portable projection drops exactly the location facts",
    namedFacts([
      ["rootDropped", () => "root" in portable === false],
      ["residentDigestDropped", () => "digest" in portable === false],
      ["locationDropped", () => "location" in portable.configuration === false],
      [
        "nothingElseDropped",
        () =>
          canonicalizeAutoMovieJson({
            ...portable,
            root: windows.root,
            digest: windows.digest,
            configuration: {
              ...portable.configuration,
              location: windows.configuration.location,
            },
          }) === canonicalizeAutoMovieJson(windows),
      ],
      [
        "checkoutsShareProjection",
        () =>
          canonicalizeAutoMovieJson(portable) ===
          canonicalizeAutoMovieJson(
            portableAutoMovieLibraryAuthoringSnapshot(posix),
          ),
      ],
    ]),
    {
      rootDropped: true,
      residentDigestDropped: true,
      locationDropped: true,
      nothingElseDropped: true,
      checkoutsShareProjection: true,
    },
  );

  const base = fingerprint(BASE, windows);
  TestValidator.equals(
    "one library input identity across checkouts",
    namedFacts([
      [
        "posixCheckout",
        () => fingerprint({ ...BASE, root: POSIX }, posix) === base,
      ],
      ["crlfCheckout", () => fingerprint({ ...BASE, crlf: true }) === base],
      ["repeatedAcquisition", () => fingerprint(BASE, recaptured) === base],
    ]),
    { posixCheckout: true, crlfCheckout: true, repeatedAcquisition: true },
  );
  TestValidator.equals(
    "evidence from another checkout is refused",
    throwsError(() => capture(BASE, POSIX), ["belongs to", "not builder root"]),
    true,
  );

  const annex = fingerprint({ ...BASE, production: "harbor-annex" }, windows);
  TestValidator.equals(
    "the namespace moves the identity",
    annex !== base,
    true,
  );
  const harborIndex = publish("harbor", base);
  const annexIndex = publish("harbor-annex", annex);
  TestValidator.equals(
    "each index records the namespace its identity bound",
    [
      [harborIndex.index.production, harborIndex.index.inputFingerprint],
      [annexIndex.index.production, annexIndex.index.inputFingerprint],
    ],
    [
      ["harbor", base],
      ["harbor-annex", annex],
    ],
  );
  TestValidator.equals(
    "the library state reader opens an index only under its namespace",
    [
      reopen("harbor", harborIndex),
      reopen("harbor-annex", harborIndex),
      reopen("harbor-annex", annexIndex),
    ],
    [[], ["library-index-invalid"], []],
  );

  const moved = (change: Partial<IVariant>): boolean =>
    fingerprint({ ...BASE, ...change }) !== base;
  TestValidator.equals(
    "every result-changing input moves the identity",
    {
      selectedSource: moved({ hall: `${BASE.hall}export const depth = 6;\n` }),
      populationHelper: moved({ shared: "export const width = 5;\n" }),
      importedHelper: moved({ helper: "export const span = 3;\n" }),
      ownerAnchor: moved({ anchor: "hall-east" }),
      designUnit: moved({ unit: "b".repeat(64) }),
      configuration: moved({ materials: "draft" }),
      adoptedAsset: moved({ asset: Buffer.from([1, 2, 4]) }),
      derivedOutput: moved({ derived: Buffer.from("[0,2]\n", "utf8") }),
      helperLineEndingsOnly: moved({
        helper: BASE.helper.replaceAll("\n", "\r\n"),
      }),
    },
    {
      selectedSource: true,
      populationHelper: true,
      importedHelper: true,
      ownerAnchor: true,
      designUnit: true,
      configuration: true,
      adoptedAsset: true,
      derivedOutput: true,
      helperLineEndingsOnly: false,
    },
  );
};

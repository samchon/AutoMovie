import type {
  IAutoMovieAssetProvenance,
  IAutoMovieDiagnostic,
} from "@automovie/interface";
import type {
  IAutoMovieFingerprintField,
  IAutoMovieProductionContentInput,
  IAutoMovieProductionDesignGraph,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { productionModule, textDigest } from "./sourceStatusFixtures";

interface IDerivedInputs {
  artifacts: Readonly<Record<string, unknown>>;
  fields: IAutoMovieFingerprintField[];
  diagnostics: IAutoMovieDiagnostic[];
  assets: IAutoMovieAssetProvenance[];
  content: IAutoMovieProductionContentInput[];
}

const { readAutoMovieLibraryDerivedInputs } = loadSourceModule<{
  readAutoMovieLibraryDerivedInputs(props: {
    project: object;
    enabled: boolean;
  }): IDerivedInputs;
}>(productionModule("readAutoMovieLibraryDerivedInputs.ts"));
const { contentFingerprintFields } = loadSourceModule<{
  contentFingerprintFields(
    inputs: readonly IAutoMovieProductionContentInput[],
  ): IAutoMovieFingerprintField[];
}>(productionModule("productionBuildIdentity.ts"));
const { productionAssetInventory } = loadSourceModule<{
  productionAssetInventory(
    manifestPath: string | undefined,
    inputs: readonly IAutoMovieProductionContentInput[],
    productionId: string,
    graph: IAutoMovieProductionDesignGraph,
    archetypes: unknown,
  ): {
    records: IAutoMovieAssetProvenance[];
    diagnostics: IAutoMovieDiagnostic[];
  };
}>(productionModule("productionAssetInventory.ts"));
const { inspectAutoMovieDerivedArtifacts } = loadSourceModule<{
  inspectAutoMovieDerivedArtifacts(props: {
    root: string;
    manifestPath?: string;
    externalAssetPaths?: readonly string[];
  }): {
    fingerprintFields: IAutoMovieFingerprintField[];
    problems: Array<{
      code: IAutoMovieDiagnostic["code"];
      target: string;
      path: string | null;
      message: string;
    }>;
  };
}>(productionModule("derivedArtifacts.ts"));

/** A project root that does not exist, so its derivation root cannot resolve. */
const ROOT = path.join(__dirname, "absent-derived-inputs-project");
const LEDGER = "automovie/assets.json";
const DERIVATIONS = "automovie/derived-artifacts.json";
const WIND = "assets/sound/harbor-wind.ogg";

const GRAPH: IAutoMovieProductionDesignGraph = {
  production: null,
  models: new Map(),
  world: null,
  formations: new Map(),
  shots: new Map(),
  acceptance: new Map(),
};

const contentOf = (): IAutoMovieProductionContentInput[] => [
  {
    path: "src/spaces/hall.ts",
    source: true,
    render: false,
    bytes: Buffer.from("export const hall = { width: 4 };\n", "utf8"),
  },
  {
    path: WIND,
    source: false,
    render: true,
    bytes: Buffer.from("harbor wind", "utf8"),
  },
  {
    path: LEDGER,
    source: false,
    render: false,
    bytes: Buffer.from(
      JSON.stringify({
        version: 1,
        assets: [
          {
            path: WIND,
            digest: textDigest("harbor wind"),
            uses: [
              {
                production: "harbor",
                consumer: { kind: "audio-cue", id: "harbor-wind" },
                reason: "Ambient wind under the hall walkthrough.",
              },
            ],
          },
        ],
      }),
      "utf8",
    ),
  },
];

/**
 * A library's derived inputs are read once, the same way for its compile and
 * every later check.
 *
 * The fields a library result is bound to are the declared content inventory
 * followed by the verified derivation closure, and the compile also receives
 * the admitted artifacts, the adopted asset records and their diagnostics from
 * that same read. An unreadable inventory must become an unsafe field and a
 * refusal rather than an exception, and the derivation closure must still be
 * inspected, so the failure reaches both the identity and the author. A scope
 * that reads no content must touch nothing.
 *
 * Scenarios:
 *
 * 1. A disabled read calls no project method and returns empty inputs.
 * 2. A readable inventory with an asset ledger and no derivation manifest gives
 *    the content fields, the ledger's adopted records and diagnostics as the
 *    asset inventory reads them, the inventory itself, and no artifacts.
 * 3. An unreadable inventory gives one unsafe field and one refusal naming the
 *    cause, then the derivation closure's own fields and its refusals as
 *    project errors.
 * 4. An asset inventory that fails after the content was read keeps the content
 *    fields and inventory, appends the unsafe field, and refuses with the cause.
 */
export const test_production_library_derived_inputs = (): void => {
  let reads = 0;
  const projectOf = (props: {
    manifest?: { assetManifest?: string; derivedArtifactManifest?: string };
    contentInputs?: () => IAutoMovieProductionContentInput[];
    graph?: () => IAutoMovieProductionDesignGraph;
  }) => {
    const count =
      <T>(read: () => T): (() => T) =>
      () => {
        reads += 1;
        return read();
      };
    return {
      root: ROOT,
      productionId: "harbor",
      archetypes: undefined,
      manifest: count(() => props.manifest ?? {}),
      contentInputs: count(props.contentInputs ?? contentOf),
      graph: count(props.graph ?? (() => GRAPH)),
    };
  };

  TestValidator.equals(
    "a disabled read touches nothing",
    {
      inputs: readAutoMovieLibraryDerivedInputs({
        project: projectOf({}),
        enabled: false,
      }),
      reads,
    },
    {
      inputs: {
        artifacts: {},
        fields: [],
        diagnostics: [],
        assets: [],
        content: [],
      },
      reads: 0,
    },
  );

  const content = contentOf();
  const inventory = productionAssetInventory(
    LEDGER,
    content,
    "harbor",
    GRAPH,
    undefined,
  );
  const readable = readAutoMovieLibraryDerivedInputs({
    project: projectOf({
      manifest: { assetManifest: LEDGER },
      contentInputs: () => content,
    }),
    enabled: true,
  });
  TestValidator.equals(
    "a readable inventory gives its fields, records and diagnostics",
    readable,
    {
      artifacts: {},
      fields: contentFingerprintFields(content),
      diagnostics: inventory.diagnostics,
      assets: inventory.records,
      content,
    },
  );
  TestValidator.equals(
    "the adopted ledger record is carried",
    readable.assets.map((asset) => asset.path),
    [WIND],
  );

  const derivation = inspectAutoMovieDerivedArtifacts({
    root: ROOT,
    manifestPath: DERIVATIONS,
    externalAssetPaths: [],
  });
  const derivationRefusals = derivation.problems.map(
    (problem): IAutoMovieDiagnostic => ({
      code: problem.code,
      category: "error",
      phase: "project",
      target: problem.target,
      path: problem.path,
      message: problem.message,
    }),
  );
  const unsafe: IAutoMovieFingerprintField = {
    role: "content:inventory",
    kind: "unsafe",
    payload: new Uint8Array(),
  };
  TestValidator.equals(
    "an unreadable inventory refuses and still inspects the derivation closure",
    readAutoMovieLibraryDerivedInputs({
      project: projectOf({
        manifest: {
          assetManifest: LEDGER,
          derivedArtifactManifest: DERIVATIONS,
        },
        contentInputs: () => {
          throw new Error("Declared content root escapes the project.");
        },
      }),
      enabled: true,
    }),
    {
      artifacts: {},
      fields: [unsafe, ...derivation.fingerprintFields],
      diagnostics: [
        {
          code: "content-input-unsafe",
          category: "error",
          phase: "source",
          target: "declared-content",
          path: null,
          message: "Declared content root escapes the project.",
        },
        ...derivationRefusals,
      ],
      assets: [],
      content: [],
    },
  );
  TestValidator.predicate(
    "the unreadable-root derivation closure refuses",
    derivationRefusals.length !== 0,
  );

  const afterContent = contentOf();
  TestValidator.equals(
    "an inventory failure after the content read keeps the content",
    readAutoMovieLibraryDerivedInputs({
      project: projectOf({
        manifest: { assetManifest: LEDGER },
        contentInputs: () => afterContent,
        graph: () => {
          throw new Error("Model recipe hall fails its schema.");
        },
      }),
      enabled: true,
    }),
    {
      artifacts: {},
      fields: [...contentFingerprintFields(afterContent), unsafe],
      diagnostics: [
        {
          code: "content-input-unsafe",
          category: "error",
          phase: "source",
          target: "declared-content",
          path: null,
          message: "Model recipe hall fails its schema.",
        },
      ],
      assets: [],
      content: afterContent,
    },
  );
};

import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** Repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

const readPackageFile = (...segments: string[]): string =>
  fs.readFileSync(path.join(ROOT, ...segments), "utf8");

/** Directory names directly under `segments`, in code-unit order. */
const directories = (...segments: string[]): string[] =>
  fs
    .readdirSync(path.join(ROOT, ...segments), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareCodeUnits);

/** Module names one package's `src/index.ts` re-exports, in code-unit order. */
const exportedModules = (pkg: string): string[] =>
  [
    ...readPackageFile("packages", pkg, "src", "index.ts").matchAll(
      /^export \* from "\.\/([^"]+)";$/gm,
    ),
  ]
    .map((line) => line[1]!)
    .sort(compareCodeUnits);

/** The names one module declares to the outside. */
const exportedNames = (pkg: string, module: string): string[] =>
  [
    ...readPackageFile("packages", pkg, "src", `${module}.ts`).matchAll(
      /^export (?:const|function|interface|type|class) ([A-Za-z_$][\w$]*)/gm,
    ),
  ].map((declaration) => declaration[1]!);

/**
 * Modules whose surface table names none of their exports.
 *
 * A table of functions cannot be compared with a list of filenames directly, so
 * the question asked is the one a reader would ask: does this document mention
 * anything this module exports? A module the table forgot answers no.
 */
const unmentionedModules = (pkg: string, document: string): string[] =>
  exportedModules(pkg).filter(
    (module) =>
      !exportedNames(pkg, module).some((name) => document.includes(name)),
  );

/**
 * The public entry documents must describe the product that shipped.
 *
 * These files are what a new contributor and a fresh agent read first, and
 * every claim in them is checkable against the tree beside them. They have
 * drifted repeatedly: retired command and agent surfaces outlived their removal
 * (#1385), a dependency the package no longer carries was still advertised, two
 * folds were documented as absent while their directories sat in `src`, the
 * tool counts stopped one release behind the surface, and a verb the harness
 * never had was taught as vocabulary (#1394). Prose cannot be trusted to age,
 * so each assertion reads the claim and the thing claimed.
 *
 * The negative halves are not decoration. A stale sentence usually survives
 * beside its correction rather than instead of it -- the interface README
 * asserted a `typia` dependency on line 5 and denied it on line 23 -- so a
 * positive-only pin passes while the contradiction ships.
 *
 * Scenarios:
 *
 * 1. The starter command names the published CLI binary, and no public entry
 *    document names a retired command or agent surface.
 * 2. The engine README documents the physics and topology tiers it implements, and
 *    the public violation kind calls physics a plausibility warning.
 * 3. The interface README claims no runtime dependency and names the harness and
 *    cinematics folds, with the removed `typia` claim asserted ABSENT.
 * 4. Its domain-folder table names every folder `packages/interface/src` ships,
 *    compared against the directory listing rather than against prose. `core/`
 *    was missing from the table until this comparison existed.
 * 5. The same comparison for the three other documents that enumerate a surface
 *    (#1398): the root package table against `packages/`, the engine module
 *    table against `packages/engine/src`, and the render and viewer surface
 *    tables against what their `index.ts` exports. A function table cannot be
 *    diffed against filenames, so the question asked of those two is whether
 *    the document mentions ANY name a module exports; a module it forgot
 *    answers no. All three had fallen behind, the root one omitting the very
 *    package whose binary the same file twice tells the reader to run.
 * 6. No package entry document points into `.wiki/`, which is gitignored: it ships
 *    in no tarball and exists in no clone, so such a pointer is dead for every
 *    reader who is not the author on the machine that wrote it.
 * 7. The mcp README names the exact five-tool evidence surface and the sole
 *    published binary while retired application families remain absent.
 * 8. The performance stage's JSDoc names real verbs only.
 * 9. The region contract documents the `fullBody` locomote default and
 *    content-aware layering -- both asserted PRESENT, both with the pre-#1383
 *    sentence they replaced asserted absent. The text is flattened across
 *    whitespace AND asterisks first, because a JSDoc continuation prefix would
 *    otherwise land mid-sentence.
 * 10. The root, interface, and engine READMEs teach coding-agent-owned files,
 *     deterministic delivery, and the narrow MCP evidence boundary without the
 *     retired authoring application or diffusion-only product claims (#1443).
 * 11. Root, interface, and MCP package manifests advertise that same current
 *     product boundary instead of the retired structured-output authoring
 *     engine (#1444).
 * 12. The packed-tarball client drives that same five-tool surface and keeps the
 *     removed compatibility servers and MCP-owned coding operations out.
 */
export const test_workspace_public_contracts = (): void => {
  const rootReadme = readPackageFile("README.md");
  const engineReadme = readPackageFile("packages", "engine", "README.md");
  const interfaceReadme = readPackageFile("packages", "interface", "README.md");
  const mcpReadme = readPackageFile("packages", "mcp", "README.md");
  const mcpApplication = readPackageFile(
    "packages",
    "mcp",
    "src",
    "AutoMovieApplication.ts",
  );
  const tgzE2e = readPackageFile("internals", "e2e-tgz.mjs");
  type PackageMetadata = {
    description: string;
    keywords: string[];
  };
  const rootPackage = JSON.parse(
    readPackageFile("package.json"),
  ) as PackageMetadata;
  const interfacePackage = JSON.parse(
    readPackageFile("packages", "interface", "package.json"),
  ) as PackageMetadata;
  const mcpPackage = JSON.parse(
    readPackageFile("packages", "mcp", "package.json"),
  ) as PackageMetadata & {
    bin: Record<string, string>;
    publishConfig: { bin: Record<string, string> };
  };
  const testPackage = JSON.parse(readPackageFile("test", "package.json")) as {
    scripts: { coverage: string };
  };
  const authoringContract = readPackageFile(
    "packages",
    "interface",
    "src",
    "authoring",
    "IAutoMovieAuthoring.ts",
  );
  const actionCall = readPackageFile(
    "packages",
    "interface",
    "src",
    "harness",
    "IAutoMovieActionCall.ts",
  );
  const bodyRegion = readPackageFile(
    "packages",
    "interface",
    "src",
    "skeleton",
    "AutoMovieBodyRegion.ts",
  );
  const violationKind = readPackageFile(
    "packages",
    "interface",
    "src",
    "validation",
    "AutoMovieViolationKind.ts",
  );
  const violationContract = readPackageFile(
    "packages",
    "interface",
    "src",
    "validation",
    "IAutoMovieConstraintViolation.ts",
  );
  // Every document this scenario reads, so the retired-surface sweep covers
  // the same set the paragraph above claims for it: four READMEs, the harness
  // application and action-call contracts, the body-region enum, and the two
  // validation types. They reach a reader through different doors, and a
  // retired command name is equally wrong behind any of them.
  const publicContract = [
    rootReadme,
    engineReadme,
    interfaceReadme,
    mcpReadme,
    authoringContract,
    actionCall,
    bodyRegion,
    violationKind,
    violationContract,
  ].join("\n");

  TestValidator.equals(
    "the starter command names the published CLI binary",
    rootReadme.includes("npx create-automovie <dir>"),
    true,
  );
  TestValidator.equals(
    "public entry docs do not name retired command or agent surfaces",
    publicContract.match(/npx autobe|@automovie\/agent|MicroAgentica/g) ?? [],
    [],
  );
  TestValidator.equals(
    "the engine documents implemented physics and topology tiers",
    [
      engineReadme.includes("Tier 3 (physics)"),
      engineReadme.includes("Tier 5 (topology)"),
      engineReadme.includes("warning만 있으면 성공"),
    ],
    [true, true, true],
  );
  TestValidator.equals(
    "the public violation kind calls physics a plausibility warning",
    violationKind.includes("physical-plausibility warning"),
    true,
  );

  // #1394: the contract docs drifted from the shipped surface once (a removed
  // typia dependency, a harness folder claimed absent, pre-#1392 tool counts,
  // a verb that does not exist, and pre-#1383 region semantics). Pin the truth.
  TestValidator.equals(
    "the interface documents no runtime dependency and its harness folder",
    [
      interfaceReadme.includes("런타임 의존은 없다"),
      interfaceReadme.includes("`harness/`"),
      interfaceReadme.includes("`cinematics/`"),
      interfaceReadme.includes("의존성은 `typia`"),
    ],
    [true, true, true, false],
  );
  // The domain-folder table is a claim about the package's own layout, so read
  // the layout instead of trusting the prose. The table omitted `harness/` and
  // `cinematics/` until #1394, and `core/` (the node, track, and channel
  // primitives every other fold builds on) until the follow-up.
  TestValidator.equals(
    "the interface README's folder table matches the shipped folders",
    [...interfaceReadme.matchAll(/^\| `([^`]+)\/` \|/gm)]
      .map((row) => row[1]!)
      .sort(compareCodeUnits),
    fs
      .readdirSync(path.join(ROOT, "packages", "interface", "src"), {
        withFileTypes: true,
      })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareCodeUnits),
  );
  // #1398: the same comparison, for the three other documents that enumerate a
  // surface. Every one of them had fallen behind: the root table omitted the
  // package whose binary the same file tells you to run, the engine table
  // documented seven of thirteen folders including neither `film/` nor
  // `perform/`, and the render and viewer tables missed five modules each.
  TestValidator.equals(
    "the root package table names every workspace package",
    [...rootReadme.matchAll(/^\| \[`(?:(?:@automovie\/)?([a-z][a-z-]+))`\]/gm)]
      .map((row) => row[1]!)
      .sort(compareCodeUnits),
    directories("packages"),
  );
  TestValidator.equals(
    "the engine README's module table matches the shipped folders",
    [...engineReadme.matchAll(/^\| `([^`]+)\/` \|/gm)]
      .map((row) => row[1]!)
      .sort(compareCodeUnits),
    directories("packages", "engine", "src"),
  );
  TestValidator.equals(
    "the render and viewer surface tables name every module they export",
    // The module counts ride along so the comparison cannot go vacuous: an
    // `index.ts` written in a re-export style the extractor does not know
    // would otherwise leave nothing to check and pass.
    ["render", "viewer"].map((pkg) => ({
      modules: exportedModules(pkg).length > 0,
      unmentioned: unmentionedModules(
        pkg,
        readPackageFile("packages", pkg, "README.md"),
      ),
    })),
    [
      { modules: true, unmentioned: [] },
      { modules: true, unmentioned: [] },
    ],
  );
  TestValidator.equals(
    "no package entry document points into the gitignored wiki",
    directories("packages")
      .filter((pkg) =>
        readPackageFile("packages", pkg, "README.md").includes(".wiki/"),
      )
      .concat(rootReadme.includes(".wiki/") ? ["<root>"] : []),
    [],
  );
  TestValidator.equals(
    "the mcp README counts the surface it actually ships",
    [
      mcpReadme.includes("exactly five MCP tools"),
      mcpReadme.includes("captureFrame"),
      mcpReadme.includes("repaintShot"),
    ],
    [true, true, true],
  );
  TestValidator.equals(
    "public entry READMEs teach the coding-agent and five-tool product contract",
    [
      rootReadme.includes("Coding-agent-native deterministic filmmaking"),
      rootReadme.includes('`visualDelivery: "deterministic"`'),
      rootReadme.includes('`visualDelivery: "repainted"`'),
      rootReadme.includes(
        "Design, source, asset, shot, sequence, optional rendition, and film reviews",
      ),
      rootReadme.includes("default, zero-configuration path"),
      rootReadme.includes("optional host-adapter lane"),
      rootReadme.includes("immutable provenance receipt"),
      rootReadme.includes("MCP has no design setter, compiler, renderer"),
      interfaceReadme.includes("다섯 MCP 지식·증거·리뷰 계약"),
      interfaceReadme.includes("MCP에는 그중 정확한 다섯 도구 계약만 반영"),
      engineReadme.includes("이 엔진의 두 번째 저작 API가 아니다"),
      engineReadme.includes("npx create-automovie <dir>"),
    ],
    [true, true, true, true, true, true, true, true, true, true, true, true],
  );
  TestValidator.equals(
    "public entry READMEs reject retired MCP authoring and diffusion-only claims",
    [rootReadme, interfaceReadme, engineReadme]
      .join("\n")
      .match(
        /An MCP server for deterministic motion-control video|MCP motion authoring surface|not a replacement for diffusion|MCP surface is the product boundary|structured-output 스키마가 곧|16개 MCP|3단 MCP 표면|stage\/block\/perform 데이터 계약|슬레이트 상태·트랜잭션|enact가 그 다리|npx automovie start <dir>/g,
      ) ?? [],
    [],
  );
  TestValidator.equals(
    "package manifests advertise the current product and ownership boundaries",
    {
      root: {
        description: rootPackage.description,
        keywords: rootPackage.keywords,
      },
      interface: {
        description: interfacePackage.description,
        keywords: interfacePackage.keywords,
      },
      mcp: {
        description: mcpPackage.description,
        keywords: mcpPackage.keywords,
      },
    },
    {
      root: {
        description:
          "Coding-agent-native deterministic filmmaking: tracked authoring, compilation, rendering, review, and delivery.",
        keywords: [
          "coding-agent",
          "deterministic",
          "filmmaking",
          "animation",
          "rendering",
        ],
      },
      interface: {
        description:
          "AutoMovie type contracts for code-native authoring, deterministic film data, production evidence, review, and delivery.",
        keywords: [
          "animation",
          "filmmaking",
          "production",
          "typescript",
          "types",
        ],
      },
      mcp: {
        description:
          "AutoMovie MCP boundary for session knowledge, host evidence, optional repaint receipts, and verdict-last review.",
        keywords: [
          "mcp",
          "model-context-protocol",
          "evidence",
          "review",
          "filmmaking",
        ],
      },
    },
  );
  TestValidator.equals(
    "package manifests reject retired structured-output motion-authoring claims",
    [rootPackage, interfacePackage, mcpPackage]
      .flatMap((manifest) => [manifest.description, ...manifest.keywords])
      .join("\n")
      .match(
        /LLM structured-output|function-calling|structured-output|motion-control engine as Model Context Protocol tools/g,
      ) ?? [],
    [],
  );
  const mcpMethods = [
    ...mcpApplication.matchAll(
      /^\u0020{2}public (?:async )?([a-z][A-Za-z0-9]*)\s*\(/gm,
    ),
  ]
    .map((match) => match[1]!)
    .filter((name) => name !== "constructor")
    .sort(compareCodeUnits);
  const mcpToolGuideKeys = [
    ...mcpApplication
      .match(
        /export const AUTOMOVIE_TOOL_GUIDES = \{([\s\S]*?)\n\} as const/,
      )![1]!
      .matchAll(/^\u0020{2}([a-z][A-Za-z0-9]*):/gm),
  ]
    .map((match) => match[1]!)
    .sort(compareCodeUnits);
  const packedToolNames = [
    ...tgzE2e
      .match(/const expectedTools = \[([\s\S]*?)\n\u0020{2}\];/)![1]!
      .matchAll(/^\u0020{4}"([a-z][A-Za-z0-9]*)",$/gm),
  ]
    .map((match) => match[1]!)
    .sort(compareCodeUnits);
  TestValidator.equals(
    "public README tool tables derive their complete surface from the application",
    {
      methods: mcpMethods,
      guides: mcpToolGuideKeys,
      tables: [rootReadme, mcpReadme].map((document) =>
        [...document.matchAll(/^\| `([a-z][A-Za-z0-9]*)`\s+\|/gm)]
          .map((match) => match[1]!)
          .sort(compareCodeUnits),
      ),
    },
    {
      methods: mcpToolGuideKeys,
      guides: mcpToolGuideKeys,
      tables: [mcpToolGuideKeys, mcpToolGuideKeys],
    },
  );
  TestValidator.equals(
    "retired MCP and interface application families and binaries stay absent",
    {
      sources: [
        "AutoMovieLegacyApplication.ts",
        "AutoMovieGatewayApplication.ts",
        "AutoMovieLegacyGatewayApplication.ts",
        "AutoMovieProductionApplication.ts",
        "createAutoMovieProductionMcpServer.ts",
        "bin-production.ts",
        "bin-granular.ts",
      ].filter((file) =>
        fs.existsSync(path.join(ROOT, "packages", "mcp", "src", file)),
      ),
      interfaceApplications: [
        "IAutoMovieScriptApplication.ts",
        "IAutoMovieForgeApplication.ts",
        "IAutoMovieStagingApplication.ts",
        "IAutoMovieBlockingApplication.ts",
        "IAutoMoviePerformanceApplication.ts",
        "IAutoMovieReviewApplication.ts",
        "IAutoMovieAssembleApplication.ts",
      ].filter((file) =>
        fs.existsSync(
          path.join(ROOT, "packages", "interface", "src", "harness", file),
        ),
      ),
      interfaceApplicationExports:
        readPackageFile(
          "packages",
          "interface",
          "src",
          "harness",
          "index.ts",
        ).match(/IAutoMovie\w+Application/g) ?? [],
      bins: mcpPackage.bin,
      publishedBins: mcpPackage.publishConfig.bin,
      retiredNamesInReadme:
        mcpReadme.match(
          /openProject|inspectProject|compileProject|queryGeometry|previewFrame|automovie-mcp-(?:legacy|production|granular)/g,
        ) ?? [],
      packedTools: packedToolNames,
      retiredNamesInTgzE2e:
        tgzE2e.match(
          /AutoMovieLegacyApplication|tools\.length === (?:4|15)|name: "(?:execute|openProject|nextSteps|compileProject|queryGeometry|previewFrame)"|app\.(?:openProject|inspectProject|compileProject|queryGeometry)/g,
        ) ?? [],
      retiredCoverageExcludes:
        testPackage.scripts.coverage.match(
          /bin-(?:granular|production)\.ts/g,
        ) ?? [],
    },
    {
      sources: [],
      interfaceApplications: [],
      interfaceApplicationExports: [],
      bins: { "automovie-mcp": "lib/bin.js" },
      publishedBins: { "automovie-mcp": "lib/bin.js" },
      retiredNamesInReadme: [],
      packedTools: mcpToolGuideKeys,
      retiredNamesInTgzE2e: [],
      retiredCoverageExcludes: [],
    },
  );
  TestValidator.equals(
    "the performance stage names real verbs only",
    authoringContract.includes("walkTo"),
    false,
  );
  TestValidator.equals(
    "the region contract documents fullBody locomote and content-aware layering",
    (() => {
      // JSDoc continuation prefixes (" * ") would land mid-sentence after a
      // whitespace-only flatten, so fold runs of whitespace AND asterisks.
      const flatCall = actionCall.replace(/[\s*]+/g, " ");
      const flatRegion = bodyRegion.replace(/[\s*]+/g, " ");
      return [
        flatCall.includes("a `locomote` is `lowerBody`"),
        flatCall.includes("a `locomote` is `fullBody`"),
        flatCall.includes("Overlap is judged on the content surviving those"),
        flatRegion.includes("cannot co-occur with any other region"),
        flatRegion.includes(
          "co-occurs with another region only while their surviving content",
        ),
      ];
    })(),
    [false, true, true, false, true],
  );
};

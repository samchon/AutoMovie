import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_REPAINT_GUIDE,
  AUTOMOVIE_REVIEW_GUIDES,
  AUTOMOVIE_TOOL_GUIDES,
  type AutoMovieGuideName,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";

interface IGuideSnippetFixtureFailure {
  error: unknown;
}

class GuideSnippetFixtureCleanupError extends AggregateError {}

/** Remove the guide-snippet root without replacing its compiler failure. */
export const preserveGuideSnippetFixtureCleanup = (
  failure: IGuideSnippetFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new GuideSnippetFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Guide-snippet fixture cleanup failed after the test failed.",
    );
  }
};

/** Pin the guide corpus as an executable contract rather than loose prose. */
export const test_mcp_guide_corpus = (): void => {
  const root = path.resolve(__dirname, "../../../..");
  const promptRoot = path.join(root, "packages/mcp/prompts");
  const files = fs
    .readdirSync(promptRoot)
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort(compareCodeUnits);
  const names = files.map((file) => file.slice(0, -".md".length));
  TestValidator.equals(
    "served guide names and prompt files form one exact closure",
    names,
    [...AUTOMOVIE_PRODUCTION_GUIDE_NAMES].sort(compareCodeUnits),
  );

  const documents = new Map(
    files.map((file) => [
      file.slice(0, -".md".length),
      fs.readFileSync(path.join(promptRoot, file), "utf8"),
    ]),
  );
  const corpus = [...documents.values()].join("\n");
  for (const tool of [
    "getGuideDocument",
    "captureFrame",
    "repaintShot",
    "prepareReview",
    "submitReview",
  ] as const)
    TestValidator.predicate(
      `the corpus names the actual ${tool} tool`,
      corpus.includes(tool),
    );

  TestValidator.equals(
    "every gate guide is linked to its actual tool declaration",
    namedFacts([
      [
        "AUTOMOVIETOOLGUIDESCaptureFrameIncludes",
        () => AUTOMOVIE_TOOL_GUIDES.captureFrame.includes("CAPTURE_FRAME"),
      ],
      [
        "AUTOMOVIETOOLGUIDESRepaintShotIncludes",
        () => AUTOMOVIE_TOOL_GUIDES.repaintShot.includes("REPAINT_SHOT"),
      ],
      [
        "AUTOMOVIEREPAINTGUIDEDIFFUSIONENHANCE",
        () => AUTOMOVIE_REPAINT_GUIDE === "DIFFUSION_ENHANCE",
      ],
      [
        "newSetString",
        () =>
          new Set<string>(AUTOMOVIE_TOOL_GUIDES.repaintShot).has(
            AUTOMOVIE_REPAINT_GUIDE,
          ) === false,
      ],
      [
        "AUTOMOVIETOOLGUIDESPrepareReviewIncludes",
        () => AUTOMOVIE_TOOL_GUIDES.prepareReview.includes("AUTOMOVIE_OVERALL"),
      ],
      [
        "AUTOMOVIETOOLGUIDESSubmitReviewIncludes",
        () => AUTOMOVIE_TOOL_GUIDES.submitReview.includes("AUTOMOVIE_OVERALL"),
      ],
      [
        "valuesAUTOMOVIEREVIEWGUIDESGuide",
        () =>
          Object.values(AUTOMOVIE_REVIEW_GUIDES).every(
            (guide) => documents.get(guide)?.includes("prepareReview") === true,
          ),
      ],
      [
        "valuesAUTOMOVIEREVIEWGUIDESGuide2",
        () =>
          Object.values(AUTOMOVIE_REVIEW_GUIDES).every(
            (guide) => documents.get(guide)?.includes("submitReview") === true,
          ),
      ],
    ]),
    {
      AUTOMOVIETOOLGUIDESCaptureFrameIncludes: true,
      AUTOMOVIETOOLGUIDESRepaintShotIncludes: true,
      AUTOMOVIEREPAINTGUIDEDIFFUSIONENHANCE: true,
      newSetString: true,
      AUTOMOVIETOOLGUIDESPrepareReviewIncludes: true,
      AUTOMOVIETOOLGUIDESSubmitReviewIncludes: true,
      valuesAUTOMOVIEREVIEWGUIDESGuide: true,
      valuesAUTOMOVIEREVIEWGUIDESGuide2: true,
    },
  );

  const overall = documents.get("AUTOMOVIE_OVERALL")!;
  TestValidator.equals(
    "the constitution alone routes every next guide",
    namedFacts([
      ["overallIncludesFlow", () => overall.includes("## Flow")],
      ["overallIncludesGuide", () => overall.includes("## Guide selection")],
      [
        "AUTOMOVIEPRODUCTIONGUIDENAMESNameName",
        () =>
          AUTOMOVIE_PRODUCTION_GUIDE_NAMES.every(
            (name) =>
              name === "AUTOMOVIE_OVERALL" || overall.includes(`\`${name}\``),
          ),
      ],
    ]),
    {
      overallIncludesFlow: true,
      overallIncludesGuide: true,
      AUTOMOVIEPRODUCTIONGUIDENAMESNameName: true,
    },
  );
  TestValidator.equals(
    "the handbook doctrine is pinned",
    namedFacts([
      [
        "documentsGetCINEMATOGRAPHY",
        () =>
          documents
            .get("CINEMATOGRAPHY")!
            .includes(
              "emotion, story, rhythm, eye trace, two-dimensional screen plane, then three-dimensional continuity",
            ),
      ],
      [
        "documentsGetDIFFUSIONENHANCE",
        () =>
          documents
            .get("DIFFUSION_ENHANCE")!
            .includes("search current official model cards"),
      ],
      [
        "documentsGetDIFFUSIONENHANCE2",
        () =>
          documents
            .get("DIFFUSION_ENHANCE")!
            .includes("The repaint receives a separate `rendition` review"),
      ],
      [
        "documentsGetREPAINTSHOT",
        () =>
          documents
            .get("REPAINT_SHOT")!
            .includes("visual delivery `repainted`"),
      ],
    ]),
    {
      documentsGetCINEMATOGRAPHY: true,
      documentsGetDIFFUSIONENHANCE: true,
      documentsGetDIFFUSIONENHANCE2: true,
      documentsGetREPAINTSHOT: true,
    },
  );

  for (const retired of [
    "BATTLE_SIM",
    "BLOCKING",
    "FORGE",
    "PERFORMANCE",
    "PRODUCTION_RENDER",
    "PRODUCTION_REVIEW",
    "PROJECT_MEMORY",
    "PROPS",
    "RENDER_GUIDES",
    "REVIEW",
    "STAGING",
  ])
    TestValidator.predicate(
      `retired ${retired} guide file is absent`,
      fs.existsSync(path.join(promptRoot, `${retired}.md`)) === false,
    );
  const canonicalDtoName: AutoMovieGuideName = "AUTOMOVIE_OVERALL";
  const dtoSource = fs.readFileSync(
    path.join(root, "packages/mcp/src/dto.ts"),
    "utf8",
  );
  TestValidator.equals(
    "the public DTO aliases the canonical guide union without retired names",
    namedFacts([
      [
        "canonicalDtoNameAUTOMOVIEOVERALL",
        () => canonicalDtoName === "AUTOMOVIE_OVERALL",
      ],
      [
        "dtoSourceIncludesExport",
        () =>
          dtoSource.includes(
            "export type AutoMovieGuideName = AutoMovieProductionGuideName;",
          ),
      ],
      [
        "STAGINGBLOCKINGPERFORMANCE",
        () =>
          ["STAGING", "BLOCKING", "PERFORMANCE", "FORGE", "REVIEW"].every(
            (name) => dtoSource.includes(`| "${name}"`) === false,
          ),
      ],
    ]),
    {
      canonicalDtoNameAUTOMOVIEOVERALL: true,
      dtoSourceIncludesExport: true,
      STAGINGBLOCKINGPERFORMANCE: true,
    },
  );
  for (const retiredCall of [
    "queryGeometry",
    "inspectProject",
    "compileProject",
    "previewFrame",
    "commitShot",
    "saveSlate",
    "AutoMovieLegacyApplication",
    ".stage(",
    ".block(",
    ".perform(",
    ".forge(",
  ])
    TestValidator.predicate(
      `retired call ${retiredCall} is absent from the corpus`,
      corpus.includes(retiredCall) === false,
    );

  compileSnippets(root, documents);
};

const compileSnippets = (
  root: string,
  documents: ReadonlyMap<string, string>,
): void => {
  const snippets = [...documents]
    .flatMap(([guide, document]) =>
      [...document.matchAll(/```ts\r?\n([\s\S]*?)```/g)].map(
        (match, index) => ({
          guide,
          index,
          source: match[1]!,
        }),
      ),
    )
    .sort((left, right) =>
      compareCodeUnits(
        `${left.guide}:${left.index}`,
        `${right.guide}:${right.index}`,
      ),
    );
  TestValidator.predicate(
    "the corpus carries compile-checked TypeScript recipes",
    snippets.length > 0,
  );
  const scaffoldConfigPath = path.join(
    root,
    "packages/cli/scaffold/tsconfig.json",
  );
  const scaffoldConfig = ts.readConfigFile(scaffoldConfigPath, ts.sys.readFile);
  if (scaffoldConfig.error !== undefined)
    throw new Error(
      ts.formatDiagnostic(scaffoldConfig.error, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
  const parsed = ts.parseJsonConfigFileContent(
    scaffoldConfig.config,
    ts.sys,
    path.dirname(scaffoldConfigPath),
    {
      noEmit: true,
      rootDir: undefined,
      baseUrl: undefined,
      paths: undefined,
    },
    scaffoldConfigPath,
  );
  if (parsed.errors.length !== 0)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => root,
        getNewLine: () => "\n",
      }),
    );
  const cache = path.join(root, "test/node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(
    path.join(cache, "automovie-guide-snippets-"),
  );
  let guideSnippetFailure: IGuideSnippetFixtureFailure | undefined;
  try {
    for (const snippet of snippets) {
      const file = path.join(
        temporary,
        `${snippet.guide.toLowerCase()}-${snippet.index}.ts`,
      );
      fs.writeFileSync(file, snippet.source);
      const program = ts.createProgram({
        rootNames: [file],
        options: {
          ...parsed.options,
          noEmit: true,
          rootDir: undefined,
          baseUrl: undefined,
          paths: undefined,
        },
      });
      const diagnostics = ts.getPreEmitDiagnostics(program);
      if (diagnostics.length !== 0)
        throw new Error(
          `${snippet.guide} TypeScript snippet ${snippet.index + 1} does not compile:\n${ts.formatDiagnosticsWithColorAndContext(
            diagnostics,
            {
              getCanonicalFileName: (name) => name,
              getCurrentDirectory: () => root,
              getNewLine: () => "\n",
            },
          )}`,
        );
    }
  } catch (error) {
    guideSnippetFailure = { error };
    throw error;
  } finally {
    preserveGuideSnippetFixtureCleanup(guideSnippetFailure, () =>
      fs.rmSync(temporary, { force: true, recursive: true }),
    );
  }
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

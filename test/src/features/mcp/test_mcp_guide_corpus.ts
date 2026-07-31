import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_REVIEW_GUIDES,
  AUTOMOVIE_TOOL_GUIDES,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

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

  TestValidator.predicate(
    "every gate guide is linked to its actual tool declaration",
    AUTOMOVIE_TOOL_GUIDES.captureFrame.includes("CAPTURE_FRAME") &&
      AUTOMOVIE_TOOL_GUIDES.repaintShot.includes("REPAINT_SHOT") &&
      AUTOMOVIE_TOOL_GUIDES.repaintShot.includes("DIFFUSION_ENHANCE") &&
      AUTOMOVIE_TOOL_GUIDES.prepareReview.includes("AUTOMOVIE_OVERALL") &&
      AUTOMOVIE_TOOL_GUIDES.submitReview.includes("AUTOMOVIE_OVERALL") &&
      Object.values(AUTOMOVIE_REVIEW_GUIDES).every(
        (guide) => documents.get(guide)?.includes("prepareReview") === true,
      ) &&
      Object.values(AUTOMOVIE_REVIEW_GUIDES).every(
        (guide) => documents.get(guide)?.includes("submitReview") === true,
      ),
  );

  const overall = documents.get("AUTOMOVIE_OVERALL")!;
  TestValidator.predicate(
    "the constitution alone routes every next guide",
    overall.includes("## Flow") &&
      overall.includes("## Guide selection") &&
      AUTOMOVIE_PRODUCTION_GUIDE_NAMES.every(
        (name) =>
          name === "AUTOMOVIE_OVERALL" || overall.includes(`\`${name}\``),
      ),
  );
  TestValidator.predicate(
    "the handbook doctrine is pinned",
    documents
      .get("CINEMATOGRAPHY")!
      .includes(
        "emotion, story, rhythm, eye trace, two-dimensional screen plane, then three-dimensional continuity",
      ) &&
      documents.get("BATTLE_SIM")!.includes("Fact") &&
      documents.get("BATTLE_SIM")!.includes("Hint") &&
      documents.get("BATTLE_SIM")!.includes("Authored response") &&
      documents
        .get("DIFFUSION_ENHANCE")!
        .includes("search current official model cards") &&
      documents.get("DIFFUSION_ENHANCE")!.includes("separate visual review") &&
      documents.get("REPAINT_SHOT")!.includes("visual delivery `repainted`"),
  );

  for (const retired of [
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
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-guide-snippets-"),
  );
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
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          moduleResolution: ts.ModuleResolutionKind.Node10,
          esModuleInterop: true,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          typeRoots: [path.join(root, "node_modules/@types")],
          baseUrl: root,
          paths: {
            "@automovie/*": ["packages/*/src/index.ts"],
          },
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
  } finally {
    fs.rmSync(temporary, { force: true, recursive: true });
  }
};

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

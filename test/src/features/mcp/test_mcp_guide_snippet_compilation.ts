import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AutoMovieApplication,
  compareCodeUnits,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript-compiler";

/**
 * Every `ts` example a served guide carries compiles against the workspace.
 *
 * `packages/mcp/prompts/README.md` tells guide authors that a fenced block
 * tagged `ts` is compiled and that a deliberately incomplete fragment is tagged
 * `text` instead. Authors write against that promise and reviewers pass
 * examples on it, so while nothing compiled them a wrong example entered
 * without resistance: `#1904` shipped an import the sandbox refuses because the
 * guide it copied carried one, and this case's first run found a `ts` fragment
 * that names an undeclared `context`.
 *
 * The corpus is read through `getGuideDocument` rather than off disk, because
 * an example only misleads an authoring agent once the server hands it over.
 *
 * Scenarios:
 *
 * 1. The served corpus yields at least one `ts` example, so a fence syntax this
 *    extractor stops recognising fails the case instead of emptying it.
 * 2. Every extracted example compiles under the scaffold's own compiler
 *    options, which is the configuration a generated production is written
 *    against, and reports no diagnostic of its own.
 */
export const test_mcp_guide_snippet_compilation = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-snippet-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectSnippetCompilation(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

/** The repository root, four levels above `test/src/features/mcp`. */
const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");

/**
 * The compiler options a generated production is written against.
 *
 * The scaffold's own `tsconfig.json` is the configuration every project this
 * repository prints inherits, so compiling a guide example under anything else
 * would prove it compiles somewhere the reader never works. `rootDir`,
 * `baseUrl` and `paths` are dropped because the examples are written to a
 * scratch directory rather than into a project tree.
 */
const scaffoldOptions = (): ts.CompilerOptions => {
  const configPath = path.join(
    REPOSITORY_ROOT,
    "packages/cli/scaffold/tsconfig.json",
  );
  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => REPOSITORY_ROOT,
    getNewLine: () => "\n",
  };
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error !== undefined)
    throw new Error(ts.formatDiagnostic(config.error, host));
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    path.dirname(configPath),
    { noEmit: true, rootDir: undefined, baseUrl: undefined, paths: undefined },
    configPath,
  );
  if (parsed.errors.length !== 0)
    throw new Error(ts.formatDiagnostics(parsed.errors, host));
  return {
    ...parsed.options,
    noEmit: true,
    rootDir: undefined,
    baseUrl: undefined,
    paths: undefined,
  };
};

interface ISnippet {
  guide: string;
  index: number;
  source: string;
}

const FENCE = /```ts\r?\n([\s\S]*?)```/gu;

/**
 * The `ts` examples one guide presents, in the order it presents them.
 *
 * The index is the author's own count of the examples in that document, which
 * is how a failure names the block to open rather than a scratch file the
 * reader never sees.
 */
const guideSnippets = (guide: string, content: string): ISnippet[] =>
  [...content.matchAll(FENCE)].map((match, index) => ({
    guide,
    index,
    source: match[1]!,
  }));

/**
 * One scratch module per example, written where the workspace resolves.
 *
 * The directory sits under `test/node_modules/.cache` because Node resolution
 * walks ancestors: from there `@automovie/engine` reaches the workspace link in
 * `test/node_modules`, while a system temporary directory resolves nothing and
 * would report every example as a missing module.
 *
 * `export {}` closes each file as a module. Without it an example that imports
 * nothing is a script sharing one global scope with every other such example,
 * so two independent guides declaring the same name would collide over a
 * conflict neither of them has. It adds no declaration and hides no diagnostic.
 */
const writeSnippets = (
  directory: string,
  snippets: readonly ISnippet[],
): Map<string, ISnippet> => {
  const written = new Map<string, ISnippet>();
  for (const snippet of snippets) {
    const file = path.join(
      directory,
      `${snippet.guide.toLowerCase()}-${snippet.index}.ts`,
    );
    fs.writeFileSync(file, `${snippet.source}\nexport {};\n`, "utf8");
    written.set(path.resolve(file), snippet);
  }
  return written;
};

/**
 * Diagnostics are read per example rather than for the whole program.
 *
 * One program compiles every example at once because each one pulls the whole
 * workspace source graph in, and building that graph eight times over costs
 * minutes for nothing. Asking the program for its diagnostics as a whole would
 * then report an unrelated workspace error against this case, so each example
 * is asked only about itself.
 *
 * A failure carries the line inside the fenced block, because that is the line
 * the author edits. The appended `export {}` sits after the last of them, so
 * every reported position is the author's own. An example the program never
 * received is a failure of the arrangement rather than a clean run, so it
 * throws instead of contributing nothing.
 */
const snippetDiagnostics = (
  program: ts.Program,
  written: ReadonlyMap<string, ISnippet>,
): string[] => {
  const failures: string[] = [];
  for (const [file, snippet] of written) {
    const source = program.getSourceFile(file);
    if (source === undefined)
      throw new Error(`The guide example ${file} never entered the program.`);
    for (const diagnostic of ts.getPreEmitDiagnostics(program, source))
      failures.push(
        `${snippet.guide} example ${snippet.index + 1} line ${
          diagnostic.start === undefined
            ? 0
            : source.getLineAndCharacterOfPosition(diagnostic.start).line + 1
        }: TS${diagnostic.code} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      );
  }
  return [...new Set(failures)].sort(compareCodeUnits);
};

const inspectSnippetCompilation = (application: AutoMovieApplication): void => {
  const snippets = AUTOMOVIE_PRODUCTION_GUIDE_NAMES.flatMap((name) =>
    guideSnippets(name, application.getGuideDocument({ name }).content),
  );
  TestValidator.predicate(
    "the served corpus carries compiled TypeScript examples",
    snippets.length > 0,
  );

  const cache = path.resolve(__dirname, "../../../node_modules/.cache");
  fs.mkdirSync(cache, { recursive: true });
  const directory = fs.mkdtempSync(path.join(cache, "automovie-snippets-"));
  try {
    const written = writeSnippets(directory, snippets);
    const program = ts.createProgram({
      rootNames: [...written.keys()],
      options: scaffoldOptions(),
    });
    TestValidator.equals(
      "every ts example in a served guide compiles",
      snippetDiagnostics(program, written),
      [],
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

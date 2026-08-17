import * as AutoMovieEngine from "@automovie/engine";
import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
  AUTOMOVIE_SANDBOX_MODULE_EXPORTS,
  AutoMovieApplication,
  compareCodeUnits,
  isProjectSourceSpecifier,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ts from "typescript-compiler";

/**
 * Every capability a guide presents as callable is reachable from the sandbox.
 *
 * A guide that teaches a technique the import gate refuses leaves an authoring
 * agent to invent a workaround, and the workaround compiles, passes its tests
 * and looks plausible in a frame. That is how #1904 shipped texture-repeat
 * masonry into a production while the built-environment guide forbade exactly that, and it
 * is what this guard exists to make impossible to repeat.
 */
export const test_mcp_guide_surface_reachability = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-reach-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectSandboxReach(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const inspectSandboxReach = (application: AutoMovieApplication): void => {
  const guides = AUTOMOVIE_PRODUCTION_GUIDE_NAMES.map((name) => ({
    name,
    ...splitGuide(application.getGuideDocument({ name }).content),
  }));

  TestValidator.equals(
    "every engine function a guide writes in call form is on the sandbox surface",
    distinct(
      guides.flatMap(({ name, prose }) =>
        proseCalls(prose)
          .filter(
            (called) =>
              ENGINE_RUNTIME_EXPORTS.has(called) &&
              SANDBOX_SURFACE.has(called) === false,
          )
          .map((called) => `${name}: ${called}()`),
      ),
    ),
    [],
  );

  TestValidator.equals(
    "every shot-source example in a guide imports only what the sandbox serves",
    distinct(
      guides.flatMap(({ name, examples }) =>
        examples.flatMap((example) =>
          refusedImports(example).map((refused) => `${name}: ${refused}`),
        ),
      ),
    ),
    [],
  );
};

/**
 * The engine names that exist at run time.
 *
 * Reading the package namespace rather than a list keeps a type out of the
 * population by construction: `IAutoMovieSurfacePattern` is erased before this
 * object exists, so a guide naming it can never be read as a claim about a
 * surface that must hold runtime names only.
 */
const ENGINE_RUNTIME_EXPORTS: ReadonlySet<string> = new Set(
  Object.keys(AutoMovieEngine),
);

/** Read at run time, so a name added to the surface cannot leave this stale. */
const SANDBOX_SURFACE: ReadonlySet<string> = new Set(
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
);

/**
 * The modules a shot-source example is allowed to name.
 *
 * The sandbox-served packages come from the gate's own map. `@automovie/interface`
 * joins them because it is pure types with no runtime dependency, which makes it
 * the vocabulary every shot module is written against and the one non-served
 * package a shot-source example legitimately names.
 */
const SHOT_SOURCE_SPECIFIERS: ReadonlySet<string> = new Set([
  ...AUTOMOVIE_SANDBOX_MODULE_EXPORTS.keys(),
  "@automovie/interface",
]);

const CODE_SPAN = /`([^`\n]+)`/gu;

const CALL_FORM = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\(/gu;

const distinct = (values: readonly string[]): string[] =>
  [...new Set(values)].sort(compareCodeUnits);

/**
 * One guide separated into its prose and its fenced TypeScript examples.
 *
 * The two make different claims and are read by different rules. Prose names a
 * capability in sentences; an example writes the import statement a source file
 * would carry, which is the exact text the link gate reads. Scanning them
 * together would judge an example's calls as prose and a prose backtick as
 * code.
 */
const splitGuide = (
  content: string,
): { prose: string; examples: readonly string[] } => {
  const prose: string[] = [];
  const examples: string[] = [];
  let open: string[] | null = null;
  let language = "";
  for (const line of content.split("\n")) {
    if (line.startsWith("```") === false) {
      (open ?? prose).push(line);
      continue;
    }
    if (open === null) {
      language = line.slice(3).trim();
      open = [];
    } else {
      if (language === "ts") examples.push(open.join("\n"));
      open = null;
    }
  }
  return { prose: prose.join("\n"), examples };
};

/**
 * The bare names a guide's prose writes in call form.
 *
 * Call form is a code span in which the name stands immediately against `(`,
 * as in `tessellateSurface(`. A bare mention presents a thing without claiming
 * a call site, and a member call (`super.render(`, `context.engine.formationSlot(`)
 * calls something the reader already holds rather than a name imported from the
 * engine, so neither is a claim about the surface.
 *
 * The caller narrows this to names the engine actually exports at run time,
 * which is what separates an engine capability from the reader's own method
 * (`render(`, `design(`), another package's API (`compileAutoMovieProduction(`)
 * and an MCP tool (`getGuideDocument(`). Those share the shape of a surface name
 * and nothing else, and the surface makes no claim about any of them.
 *
 * The rule this leaves a guide author is one sentence: write an engine function
 * in call form only where shot source may call it. `BUILT_ENVIRONMENT` states that
 * a project script under `scripts/` reaches the whole of `@automovie/engine`, so
 * a script-only engine function is named bare or shown inside an example that
 * imports a package the sandbox does not serve.
 */
const proseCalls = (prose: string): string[] =>
  [...prose.matchAll(CODE_SPAN)].flatMap((span) =>
    [...span[1].matchAll(CALL_FORM)].map((call) => call[1]),
  );

/**
 * The imports one guide example carries that the sandbox would refuse.
 *
 * An example is shot source when it binds something from a sandbox-served
 * package and names no module outside {@link SHOT_SOURCE_SPECIFIERS} and the
 * project's own relative source. Naming anything else is how a guide says the
 * snippet runs elsewhere, which is what `TYPESCRIPT` does when it shows a
 * `scripts/` module reaching the whole engine beside `@automovie/cli`.
 *
 * That test reads every module the example names rather than only the ones it
 * binds at run time. Reading only the runtime ones would let the defect exempt
 * the example that carries it: a type imported without its `type` marker is
 * both the refusal and, under that weaker test, the reason to stop looking.
 */
const refusedImports = (example: string): string[] => {
  const file = ts.createSourceFile(
    "example.ts",
    example,
    ts.ScriptTarget.ESNext,
    false,
    ts.ScriptKind.TS,
  );
  const declarations = file.statements.filter(ts.isImportDeclaration);
  const specifiers = declarations.map(
    (declaration) => (declaration.moduleSpecifier as ts.StringLiteral).text,
  );
  if (
    specifiers.some((specifier) =>
      AUTOMOVIE_SANDBOX_MODULE_EXPORTS.has(specifier),
    ) === false ||
    specifiers.every(
      (specifier) =>
        SHOT_SOURCE_SPECIFIERS.has(specifier) ||
        isProjectSourceSpecifier(specifier),
    ) === false
  )
    return [];
  return declarations.flatMap((declaration, index) =>
    refusedBindings(declaration, specifiers[index]),
  );
};

/**
 * One import declaration read the way the compiler's own link gate reads it.
 *
 * A whole-clause `import type` and a specifier marked `type` disappear before
 * execution and claim nothing. Every other binding is a runtime name its
 * package must publish to the sandbox, and a default, namespace, or
 * side-effect clause is refused whatever it names, because the sandbox hands
 * out a frozen exports object and binding it whole hides which names a module
 * depends on. A project-relative module publishes its own names and is linked
 * from the project's reader, so nothing here judges it.
 */
const refusedBindings = (
  declaration: ts.ImportDeclaration,
  specifier: string,
): string[] => {
  if (isProjectSourceSpecifier(specifier)) return [];
  const clause = declaration.importClause;
  if (clause === undefined) return [`${specifier} imported for side effect`];
  if (clause.isTypeOnly) return [];
  const bindings = clause.namedBindings;
  if (
    clause.name !== undefined ||
    bindings === undefined ||
    ts.isNamedImports(bindings) === false
  )
    return [`${specifier} bound as a default or namespace import`];
  const served = AUTOMOVIE_SANDBOX_MODULE_EXPORTS.get(specifier);
  return bindings.elements
    .filter((element) => element.isTypeOnly === false)
    .map((element) => (element.propertyName ?? element.name).text)
    .filter((name) => served === undefined || served.has(name) === false)
    .map((name) => `${name} imported from ${specifier}`);
};

import ts from "typescript-compiler";

import {
  AUTOMOVIE_SANDBOX_ENGINE_SPECIFIER,
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
} from "./sandboxEngineSurface";

/**
 * One project source module the compiler linked into a deterministic build.
 */
export interface IAutoMovieLinkedSourceModule {
  /**
   * Project-relative path, which is also the specifier it is required by.
   */
  path: string;
  /**
   * Normalized source text.
   */
  source: string;
  /**
   * Every project specifier this module writes, mapped to the module it means.
   *
   * Resolution happens once, here. The sandbox looks a specifier up rather than
   * resolving it again, so there is no second implementation of this arithmetic
   * that could disagree about which module a spelling names.
   */
  imports: Record<string, string>;
}

/**
 * What a link attempt produced, or why it could not finish.
 */
export interface IAutoMovieSourceLinkResult {
  /**
   * Imported modules in dependency order, entry last.
   *
   * Ordered so a plain synchronous registry can evaluate each module once, with
   * everything it requires already registered.
   */
  modules: IAutoMovieLinkedSourceModule[];
  /**
   * The entry module's own resolved specifiers.
   *
   * Stated rather than searched for. The entry is always linked, so a consumer
   * that looked it up in {@link modules} would need a fallback for a case that
   * cannot happen, and a branch nothing can reach is a branch nothing can
   * test.
   */
  entryImports: Record<string, string>;
  /**
   * Refusals, each naming the file that caused it.
   */
  failures: Array<{ path: string; reason: string }>;
}

/**
 * The engine names a deterministic source module may import at runtime.
 *
 * Derived from {@link AUTOMOVIE_SANDBOX_ENGINE_SURFACE} rather than spelled a
 * second time, because a second list is exactly what let a stand-in exist that
 * no source could reach: the gate refused the import, the compile failed, and
 * the byte-parity gate reported a mismatch for a comparison it never ran.
 */
export const AUTOMOVIE_SANDBOX_ENGINE_EXPORTS: ReadonlySet<string> = new Set(
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
);

/**
 * The archetype surface a deterministic source module may import at runtime.
 *
 * These are frozen constant tables rather than behaviour, so the sandbox's
 * stand-in is the data itself, serialised into the bootstrap: a table cannot
 * read a clock or a file, and two spellings of the same numbers cannot
 * disagree. They are listed separately from the engine surface because a
 * package boundary is what a source module writes, and a gate that folded both
 * into one set would accept an engine name imported from the archetypes
 * package.
 */
export const AUTOMOVIE_SANDBOX_ARCHETYPE_EXPORTS: ReadonlySet<string> = new Set(
  ["CAT_GAITS", "HORSE_GAITS", "HUMANOID_GAITS"],
);

/**
 * Which names one permitted runtime package may contribute to a source.
 */
export const AUTOMOVIE_SANDBOX_MODULE_EXPORTS: ReadonlyMap<
  string,
  ReadonlySet<string>
> = new Map([
  [AUTOMOVIE_SANDBOX_ENGINE_SPECIFIER, AUTOMOVIE_SANDBOX_ENGINE_EXPORTS],
  ["@automovie/archetypes", AUTOMOVIE_SANDBOX_ARCHETYPE_EXPORTS],
]);

/**
 * Whether a specifier addresses a module inside the project's own source.
 */
export const isProjectSourceSpecifier = (specifier: string): boolean =>
  specifier.startsWith("./") || specifier.startsWith("../");

const POSIX = /\\/gu;

/**
 * Resolve a relative specifier against the module that wrote it.
 *
 * Project-relative and normalized, so the same module reached by two spellings
 * is one registry entry. A specifier that climbs above the project root is
 * refused here rather than left for the reader, since the reader's own root
 * check would report it as a missing file and hide what the author actually
 * did.
 */
export const resolveProjectSourceSpecifier = (
  from: string,
  specifier: string,
): string | null => {
  const base = from.replace(POSIX, "/").split("/").slice(0, -1);
  const parts = specifier.replace(POSIX, "/").split("/");
  const stack = [...base];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length === 0) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  if (stack.length === 0) return null;
  const joined = stack.join("/");
  return joined.endsWith(".ts") ? joined : `${joined}.ts`;
};

/** Runtime specifiers one module imports, in source order. */
const runtimeSpecifiers = (path: string, source: string): string[] => {
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  for (const statement of file.statements) {
    if (
      ts.isImportDeclaration(statement) === false ||
      ts.isStringLiteralLike(statement.moduleSpecifier) === false
    )
      continue;
    const clause = statement.importClause;
    // A type-only import is erased before the sandbox ever sees it, so it
    // creates no runtime dependency and must not pull a module into the graph.
    if (clause !== undefined && clause.isTypeOnly) continue;
    if (
      clause !== undefined &&
      clause.name === undefined &&
      clause.namedBindings !== undefined &&
      ts.isNamedImports(clause.namedBindings) &&
      clause.namedBindings.elements.every((element) => element.isTypeOnly)
    )
      continue;
    specifiers.push(statement.moduleSpecifier.text);
  }
  return specifiers;
};

/**
 * Collect every project source module an entry module reaches.
 *
 * The sandbox already owns a synchronous module registry; this is what fills
 * it. Modules come back in dependency order so the registry can evaluate each
 * one once with its own imports already present, which is ordinary CommonJS
 * behavior rather than a second loading model.
 *
 * A cycle is refused rather than supported. CommonJS resolves one by handing
 * out a half-built `exports`, and a subject vocabulary that depends on its own
 * partially-initialized self is a defect the author should hear about at
 * compile time instead of discovering as a missing method at render time.
 *
 * The reader is the project's own owned-source reader, so path escape,
 * symlinks, and missing files stay refused exactly as they are for an entry
 * module. Nothing here widens what the compiler is willing to open.
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Links scenes and assets from the project's reviewable TypeScript modules in dependency order rather than from hidden editor state.
 */
export const linkProductionSource = (props: {
  entryPath: string;
  entrySource: string;
  read: (relativePath: string) => string;
}): IAutoMovieSourceLinkResult => {
  const modules: IAutoMovieLinkedSourceModule[] = [];
  const failures: Array<{ path: string; reason: string }> = [];
  const done = new Set<string>();
  const active: string[] = [];
  let entryImports: Record<string, string> = {};

  const visit = (path: string, source: string): void => {
    if (done.has(path)) return;
    if (active.includes(path)) {
      failures.push({
        path,
        reason: `Source module "${path}" imports itself through ${[...active.slice(active.indexOf(path)), path].join(" -> ")}. A deterministic module graph may not contain a cycle, because a module would then read its own half-built exports. Break the cycle and compile again.`,
      });
      return;
    }
    active.push(path);
    const imports: Record<string, string> = {};
    for (const specifier of runtimeSpecifiers(path, source)) {
      if (isProjectSourceSpecifier(specifier) === false) continue;
      const resolved = resolveProjectSourceSpecifier(path, specifier);
      if (resolved === null) {
        failures.push({
          path,
          reason: `Source module "${path}" imports "${specifier}", which climbs above the project root. Import a module inside a configured source root and compile again.`,
        });
        continue;
      }
      let imported: string;
      try {
        imported = props.read(resolved);
      } catch (error) {
        failures.push({
          path,
          reason: `Source module "${path}" imports "${specifier}", which does not resolve to a readable project source: ${String(error instanceof Error ? error.message : error)}`,
        });
        continue;
      }
      imports[specifier] = resolved;
      visit(resolved, imported);
    }
    active.pop();
    done.add(path);
    if (path === props.entryPath) entryImports = imports;
    modules.push({ path, source, imports });
  };

  visit(props.entryPath, props.entrySource);
  return { modules, entryImports, failures };
};

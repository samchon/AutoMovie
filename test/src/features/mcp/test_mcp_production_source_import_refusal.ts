import type { IAutoMovieDiagnostic } from "@automovie/interface";
import { inspectDeterministicSource } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const refusals = (source: string): IAutoMovieDiagnostic[] =>
  inspectDeterministicSource("shot:one", "src/shots/one.ts", source).filter(
    (diagnostic) => diagnostic.code === "source-import-unsupported",
  );

/** The one message a single-import module was refused with. */
const only = (source: string): string => {
  const found = refusals(source);
  if (found.length !== 1)
    throw new Error(`expected one refusal, got ${found.length}`);
  return found[0]!.message;
};

/**
 * An import a shot module cannot link is refused by name and by reason.
 *
 * The sandbox links the engine surface and project-relative source and nothing
 * else, which is a rule an author meets by breaking it. What they got back
 * named the file and never the import: "runtime import is unavailable in
 * deterministic shot source", in a module with a dozen of them. Worse, the
 * refusal was deduplicated per file, so three unlinkable imports produced one
 * message and correcting it revealed the next; and the advice attached --
 * replace it with design input or an explicit seed -- is about nondeterminism
 * and had nothing to say about linking.
 *
 * Four different mistakes arrived under that one sentence, and they need
 * different corrections: a whole-module binding is rewritten as named imports,
 * an unknown package is removed, a misspelled engine export is corrected, and a
 * dynamic import is hoisted. So each is asserted for the words that separate it
 * from the other three, and the negative twin of every one of them is the
 * import that links and must stay silent.
 *
 * Scenarios:
 *
 * 1. A named import of a real engine export links and is refused for nothing,
 *    which is the reading that keeps the rest from being an over-match.
 * 2. A namespace binding is refused for hiding which names the link graph must
 *    resolve, and the message names the module it was written against.
 * 3. A package outside the linkable surface is refused for being outside it, and
 *    is named, so the author is not left comparing an allowlist by eye.
 * 4. A named import the sandbox stand-in does not provide is refused with the
 *    exact missing name, which is the case a file-level message could never
 *    have pointed at.
 * 5. A dynamic import is refused for happening after linking rather than before,
 *    and carries its own specifier.
 * 6. Three unlinkable imports in one module produce three refusals, one per
 *    import, so correcting the first does not reveal the second.
 * 7. A type-only import is not an import at runtime and is refused for nothing,
 *    because it is erased before the sandbox sees it.
 */
export const test_mcp_production_source_import_refusal = (): void => {
  const linkable = `import { tessellateSurface } from "@automovie/engine";\nexport const build = () => tessellateSurface;\n`;
  const namespaced = `import * as engine from "@automovie/engine";\nexport const build = () => engine;\n`;
  const foreign = `import { readFileSync } from "node:fs";\nexport const build = () => readFileSync;\n`;
  const absent = `import { thereIsNoSuchExport } from "@automovie/engine";\nexport const build = () => thereIsNoSuchExport;\n`;
  const dynamic = `export const build = async () => await import("node:os");\n`;
  const typeOnly = `import type { IAutoMovieMesh } from "@automovie/interface";\nexport const build = (): IAutoMovieMesh | null => null;\n`;
  const several = `${foreign}${namespaced}import { alsoNotThere } from "@automovie/engine";\n`;

  TestValidator.equals(
    "an unlinkable import is refused by name and told what to do about it",
    namedFacts([
      [
        "aLinkableImportIsRefusedForNothing",
        () => refusals(linkable).length === 0,
      ],
      ["andSoIsATypeOnlyOne", () => refusals(typeOnly).length === 0],
      [
        "aNamespaceBindingIsNamedAndExplained",
        () =>
          only(namespaced).includes('"@automovie/engine"') &&
          only(namespaced).includes("namespace"),
      ],
      [
        "aPackageOutsideTheSurfaceIsNamed",
        () =>
          only(foreign).includes('"node:fs"') &&
          only(foreign).includes("project-relative source"),
      ],
      [
        "aMissingExportIsNamedExactly",
        () => only(absent).includes('"thereIsNoSuchExport"'),
      ],
      [
        "aDynamicImportCarriesItsOwnSpecifier",
        () =>
          only(dynamic).includes('"node:os"') &&
          only(dynamic).includes("before it runs"),
      ],
      // The deduplication key is the import, not the file: three mistakes are
      // three messages rather than one revealed three times.
      ["threeBadImportsAreThreeRefusals", () => refusals(several).length === 3],
      [
        "andEachOfThemNamesItsOwn",
        () => new Set(refusals(several).map((it) => it.message)).size === 3,
      ],
    ]),
    {
      aLinkableImportIsRefusedForNothing: true,
      andSoIsATypeOnlyOne: true,
      aNamespaceBindingIsNamedAndExplained: true,
      aPackageOutsideTheSurfaceIsNamed: true,
      aMissingExportIsNamedExactly: true,
      aDynamicImportCarriesItsOwnSpecifier: true,
      threeBadImportsAreThreeRefusals: true,
      andEachOfThemNamesItsOwn: true,
    },
  );
};

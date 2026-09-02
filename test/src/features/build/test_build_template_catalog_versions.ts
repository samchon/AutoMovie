import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { requireSourceModule } from "../internal/requireSourceModule";

const unit = requireSourceModule<{
  readCatalogVersion: (props: {
    catalog: string;
    dep: string;
    workspace: string;
  }) => string;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/template/build/catalogVersion.ts",
  ),
  ["readCatalogVersion"],
);

/**
 * One workspace manifest carrying every value form the resolver accepts, plus
 * the shapes it has to walk past.
 *
 * Written for the case rather than read from the repository: asserting against
 * the real manifest would pin whatever versions it holds today, so bumping a
 * dependency would break the test and breaking the resolver would not.
 */
const WORKSPACE = [
  "packages:",
  "  - packages/*",
  "",
  "catalog:",
  "  plain: ^1.2.3",
  "  anchored: &shared ^13.0.2",
  "  aliased: *shared",
  '  quoted: "~4.5.6"',
  "  dangling: *missing",
  "",
  "otherCatalog:",
  "  plain: ^7.0.0",
  "  onlyLater: ^8.8.8",
  "",
].join("\n");

/**
 * The scaffold's baked dependency versions come from this repository's own
 * manifests, by a rule this repository wrote.
 *
 * The resolver walks a pnpm workspace by indentation and accepts four value
 * forms, which is four ways a generated project could receive a version nobody
 * meant. It ran on every scaffold render and every experimental sandbox and no
 * process in the suite had ever loaded it, so all four forms and all three
 * refusals were unread.
 *
 * Scenarios:
 *
 * 1. A plain range, an anchored one, an alias resolved through its anchor, and
 *    a quoted one each yield the version the manifest states.
 * 2. A catalog's scope ends where the indentation returns, so a dependency of
 *    the same name in a later catalog is not answered from the earlier one.
 * 3. An unknown catalog, an unknown dependency, and an alias with no anchor are
 *    each refused by name rather than resolved to something plausible.
 */
export const test_build_template_catalog_versions = (): void => {
  const read = (catalog: string, dep: string): string =>
    unit.readCatalogVersion({ catalog, dep, workspace: WORKSPACE });
  const refuses = (catalog: string, dep: string, fragment: string): boolean => {
    try {
      read(catalog, dep);
      return false;
    } catch (error) {
      return error instanceof Error && error.message.includes(fragment);
    }
  };

  TestValidator.equals(
    "the scaffold's versions are resolved by this repository's own catalog rule",
    namedFacts([
      ["plainRange", () => read("catalog", "plain") === "^1.2.3"],
      ["anchorStripped", () => read("catalog", "anchored") === "^13.0.2"],
      ["aliasResolved", () => read("catalog", "aliased") === "^13.0.2"],
      ["quotesDropped", () => read("catalog", "quoted") === "~4.5.6"],
      [
        // `onlyLater` exists in the second catalog and not the first. Answering
        // it from the first means the walk never stopped where the indentation
        // said it did, and a dependency would silently take a version declared
        // for a different runtime graph. Asking for a name both catalogs carry
        // could not see that: the first match returns before the walk would
        // have run past its own scope.
        "catalogScopeEnds",
        () =>
          read("otherCatalog", "onlyLater") === "^8.8.8" &&
          refuses("catalog", "onlyLater", 'dependency "onlyLater" not found'),
      ],
      [
        "unknownCatalogRefused",
        () => refuses("noSuchCatalog", "plain", "not found"),
      ],
      [
        "unknownDependencyRefused",
        () => refuses("catalog", "absent", 'dependency "absent" not found'),
      ],
      [
        "danglingAliasRefused",
        () => refuses("catalog", "dangling", "unresolved YAML alias"),
      ],
    ]),
    {
      plainRange: true,
      anchorStripped: true,
      aliasResolved: true,
      quotesDropped: true,
      catalogScopeEnds: true,
      unknownCatalogRefused: true,
      unknownDependencyRefused: true,
      danglingAliasRefused: true,
    },
  );
};

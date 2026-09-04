import { resolveAutoMovieCatalogVersion } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

/**
 * Catalog lookup is driven through YAML ownership rather than matching lines.
 *
 * Scenarios:
 *
 * 1. Plain, quoted, commented, anchored, aliased, CRLF, and prototype-looking
 *    keys resolve to their interpreted direct string value.
 * 2. A same-named mapping outside `catalogs`, a sibling catalog, and a deeper
 *    descendant never take ownership from the requested direct path.
 * 3. Missing owners, wrong node kinds, blank values, duplicate keys, invalid
 *    syntax, and unresolved or forward aliases are refused with the requested
 *    catalog and dependency in the diagnostic.
 */
export const test_template_catalog_resolution = (): void => {
  const resolve = (
    workspace: string,
    catalog: string = "media",
    dependency: string = "lib",
  ): string =>
    resolveAutoMovieCatalogVersion({ catalog, dependency, workspace });
  const refusal = (workspace: string): string => {
    try {
      resolve(workspace);
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  TestValidator.equals(
    "YAML string syntax resolves to semantic catalog values",
    [
      resolve("catalogs:\n  media:\n    lib: ^1.2.3\n"),
      resolve("catalogs:\n  media:\n    lib: '^1.2.3'"),
      resolve('catalogs:\n  media:\n    lib: "^1.2.3"'),
      resolve("catalogs:\n  media:\n    lib: ^1.2.3 # pinned"),
      resolve(
        "catalogs:\n  media:\n    shared: &shared ^1.2.3\n    lib: *shared",
      ),
      resolve(
        "catalogs:\n  media:\n    shared: &__proto__ ^1.2.3\n    lib: *__proto__",
      ),
      resolve("catalogs:\r\n  media:\r\n    lib: ^1.2.3\r\n"),
      resolve(
        "catalogs:\n  media:\n    __proto__: '^1.2.3'",
        "media",
        "__proto__",
      ),
      resolve("catalogs:\n  media:\n    lib: __proto__"),
      resolve(
        "catalogs:\n  ? [not, scalar]\n  : ignored\n  media:\n    lib: ^1.2.3",
      ),
    ],
    [
      "^1.2.3",
      "^1.2.3",
      "^1.2.3",
      "^1.2.3",
      "^1.2.3",
      "^1.2.3",
      "^1.2.3",
      "^1.2.3",
      "__proto__",
      "^1.2.3",
    ],
  );

  TestValidator.equals(
    "only the requested direct mapping path owns the result",
    [
      resolve(
        "media:\n  lib: ^9.9.9\ncatalogs:\n  other:\n    lib: ^8.8.8\n  media:\n    nested:\n      lib: ^7.7.7\n    lib: ^1.2.3",
      ),
      resolve(
        "catalogs:\n  media:\n    lib: ^1.2.3\n    nested:\n      lib: ^7.7.7\n  other:\n    lib: ^8.8.8",
      ),
    ],
    ["^1.2.3", "^1.2.3"],
  );

  const invalid = [
    "[]",
    "other: value",
    "catalogs: []",
    "value: &value {}\ncatalogs: *value",
    "catalogs:\n  other:\n    lib: ^1.2.3",
    "catalogs:\n  media: []",
    "catalogs:\n  value: &value {}\n  media: *value",
    "catalogs:\n  media:\n    other: ^1.2.3",
    "catalogs:\n  media:\n    lib:",
    "catalogs:\n  media:\n    lib: '   '",
    "catalogs:\n  media:\n    lib: 123",
    "catalogs:\n  media:\n    lib: []",
    "catalogs:\n  media:\n    lib: {}",
    "catalogs: {}\ncatalogs: {}",
    "catalogs:\n  media: {}\n  media: {}",
    "catalogs:\n  media:\n    lib: one\n    lib: two",
    "catalogs:\n  media:\n    lib: [",
    "catalogs:\n  media:\n    lib: !unresolved ^1.2.3",
    "catalogs:\n  media:\n    lib: *missing",
    "catalogs:\n  media:\n    lib: *later\n    value: &later ^1.2.3",
  ];
  const diagnostics = invalid.map(refusal);
  TestValidator.predicate(
    "every invalid document is refused in the requested lookup context",
    diagnostics.every(
      (message) =>
        message !== "accepted" &&
        message.includes('catalog "media" dependency "lib"'),
    ),
  );
};

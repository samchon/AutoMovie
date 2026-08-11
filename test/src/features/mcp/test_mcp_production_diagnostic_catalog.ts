import { AUTOMOVIE_DIAGNOSTIC_CODES } from "@automovie/interface";
import {
  AutoMovieApplication,
  findAutoMovieDiagnosticCatalogEntry,
  listAutoMovieDiagnosticCatalog,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/** The public catalog exhaustively resolves immutable behavioral references. */
export const test_mcp_production_diagnostic_catalog = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-catalog-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    inspectCatalog(new AutoMovieApplication({ projectRoot: root }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const inspectCatalog = (application: AutoMovieApplication): void => {
  const catalog = listAutoMovieDiagnosticCatalog();
  const referenceIds = new Set(catalog.map((entry) => entry.reference.id));

  TestValidator.equals(
    "catalog follows the closed code order",
    catalog.map((entry) => entry.code),
    [...AUTOMOVIE_DIAGNOSTIC_CODES],
  );
  TestValidator.equals(
    "every code has exactly one reference identity",
    referenceIds.size,
    AUTOMOVIE_DIAGNOSTIC_CODES.length,
  );
  TestValidator.equals(
    "every reference belongs to the same positive catalog revision",
    new Set(catalog.map((entry) => entry.reference.catalogRevision)),
    new Set([catalog[0]!.reference.catalogRevision]),
  );
  TestValidator.equals(
    "catalog and entries are immutable",
    namedFacts([
      ["catalog", () => Object.isFrozen(catalog)],
      ["entries", () => catalog.every(Object.isFrozen)],
      [
        "references",
        () => catalog.every((entry) => Object.isFrozen(entry.reference)),
      ],
    ]),
    { catalog: true, entries: true, references: true },
  );

  for (const entry of catalog) {
    TestValidator.equals(
      `${entry.code} resolves to its one catalog entry`,
      findAutoMovieDiagnosticCatalogEntry(entry.code),
      entry,
    );
    TestValidator.equals(
      `${entry.code} resolves to a shipped guide`,
      application.getGuideDocument({ name: entry.guide }).name,
      entry.guide,
    );
    TestValidator.predicate(
      `${entry.code} carries a positive revision and anchored Markdown path`,
      entry.reference.catalogRevision > 0 &&
        entry.reference.path.includes(".md#") &&
        entry.invariant.length > 0 &&
        entry.correction.length > 0 &&
        entry.recheck.length > 0,
    );
  }

  TestValidator.equals(
    "unknown code is not treated as a catalog entry",
    findAutoMovieDiagnosticCatalogEntry("outside-the-closed-catalog"),
    null,
  );
  TestValidator.equals(
    "lookup preserves provider and author choice",
    namedFacts([
      [
        "assetChoice",
        () =>
          findAutoMovieDiagnosticCatalogEntry(
            "asset-bytes-missing",
          )?.correction.includes(
            "without changing provider or content policy implicitly",
          ) === true,
      ],
      [
        "repaintChoice",
        () =>
          findAutoMovieDiagnosticCatalogEntry(
            "repaint-failed",
          )?.correction.includes(
            "without choosing a provider or candidate automatically",
          ) === true,
      ],
      [
        "reviewAuthority",
        () =>
          findAutoMovieDiagnosticCatalogEntry(
            "review-outcome-missing",
          )?.correction.includes(
            "never decides the verdict for the reviewer",
          ) === true,
      ],
    ]),
    { assetChoice: true, repaintChoice: true, reviewAuthority: true },
  );
};

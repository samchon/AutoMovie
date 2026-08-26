import { AUTOMOVIE_DIAGNOSTIC_CODES } from "@automovie/interface";
import {
  findAutoMovieDiagnosticCatalogEntry,
  listAutoMovieDiagnosticCatalog,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/** The catalog closes the diagnostic union over immutable, resolvable entries. */
export const test_mcp_production_diagnostic_catalog = (): void => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-catalog-"));
  fs.writeFileSync(
    path.join(root, "automovie.config.ts"),
    "export default {};\n",
  );
  try {
    const catalog = listAutoMovieDiagnosticCatalog();
    const references = new Set(catalog.map((entry) => entry.reference.id));
    const revisions = new Set(
      catalog.map((entry) => entry.reference.catalogRevision),
    );

    TestValidator.equals(
      "the immutable catalog closes the public diagnostic union exactly once",
      namedFacts([
        [
          "codes",
          () =>
            catalog.map((entry) => entry.code).join("\n") ===
            AUTOMOVIE_DIAGNOSTIC_CODES.join("\n"),
        ],
        ["uniqueReferences", () => references.size === catalog.length],
        [
          "onePositiveRevision",
          () =>
            revisions.size === 1 &&
            [...revisions].every((revision) => revision > 0),
        ],
        [
          "completeReferences",
          () =>
            catalog.every(
              (entry) =>
                entry.reference.path.includes(".md#") &&
                entry.invariant.length > 0 &&
                entry.correction.length > 0 &&
                entry.recheck.length > 0,
            ),
        ],
        ["catalogFrozen", () => Object.isFrozen(catalog)],
        [
          "entriesFrozen",
          () =>
            catalog.every(
              (entry) =>
                Object.isFrozen(entry) && Object.isFrozen(entry.reference),
            ),
        ],
        [
          "lookups",
          () =>
            catalog.every(
              (entry) =>
                findAutoMovieDiagnosticCatalogEntry(entry.code) === entry,
            ),
        ],
      ]),
      {
        codes: true,
        uniqueReferences: true,
        onePositiveRevision: true,
        completeReferences: true,
        catalogFrozen: true,
        entriesFrozen: true,
        lookups: true,
      },
    );
    TestValidator.equals(
      "an unknown diagnostic never aliases a catalog entry",
      findAutoMovieDiagnosticCatalogEntry("outside-the-closed-catalog"),
      null,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

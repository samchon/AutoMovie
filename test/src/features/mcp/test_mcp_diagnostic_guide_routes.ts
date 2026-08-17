import {
  AUTOMOVIE_PRODUCTION_GUIDE_NAMES,
  compareCodeUnits,
  listAutoMovieDiagnosticCatalog,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** The corpus, four levels above `test/src/features/mcp`. */
const PACKAGE_ROOT = path.resolve(__dirname, "../../../../packages/mcp");

/** The name one authored file serves under, matching `build/prompt.mjs`. */
const servedName = (file: string): string => {
  const stem = path.basename(file, ".md");
  if (stem !== "INDEX") return stem;
  const area = path.basename(path.dirname(file));
  return area === "prompts"
    ? "AUTOMOVIE_OVERALL"
    : area.replaceAll("-", "_").toUpperCase();
};

/** GitHub's heading slug, which is what an anchor in a reference addresses. */
const slug = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9 -]/gu, "")
    .trim()
    .replace(/\s+/gu, "-");

const headingSlugs = (markdown: string): Set<string> =>
  new Set(
    [...markdown.matchAll(/^#{1,6} (.+)$/gmu)].map((match) =>
      slug(match[1]!.trim()),
    ),
  );

/**
 * Every diagnostic's guide reference resolves to the document it names.
 *
 * A refusal carries the guide and the exact section an author is told to read,
 * and that pointer is the whole recovery path for a defect class. Nothing
 * checked that it lands anywhere. The corpus was reorganized into topic folders
 * and every one of the thirty-two references moved with it; the only thing that
 * caught a stale path was somebody running a script by hand, which is not a
 * check, and a reference that points at a file nobody has is worse than no
 * reference at all because it reads like an answer.
 *
 * Scenarios:
 *
 * 1. Every reference path exists under `packages/mcp/prompts`.
 * 2. Every reference anchor is a heading in that file, so an author following it
 *    lands on the section rather than the top of a long document.
 * 3. Every reference path serves under the guide name the same entry declares,
 *    which is what keeps the name a client asks for and the file an author opens
 *    from drifting apart.
 * 4. Every declared guide name is one the server actually serves.
 */
export const test_mcp_diagnostic_guide_routes = (): void => {
  const entries = listAutoMovieDiagnosticCatalog();
  TestValidator.equals(
    "the catalog routes every defect class somewhere",
    entries.length > 0,
    true,
  );

  const missingFiles: string[] = [];
  const missingAnchors: string[] = [];
  const mismatchedGuides: string[] = [];
  for (const entry of entries) {
    const [relative, anchor] = entry.reference.path.split("#");
    const file = path.join(PACKAGE_ROOT, ...(relative ?? "").split("/"));
    if (fs.existsSync(file) === false) {
      missingFiles.push(`${entry.code}: ${entry.reference.path}`);
      continue;
    }
    const markdown = fs.readFileSync(file, "utf8");
    if (anchor === undefined || headingSlugs(markdown).has(anchor) === false)
      missingAnchors.push(`${entry.code}: ${entry.reference.path}`);
    if (servedName(file) !== entry.guide)
      mismatchedGuides.push(
        `${entry.code}: ${entry.guide} points at ${relative}`,
      );
  }

  TestValidator.equals(
    "every guide reference resolves to a file, an anchor, and its own guide",
    {
      missingFiles: [...new Set(missingFiles)].sort(compareCodeUnits),
      missingAnchors: [...new Set(missingAnchors)].sort(compareCodeUnits),
      mismatchedGuides: [...new Set(mismatchedGuides)].sort(compareCodeUnits),
    },
    { missingFiles: [], missingAnchors: [], mismatchedGuides: [] },
  );

  TestValidator.equals(
    "every routed guide name is served",
    [
      ...new Set(
        entries
          .map((entry) => entry.guide)
          .filter(
            (guide) =>
              AUTOMOVIE_PRODUCTION_GUIDE_NAMES.includes(guide) === false,
          ),
      ),
    ].sort(compareCodeUnits),
    [],
  );
};

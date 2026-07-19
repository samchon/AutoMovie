import { compareCodeUnits } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

/** The repository root — four levels above `test/src/features/docs`. */
const ROOT = path.join(__dirname, "..", "..", "..", "..");

/** Where the version-controlled decision records live. */
const DECISIONS = path.join(ROOT, "docs", "decisions");

/** A record filename: the identifier, then a kebab summary. */
const RECORD = /^D(\d{3})-[a-z0-9-]+\.md$/;

/**
 * A decision citation in prose. The surrounding-character guards keep it from
 * firing inside an identifier or a longer number (`3D001`, `D0155`).
 */
const CITATION = /(?<![0-9A-Za-z])D(\d{3})(?![0-9A-Za-z])/g;

/** Sections every record owes a reader who arrives from a citation. */
const SECTIONS: readonly string[] = [
  "## Decision",
  "## Why",
  "## Where it binds",
  "## Relations",
];

/** Collect every file under `dir` whose extension is in `extensions`. */
const walk = (dir: string, extensions: readonly string[]): string[] => {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, extensions));
    else if (extensions.includes(path.extname(entry.name))) out.push(full);
  }
  return out.sort(compareCodeUnits);
};

/**
 * Every tree whose text may cite a decision — the shipped sources, the MCP
 * guide corpus, and the test suite. Each is addressed directly rather than by
 * walking `packages/`, so no `node_modules` or build output is ever scanned.
 */
const citingFiles = (): string[] => {
  const roots: string[] = [path.join(ROOT, "test", "src", "features")];
  const packages = path.join(ROOT, "packages");
  for (const entry of fs.readdirSync(packages, { withFileTypes: true })) {
    if (entry.isDirectory() === false) continue;
    for (const leaf of ["src", "prompts"]) {
      const dir = path.join(packages, entry.name, leaf);
      if (fs.existsSync(dir)) roots.push(dir);
    }
  }
  // This file is the one place an identifier may appear without being a claim
  // about a record — its negative twin needs an id that deliberately resolves
  // to nothing — so the scanner cannot include itself.
  const self: string = path.resolve(__filename);
  return roots
    .flatMap((dir) => walk(dir, [".ts", ".md"]))
    .filter((file) => path.resolve(file) !== self);
};

/** Identifiers cited across the scanned trees, deduplicated and sorted. */
const citedIdentifiers = (): string[] => {
  const found = new Set<string>();
  for (const file of citingFiles())
    for (const match of fs.readFileSync(file, "utf8").matchAll(CITATION))
      found.add(`D${match[1]!}`);
  return [...found].sort(compareCodeUnits);
};

/** Record filename by identifier, read once. */
const RECORDS: ReadonlyMap<string, string> = new Map(
  fs
    .readdirSync(DECISIONS)
    .map((name) => [RECORD.exec(name), name] as const)
    .filter(
      (pair): pair is readonly [RegExpExecArray, string] => pair[0] !== null,
    )
    .map(([match, name]) => [`D${match[1]!}`, name]),
);

/** The identifier of every record file present on disk, sorted. */
const publishedIdentifiers = (): string[] =>
  [...RECORDS.keys()].sort(compareCodeUnits);

/** The record file backing an identifier, or null when nothing resolves it. */
const recordFor = (identifier: string): string | null =>
  RECORDS.get(identifier) ?? null;

/**
 * Shipped source cites decisions as binding authority — `(D015)` in a
 * validator's JSDoc means its severity is a project-level decision, not a local
 * judgement call. `docs/decisions/` version-controls those records precisely so
 * a reader holding only the repository can resolve one; `.wiki/07-decisions/`
 * is gitignored and carries its own unrelated `NNN` numbering, so it can never
 * be the target of a citation. This pins both directions of that contract: a
 * citation cannot rot into a dangling reference, and a record cannot go
 * unlisted or half-written.
 *
 * Scenarios:
 *
 * 1. The scan finds citations at all — a scanner that silently matched nothing
 *    would make every assertion below pass vacuously, so the guard comes
 *    first.
 * 2. Every identifier cited across the packages, the guide corpus, and the test
 *    suite resolves to a record file (#1181: the reviewability contract).
 * 3. Every record on disk is linked from the index table, so the published set and
 *    its table of contents cannot drift apart.
 * 4. Every record carries Decision, Why, Where it binds, and Relations — the
 *    sections that make a record answer the question a citation raises.
 * 5. `recordFor` resolves a published identifier and returns null for an absent
 *    one: the negative twin proving scenario 2 can actually fail.
 */
export const test_docs_decision_records = (): void => {
  const cited: string[] = citedIdentifiers();
  const published: string[] = publishedIdentifiers();

  // 1. the scanner reaches real text.
  TestValidator.predicate(
    "the scan finds decision citations in the tracked trees",
    cited.length > 0,
  );

  // 2. every citation resolves.
  TestValidator.equals(
    "every cited decision has a record",
    cited.filter((id) => recordFor(id) === null),
    [],
  );

  // 3. every record is indexed.
  const index: string = fs.readFileSync(
    path.join(DECISIONS, "README.md"),
    "utf8",
  );
  TestValidator.equals(
    "every record is linked from the index",
    published.filter((id) => index.includes(`](./${recordFor(id)})`) === false),
    [],
  );

  // 4. every record is fully written.
  TestValidator.equals(
    "every record carries the standard sections",
    published.filter((id) => {
      const body: string = fs.readFileSync(
        path.join(DECISIONS, recordFor(id)!),
        "utf8",
      );
      return SECTIONS.every((section) => body.includes(section)) === false;
    }),
    [],
  );

  // 5. the negative twin: an absent identifier resolves to nothing.
  TestValidator.predicate(
    "a published identifier resolves to its record",
    recordFor(published[0]!) !== null,
  );
  TestValidator.predicate(
    "an unpublished identifier resolves to nothing",
    recordFor("D999") === null,
  );
};

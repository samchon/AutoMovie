import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/** Repository root, from this file's own location. */
const root = path.resolve(__dirname, "..", "..", "..", "..");

/** Directories whose contents ship to a user, or teach one. */
const SHIPPED = ["packages", "docs"];

/** Directories that are build output, dependencies, or a disposable sandbox. */
const SKIP = new Set([
  "node_modules",
  "lib",
  "dist",
  "generated",
  "renders",
  "experimental",
  ".automovie",
  ".git",
  "playground",
]);

const EXTENSIONS = new Set([".ts", ".tsx", ".md", ".mjs", ".cjs", ".js"]);

/**
 * Subject matter that has no business in a universal film engine.
 *
 * Each entry names one particular conflict, period, army or weapon rather than
 * a thing films are made of. A crowd, a formation, a projectile and an impact
 * are film-making; a musket and a regiment are one production's props, and a
 * production builds its own.
 *
 * Words with an ordinary sense outside that vocabulary are deliberately absent.
 * `battle`, `combat`, `charge`, `march`, `weapon` and `army` all carry meanings
 * a general document legitimately needs, so pinning them here would report
 * prose that is doing nothing wrong. What is listed is what cannot be
 * innocent.
 */
const SUBJECT_MATTER = [
  "austerlitz",
  "napoleon",
  "napoleonic",
  "pratzen",
  "musket",
  "bayonet",
  "grenadier",
  "hussar",
  "dragoon",
  "cuirassier",
  "cavalry",
  "regiment",
  "battalion",
  "infantry",
  "artillery",
  "soldier",
];

const files = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const found: string[] = [];
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...files(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) found.push(full);
  }
  return found;
};

/**
 * A universal film engine may not name one production's subject.
 *
 * Automovie renders and simulates; what it renders is the user's to decide. A
 * package that ships a period's weapon as a type, a handbook that teaches one
 * kind of engagement, or a research ledger for one campaign all tell every user
 * what the engine is for, and narrow it to that.
 *
 * The failure is not hypothetical. This vocabulary reached a shipped guide, an
 * interface type's documentation, a model archetype, a starter template and the
 * evidence-graph handbook's worked example, and it arrived each time through
 * ordinary good practice: a capability needed a real measured number, a guide
 * needed a concrete example, and the best-documented answer to hand belonged to
 * one particular historical engagement. Nobody hardcoded a film; each step only
 * made the previous step verifiable.
 *
 * That is why this is a test rather than a convention. The next reach for a
 * concrete example will look as reasonable as the last one did.
 *
 * Scenarios:
 *
 * 1. No shipped or teaching file names a particular conflict, period, army or
 *    weapon, and a failure reports every file and the word it carried, so one
 *    run names the whole set rather than the first of them.
 * 2. The scan reaches a real population, so a sweep that silently matched nothing
 *    cannot pass for a clean repository.
 */
export const test_workspace_no_subject_matter = (): void => {
  const scanned = SHIPPED.flatMap((directory) => {
    const full = path.join(root, directory);
    return fs.existsSync(full) ? files(full) : [];
  });
  const offences = scanned.flatMap((file) => {
    const text = fs.readFileSync(file, "utf8").toLowerCase();
    return SUBJECT_MATTER.filter((word) => text.includes(word)).map(
      (word) => `${path.relative(root, file).replaceAll("\\", "/")}: ${word}`,
    );
  });
  TestValidator.equals(
    "no shipped or teaching file names one production's subject",
    namedFacts([
      ["scanned", () => scanned.length > 100],
      ["clean", () => offences.length === 0],
      // Named rather than counted: a count says a rule broke, a list says
      // where, and the whole point of the scan is to fix every site in one
      // pass rather than one site per run.
      ["offences", () => (offences.length === 0 ? [] : offences)],
    ]),
    { scanned: true, clean: true, offences: [] },
  );
};

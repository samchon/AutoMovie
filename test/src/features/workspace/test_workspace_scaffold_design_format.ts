import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";

/** Repository root, from this file's own location. */
const root = path.resolve(__dirname, "..", "..", "..", "..");

/** The shipped project state a generated production starts from. */
const STATE = path.join(root, "packages", "cli", "scaffold", ".automovie");

const files = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return files(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });

/**
 * A shipped design record is written the way its emitter writes one.
 *
 * `npm run design` in a generated project re-derives every record from the
 * typed subjects under `src` and writes it with `JSON.stringify(value, null,
 * 2)`. A record committed here in any other shape is therefore rewritten the
 * first time an author runs that command -- which is a design mutation, which
 * stales the compile, which refuses every reader of generated state until
 * somebody compiles again. Nothing in that chain names the formatting, so the
 * author is left with "state is stale" and no file to look at.
 *
 * That is not hypothetical: repository formatting collapsed nine of these
 * records onto shorter lines, and the packaged end-to-end run failed three
 * steps later with a stale state and no cause attached. `.prettierignore` now
 * leaves this tree alone, and this is the check that says so, because a
 * formatter is exactly the kind of tool that comes back.
 *
 * Scenarios:
 *
 * 1. Every shipped record is byte-identical to its own re-serialization, so an
 *    emit on a fresh project writes nothing.
 * 2. The scan reaches a real population, so a sweep that silently matched no
 *    record cannot pass for a consistent tree.
 */
export const test_workspace_scaffold_design_format = (): void => {
  const scanned = files(STATE);
  const offences = scanned.flatMap((file) => {
    const text = fs.readFileSync(file, "utf8");
    const emitted = `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
    return text === emitted
      ? []
      : [path.relative(root, file).replaceAll("\\", "/")];
  });
  TestValidator.equals(
    "the scan reaches a real population",
    namedFacts([["scanned", () => scanned.length >= 10]]),
    { scanned: true },
  );
  // Compared as a list rather than a count: the whole point is to name every
  // record a formatter touched, in one run rather than one per run.
  TestValidator.equals(
    "every shipped design record is written the way the emitter writes one",
    offences,
    [],
  );
};

import fs from "node:fs";

/**
 * Load one repository module by absolute path and prove it is that module.
 *
 * `require(<absolute .ts path>)` under this harness can answer with a different
 * module than the one named, silently. Measured against
 * `packages/template/build`: requiring `syncVersions.ts` returned
 * `templateVersions.ts`'s exports and never ran syncVersions' body, and
 * requiring `templateVersions.ts` returned the generated
 * `packages/template/src/templateVersions.ts` instead. Both answered with a
 * module, neither with the one named, and nothing said so.
 *
 * That is the shape this campaign keeps meeting: a step that reports success
 * while measuring something else. Here it is worse than usual, because every
 * private-unit scenario in this suite reaches its subject this way. A scenario
 * handed the wrong module asserts against whatever that module happens to
 * export and passes, and what passed is not what it named.
 *
 * So the caller states which runtime exports it came for, and this checks both
 * directions: the loaded object carries each of them, and the file at that path
 * declares each of them in its own bytes. A different module satisfying the
 * first would have to have been written with the same export names in the same
 * file to satisfy the second.
 *
 * The second direction means a name the file only re-exports does not count. A
 * barrel is refused here on purpose: `export * from "./elsewhere"` tells you
 * nothing about which file answered, which is the one thing this is for. Name a
 * value the file itself declares, and reach a re-exported one through the
 * package's own entry point like any other consumer.
 *
 * Type-only exports are invisible at run time and cannot be named here. Pass
 * the values the scenario actually calls.
 *
 * The declaration check reads `export const|let|var|function|class <name>`, so
 * a module that declares a value and exports it separately as `export { name }`
 * is refused even though it does declare it. That is a false refusal and it is
 * left standing rather than papered over, because the pattern that would admit
 * it is one character away from the pattern that admits `export { name } from
 * "./elsewhere"`, which is the re-export this must keep refusing. It is loud
 * when it happens -- the message names the file and the export -- and no module
 * this suite loads by path is written that way. Widen it only with a case for
 * both forms.
 */
export const requireSourceModule = <T>(
  file: string,
  exports: readonly string[],
): T => {
  if (exports.length === 0)
    throw new Error(
      `requireSourceModule("${file}") named no export, so it would prove nothing about which module it loaded.`,
    );
  const loaded = require(file) as Record<string, unknown>;
  const source = fs.readFileSync(file, "utf8");
  const missing = exports.filter((name) => loaded[name] === undefined);
  if (missing.length !== 0)
    throw new Error(
      `require("${file}") answered with a module that does not export ${missing.join(", ")}. It carries ${Object.keys(loaded).join(", ") || "nothing"} instead, so it is not the module this path names.`,
    );
  const undeclared = exports.filter(
    (name) =>
      new RegExp(
        `export\\s+(?:const|let|var|function|async\\s+function|class)\\s+${name}\\b`,
        "u",
      ).test(source) === false,
  );
  if (undeclared.length !== 0)
    throw new Error(
      `The file at "${file}" declares no ${undeclared.join(", ")}, so the module require answered with came from somewhere else.`,
    );
  return loaded as T;
};

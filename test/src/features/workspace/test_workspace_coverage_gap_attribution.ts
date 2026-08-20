import { TestValidator } from "@nestia/e2e";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { namedFacts } from "../internal/predicates";

/** The repository root, four levels above `test/src/features/workspace`. */
const ROOT = path.resolve(__dirname, "../../../..");

/**
 * A file carrying the shapes the report actually produced.
 *
 * Line 1 is the import a transpile helper was mapped onto, line 4 is a constant
 * carrying nothing but its own name, and line 5 is an ordinary definition.
 */
const SOURCE = [
  "import {",
  "  builtEnvironmentUnclaimedElements,",
  "} from './builtEnvironment';",
  "const PLANE_NORMAL_EPSILON = 1e-12;",
  "export const mountViewer = (host) => host;",
];

/** One newline, built rather than written: an escape in this file is emitted literally. */
const NEWLINE = String.fromCharCode(10);

const entry = (name: string, line: number) =>
  JSON.stringify({
    name,
    loc: { start: { line, column: 0 }, end: { line, column: 0 } },
  });

interface IAnswers {
  fresh: boolean;
  ranElsewhere: boolean;
  neverWritten: boolean;
  anonymous: boolean;
  unreadable: boolean;
  confirmed: boolean;
  bodyAnchored: boolean;
}

/**
 * A gap the reporter drops must be one the file provably does not have.
 *
 * `#1991` reported a function listed as uncovered beside its own six calls.
 * Measured on one 343-file report: **361** named function entries had zero
 * hits; **137** carried a name that had run under another entry in the same
 * file, and **13** carried a name the file never contains —
 * `__setModuleDefault`, `ownKeys` and `get` are helpers the transpile emitted,
 * mapped onto the `import {` a file opens with and printed as untested code
 * somebody wrote. `builtEnvironmentUnclaimedElements` appeared twice: at a line
 * holding `const PLANE_NORMAL_EPSILON = 1e-12;` with zero hits, and where it is
 * defined with six.
 *
 * Both rules are provable, and that is why they are the two. A name with a
 * covered entry beside it demonstrably ran. A name the file never contains is
 * not a function the file declares. Neither can hide untested code.
 *
 * The rule that was tried and rejected is the tempting one: drop an entry whose
 * reported line does not define it. It is a heuristic, and it fails in the
 * direction that costs the most — a function entry can be anchored at its body's
 * first statement rather than its signature, so the line holds no name while the
 * gap is entirely real. Those stay listed, and the report says how many carry a
 * position not to be trusted.
 *
 * Scenarios:
 *
 * 1. A zero-hit name with nothing against it is a gap, which is the ordinary
 *    case this report exists to print.
 * 2. A name that ran under another entry in the same file is dropped.
 * 3. A name the file never contains is dropped.
 * 4. An entry the tool named anonymously is kept: there is nothing to look for,
 *    and a guess that hides a real gap is worse than one that shows a false one.
 * 5. A file the report outlived is kept whole rather than judged against
 *    nothing.
 * 6. Position confirmation is a separate question, and answers no for a line
 *    that holds a different name — which is a count, never a drop.
 * 7. Importing the reporter prints nothing. That guard is what lets this case
 *    ask about the rule at all, and `coverage.mjs` carries it for the same
 *    reason.
 */
export const test_workspace_coverage_gap_attribution = (): void => {
  const module = path.join(ROOT, "internals", "report-coverage-gaps.mjs");
  const probe = spawnSync(
    process.execPath,
    [
      "-e",
      `import(${JSON.stringify(pathToFileURL(module).href)}).then((loaded) => {
         const source = ${JSON.stringify(SOURCE)};
         const text = ${JSON.stringify(SOURCE.join(NEWLINE))};
         const real = (name, covered, body) =>
           loaded.functionGapIsReal({
             name,
             covered: new Set(covered),
             text: body === undefined ? text : body,
           });
         console.log(
           JSON.stringify({
             fresh: real("mountViewer", []),
             ranElsewhere: real("builtEnvironmentUnclaimedElements", [
               "builtEnvironmentUnclaimedElements",
             ]),
             neverWritten: real("__setModuleDefault", []),
             anonymous: real("(anonymous_12)", []),
             unreadable: real("__setModuleDefault", [], null),
             confirmed: loaded.functionPositionConfirmed(
               source,
               ${entry("mountViewer", 5)},
             ),
             bodyAnchored: loaded.functionPositionConfirmed(
               source,
               ${entry("mountViewer", 4)},
             ),
           }),
         );
       });`,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  const answers = ((): IAnswers | null => {
    const line = probe.stdout
      .split("\n")
      .map((text) => text.trim())
      .find((text) => text.startsWith("{"));
    if (line === undefined) return null;
    try {
      return JSON.parse(line) as IAnswers;
    } catch {
      return null;
    }
  })();

  TestValidator.equals(
    "a coverage gap is dropped only where the file provably has none",
    namedFacts([
      ["the probe answered", () => answers !== null],
      ["an ordinary zero-hit name is a gap", () => answers?.fresh === true],
      [
        "a name that ran under another entry is not",
        () => answers?.ranElsewhere === false,
      ],
      [
        "and neither is a name this repository never wrote",
        () => answers?.neverWritten === false,
      ],
      [
        "an anonymous entry is kept, because nothing can be looked for",
        () => answers?.anonymous === true,
      ],
      [
        "a file the report outlived is kept whole",
        () => answers?.unreadable === true,
      ],
      // Position is counted, never acted on. Both answers matter: a rule that
      // always said yes would report nothing to distrust.
      [
        "a definition line confirms its own position",
        () => answers?.confirmed === true,
      ],
      [
        "and a line holding another name does not",
        () => answers?.bodyAnchored === false,
      ],
      [
        "importing the reporter printed no report",
        () => probe.stdout.includes("::group::") === false,
      ],
    ]),
    {
      "the probe answered": true,
      "an ordinary zero-hit name is a gap": true,
      "a name that ran under another entry is not": true,
      "and neither is a name this repository never wrote": true,
      "an anonymous entry is kept, because nothing can be looked for": true,
      "a file the report outlived is kept whole": true,
      "a definition line confirms its own position": true,
      "and a line holding another name does not": true,
      "importing the reporter printed no report": true,
    },
  );
};

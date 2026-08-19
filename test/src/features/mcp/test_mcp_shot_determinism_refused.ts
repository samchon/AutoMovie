import { IAutoMovieDiagnostic } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

const CODE = "source-shot-nondeterministic";

/**
 * A shot build path reads nothing it was not given, and the compiler says so.
 *
 * `determinism` is a named criterion of the `source` review, and it was the one
 * criterion with no mechanical enforcement anywhere: nothing refused a wall
 * clock, unseeded randomness, or process state inside a shot module, so an
 * agent discharged it by reading for it. A criterion a machine can decide is
 * not a review criterion.
 *
 * Determinism is also the property every other check in this product rests on,
 * because each of them compares two runs; a value that moves on its own makes
 * those comparisons unable to fail, which reads exactly like passing. So the
 * refusal is not scope-dependent the way an incomplete review is.
 *
 * Scenarios:
 *
 * 1. The shipped starter's shot module is clean.
 * 2. A wall clock, unseeded randomness, and process state are each refused, and
 *    the refusal names the spelling, the line, and the shots that module
 *    builds.
 * 3. An import is not this scan's business. The compiler walks the module's
 *    TypeScript AST and refuses an unsupported one as
 *    `source-import-unsupported` before this ever runs, so a regex beside a
 *    parser would be a second, worse spelling of the same rule.
 * 4. The scan reads code rather than prose: the same spelling inside a JSDoc
 *    line is not a call and is not refused.
 */
export const test_mcp_shot_determinism_refused = (): void => {
  const fixture = productionFixture();
  try {
    const module = path.join(fixture.root, "src", "shots", "opening.ts");
    const authored = fs.readFileSync(module, "utf8");
    const compiler = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    );
    const of = (code: string): IAutoMovieDiagnostic[] =>
      compiler
        .compile({ scope: "source" })
        .diagnostics.filter((diagnostic) => diagnostic.code === code);

    const clean = of(CODE);

    fs.writeFileSync(
      module,
      `${authored}\nexport const drift = Date.now();\n`,
      "utf8",
    );
    const clock = of(CODE);

    fs.writeFileSync(
      module,
      `${authored}\nexport const jitter = Math.random();\n`,
      "utf8",
    );
    const random = of(CODE);

    fs.writeFileSync(
      module,
      `${authored}\nexport const host = process.platform;\n`,
      "utf8",
    );
    const machine = of(CODE);

    // The parser owns imports; this scan stops where it starts.
    fs.writeFileSync(
      module,
      `import nodeFs from "node:fs";\n${authored}\nexport const bytes = nodeFs;\n`,
      "utf8",
    );
    const imported = of("source-import-unsupported");

    fs.writeFileSync(
      module,
      `${authored}\n/** Never call Math.random() here; use a declared seed. */\nexport const advice = 1;\n`,
      "utf8",
    );
    const prose = of(CODE);

    fs.writeFileSync(module, authored, "utf8");
    const restored = of(CODE);

    TestValidator.equals(
      "a shot module that reads a clock, a die, or the machine is refused",
      namedFacts([
        ["theStarterIsClean", () => clean.length === 0],
        ["restoringItIsCleanAgain", () => restored.length === 0],
        [
          "aWallClockIsRefused",
          () =>
            clock.length === 1 &&
            clock[0]!.category === "error" &&
            clock[0]!.message.includes("Date.now"),
        ],
        [
          "unseededRandomnessIsRefused",
          () =>
            random.length === 1 && random[0]!.message.includes("Math.random"),
        ],
        [
          "processStateIsRefused",
          () => machine.length === 1 && machine[0]!.message.includes("process"),
        ],
        ["theParserOwnsImports", () => imported.length !== 0],
        [
          "theRefusalNamesTheModuleAndItsShots",
          () =>
            clock[0]!.path === "src/shots/opening.ts" &&
            clock[0]!.message.includes('"opening"'),
        ],
        ["proseIsNotACall", () => prose.length === 0],
      ]),
      {
        theStarterIsClean: true,
        restoringItIsCleanAgain: true,
        aWallClockIsRefused: true,
        unseededRandomnessIsRefused: true,
        processStateIsRefused: true,
        theParserOwnsImports: true,
        theRefusalNamesTheModuleAndItsShots: true,
        proseIsNotACall: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

interface ITemplateSentinelFixtureFailure {
  error: unknown;
}

class TemplateSentinelFixtureCleanupError extends AggregateError {}

export const preserveTemplateSentinelFixtureCleanup = (
  failure: ITemplateSentinelFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new TemplateSentinelFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Template-sentinel fixture teardown failed after the test failed.",
    );
  }
};

/**
 * The compiler refuses source that still carries the scaffold's placeholder.
 *
 * The scaffold marks a section an author must implement with an exact token.
 * Left in place it compiles fine and says nothing, so a shot can register, pass
 * its contract, and still be a stub. A lint rule caught this, which meant the
 * one gate that reads the source in a sandbox did not.
 *
 * Boundary matching is what keeps the check honest. The token is an identifier,
 * so a longer name that merely contains it is a different symbol, and reporting
 * on it would make the rule a substring search a project cannot escape except
 * by renaming unrelated code.
 *
 * Scenarios:
 *
 * 1. The starter's own source is free of the sentinel and compiles, which is the
 *    negative twin: the check must be silent on a project that never had the
 *    placeholder or has already replaced it.
 * 2. Restoring the exact token to a compiled shot module fails the compile with
 *    `source-template-sentinel`, and the message names the file.
 * 3. A longer identifier that contains the token is not the placeholder and
 *    compiles, so the check reads identifier boundaries rather than
 *    substrings.
 */
export const test_mcp_production_template_sentinel = (): void => {
  let failure: ITemplateSentinelFixtureFailure | undefined;
  const fixture = productionFixture();
  try {
    const modulePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(modulePath, "utf8");
    const compile = (): ReturnType<AutoMovieProductionCompiler["compile"]> =>
      new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
      ).compile({ scope: "source" });
    const sentinel = (
      output: ReturnType<AutoMovieProductionCompiler["compile"]>,
    ): { path: string | null } | undefined =>
      output.diagnostics.find(
        (item) => item.code === "source-template-sentinel",
      );

    const clean = compile();
    TestValidator.equals(
      "the starter carries no placeholder",
      sentinel(clean) === undefined,
      true,
    );

    fs.writeFileSync(
      modulePath,
      `const AUTOMOVIE_IMPLEMENT_ME = 1;\n${original}`,
    );
    const stubbed = compile();
    TestValidator.equals(
      "a restored placeholder refuses the compile and names its file",
      namedFacts([
        ["refused", () => stubbed.success === false],
        ["reported", () => sentinel(stubbed) !== undefined],
        [
          "namesTheModule",
          () => sentinel(stubbed)?.path?.includes("opening.ts") === true,
        ],
      ]),
      { refused: true, reported: true, namesTheModule: true },
    );

    fs.writeFileSync(
      modulePath,
      `const AUTOMOVIE_IMPLEMENT_ME_LATER = 1;\nvoid AUTOMOVIE_IMPLEMENT_ME_LATER;\n${original}`,
    );
    TestValidator.equals(
      "a longer identifier containing the token is not the placeholder",
      sentinel(compile()) === undefined,
      true,
    );
    fs.writeFileSync(modulePath, original);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveTemplateSentinelFixtureCleanup(failure, () => fixture.dispose());
  }
};

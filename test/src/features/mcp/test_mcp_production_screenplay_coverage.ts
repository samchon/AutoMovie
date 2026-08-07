import { IAutoMovieScreenplayIndex } from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

interface IScreenplayCoverageFixtureFailure {
  error: unknown;
}

class ScreenplayCoverageFixtureCleanupError extends AggregateError {}

export const preserveScreenplayCoverageFixtureCleanup = (
  failure: IScreenplayCoverageFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ScreenplayCoverageFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Screenplay-coverage fixture teardown failed after the test failed.",
    );
  }
};

const codes = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): Set<string> => new Set(output.diagnostics.map((item) => item.code));

const coverage = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): { category: string; message: string } | undefined => {
  const found = output.diagnostics.find(
    (item) => item.code === "screenplay-scene-unrealized",
  );
  return found === undefined
    ? undefined
    : { category: found.category, message: found.message };
};

/**
 * The compiler owns whether the film covers its screenplay.
 *
 * The screenplay was the one join the compiler did not know about: it never
 * used the word, so a scene could sit in the index with nothing built against
 * it while every gate stayed green. A lint rule was the sole enforcer, and a
 * lint rule has no compile scope, so it could not tell "not finished yet" from
 * "wrong" and failed continuously on any film built sequence by sequence.
 *
 * Realization is the bar, not intent. A shot contract citing a scene proves the
 * author meant to cover it; only a shot whose realization actually compiled
 * proves the film does. That distinction is what keeps an unbuilt promise from
 * turning the ledger green.
 *
 * The fixture is a one-shot production whose screenplay declares two scenes, so
 * it starts genuinely uncovered. That is the useful baseline: the check has to
 * report a real gap before it is worth trusting that it stays silent on a
 * covered one.
 *
 * Scenarios:
 *
 * 1. The fixture's second scene has no shot, so `source` warns, names the scene,
 *    and says the film must cover it before review; the compile still succeeds,
 *    because an unfinished film is the normal state while authoring.
 * 2. The same gap is an error at `review` and at `final`, because a film presented
 *    for review is claiming to be whole.
 * 3. Recording that scene as an `OMITTED` tombstone clears it at every scope,
 *    since a tombstone is how a production drops a scene without renumbering.
 * 4. The negative twin: with only the realized scene left active, the check goes
 *    silent at every scope, so it tracks the real gap rather than firing on
 *    every compile.
 */
export const test_mcp_production_screenplay_coverage = (): void => {
  let failure: IScreenplayCoverageFixtureFailure | undefined;
  const fixture = productionFixture();
  try {
    // Opening the project migrates the design tree under the production
    // segment, so the index moves out from under a path captured beforehand.
    const indexPath = (): string => {
      const candidates = [
        path.join(
          fixture.root,
          ".automovie/design/fixture-film/screenplay/index.json",
        ),
        path.join(fixture.root, ".automovie/design/screenplay/index.json"),
      ];
      return candidates.find((file) => fs.existsSync(file)) ?? candidates[0];
    };
    const original = fs.readFileSync(indexPath(), "utf8");
    const reopen = (): AutoMovieProductionCompiler =>
      new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
      );
    const rewrite = (
      mutate: (index: IAutoMovieScreenplayIndex) => void,
    ): void => {
      const index = JSON.parse(original) as IAutoMovieScreenplayIndex;
      mutate(index);
      const file = indexPath();
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file,
        `${JSON.stringify(index, null, 2)}
`,
      );
    };

    const uncoveredSource = reopen().compile({ scope: "source" });
    TestValidator.equals(
      "an unrealized active scene warns while authoring without failing the compile",
      namedFacts([
        ["compileSucceeded", () => uncoveredSource.success === true],
        ["warns", () => coverage(uncoveredSource)?.category === "warning"],
        [
          "namesTheScene",
          () => coverage(uncoveredSource)?.message.includes("SCN-002") === true,
        ],
        [
          "saysNotYet",
          () =>
            coverage(uncoveredSource)?.message.includes(
              "must before review",
            ) === true,
        ],
      ]),
      {
        compileSucceeded: true,
        warns: true,
        namesTheScene: true,
        saysNotYet: true,
      },
    );
    TestValidator.equals(
      "the same gap refuses from review on",
      namedFacts([
        [
          "review",
          () =>
            coverage(reopen().compile({ scope: "review" }))?.category ===
            "error",
        ],
        [
          "final",
          () =>
            coverage(reopen().compile({ scope: "final" }))?.category ===
            "error",
        ],
      ]),
      { review: true, final: true },
    );

    rewrite((index) => {
      const scene = index.screenplay.scenes.find(
        (entry) => entry.id === "SCN-002",
      )!;
      scene.status = "OMITTED";
    });
    TestValidator.equals(
      "an OMITTED tombstone is not an uncovered scene",
      namedFacts([
        [
          "source",
          () =>
            codes(reopen().compile({ scope: "source" })).has(
              "screenplay-scene-unrealized",
            ),
        ],
        [
          "review",
          () =>
            codes(reopen().compile({ scope: "review" })).has(
              "screenplay-scene-unrealized",
            ),
        ],
      ]),
      { source: false, review: false },
    );

    rewrite((index) => {
      index.screenplay.scenes = index.screenplay.scenes.filter(
        (entry) => entry.id !== "SCN-002",
      );
    });
    TestValidator.equals(
      "a fully realized screenplay raises nothing at any scope",
      namedFacts([
        [
          "source",
          () =>
            codes(reopen().compile({ scope: "source" })).has(
              "screenplay-scene-unrealized",
            ),
        ],
        [
          "review",
          () =>
            codes(reopen().compile({ scope: "review" })).has(
              "screenplay-scene-unrealized",
            ),
        ],
      ]),
      { source: false, review: false },
    );
    fs.writeFileSync(indexPath(), original);
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveScreenplayCoverageFixtureCleanup(failure, () => fixture.dispose());
  }
};

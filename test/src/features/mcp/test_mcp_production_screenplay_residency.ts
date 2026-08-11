import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

interface IScreenplayResidencyFixtureFailure {
  error: unknown;
}

class ScreenplayResidencyFixtureCleanupError extends AggregateError {}

const preserveScreenplayResidencyFixtureCleanup = (
  failure: IScreenplayResidencyFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ScreenplayResidencyFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Screenplay-residency fixture teardown failed after the test failed.",
    );
  }
};

const codes = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): Set<string> => new Set(output.diagnostics.map((item) => item.code));

const residency = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): { category: string; message: string } | undefined => {
  const found = output.diagnostics.find(
    (item) => item.code === "screenplay-index-missing",
  );
  return found === undefined
    ? undefined
    : { category: found.category, message: found.message };
};

/**
 * A resident shot contract requires a resident screenplay index.
 *
 * This is the obligation `automovie/state-presence` held: a downstream record
 * whose configured upstream slot does not exist is a record joining to
 * numbering nothing has fixed. The compiler already loads the graph that
 * answers it, so a second enforcer with its own language and failure modes was
 * only a second place the answer could come from.
 *
 * The rule's one property worth preserving verbatim is that it checks residency
 * and never decodes. A structurally valid but empty ledger counts as present,
 * so prose can never affect the verdict and this check can never disagree with
 * the ones that judge the ledger's content.
 *
 * Silence on an empty project is equally load-bearing. A fresh scaffold and a
 * design-only session have no shot contracts, and telling their author to write
 * a screenplay before there is anything to join it to would make the gate fire
 * where there is no defect.
 *
 * Scenarios:
 *
 * 1. Removing the index while the fixture's shot contract stays resident refuses
 *    at `design`, the earliest scope, since this is a design-record fact and
 *    nothing built later can repair it.
 * 2. The same removal refuses at `source`, `review` and `final`, so the verdict
 *    does not depend on how far the production has been driven.
 * 3. The message names how many contracts are stranded, which is what tells an
 *    author whether one shot ran ahead or the whole design did.
 * 4. The negative twin: with the index restored, the check is silent at every
 *    scope, so it tracks the missing slot rather than firing on every compile.
 * 5. A project with neither slot populated is silent, because residency is a
 *    requirement between records and an empty project has no downstream record
 *    making the demand.
 */
export const test_mcp_production_screenplay_residency = (): void => {
  let failure: IScreenplayResidencyFixtureFailure | undefined;
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
    const reopen = (): AutoMovieProductionCompiler =>
      new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
      );
    // Open once so the migration settles before the index path is captured.
    reopen();
    const file = indexPath();
    const original = fs.readFileSync(file, "utf8");
    fs.rmSync(file);

    const missingDesign = reopen().compile({ scope: "design" });
    TestValidator.equals(
      "a stranded shot contract refuses at the earliest scope",
      residency(missingDesign),
      {
        category: "error",
        message:
          "1 shot contract(s) are resident with no screenplay index. Their scene citations join to numbering that does not exist, so nothing downstream can be traced to authored work. Author the screenplay index, then compile again.",
      },
    );

    const refuses =
      (scope: "design" | "source" | "review" | "final") => (): boolean =>
        codes(reopen().compile({ scope })).has("screenplay-index-missing");
    // `namedFacts` stops at its first false, so a silence expectation is phrased
    // positively; stated the other way only the first scope would be reported.
    const silent =
      (scope: "design" | "source" | "review" | "final") => (): boolean =>
        refuses(scope)() === false;
    TestValidator.equals(
      "the refusal does not depend on how far the production has been driven",
      namedFacts([
        ["source", refuses("source")],
        ["review", refuses("review")],
        ["final", refuses("final")],
      ]),
      { source: true, review: true, final: true },
    );

    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, original);
    TestValidator.equals(
      "a resident index clears the check at every scope",
      namedFacts([
        ["design", silent("design")],
        ["source", silent("source")],
        ["review", silent("review")],
        ["final", silent("final")],
      ]),
      { design: true, source: true, review: true, final: true },
    );
  } catch (error) {
    failure = { error };
    throw error;
  } finally {
    preserveScreenplayResidencyFixtureCleanup(failure, () => fixture.dispose());
  }

  let emptyFailure: IScreenplayResidencyFixtureFailure | undefined;
  const emptyRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-screenplay-residency-"),
  );
  try {
    const empty = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(emptyRoot),
    ).compile({ scope: "design" });
    TestValidator.predicate(
      "a project with neither slot populated makes no demand",
      codes(empty).has("screenplay-index-missing") === false,
    );
  } catch (error) {
    emptyFailure = { error };
    throw error;
  } finally {
    preserveScreenplayResidencyFixtureCleanup(emptyFailure, () =>
      fs.rmSync(emptyRoot, { force: true, recursive: true }),
    );
  }
};

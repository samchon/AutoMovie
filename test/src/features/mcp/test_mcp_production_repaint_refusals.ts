import { IAutoMovieRepaintShot } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

interface IRepaintFixtureFailure {
  error: unknown;
}

class RepaintFixtureCleanupError extends AggregateError {}

/** Dispose one repaint fixture without replacing its primary failure. */
export const preserveRepaintFixtureCleanup = (
  failure: IRepaintFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new RepaintFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Repaint fixture cleanup failed after the test failed.",
    );
  }
};

const parameters = (): IAutoMovieRepaintShot.IProps["parameters"] =>
  ({
    prompt: "a duel at dawn",
    seed: 7,
    strength: 0.4,
    controls: {},
  }) as unknown as IAutoMovieRepaintShot.IProps["parameters"];

const codesOf = (output: IAutoMovieRepaintShot): string[] =>
  output.diagnostics.map((diagnostic) => diagnostic.code);

/**
 * What `repaintShot` refuses before it would ever call a diffusion adapter.
 *
 * Repaint is the one surface that hands work to a model outside this project,
 * so every precondition failure has to come back as a named diagnostic with the
 * repair in it: AutoMovie will not fabricate diffusion output, and it will not
 * let a host believe a repaint happened. This host has no adapter configured,
 * which is exactly the state most hosts start in.
 *
 * Scenarios:
 *
 * 1. A blank or untrimmed `productionId` is refused as
 *    `repaint-production-invalid` without touching the project.
 * 2. A host with no adapter is refused as `repaint-host-unavailable`, and the
 *    message names the configuration that would supply one.
 * 3. Every refusal reports `repainted: false` with a null receipt, so no caller
 *    can read a rendition out of a failure.
 */
export const test_mcp_production_repaint_refusals = async (): Promise<void> => {
  const fixture = productionFixture();
  let repaintFailure: IRepaintFixtureFailure | undefined;
  try {
    const application = new AutoMovieApplication({
      projectRoot: fixture.root,
      productionId: "fixture-film",
    });
    // `getGuideDocument` is synchronous and records the session credit
    // `repaintShot` requires; without both, the call throws instead of
    // returning the refusal this test is about.
    application.getGuideDocument({ name: "AUTOMOVIE_OVERALL" });
    application.getGuideDocument({ name: "REPAINT_SHOT" });
    const repaint = async (
      productionId: string,
    ): Promise<IAutoMovieRepaintShot> =>
      application.repaintShot({
        productionId,
        shot: "opening",
        parameters: parameters(),
        references: [],
      } as unknown as IAutoMovieRepaintShot.IProps);
    const blank = await repaint("  ");
    const untrimmed = await repaint("fixture-film ");
    const hostless = await repaint("fixture-film");
    TestValidator.equals(
      "repaint refuses by name and never reports a rendition it did not make",
      namedFacts([
        [
          "blankProductionIsRefused",
          () => codesOf(blank).join(",") === "repaint-production-invalid",
        ],
        [
          "untrimmedProductionIsRefused",
          () => codesOf(untrimmed).join(",") === "repaint-production-invalid",
        ],
        [
          "aHostWithNoAdapterIsRefused",
          () => codesOf(hostless).join(",") === "repaint-host-unavailable",
        ],
        [
          "theAdapterRefusalNamesItsConfiguration",
          () =>
            hostless.diagnostics[0]!.message.includes(
              "createAutoMovieMcpServer({ repaint })",
            ),
        ],
        [
          "noRefusalCarriesAReceipt",
          () =>
            [blank, untrimmed, hostless].every(
              (output) => output.repainted === false && output.receipt === null,
            ),
        ],
      ]),
      {
        blankProductionIsRefused: true,
        untrimmedProductionIsRefused: true,
        aHostWithNoAdapterIsRefused: true,
        theAdapterRefusalNamesItsConfiguration: true,
        noRefusalCarriesAReceipt: true,
      },
    );
  } catch (error) {
    repaintFailure = { error };
    throw error;
  } finally {
    preserveRepaintFixtureCleanup(repaintFailure, () => fixture.dispose());
  }
};

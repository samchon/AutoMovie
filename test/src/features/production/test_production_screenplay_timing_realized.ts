import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

const TIMING_CODES = new Set([
  "screenplay-timing-unowned",
  "screenplay-timing-reference-invalid",
  "screenplay-timing-owner-absent",
  "screenplay-timing-value-mismatch",
]);

/** Timing diagnostics of every code, whatever severity the scope gave them. */
const timing = (
  compiler: AutoMovieProductionCompiler,
  scope: "source" | "review",
) =>
  compiler
    .compile({ scope })
    .diagnostics.filter((diagnostic) => TIMING_CODES.has(diagnostic.code));

/**
 * A duration a scene states in prose must name the shot field that owns it.
 *
 * The ledger checks that a shot cites a scene the index declares, the coverage
 * gate checks that every active scene has a realizing shot, and
 * `realizeShotContract` evaluates every authored predicate against the compiled
 * artifact. None of them reads the scene's prose, so a figure written there
 * used to be a falsifiable claim about the film that nothing falsified, and an
 * equal number elsewhere in the production is coincidence, not traceability.
 * Every stated duration therefore carries an inline `{@timing ...}` selector
 * naming the exact shot duration, event boundary, or review frame it quotes.
 *
 * Scenarios:
 *
 * 1. The completed fixture, whose every stated duration names its owner, raises
 *    nothing at review.
 * 2. Evidence comments and fenced examples are not audience-facing prose, so
 *    numbers inside either cannot invent a timing promise, while prose after
 *    an unclosed fenced example is still prose.
 * 3. A duration without an owner is reported as unowned, naming the figure: a
 *    warning while authoring and an error at review.
 * 4. A selector outside the supported grammar, a shot that does not cite the
 *    scene, and a field the shot does not carry are each refused by name.
 * 5. An owned figure that differs from the contract value is a mismatch naming
 *    both values, while the exact contract value is silent, and a scene id is
 *    not a duration.
 */
export const test_production_screenplay_timing_realized = (): void => {
  const fixture = productionFixture();
  try {
    const scene = path.join(
      fixture.root,
      "docs",
      "screenplays",
      "001-cue",
      "001-cue.md",
    );
    const authored = fs.readFileSync(scene, "utf8");
    const compiler = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    );
    const withProse = (
      prose: string,
      scope: "source" | "review" = "review",
    ) => {
      fs.writeFileSync(scene, `${authored}\n${prose}\n`, "utf8");
      return timing(compiler, scope);
    };

    const anchoredHeadingIsStable =
      compiler
        .compile({ scope: "review" })
        .diagnostics.filter(
          (diagnostic) => diagnostic.code === "screenplay-heading-retitled",
        ).length === 0;
    const asAuthored = timing(compiler, "review");
    const metadataAndExample = withProse(
      "<!-- Review metadata mentions 1.1 seconds. -->\n```html\n<!-- A literal example mentions 1.3 seconds.\n```",
    );
    const visibleAfterExample = withProse(
      "```html\n<!-- An unclosed literal comment.\n```\nThe visible scene holds for 1.4 seconds.",
    );
    const authoring = withProse(
      "SCN-001 holds the raised hand for 1.2 seconds.",
      "source",
    );
    const delivering = withProse(
      "SCN-001 holds the raised hand for 1.2 seconds.",
    );
    const invalidSelector = withProse(
      "The hand holds for 6 seconds {@timing shot:opening/nonsense}.",
    );
    const foreignShot = withProse(
      "The hand holds for 6 seconds {@timing shot:answer/duration}.",
    );
    const absentField = withProse(
      "The hand holds for 3 seconds {@timing shot:opening/event:missing/to}.",
    );
    const mismatch = withProse(
      "The hand holds for 1.2 seconds {@timing shot:opening/duration}.",
    );
    const owned = withProse(
      "The hand holds for 6.0 seconds {@timing shot:opening/duration}, and the cue closes at three seconds {@timing shot:opening/event:cue-raised/to}.",
    );
    const identifier = withProse("See SCN-001 for the raised hand.");
    fs.writeFileSync(scene, authored, "utf8");
    const restored = timing(compiler, "review");

    TestValidator.equals(
      "a duration stated in scene prose must name the shot field it quotes",
      namedFacts([
        [
          "anExplicitEvidenceAnchorIsNotPartOfTheTitle",
          () => anchoredHeadingIsStable,
        ],
        ["theFixtureScriptIsClean", () => asAuthored.length === 0],
        [
          "metadataAndExamplesMakeNoPromise",
          () => metadataAndExample.length === 0,
        ],
        [
          "aFenceLiteralCannotHideLaterProse",
          () =>
            visibleAfterExample.length === 1 &&
            visibleAfterExample[0]!.code === "screenplay-timing-unowned" &&
            visibleAfterExample[0]!.message.includes("1.4 seconds"),
        ],
        ["restoringItIsCleanAgain", () => restored.length === 0],
        [
          "authoringWarns",
          () =>
            authoring.length === 1 &&
            authoring[0]!.category === "warning" &&
            authoring[0]!.code === "screenplay-timing-unowned",
        ],
        [
          "deliveringRefuses",
          () =>
            delivering.length === 1 &&
            delivering[0]!.category === "error" &&
            delivering[0]!.code === "screenplay-timing-unowned",
        ],
        [
          "theRefusalNamesTheStatedFigure",
          () => delivering[0]!.message.includes("1.2 seconds"),
        ],
        [
          "theRefusalAddressesTheDocument",
          () => delivering[0]!.path === "docs/screenplays/001-cue/001-cue.md",
        ],
        [
          "anUnsupportedSelectorIsNamed",
          () =>
            invalidSelector.length === 1 &&
            invalidSelector[0]!.code ===
              "screenplay-timing-reference-invalid" &&
            invalidSelector[0]!.message.includes("shot:opening/nonsense"),
        ],
        [
          "aShotThatDoesNotCiteTheSceneCannotOwnIt",
          () =>
            foreignShot.length === 1 &&
            foreignShot[0]!.code === "screenplay-timing-owner-absent" &&
            foreignShot[0]!.message.includes('shot "answer"'),
        ],
        [
          "aMissingFieldIsNamed",
          () =>
            absentField.length === 1 &&
            absentField[0]!.code === "screenplay-timing-owner-absent" &&
            absentField[0]!.message.includes("shot:opening/event:missing/to"),
        ],
        [
          "aMismatchNamesBothValues",
          () =>
            mismatch.length === 1 &&
            mismatch[0]!.code === "screenplay-timing-value-mismatch" &&
            mismatch[0]!.message.includes("1.2s") &&
            mismatch[0]!.message.includes("6s"),
        ],
        ["theExactContractValueIsSilent", () => owned.length === 0],
        ["aSceneIdIsNotADuration", () => identifier.length === 0],
      ]),
      {
        anExplicitEvidenceAnchorIsNotPartOfTheTitle: true,
        theFixtureScriptIsClean: true,
        metadataAndExamplesMakeNoPromise: true,
        aFenceLiteralCannotHideLaterProse: true,
        restoringItIsCleanAgain: true,
        authoringWarns: true,
        deliveringRefuses: true,
        theRefusalNamesTheStatedFigure: true,
        theRefusalAddressesTheDocument: true,
        anUnsupportedSelectorIsNamed: true,
        aShotThatDoesNotCiteTheSceneCannotOwnIt: true,
        aMissingFieldIsNamed: true,
        aMismatchNamesBothValues: true,
        theExactContractValueIsSilent: true,
        aSceneIdIsNotADuration: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

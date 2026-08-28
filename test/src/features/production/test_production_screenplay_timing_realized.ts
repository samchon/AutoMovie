import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture } from "./productionFixtures";

const CODE = "screenplay-scene-timing-unrealized";

/** Diagnostics of one code, whatever severity the scope gave them. */
const timing = (
  compiler: AutoMovieProductionCompiler,
  scope: "source" | "review",
) =>
  compiler
    .compile({ scope })
    .diagnostics.filter((diagnostic) => diagnostic.code === CODE);

/**
 * A duration a scene states in prose must be one its shots actually carry.
 *
 * This is the joint that was open. The ledger checks that a shot cites a scene
 * the index declares, the coverage gate checks that every active scene has a
 * realizing shot, and `realizeShotContract` evaluates every authored opening,
 * closing, and event predicate against the compiled artifact — none of them
 * reads the scene's prose. So the completed regression fixture says "the hand
 * holds at its height for 1.2 seconds" beside a shot whose cue window closes at
 * 3.0 of a 6.0 second scene, and every gate stayed green.
 *
 * `#story-falsifiable-acceptance` asks a story success condition to carry a
 * subject, a time, an observable state, and a failure condition;
 * `#story-scene-observability` forbids resting acceptance on what the camera
 * cannot see. A timing written into scene prose has all of the first and none
 * of the second — it is a falsifiable claim about the film that nothing was
 * falsifying.
 *
 * Scenarios:
 *
 * 1. Prose quoting a duration the realizing contract carries raises nothing.
 * 2. Prose quoting a duration no realizing shot carries is reported, naming the
 *    stated figure and the ones the shots do carry.
 * 3. The same state is a warning while authoring and an error at review, which
 *    is the severity `screenplay-scene-unrealized` already uses: prose may run
 *    ahead of its shot, but a film presented as deliverable is claiming its
 *    script describes it.
 * 4. A number that is part of an identifier is not a duration, so a scene may
 *    say its own `SCN-001` without being refused for it.
 * 5. Evidence comments and fenced examples are not audience-facing prose, so
 *    numbers inside either cannot invent a screenplay timing promise.
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

    const anchoredHeadingIsStable =
      compiler
        .compile({ scope: "review" })
        .diagnostics.filter(
          (diagnostic) => diagnostic.code === "screenplay-heading-retitled",
        ).length === 0;
    const asAuthored = timing(compiler, "review");

    fs.writeFileSync(
      scene,
      `${authored}\n<!-- Review metadata mentions 1.1 seconds. -->\n\`\`\`html\n<!-- A literal example mentions 1.3 seconds.\n\`\`\`\n`,
      "utf8",
    );
    const metadataAndExample = timing(compiler, "review");

    fs.writeFileSync(
      scene,
      `${authored}\n\`\`\`html\n<!-- An unclosed literal comment.\n\`\`\`\nThe visible scene holds for 1.4 seconds.\n`,
      "utf8",
    );
    const visibleAfterExample = timing(compiler, "review");

    // The cue window closes at 3.0 and the scene runs 6.0; 1.2 is neither.
    fs.writeFileSync(
      scene,
      `${authored}\nSCN-001 holds the raised hand for 1.2 seconds.\n`,
      "utf8",
    );
    const authoring = timing(compiler, "source");
    const delivering = timing(compiler, "review");

    fs.writeFileSync(scene, authored, "utf8");
    const restored = timing(compiler, "review");

    TestValidator.equals(
      "a duration stated in scene prose must be one its shots carry",
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
            visibleAfterExample[0]!.message.includes("1.4s"),
        ],
        ["restoringItIsCleanAgain", () => restored.length === 0],
        [
          "authoringWarns",
          () => authoring.length === 1 && authoring[0]!.category === "warning",
        ],
        [
          "deliveringRefuses",
          () => delivering.length === 1 && delivering[0]!.category === "error",
        ],
        [
          "theRefusalNamesTheStatedFigure",
          () => delivering[0]!.message.includes("1.2s"),
        ],
        [
          "theRefusalNamesWhatTheShotCarries",
          () =>
            delivering[0]!.message.includes("6s") &&
            delivering[0]!.message.includes("3s"),
        ],
        [
          "theRefusalAddressesTheDocument",
          () => delivering[0]!.path === "docs/screenplays/001-cue/001-cue.md",
        ],
        [
          "aSceneIdIsNotADuration",
          () => delivering[0]!.message.includes("1s") === false,
        ],
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
        theRefusalNamesWhatTheShotCarries: true,
        theRefusalAddressesTheDocument: true,
        aSceneIdIsNotADuration: true,
      },
    );
  } finally {
    fixture.dispose();
  }
};

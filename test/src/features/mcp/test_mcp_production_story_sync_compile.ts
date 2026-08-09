import { scaffoldAssetDirectory } from "@automovie/cli";
import {
  IAutoMovieAcceptanceScenario,
  IAutoMovieCompiledContractRealization,
  IAutoMovieShotContract,
  IAutoMovieShotStoryTime,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import {
  productionCompileSucceeded,
  productionDesign,
  productionFixture,
  setProductionFixtureShotContract,
} from "./productionFixtures";

const STORY_CLOCK = {
  units: "second",
  epoch: "Story time zero is the instant the tracked action begins.",
} as const;

const editSource = (edit: unknown): string =>
  `export const film = { build() { return ${JSON.stringify(edit)}; } };\n`;

const twoShotEdit = (): unknown => ({
  id: "fixture-film",
  omissions: [],
  tracks: {
    video: [
      {
        shot: "opening",
        sourceIn: { frame: 0 },
        sourceOut: { seconds: 6 },
        start: { frame: 0 },
        handles: { head: { frame: 0 }, tail: { frame: 0 } },
        transitionIn: { kind: "cut" },
        transitionOut: { kind: "cut" },
      },
      {
        shot: "answer",
        sourceIn: { frame: 0 },
        sourceOut: { seconds: 6 },
        start: { seconds: 6 },
        handles: { head: { frame: 0 }, tail: { frame: 0 } },
        transitionIn: { kind: "cut" },
        transitionOut: { kind: "cut" },
      },
    ],
    audio: [],
    captions: [],
    effects: [],
  },
});

const realizedEventTime = (
  project: AutoMovieProductionProject,
  shot: string,
  event: string,
): number => {
  const realization = JSON.parse(
    Buffer.from(
      project.readGeneratedFile(`realizations/${shot}.json`),
    ).toString("utf8"),
  ) as IAutoMovieCompiledContractRealization;
  const realized = realization.events.find(
    (candidate) => candidate.id === event,
  );
  if (realized === undefined)
    throw new Error(`realization of "${shot}" has no event "${event}"`);
  return realized.time;
};

const repin = (
  project: AutoMovieProductionProject,
  shot: string,
  storyTime: IAutoMovieShotStoryTime,
): void => {
  const contract = project.graph().shots.get(shot);
  if (contract === undefined)
    throw new Error(`fixture has no resident shot "${shot}"`);
  const pinned: IAutoMovieShotContract = { ...contract, storyTime };
  if (setProductionFixtureShotContract(project, pinned).accepted === false)
    throw new Error(`fixture refused the story-clock pin for "${shot}"`);
};

const sharedMoment = (
  toleranceSeconds: number,
  required = true,
): IAutoMovieAcceptanceScenario => ({
  id: "shared-moment",
  target: { kind: "film", id: "fixture-film" },
  criterion: {
    kind: "story-sync",
    events: [
      { shot: "opening", event: "signal-raised" },
      { shot: "answer", event: "signal-answered" },
    ],
    toleranceSeconds,
    expectation:
      "Both coverages show one instant of the action, not two consecutive instants.",
  },
  required,
});

/**
 * A cross-shot simultaneity claim measured against actual compiled output.
 *
 * The fixture cuts two coverages back to back, which is exactly the arrangement
 * that proves nothing on its own: adjacency in the edit is presentation order.
 * The story clock is what lets the production assert that both coverages show
 * one moment, and the compiler is what refuses the assertion when the realized
 * event times disagree.
 *
 * Scenarios:
 *
 * 1. The two-shot fixture compiles unchanged while the production states no story
 *    time at all.
 * 2. Pinning the second coverage so its realized event lands on the first one's
 *    story second compiles clean, and the prepared film review carries the
 *    passing compiler-derived story-clock outcome for a reviewer to cite.
 * 3. Repinning it so the two events land apart refuses the compile, naming the
 *    measured gap even though the edit still cuts straight from one to the
 *    other.
 * 4. The same false claim, declared optional, warns instead of blocking.
 */
export const test_mcp_production_story_sync_compile = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    project.setProductionDesign(productionDesign({ targetRuntimeSeconds: 12 }));
    const answer = JSON.parse(
      fs.readFileSync(
        path.join(
          scaffoldAssetDirectory(),
          ".automovie/design/shots/answer.json",
        ),
        "utf8",
      ),
    ) as IAutoMovieShotContract;
    setProductionFixtureShotContract(project, answer);
    fs.writeFileSync(
      path.join(fixture.root, "src/film.ts"),
      editSource(twoShotEdit()),
    );

    const unpinned = compiler.compile({ scope: "source" });
    const unpinnedSucceeded = productionCompileSucceeded(
      "two-shot fixture without a story clock",
      unpinned,
    );
    TestValidator.predicate(
      "a production that states no story time compiles unchanged",
      unpinnedSucceeded,
    );

    const openingTime = realizedEventTime(project, "opening", "signal-raised");
    const answerTime = realizedEventTime(project, "answer", "signal-answered");
    project.setProductionDesign(
      productionDesign({ targetRuntimeSeconds: 12, storyClock: STORY_CLOCK }),
    );
    repin(project, "opening", { originSeconds: 0 });
    // The second coverage is pinned so its own realized event lands on exactly
    // the story second the first one's does. Its local time is different, and
    // that is the point: local time locates a frame inside a shot, story time
    // locates the shot in what the film says happened.
    repin(project, "answer", { originSeconds: openingTime - answerTime });
    project.setAcceptanceScenario(sharedMoment(0.25));
    const together = compiler.compile({ scope: "source" });
    const togetherSucceeded = productionCompileSucceeded(
      "two coverages pinned to one story moment",
      together,
    );
    const prepared = new AutoMovieProductionReviewService(project).prepare({
      target: { kind: "film", id: "fixture-film" },
    });
    const outcome = prepared.outcomes.find(
      (candidate) => candidate.scenario === "shared-moment",
    );
    TestValidator.equals(
      "two shots pinned to the same story moment are judged simultaneous",
      namedFacts([
        ["compiled", () => togetherSucceeded],
        [
          "noStorySyncRefusal",
          () =>
            together.diagnostics.every(
              (diagnostic) =>
                diagnostic.code !== "acceptance-story-sync-failed",
            ),
        ],
        ["reviewOutcomePrepared", () => outcome?.kind === "story-sync"],
        [
          "reviewOutcomePassed",
          () => outcome?.kind === "story-sync" && outcome.passed,
        ],
        [
          "reviewOutcomeNamesBothShots",
          () =>
            outcome?.kind === "story-sync" &&
            outcome.points.map((point) => point.shot).join(",") ===
              "opening,answer",
        ],
        [
          "reviewOutcomeKeepsLocalTimes",
          () =>
            outcome?.kind === "story-sync" &&
            outcome.points[0]?.localSeconds === openingTime &&
            outcome.points[1]?.localSeconds === answerTime,
        ],
      ]),
      {
        compiled: true,
        noStorySyncRefusal: true,
        reviewOutcomePrepared: true,
        reviewOutcomePassed: true,
        reviewOutcomeNamesBothShots: true,
        reviewOutcomeKeepsLocalTimes: true,
      },
    );

    // Both origins at zero leave every declared window overlapping, so the
    // design gate has nothing to object to; only the realized times separate
    // the two events, which is precisely the fact the compiler must catch.
    repin(project, "answer", { originSeconds: 0 });
    const apart = compiler.compile({ scope: "source" });
    const gap = answerTime - openingTime;
    const refusal = apart.diagnostics.find(
      (diagnostic) => diagnostic.code === "acceptance-story-sync-failed",
    );
    TestValidator.equals(
      "a false simultaneity claim is refused and names the measured gap",
      namedFacts([
        // The fixture is only a witness if its two events actually realize at
        // different story seconds; say so rather than assert nothing.
        ["fixtureSeparatesTheEvents", () => gap > 0.25],
        ["compileRefused", () => apart.success === false],
        ["refusalRaised", () => refusal !== undefined],
        ["refusalBlocks", () => refusal?.category === "error"],
        ["refusalOwner", () => refusal?.target === "acceptance:shared-moment"],
        [
          "refusalNamesGap",
          () => refusal?.message.includes(`are ${gap}s apart`) === true,
        ],
        [
          "refusalNamesTolerance",
          () =>
            refusal?.message.includes("beyond the 0.25s tolerance") === true,
        ],
      ]),
      {
        fixtureSeparatesTheEvents: true,
        compileRefused: true,
        refusalRaised: true,
        refusalBlocks: true,
        refusalOwner: true,
        refusalNamesGap: true,
        refusalNamesTolerance: true,
      },
    );

    project.setAcceptanceScenario(sharedMoment(0.25, false));
    const optional = compiler.compile({ scope: "source" });
    TestValidator.equals(
      "an optional simultaneity claim still reports the gap without blocking",
      namedFacts([
        [
          "compiled",
          () =>
            productionCompileSucceeded("optional story-sync claim", optional),
        ],
        [
          "warned",
          () =>
            optional.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "acceptance-story-sync-failed" &&
                diagnostic.category === "warning",
            ),
        ],
      ]),
      { compiled: true, warned: true },
    );
  } finally {
    fixture.dispose();
  }
};

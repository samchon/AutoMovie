import {
  IAutoMovieCompiledShotSource,
  IAutoMovieDefinedShotContract,
  IAutoMovieFilmEdit,
  IAutoMovieProductionDesign,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { namedFacts } from "../internal/predicates";
import { productionFixture, shotContract } from "./productionFixtures";

interface IProductionShotContinuityFixtureFailure {
  error: unknown;
}

class ProductionShotContinuityFixtureCleanupError extends AggregateError {}

export const preserveProductionShotContinuityFixtureCleanup = (
  failure: IProductionShotContinuityFixtureFailure | undefined,
  cleanup: () => void,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionShotContinuityFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production shot-continuity fixture teardown failed after the test failed.",
    );
  }
};

const registrationOf = (
  contract: IAutoMovieShotContract,
): IAutoMovieDefinedShotContract => {
  const { id: _id, source: _source, ...registration } = contract;
  return registration;
};

const continuitySource = (
  opening: IAutoMovieShotContract,
  answer: IAutoMovieShotContract,
): string => `
import { defineShot } from "@automovie/engine";

const OPENING_CONTRACT = ${JSON.stringify(registrationOf(opening))};
const ANSWER_CONTRACT = ${JSON.stringify(registrationOf(answer))};

const program = (context, moving) => {
  const model = context.runtimeModels.sentinel;
  if (model === undefined || model.skeleton === null)
    throw new Error("sentinel runtime rig is required");
  const pose = (x) => ({
    skeleton: model.skeleton.id,
    root: {
      translation: { x, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    },
    joints: [],
  });
  const clip = {
    id: context.contract.id + "-move",
    skeleton: model.skeleton.id,
    duration: context.contract.durationSeconds,
    loop: false,
    keyframes: [
      { time: 0, pose: pose(0), expression: null, easing: "linear", bezier: null },
      {
        time: context.contract.durationSeconds,
        pose: pose(1),
        expression: null,
        easing: "linear",
        bezier: null,
      },
    ],
    gaitCycle: null,
  };
  return {
    actors: [
      { node: "sentinel", model: "sentinel", speed: 1, eyeHeight: 1.6 },
    ],
    script: {
      logline: "One actor crosses a hard cut without resetting.",
      theme: "continuity is measured state",
      cast: [
        { node: "sentinel", character: "sentinel", modelRef: model.id },
      ],
      beats: [
        {
          id: context.contract.beat,
          name: context.contract.beat,
          summary: "the sentinel keeps the established root",
          durationHint: context.contract.durationSeconds,
        },
      ],
    },
    stage: {
      scene: {
        id: context.contract.id + "-scene",
        name: "continuity ground",
      },
      plan: "The second source deliberately repeats the original mark.",
      actors: [
        {
          node: "sentinel",
          position: { x: 0, y: 0, z: 0 },
          facingDeg: 0,
        },
      ],
      cameras: [
        {
          node: "camera",
          position: { x: 0, y: 1.4, z: 5 },
          lookAt: { kind: "node", node: "sentinel" },
          fovDeg: 40,
        },
      ],
      lights: [
        {
          node: "sun",
          role: "sun",
          direction: { x: -1, y: -1, z: -1 },
          intensity: 1,
        },
      ],
    },
    blocking: {
      beat: context.contract.beat,
      analysis: "The root must remain continuous at the cut.",
      rationale: "A fixed wide shot exposes any reset across the full move.",
      actors: [{ node: "sentinel", beats: "continues from the prior mark" }],
      camera: {
        framing: "wide",
        move: "static",
        on: { kind: "node", node: "sentinel" },
      },
      duration: context.contract.durationSeconds,
    },
    performance: {
      beat: context.contract.beat,
      plan: moving
        ? "Move the root one metre."
        : "Hold at the carried root without authoring the prior mark.",
      draft: [
        moving
          ? {
              verb: "enact",
              actor: "sentinel",
              start: 0,
              duration: context.contract.durationSeconds,
              clip: clip.id,
            }
          : {
              verb: "hold",
              actor: "sentinel",
              start: 0,
              duration: context.contract.durationSeconds,
            },
        {
          verb: "frame",
          actor: "camera",
          start: 0,
          duration: "auto",
          framing: "wide",
          move: "static",
          on: { kind: "node", node: "sentinel" },
        },
      ],
      revise: { review: "The hard-cut root remains continuous.", final: null },
      duration: context.contract.durationSeconds,
    },
    eventSamples: [],
    clips: moving ? [clip] : [],
  };
};

export const opening = defineShot("opening", {
  scene: "opening-scene",
  contract: OPENING_CONTRACT,
  build: (context) => program(context, true),
});

export const answer = defineShot("answer", {
  scene: "answer-scene",
  contract: ANSWER_CONTRACT,
  build: (context) => program(context, false),
});
`;

/**
 * Production shot compilation follows the authored film, not design file order.
 *
 * Scenarios:
 *
 * 1. Film order overrides design filename order and carries the measured x=1
 *    closing through a tolerant frame-grid hard cut.
 * 2. Previous/current trims, dissolve and fade boundaries compile the answer at
 *    its authored x=0 instead of applying a full-beat snapshot.
 * 3. A failed predecessor source does not leak a prior closing into the answer.
 * 4. A predecessor rejected after materialization likewise cannot seed the
 *    successor, even though its direct `compileDefinedShot` step succeeded.
 */
export const test_mcp_production_shot_continuity = async (): Promise<void> => {
  let productionShotContinuityFailure:
    | IProductionShotContinuityFixtureFailure
    | undefined;
  const fixture = productionFixture();
  try {
    const sourceModule = "src/shots/continuity.ts";
    const base = shotContract();
    const contract = (id: "opening" | "answer"): IAutoMovieShotContract => ({
      ...base,
      id,
      beat: "signal",
      source: { module: sourceModule, export: id },
      opening: [],
      closing: [],
      events: [],
      reviewFrames: [
        {
          id: `${id}-middle`,
          time: 3,
          passes: ["beauty"],
        },
      ],
    });
    const opening = contract("opening");
    const answer = contract("answer");
    const shotRoot = path.join(fixture.root, ".automovie/design/shots");
    fs.rmSync(shotRoot, { force: true, recursive: true });
    fs.mkdirSync(shotRoot, { recursive: true });
    fs.writeFileSync(
      path.join(shotRoot, "opening.json"),
      `${JSON.stringify(opening, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(shotRoot, "answer.json"),
      `${JSON.stringify(answer, null, 2)}\n`,
    );

    const acceptanceRoot = path.join(
      fixture.root,
      ".automovie/design/acceptance",
    );
    fs.rmSync(acceptanceRoot, { force: true, recursive: true });
    fs.mkdirSync(acceptanceRoot, { recursive: true });

    const productionPath = path.join(
      fixture.root,
      ".automovie/design/production.json",
    );
    const production = JSON.parse(
      fs.readFileSync(productionPath, "utf8"),
    ) as IAutoMovieProductionDesign;
    fs.writeFileSync(
      productionPath,
      `${JSON.stringify(
        { ...production, targetRuntimeSeconds: 12 },
        null,
        2,
      )}\n`,
    );

    const sourcePath = path.join(fixture.root, sourceModule);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    const project = AutoMovieProductionProject.open(fixture.root);
    const compiler = new AutoMovieProductionCompiler(project);
    const filmPath = path.join(fixture.root, "src/film.ts");
    const fullHardCut = (): IAutoMovieFilmEdit["tracks"]["video"] => [
      {
        shot: "opening",
        sourceIn: { frame: 0 },
        sourceOut: { seconds: 6 + Number.EPSILON * 4 },
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
    ];
    const compileFilm = (
      video: IAutoMovieFilmEdit["tracks"]["video"],
      targetRuntimeSeconds: number,
      source: string = continuitySource(opening, answer),
    ) => {
      const design = project.setProductionDesign({
        ...production,
        targetRuntimeSeconds,
      });
      if (design.accepted === false)
        throw new Error(
          `Continuity fixture production mutation failed:\n${JSON.stringify(
            design.diagnostics,
            null,
            2,
          )}`,
        );
      fs.writeFileSync(sourcePath, source);
      fs.writeFileSync(
        filmPath,
        `export const film = { build() { return ${JSON.stringify({
          id: production.id,
          omissions: [],
          tracks: { video, audio: [], captions: [], effects: [] },
        })}; } };\n`,
      );
      return compiler.compile({ scope: "source" });
    };
    const answerX = (
      output: ReturnType<AutoMovieProductionCompiler["compile"]>,
    ): number | null =>
      output.success === false
        ? null
        : ((
            JSON.parse(
              Buffer.from(
                project.readGeneratedFile("shots/answer.json"),
              ).toString("utf8"),
            ) as IAutoMovieCompiledShotSource
          ).scene.nodes.find((node) => node.id === "sentinel")?.transform
            .translation.x ?? null);

    const output = compileFilm(fullHardCut(), 12);
    const carriedAnswerX = answerX(output);
    if (output.success === false || carriedAnswerX !== 1)
      throw new Error(
        `Hard-cut continuity fixture failed:\n${JSON.stringify(
          {
            diagnostics: output.diagnostics,
            expectedAnswerX: 1,
            actualAnswerX: carriedAnswerX,
          },
          null,
          2,
        )}`,
      );
    TestValidator.equals(
      "the production hard cut carries the previous measured root",
      namedFacts([
        ["outputSuccess", () => output.success],
        ["carriedAnswerX", () => output.success && carriedAnswerX === 1],
      ]),
      { outputSuccess: true, carriedAnswerX: true },
    );

    const previousTrim = fullHardCut();
    previousTrim[0]!.sourceOut = { seconds: 5 };
    previousTrim[1]!.start = { seconds: 5 };
    const currentTrim = fullHardCut();
    currentTrim[0]!.sourceOut = { seconds: 6 };
    currentTrim[1]!.sourceIn = { seconds: 1 };
    const dissolve = fullHardCut();
    dissolve[0]!.sourceOut = { seconds: 6 };
    dissolve[0]!.handles.tail = { seconds: 1 };
    dissolve[0]!.transitionOut = {
      kind: "dissolve",
      duration: { seconds: 1 },
    };
    dissolve[1]!.start = { seconds: 5 };
    dissolve[1]!.handles.head = { seconds: 1 };
    dissolve[1]!.transitionIn = {
      kind: "dissolve",
      duration: { seconds: 1 },
    };
    const fade = fullHardCut();
    fade[0]!.sourceOut = { seconds: 6 };
    fade[0]!.transitionOut = {
      kind: "fade",
      duration: { seconds: 0.5 },
    };
    fade[1]!.transitionIn = {
      kind: "fade",
      duration: { seconds: 0.5 },
    };
    const noCarryCases: Array<{
      name: string;
      video: IAutoMovieFilmEdit["tracks"]["video"];
      runtime: number;
    }> = [
      { name: "previous-trim", video: previousTrim, runtime: 11 },
      { name: "current-trim", video: currentTrim, runtime: 11 },
      { name: "dissolve", video: dissolve, runtime: 11 },
      { name: "fade", video: fade, runtime: 12 },
    ];
    const noCarryResults = noCarryCases.map(({ name, video, runtime }) => {
      const boundary = compileFilm(video, runtime);
      return { name, boundary, actualAnswerX: answerX(boundary) };
    });
    const failedNoCarry = noCarryResults.filter(
      ({ boundary, actualAnswerX }) =>
        boundary.success === false || actualAnswerX !== 0,
    );
    if (failedNoCarry.length !== 0)
      throw new Error(
        `No-carry continuity fixtures failed:\n${JSON.stringify(
          failedNoCarry.map(({ name, boundary, actualAnswerX }) => ({
            name,
            diagnostics: boundary.diagnostics,
            expectedAnswerX: 0,
            actualAnswerX,
          })),
          null,
          2,
        )}`,
      );
    TestValidator.predicate(
      "trimmed and non-cut boundaries do not apply the full closing snapshot",
      noCarryResults.every(
        ({ boundary, actualAnswerX }) =>
          boundary.success && actualAnswerX === 0,
      ),
    );

    const zeroOpeningAnswer = structuredClone(answer);
    zeroOpeningAnswer.opening = [
      {
        id: "authored-zero",
        description: "Without a valid predecessor the authored mark remains.",
        predicates: [
          {
            kind: "position",
            subject: { kind: "node", id: "sentinel" },
            axis: "x",
            operator: "==",
            value: 0,
            tolerance: 0.001,
          },
        ],
      },
    ];
    const zeroOpeningMutation = project.setShotContract(zeroOpeningAnswer);
    if (zeroOpeningMutation.accepted === false)
      throw new Error(
        `Continuity fixture shot mutation failed:\n${JSON.stringify(
          zeroOpeningMutation.diagnostics,
          null,
          2,
        )}`,
      );
    const failingOpeningSource = continuitySource(
      opening,
      zeroOpeningAnswer,
    ).replace(
      "build: (context) => program(context, true),",
      'build: () => { throw new Error("opening source failure"); },',
    );
    const sourceFailure = compileFilm(fullHardCut(), 12, failingOpeningSource);
    TestValidator.equals(
      "a failed predecessor source does not poison successor realization",
      namedFacts([
        ["sourceFailureSuccess", () => sourceFailure.success === false],
        [
          "sourceFailureDiagnosticsDiagnostic",
          () =>
            sourceFailure.success === false &&
            sourceFailure.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "source-execution-failed" &&
                diagnostic.target === "shot:opening",
            ),
        ],
        [
          "sourceFailureDiagnosticsDiagnostic2",
          () =>
            sourceFailure.success === false &&
            sourceFailure.diagnostics.every(
              (diagnostic) =>
                diagnostic.target !== "shot:answer" ||
                diagnostic.code !== "contract-realization-failed",
            ),
        ],
      ]),
      {
        sourceFailureSuccess: true,
        sourceFailureDiagnosticsDiagnostic: true,
        sourceFailureDiagnosticsDiagnostic2: true,
      },
    );

    const invalidFormationSource = continuitySource(
      opening,
      zeroOpeningAnswer,
    ).replace(
      "    eventSamples: [],",
      `    formationMotions: moving ? [{
      id: "invalid-formation-motion",
      formation: "ghost",
      action: "advance",
      start: 0,
      end: context.contract.durationSeconds,
      from: {
        translation: { x: 0, y: 0, z: 0 },
        facingOffsetDeg: 0,
        spacingScale: { lateral: 1, depth: 1 },
      },
      to: {
        translation: { x: 0, y: 0, z: 1 },
        facingOffsetDeg: 0,
        spacingScale: { lateral: 1, depth: 1 },
      },
      easing: "linear",
    }] : [],
    eventSamples: [],`,
    );
    const postMaterializationFailure = compileFilm(
      fullHardCut(),
      12,
      invalidFormationSource,
    );
    TestValidator.equals(
      "a post-materialization failure cannot seed the successor",
      namedFacts([
        [
          "postMaterializationFailureSuccess",
          () => postMaterializationFailure.success === false,
        ],
        [
          "postMaterializationFailureDiagnosticsDiagnostic",
          () =>
            postMaterializationFailure.success === false &&
            postMaterializationFailure.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "engine-validation-failed" &&
                diagnostic.target === "shot:opening",
            ),
        ],
        [
          "postMaterializationFailureDiagnosticsDiagnostic2",
          () =>
            postMaterializationFailure.success === false &&
            postMaterializationFailure.diagnostics.every(
              (diagnostic) =>
                diagnostic.target !== "shot:answer" ||
                diagnostic.code !== "contract-realization-failed",
            ),
        ],
      ]),
      {
        postMaterializationFailureSuccess: true,
        postMaterializationFailureDiagnosticsDiagnostic: true,
        postMaterializationFailureDiagnosticsDiagnostic2: true,
      },
    );
  } catch (error) {
    productionShotContinuityFailure = { error };
    throw error;
  } finally {
    preserveProductionShotContinuityFixtureCleanup(
      productionShotContinuityFailure,
      () => fixture.dispose(),
    );
  }
};

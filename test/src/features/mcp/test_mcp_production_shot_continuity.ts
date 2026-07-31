import {
  IAutoMovieCompiledShotSource,
  IAutoMovieDefinedShotContract,
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

import { productionFixture, shotContract } from "./productionFixtures";

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
        { node: "sentinel", character: "sentinel", modelRef: "sentinel" },
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
      rationale: "A fixed full shot exposes any reset.",
      actors: [{ node: "sentinel", beats: "continues from the prior mark" }],
      camera: {
        framing: "full",
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
          framing: "full",
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
 * The opening enact clip moves the sentinel root from x=0 to x=1. The answer
 * source deliberately stages x=0 and only asks for `hold`; at a full hard cut,
 * its generated scene must nevertheless begin at the opening shot's measured
 * x=1 closing. This exercises film-source evaluation, ordered source compile,
 * closing capture, and `compileDefinedShot.runtime.previous` in the real MCP
 * production compiler.
 */
export const test_mcp_production_shot_continuity = async (): Promise<void> => {
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
    fs.writeFileSync(sourcePath, continuitySource(opening, answer));
    fs.writeFileSync(
      path.join(fixture.root, "src/film.ts"),
      `export const film = {
  build(context) {
    return {
      id: context.production.id,
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
    };
  },
};
`,
    );

    const project = AutoMovieProductionProject.open(fixture.root);
    const output = new AutoMovieProductionCompiler(project).compile({
      scope: "source",
    });
    const answerSource =
      output.success === false
        ? null
        : (JSON.parse(
            Buffer.from(
              project.readGeneratedFile("shots/answer.json"),
            ).toString("utf8"),
          ) as IAutoMovieCompiledShotSource);
    TestValidator.predicate(
      "the production hard cut carries the previous measured root",
      output.success &&
        answerSource?.scene.nodes.find((node) => node.id === "sentinel")
          ?.transform.translation.x === 1,
    );
  } finally {
    fixture.dispose();
  }
};

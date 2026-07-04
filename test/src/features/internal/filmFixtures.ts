import { IAutoMovieActionSynthesizer } from "@automovie/engine";
import {
  IAutoMovieBlockingApplication,
  IAutoMovieForgeApplication,
  IAutoMoviePerformanceApplication,
  IAutoMovieScriptApplication,
  IAutoMovieStagingApplication,
} from "@automovie/interface";

import { createModel, joint, keyframe, makeMotion, makePose } from "./fixtures";

/**
 * One forge entry: the shared one-part test model re-idified so its `id` equals
 * the cast node — the join contract `forgeCast` enforces and the staged scene's
 * `modelRef ?? node` fallback resolves against.
 */
export const forgeEntry = (
  node: string,
  model: Partial<IAutoMovieForgeApplication.IEntry["model"]> = {},
): IAutoMovieForgeApplication.IEntry => ({
  node,
  model: { ...createModel(), id: node, ...model },
});

/**
 * A performance for `beat-1`: both knights advance in unison (one action, two
 * actors), then the challenger strikes; the main camera frames it. The draft
 * already stands (`final: null`), so this also pins the `draft` path of the
 * `revise.final ?? draft` rule.
 */
export const makePerformanceWrite = (
  partial: Partial<IAutoMoviePerformanceApplication.IWrite> = {},
): IAutoMoviePerformanceApplication.IWrite => ({
  type: "write",
  beat: "beat-1",
  plan: "both advance a step; A strikes at the top of the walk; camera holds.",
  draft: [
    {
      verb: "locomote",
      actor: ["knightA", "knightB"],
      start: 0,
      duration: 1,
      gait: "walk",
      to: { kind: "point", point: { x: 0, y: 0, z: 0.35 } },
    },
    {
      verb: "gesture",
      actor: "knightA",
      start: 1,
      duration: 1,
      kind: "strike",
      at: { kind: "node", node: "knightB" },
    },
    {
      verb: "frame",
      actor: "cam-main",
      start: 0,
      duration: "auto",
      framing: "medium",
      move: "static",
      on: { kind: "node", node: "knightA" },
    },
  ],
  revise: {
    review: "range ok; strike lands after the step; camera holds.",
    final: null,
  },
  duration: 2,
  ...partial,
});

/**
 * A blocking for `beat-1` that the duel performance fixture realizes exactly:
 * knightA's strike anchored at t = 1 (the gesture's span), a medium static
 * camera on knightA (the fixture's frame action). Scenarios override fields to
 * inject each intent/realization mismatch.
 */
export const makeBlockingWrite = (
  partial: Partial<IAutoMovieBlockingApplication.IWrite> = {},
): IAutoMovieBlockingApplication.IWrite => ({
  type: "write",
  beat: "beat-1",
  analysis: "the charge must read as decisive — one step, one strike.",
  rationale: "medium static keeps both knights readable at striking range.",
  actors: [
    {
      node: "knightA",
      beats: "advances a step, then strikes at the top of the walk",
      anchors: [{ t: 1, cue: "the strike lands" }],
    },
    { node: "knightB", beats: "holds ground, eyes locked on the challenger" },
  ],
  camera: {
    framing: "medium",
    move: "static",
    on: { kind: "node", node: "knightA" },
  },
  duration: 2,
  ...partial,
});

/**
 * The content seam for film scenarios: every action becomes the same valid
 * one-second elbow clip (0° → 120° flexion, well inside ROM), so scenarios
 * exercise the pipeline's assembly and gating rather than clip content.
 */
export const validSynthesizer: IAutoMovieActionSynthesizer = () =>
  makeMotion(
    [
      keyframe(0, makePose([joint("leftLowerArm", { flexion: 0 })])),
      keyframe(1, makePose([joint("leftLowerArm", { flexion: 120 })])),
    ],
    1,
  );

/**
 * A minimal two-knight duel script: two cast members (one with a `modelRef`,
 * one without, so the stand-in fallback branch is exercised) and a single beat.
 * Film-pipeline scenarios override fields as needed.
 */
export const makeScriptWrite = (
  partial: Partial<IAutoMovieScriptApplication.IWrite> = {},
): IAutoMovieScriptApplication.IWrite => ({
  type: "write",
  logline: "Two knights duel at dawn.",
  theme: "honor answered in steel",
  cast: [
    { node: "knightA", character: "the challenger", modelRef: "stickman" },
    { node: "knightB", character: "the champion", modelRef: null },
  ],
  beats: [
    {
      id: "beat-1",
      name: "the charge",
      summary: "knightA charges knightB",
      durationHint: 3,
    },
  ],
  ...partial,
});

/**
 * A staging that places the duel coherently: the knights at striking range
 * facing each other, one node-tracking camera, one sun light. Scenarios
 * override fields to inject each contradiction.
 */
export const makeStagingWrite = (
  partial: Partial<IAutoMovieStagingApplication.IWrite> = {},
): IAutoMovieStagingApplication.IWrite => ({
  type: "write",
  scene: { id: "scene-duel", name: "duel at dawn" },
  plan: "A faces B at 0.7 m; camera side-on covers both; sun from the east.",
  actors: [
    { node: "knightA", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
    { node: "knightB", position: { x: 0, y: 0, z: 0.7 }, facingDeg: 180 },
  ],
  cameras: [
    {
      node: "cam-main",
      position: { x: 2, y: 1.5, z: 0.35 },
      lookAt: { kind: "node", node: "knightA" },
      fovDeg: 40,
    },
  ],
  lights: [
    {
      node: "sun",
      role: "sun",
      direction: { x: -1, y: -1, z: 0 },
      intensity: 1,
    },
  ],
  ...partial,
});

import { IAutoMovieGait, IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makeBlockingWrite,
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const context = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const rig = createSkeleton();
  return {
    skeleton: rig.id,
    gaits: [WALK],
    position,
    speed: 1,
    facingDeg,
    eyeHeight: 1.6,
    restPose: makePose([]),
    rig,
  };
};

const riglessContext = (
  position: IAutoMovieVector3,
  facingDeg: number,
): IAutoMovieMcpActorContext => {
  const { rig: _rig, ...rest } = context(position, facingDeg);
  return rest;
};

/**
 * The MCP `perform` tool keeps the client contract JSON-only while still
 * driving the engine's rig-aware performance stage.
 *
 * Scenarios:
 *
 * 1. A client calls `stage`, `block`, then `perform` with actor contexts. The
 *    server builds the default synthesizer internally and returns a performed
 *    shot with one motion per actor and the live camera compiled.
 * 2. The same MCP wrapper returns engine violations, not thrown errors, when the
 *    performance names a beat the script never declared.
 * 3. A default-synthesizer unsupported gesture fails as data instead of succeeding
 *    with the authored action dropped.
 * 4. A rig-required reach with a rigless MCP actor context fails as data instead
 *    of succeeding with no motion for that actor.
 */
export const test_mcp_perform_tool = (): void => {
  const app = new AutoMovieApplication();
  const script = makeScriptWrite();
  const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
  if (staged.success !== true) throw new Error("staging must succeed");

  const nodePosition = (id: string): IAutoMovieVector3 => {
    const node = staged.scene.nodes.find((x) => x.id === id);
    if (node === undefined) throw new Error(`missing staged node ${id}`);
    return node.transform.translation;
  };

  const blocking = app.block({
    script,
    staged,
    blocking: makeBlockingWrite({
      duration: 1,
      actors: [
        {
          node: "knightA",
          beats: "advances into the beat",
          anchors: [{ t: 0.5, cue: "mid-step" }],
        },
      ],
    }),
  }).blocked;
  if (blocking.success !== true) throw new Error("blocking must succeed");

  const performance = makePerformanceWrite({
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
        verb: "frame",
        actor: "cam-main",
        start: 0,
        duration: "auto",
        framing: "medium",
        move: "static",
        on: { kind: "node", node: "knightA" },
      },
    ],
    duration: 1,
    revise: { review: "unchanged.", final: null },
  });

  const performed = app.perform({
    script,
    staged,
    performance,
    actors: {
      knightA: context(nodePosition("knightA"), 0),
      knightB: context(nodePosition("knightB"), 180),
    },
    blocking: blocking.blocking,
  }).performed;

  TestValidator.equals("perform succeeds", performed.success, true);
  if (performed.success !== true) return;

  TestValidator.equals("shot camera", performed.shot.camera, "cam-main");
  TestValidator.predicate(
    "camera motion compiled",
    performed.shot.cameraMotion !== null,
  );
  TestValidator.equals(
    "one synthesized motion per actor",
    Object.keys(performed.motions).sort((a, b) => a.localeCompare(b)),
    ["knightA", "knightB"],
  );
  TestValidator.equals(
    "knightA clip id",
    performed.motions.knightA!.id,
    "perform:knightA",
  );

  const failed = app.perform({
    script,
    staged,
    performance: { ...performance, beat: "missing-beat" },
    actors: {
      knightA: context(nodePosition("knightA"), 0),
      knightB: context(nodePosition("knightB"), 180),
    },
  }).performed;

  TestValidator.predicate(
    "invalid beat returns violations",
    failed.success === false &&
      failed.violations.some(
        (violation) =>
          violation.kind === "type" && violation.path === "$input.beat",
      ),
  );

  const unsupportedGesture = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "gesture",
          actor: "knightA",
          start: 0,
          duration: 1,
          kind: "guard",
        },
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: context(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "unsupported default gesture returns violations",
    unsupportedGesture.success === false &&
      unsupportedGesture.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.draft[0].kind",
      ),
  );

  const riglessReach = app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft: [
        {
          verb: "reach",
          actor: "knightA",
          start: 0,
          duration: 1,
          hand: "right",
          to: { kind: "node", node: "knightB" },
        },
      ],
      duration: 1,
      revise: { review: "unchanged.", final: null },
    }),
    actors: {
      knightA: riglessContext(nodePosition("knightA"), 0),
    },
  }).performed;
  TestValidator.predicate(
    "rigless reach returns violations",
    riglessReach.success === false &&
      riglessReach.violations.some(
        (violation) =>
          violation.kind === "type" &&
          violation.path === "$input.draft[0].actor",
      ),
  );
};

import { IAutoMovieVector3 } from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";

const WALK = {
  name: "walk",
  period: 1,
  limbs: [
    { bone: "leftUpperLeg" as const, phase: 0, duty: 0.5, amplitude: 25 },
  ],
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

const cameraFrame = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
} as const;

/**
 * `targetNodeId` resolves the launch on-hit target (#1040 coverage): the launch
 * on-hit describer reads its `at` target through the node-id extractor, which
 * yields the node id for a node target and null for a non-node target — so the
 * describer only inspects a real node's context.
 *
 * Scenarios:
 *
 * 1. A `launch` whose `at` is a NODE target resolves that node id (the on-hit
 *    describer then reads the fully-contexted target and reports no gap).
 * 2. A `launch` whose `at` is a POINT target resolves no node id, so the on-hit
 *    describer short-circuits and reports no gap either.
 */
export const test_mcp_action_target_launch = (): void => {
  const app = new AutoMovieApplication();
  const script = makeScriptWrite();
  const staged = app.stage({ script, staging: makeStagingWrite() }).staged;
  if (staged.success !== true) throw new Error("staging must succeed");

  const nodePosition = (id: string): IAutoMovieVector3 => {
    const node = staged.scene.nodes.find((x) => x.id === id);
    if (node === undefined) throw new Error(`missing staged node ${id}`);
    return node.transform.translation;
  };

  const performLaunch = (
    at: Record<string, unknown>,
  ): ReturnType<AutoMovieApplication["perform"]>["performed"] =>
    app.perform({
      script,
      staged,
      performance: makePerformanceWrite({
        draft: [
          {
            verb: "launch",
            actor: "knightA",
            start: 0,
            duration: 1,
            projectile: "arrow",
            at,
            speed: 12,
            onHit: { force: 0.5 },
          },
          cameraFrame,
        ] as never,
        duration: 1,
        revise: { review: "unchanged.", final: null },
      }),
      actors: {
        knightA: context(nodePosition("knightA"), 0),
        knightB: context(nodePosition("knightB"), 180),
      },
    }).performed;

  const noOnHitGap = (
    performed: ReturnType<AutoMovieApplication["perform"]>["performed"],
  ): boolean =>
    performed.success === true ||
    (performed.success === false &&
      performed.violations.every(
        (violation) => violation.path !== "$input.performance.draft[0].onHit",
      ));

  const nodeAt = performLaunch({ kind: "node", node: "knightB" });
  TestValidator.predicate(
    "a launch onHit toward a fully-contexted node target reports no gap",
    noOnHitGap(nodeAt),
  );

  const pointAt = performLaunch({
    kind: "point",
    point: { x: 0, y: 0, z: 0.7 },
  });
  TestValidator.predicate(
    "a launch onHit toward a point target resolves no node and reports no gap",
    noOnHitGap(pointAt),
  );
};

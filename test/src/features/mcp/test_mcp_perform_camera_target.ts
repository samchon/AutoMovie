import {
  IAutoMovieActionCall,
  IAutoMovieGait,
  IAutoMovieVector3,
} from "@automovie/interface";
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

/** Where the lens sits: slightly off knightA's axis, so the aim is directional. */
const LENS: IAutoMovieVector3 = { x: 1, y: 1.6, z: 3 };

const script = makeScriptWrite();
/**
 * KnightB stands on the lens's ground point, so the actor target and the camera
 * target differ in exactly one thing: the HEIGHT of the point they resolve to
 * (a node resolves to `transform.translation`, an actor's feet; the camera
 * resolves to its own translation, eye height). That is what makes scenario 4 a
 * true adjacent case rather than a second, unrelated aim.
 *
 * The distance is load bearing. From knightA's eye at `y = 1.6`, aiming at a
 * ground point `h` metres away tilts the head by `atan2(1.6, h)`, and the
 * head's default ROM allows 45 degrees of flexion. At `h = sqrt(1^2 + 3^2) =
 * 3.162` the aim is `atan2(1.6, 3.162) = 26.8` degrees, inside the limit with
 * 18 degrees to spare; the yaw is `atan2(1, 3) = 18.4` degrees, the same as the
 * camera aim, against a 70 degree twist limit. A knightB at conversational
 * range would need `atan2(1.6, 0.7) = 66` degrees and be refused by the ROM
 * gate, which is a statement about necks, not about the placement table under
 * test.
 */
const staging = makeStagingWrite({
  actors: [
    { node: "knightA", position: { x: 0, y: 0, z: 0 }, facingDeg: 0 },
    { node: "knightB", position: { x: 1, y: 0, z: 3 }, facingDeg: 180 },
  ],
  cameras: [
    {
      node: "cam-front",
      position: LENS,
      lookAt: { kind: "node", node: "knightA" },
      fovDeg: 40,
    },
  ],
});

/** One head-aim draft, so each scenario differs only in the target. */
const lookAt = (to: IAutoMovieActionCall) =>
  makePerformanceWrite({
    draft: [to],
    revise: { review: "unchanged.", final: null },
  });

/**
 * "A person faces the camera" through the live MCP `perform` tool (#1294). The
 * engine gate and the server's default synthesizer read ONE placement table, so
 * a `lookAt` naming a staged camera both passes validation and actually
 * compiles a head aim: accepting the target in the gate while the synthesizer
 * silently dropped it would be the same defect wearing a green result.
 *
 * Scenarios:
 *
 * 1. A `lookAt` whose target is `{ kind: "node", node: "<camera id>" }` performs,
 *    and knightA carries a compiled performance: the action was synthesized,
 *    not skipped (a `null` synthesis leaves the actor out of
 *    `shot.performances`).
 * 2. That shot is byte-identical to the same `lookAt` written as an explicit
 *    `point` at the camera's staged translation, which proves the camera id
 *    resolved to the camera's own transform rather than to some other
 *    placement.
 * 3. The negative twin: an unknown id is refused at
 *    `$input.performance.draft[0].to`, and the refusal quotes that id instead
 *    of the `"node"` discriminator the same sentence lists as legal.
 * 4. The adjacent case one property away, a plain actor target on the lens's
 *    ground point, still performs, so the wider table did not turn into a wider
 *    acceptance of anything. Only the resolved point's height differs from
 *    scenario 1, and the staging comment derives why that height must be
 *    reachable for the case to test the table rather than the neck's ROM.
 */
export const test_mcp_perform_camera_target = (): void => {
  const app = new AutoMovieApplication();
  const staged = app.stage({ script, staging }).staged;
  if (staged.success !== true) throw new Error("staging fixture must succeed");

  const actors = { knightA: context({ x: 0, y: 0, z: 0 }, 0) };

  // 1. the reported repro: face the camera.
  const cameraTarget = app.perform({
    script,
    staged,
    performance: lookAt({
      verb: "lookAt",
      actor: "knightA",
      start: 0,
      duration: 2,
      to: { kind: "node", node: "cam-front" },
    }),
    actors,
  }).performed;
  TestValidator.equals(
    "a lookAt at the staged camera performs",
    cameraTarget.success,
    true,
  );
  if (cameraTarget.success !== true) return;
  TestValidator.equals(
    "the head aim was synthesized, not skipped",
    cameraTarget.shot.performances.map((entry) => entry.node),
    ["knightA"],
  );

  // 2. the camera id resolves to the camera's own staged translation.
  const pointTarget = app.perform({
    script,
    staged,
    performance: lookAt({
      verb: "lookAt",
      actor: "knightA",
      start: 0,
      duration: 2,
      to: { kind: "point", point: LENS },
    }),
    actors,
  }).performed;
  if (pointTarget.success !== true)
    throw new Error("the explicit point twin must perform");
  TestValidator.equals(
    "the camera target compiles the explicit lens point's shot",
    { shot: cameraTarget.shot, motions: cameraTarget.motions },
    { shot: pointTarget.shot, motions: pointTarget.motions },
  );

  // 3. the negative twin: an unknown id is named, the discriminator is not.
  const unknown = app.perform({
    script,
    staged,
    performance: lookAt({
      verb: "lookAt",
      actor: "knightA",
      start: 0,
      duration: 2,
      to: { kind: "node", node: "cam-ghost" },
    }),
    actors,
  }).performed;
  TestValidator.predicate(
    "an unknown target id is named, not the discriminator",
    unknown.success === false &&
      unknown.violations.some(
        (item) =>
          item.path === "$input.performance.draft[0].to" &&
          item.expected.includes('"cam-ghost"') &&
          item.expected.includes("is not placed in the staged scene") &&
          !item.expected.includes('not "node"'),
      ),
  );

  // 4. the counter-case one property away.
  TestValidator.equals(
    "a plain actor target still performs",
    app.perform({
      script,
      staged,
      performance: lookAt({
        verb: "lookAt",
        actor: "knightA",
        start: 0,
        duration: 2,
        to: { kind: "node", node: "knightB" },
      }),
      actors,
    }).performed.success,
    true,
  );
};

import {
  IAutoMovieActionCall,
  IAutoMovieActionTarget,
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

/** The default staging: knightA at the origin, knightB 0.7 m away, facing back. */
const script = makeScriptWrite();
const staging = makeStagingWrite();

const A_PLACEMENT: IAutoMovieVector3 = { x: 0, y: 0, z: 0 };
const B_PLACEMENT: IAutoMovieVector3 = { x: 0, y: 0, z: 0.7 };

const actors = {
  knightA: context(A_PLACEMENT, 0),
  knightB: context(B_PLACEMENT, 180),
};

const performing = (draft: IAutoMovieActionCall[]) => {
  const app = new AutoMovieApplication();
  const staged = app.stage({ script, staging }).staged;
  if (staged.success !== true) throw new Error("staging fixture must succeed");
  return app.perform({
    script,
    staged,
    performance: makePerformanceWrite({
      draft,
      revise: { review: "unchanged.", final: null },
    }),
    actors,
  }).performed;
};

const lookAt = (
  actor: string,
  to: IAutoMovieActionTarget,
): IAutoMovieActionCall => ({
  verb: "lookAt",
  actor,
  start: 0,
  duration: 2,
  to,
});

/**
 * The flagship two-character beat through the live MCP `perform` tool: they
 * face each other at conversational range and hold eye contact.
 *
 * The staging fixture places the knights 0.7 m apart, the distance the staging
 * schema itself names for a duel, and each actor context puts its eyes at 1.6
 * m. Resolving a `lookAt` at the other's PLACEMENT aims the head at the floor
 * and needs `atan2(1.6, 0.7) = 66.37` degrees of flexion, which the head's 45
 * degree limit refuses; resolving it at the other's eyes needs none. Both
 * halves are asserted here so the fix is proved by the pair, not by one green
 * result.
 *
 * Scenarios:
 *
 * 1. Mutual `lookAt` between the two staged knights performs, and both actors
 *    carry a compiled performance (a dropped synthesis would leave one out of
 *    `shot.performances` while still reporting success).
 * 2. The same beat written with an explicit `point` at the other's placement, the
 *    geometry the engine used to resolve to, is refused by the ROM gate on the
 *    compiled clip. This is the counter-case that shows scenario 1 passes
 *    because the aim moved, not because the gate stopped firing.
 * 3. Only the aim height differs: an explicit `point` at the other's EYE point
 *    performs exactly as the node target does, shot and motions alike.
 */
export const test_mcp_perform_eye_contact = (): void => {
  // 1. they hold each other's gaze.
  const performed = performing([
    lookAt("knightA", { kind: "node", node: "knightB" }),
    lookAt("knightB", { kind: "node", node: "knightA" }),
  ]);
  TestValidator.equals(
    "mutual eye contact at conversational range performs",
    performed.success,
    true,
  );
  if (performed.success !== true) return;
  TestValidator.equals(
    "both knights carry a compiled performance",
    performed.shot.performances.map((entry) => entry.node).sort(),
    ["knightA", "knightB"],
  );

  // 2. the counter-case: the old geometry, still refused by the neck.
  const atTheFeet = performing([
    lookAt("knightA", { kind: "point", point: B_PLACEMENT }),
  ]);
  TestValidator.predicate(
    "aiming at the subject's placement still breaks the head ROM",
    atTheFeet.success === false &&
      atTheFeet.violations.some(
        (item) => item.kind === "rom" && item.path.includes("knightA"),
      ),
  );

  // 3. the node target IS the eye point, stated as an equality.
  const atTheEyes = performing([
    lookAt("knightA", {
      kind: "point",
      point: { x: B_PLACEMENT.x, y: B_PLACEMENT.y + 1.6, z: B_PLACEMENT.z },
    }),
  ]);
  const atTheNode = performing([
    lookAt("knightA", { kind: "node", node: "knightB" }),
  ]);
  if (atTheEyes.success !== true || atTheNode.success !== true)
    throw new Error("both eye-level twins must perform");
  TestValidator.equals(
    "an actor node target compiles the explicit eye point's shot",
    { shot: atTheEyes.shot, motions: atTheEyes.motions },
    { shot: atTheNode.shot, motions: atTheNode.motions },
  );
};

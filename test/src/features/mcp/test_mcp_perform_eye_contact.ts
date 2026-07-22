import { compareCodeUnits } from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieActionTarget,
  IAutoMovieGait,
  IAutoMovieVector3,
} from "@automovie/interface";
import {
  AutoMovieApplication,
  IAutoMovieMcpActorContext,
  IAutoMovieMcpMotion,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
} from "../internal/filmFixtures";
import { createSkeleton, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

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

/**
 * Total downward flexion the compiled gaze chain carries at the first frame.
 *
 * Summed over the joints rather than read off `head`, because the aim is spread
 * across `neck` and `head` by the rig's declared ROM (#1360) and the sum is
 * what the aim geometry fixes; which bone holds how much is the chain's
 * business.
 */
const chainFlexion = (motion: IAutoMovieMcpMotion): number =>
  motion.keyframes[0]!.pose.joints.reduce(
    (sum, entry) => sum + (entry.flexion ?? 0),
    0,
  );

const chainTwist = (motion: IAutoMovieMcpMotion, index: number): number =>
  motion.keyframes[index]!.pose.joints.reduce(
    (sum, entry) => sum + (entry.twist ?? 0),
    0,
  );

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
 * m. Resolving a `lookAt` at the other's PLACEMENT aims at the floor between
 * its feet and needs `atan2(1.6, 0.7) = 66.37` degrees of downward flexion;
 * resolving it at the other's eyes needs none. Both halves are asserted here so
 * the fix is proved by the pair, not by one green result.
 *
 * **The counter-case is measured, not refused (#1360).** It used to fail the
 * ROM gate because the whole 66.37 degrees landed on `head` against its 45
 * degree limit. The gaze chain now spreads an aim over `neck` and `head`, and a
 * 66.37 degree stoop fits inside the two declared ranges, so what proves the
 * aim moved is the ANGLE each geometry compiles to rather than whether one of
 * them compiles at all. That is the stronger statement: it holds however wide
 * the rig's cervical ranges are.
 *
 * Scenarios:
 *
 * 1. Mutual `lookAt` between the two staged knights performs, both actors carry a
 *    compiled performance (a dropped synthesis would leave one out of
 *    `shot.performances` while still reporting success), and the gaze chain is
 *    level: the compiled flexion over the whole chain is 0.
 * 2. The same beat written with an explicit `point` at the other's placement, the
 *    geometry the engine used to resolve to, compiles the full `atan2(1.6,
 *    0.7)` stoop across `neck` and `head`. This is the counter-case that shows
 *    scenario 1 is level because the aim moved, not because the angle
 *    vanished.
 * 3. Only the aim height differs: an explicit `point` at the other's EYE point
 *    performs exactly as the node target does, shot and motions alike.
 * 4. A bone target follows a walking actor's hand across the shot (rather than
 *    freezing the rest-pose point), and `point`, `strike`, and `reach` compile
 *    their arm pose at the target's changing beat time.
 * 5. A missing rig bone is refused at `bone`.
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
    performed.shot.performances
      .map((entry) => entry.node)
      .sort(compareCodeUnits),
    ["knightA", "knightB"],
  );
  TestValidator.predicate(
    "eyes meeting eyes compiles a level gaze chain",
    nclose(chainFlexion(performed.motions.knightA!), 0),
  );

  // 2. the counter-case: the old geometry compiles the whole stoop instead.
  const atTheFeet = performing([
    lookAt("knightA", { kind: "point", point: B_PLACEMENT }),
  ]);
  if (atTheFeet.success !== true)
    throw new Error("a stoop the declared chain can hold must compile");
  TestValidator.predicate(
    "aiming at the placement stoops the chain by the full 66.37 degrees",
    nclose(chainFlexion(atTheFeet.motions.knightA!), 66.3706, 1e-4),
  );
  TestValidator.equals(
    "the stoop is carried by the chain, not by one bone",
    atTheFeet.motions
      .knightA!.keyframes[0]!.pose.joints.map((entry) => entry.bone)
      .sort(compareCodeUnits),
    ["head", "neck"],
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

  // 4. `knightB` walks sideways while `knightA` watches its actual left hand.
  const handTarget = performing([
    {
      verb: "locomote",
      actor: "knightB",
      start: 0,
      duration: 2,
      gait: "walk",
      to: { kind: "point", point: { x: 1, y: 0, z: 0.7 } },
    },
    lookAt("knightA", {
      kind: "bone",
      node: "knightB",
      bone: "leftHand",
    }),
  ]);
  if (handTarget.success !== true)
    throw new Error("a valid moving bone target must perform");
  const handGaze = handTarget.motions.knightA!;
  TestValidator.predicate(
    "a bone-target gaze is sampled through the moving hand's beat",
    handGaze.keyframes.length > 2 &&
      !nclose(
        chainTwist(handGaze, 0),
        chainTwist(handGaze, handGaze.keyframes.length - 1),
      ),
  );

  const movingHand: IAutoMovieActionTarget = {
    kind: "bone",
    node: "knightA",
    bone: "leftHand",
  };
  const walkingHand = {
    verb: "locomote" as const,
    actor: "knightA",
    start: 0,
    duration: 2,
    gait: "walk",
    to: { kind: "point" as const, point: { x: 1, y: 0, z: 0.7 } },
  };
  const pointAtHand = performing([
    walkingHand,
    {
      verb: "gesture",
      actor: "knightA",
      start: 0,
      duration: 2,
      kind: "point",
      at: movingHand,
    },
  ]);
  const strikeAtHand = performing([
    walkingHand,
    {
      verb: "gesture",
      actor: "knightA",
      start: 0,
      duration: 2,
      kind: "strike",
      at: movingHand,
    },
  ]);
  const reachForHand = performing([
    walkingHand,
    {
      verb: "reach",
      actor: "knightA",
      start: 0,
      duration: 2,
      hand: "right",
      to: movingHand,
    },
  ]);
  const dynamicArm = (result: typeof pointAtHand): boolean =>
    result.success === true &&
    (result.motions.knightA?.keyframes.length ?? 0) > 2;
  TestValidator.predicate(
    "each bone-target arm verb samples a moving target over its full span",
    dynamicArm(pointAtHand) &&
      dynamicArm(strikeAtHand) &&
      dynamicArm(reachForHand),
  );

  const missingBone = performing([
    lookAt("knightA", {
      kind: "bone",
      node: "knightB",
      bone: "rightHand",
    }),
  ]);
  TestValidator.predicate(
    "a bone the target rig does not carry is refused by bone",
    missingBone.success === false &&
      missingBone.violations.some((violation) =>
        violation.path.endsWith(".bone"),
      ),
  );
};

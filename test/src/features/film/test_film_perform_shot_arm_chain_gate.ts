import { performShot, stageScene } from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieActionCall,
  IAutoMovieBone,
  IAutoMovieCameraAction,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  makePerformanceWrite,
  makeScriptWrite,
  makeStagingWrite,
  validSynthesizer,
} from "../internal/filmFixtures";
import { hasViolation } from "../internal/predicates";

const bone = (
  name: AutoMovieHumanoidBone,
  parent: AutoMovieHumanoidBone | null,
  translation: IAutoMovieVector3,
): IAutoMovieBone => ({
  bone: name,
  parent,
  rest: {
    translation,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  constraint: null,
});

/**
 * A rig whose arms rest hanging (`down`) or in the canonical T-pose (`out`).
 * One property apart, so the pair isolates the rest direction.
 */
const armRig = (direction: "down" | "out"): IAutoMovieSkeleton => {
  const step = (length: number, sign: number): IAutoMovieVector3 =>
    direction === "down"
      ? { x: 0, y: -length, z: 0 }
      : { x: sign * length, y: 0, z: 0 };
  return {
    id: "skeleton-1",
    bones: [
      bone("hips", null, { x: 0, y: 0.95, z: 0 }),
      bone("spine", "hips", { x: 0, y: 0.2, z: 0 }),
      bone("chest", "spine", { x: 0, y: 0.18, z: 0 }),
      bone("leftUpperArm", "chest", { x: 0.09, y: 0, z: 0 }),
      bone("leftLowerArm", "leftUpperArm", step(0.32, 1)),
      bone("leftHand", "leftLowerArm", step(0.28, 1)),
      bone("rightUpperArm", "chest", { x: -0.09, y: 0, z: 0 }),
      bone("rightLowerArm", "rightUpperArm", step(0.32, -1)),
      bone("rightHand", "rightLowerArm", step(0.28, -1)),
    ],
  };
};

const reach: IAutoMovieActionCall = {
  verb: "reach",
  actor: "knightA",
  start: 0,
  duration: 0.6,
  hand: "left",
  to: { kind: "point", point: { x: 0, y: 1.1, z: 0.3 } },
};

const frame: IAutoMovieCameraAction = {
  verb: "frame",
  actor: "cam-main",
  start: 0,
  duration: "auto",
  framing: "medium",
  move: "static",
  on: { kind: "node", node: "knightA" },
};

const run = (rig: IAutoMovieSkeleton | null, actions: IAutoMovieActionCall[]) =>
  performShot({
    script: makeScriptWrite(),
    staged: (() => {
      const s = stageScene(makeScriptWrite(), makeStagingWrite());
      if (s.success !== true) throw new Error("staging must succeed");
      return s;
    })(),
    performance: makePerformanceWrite({
      draft: [...actions, frame],
      revise: { review: "unchanged.", final: null },
    }),
    synthesize: validSynthesizer,
    skeleton: () => rig,
  });

/**
 * The perform gate must refuse an arm verb asked of a rig whose elbow cannot
 * bend that arm (#1346), and this gate exists because the fix to the solver
 * would otherwise have made the failure QUIETER.
 *
 * Before, such a rig got a pose that loaded the bend onto abduction and twist,
 * so the shot failed loudly with ROM errors on axes the rig declared immobile.
 * Now `reachPose` refuses the rig outright, and a `null` synthesis is SKIPPED
 * by `compilePerformance` ("no motion for this actor, skip"), so without a gate
 * the shot would come back successful having performed nothing at all. That is
 * #1349's failure shape one verb lower, and trading a loud wrong answer for a
 * silent one is not a fix.
 *
 * Scenarios:
 *
 * 1. A `reach` on an arms-down rig is a `type` violation at the action's own
 *    `hand` field, carrying the rig's geometry rather than a missing clip.
 * 2. NEGATIVE TWIN: the identical shot on the T-pose rig passes. Only the rest
 *    direction changed, so only the rest direction can have caused the
 *    refusal.
 * 3. The arm GESTURES are gated on the same fact: `point` and `strike` always
 *    solve the right arm, so they are refused at their `kind` field on the same
 *    rig, and pass on the twin.
 * 4. Boundary: a shot with no arm verb at all is untouched on either rig, so the
 *    gate is scoped to the verbs that ask an arm-IK question and a quadruped
 *    that never reaches stays performable.
 */
export const test_film_perform_shot_arm_chain_gate = (): void => {
  // 1. the refusal, at the field that names the arm
  const refused = run(armRig("down"), [reach]);
  TestValidator.equals(
    "a reach on an unbendable arm fails the shot",
    refused.success,
    false,
  );
  TestValidator.predicate(
    "and is reported at the action's own hand field",
    hasViolation(refused, "type", "$input.draft[0].hand"),
  );
  TestValidator.predicate(
    "with the rig's own geometry as the reason",
    refused.success === false &&
      refused.violations.some(
        (v) =>
          v.path.includes("[0].hand") &&
          v.expected.includes("parallel") &&
          v.expected.includes("knightA"),
      ),
  );

  // 2. NEGATIVE TWIN: the same shot, the same target, a conforming rest
  TestValidator.equals(
    "the identical shot passes on the T-pose twin",
    run(armRig("out"), [reach]).success,
    true,
  );

  // 3. the arm gestures ride the same solver, so they carry the same gate
  for (const kind of ["point", "strike"] as const) {
    const gesture: IAutoMovieActionCall = {
      verb: "gesture",
      actor: "knightA",
      start: 0,
      duration: 0.6,
      kind,
      at: { kind: "point", point: { x: 0, y: 1.1, z: 0.3 } },
    };
    const gestureRefused = run(armRig("down"), [gesture]);
    TestValidator.predicate(
      `a ${kind} gesture on an unbendable arm is refused at its kind field`,
      gestureRefused.success === false &&
        hasViolation(gestureRefused, "type", "$input.draft[0].kind"),
    );
    TestValidator.equals(
      `and the same ${kind} passes on the T-pose twin`,
      run(armRig("out"), [gesture]).success,
      true,
    );
  }

  // 4. BOUNDARY: the gate is scoped to arm verbs. A rig that never reaches is
  // still perfectly performable, which is what keeps retargeted quadrupeds
  // (whose front legs ride the arm chains) legal.
  const hold: IAutoMovieActionCall = {
    verb: "hold",
    actor: "knightA",
    start: 0,
    duration: 1,
  };
  TestValidator.equals(
    "a shot with no arm verb is untouched on the arms-down rig",
    run(armRig("down"), [hold]).success,
    true,
  );

  // 5. BOUNDARY: no rig to diagnose. A node the skeleton lookup does not resolve
  // carries no geometry, so the gate has nothing to decide and stays silent
  // rather than guessing a convention for a rig it cannot see.
  TestValidator.predicate(
    "an unresolved rig raises no arm-chain violation",
    !hasViolation(run(null, [reach]), "type", "$input.draft[0].hand"),
  );
};

import {
  HUMANOID_JOINT_AXES,
  armChainFault,
  reachPose,
  resolvePose,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieBone,
  IAutoMovieSkeleton,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

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
 * Two rigs identical except for the direction the arm chain rests in: the same
 * bones, the same `0.32 m` upper and `0.28 m` fore, the same shoulder. `down`
 * hangs the arm along local −Y (the other obvious rest pose, and the one S-02's
 * agent authored); `out` holds the canonical VRM T-pose along local ±X.
 *
 * One property apart, which is what makes the pair a twin.
 */
const armRig = (direction: "down" | "out"): IAutoMovieSkeleton => {
  const step = (length: number): IAutoMovieVector3 =>
    direction === "down"
      ? { x: 0, y: -length, z: 0 }
      : { x: -length, y: 0, z: 0 };
  return {
    id: "rig-mara",
    bones: [
      bone("hips", null, { x: 0, y: 0.95, z: 0 }),
      bone("spine", "hips", { x: 0, y: 0.2, z: 0 }),
      bone("chest", "spine", { x: 0, y: 0.18, z: 0 }),
      bone("rightUpperArm", "chest", { x: -0.09, y: 0, z: 0 }),
      bone("rightLowerArm", "rightUpperArm", step(0.32)),
      bone("rightHand", "rightLowerArm", step(0.28)),
    ],
  };
};

/** Shoulder-to-hand distance at one elbow flexion angle. */
const spanAt = (skeleton: IAutoMovieSkeleton, flexion: number): number => {
  const resolved = resolvePose(
    {
      skeleton: skeleton.id,
      root: null,
      joints: [{ bone: "rightLowerArm", flexion, abduction: 0, twist: 0 }],
    },
    skeleton,
    HUMANOID_JOINT_AXES,
  );
  const shoulder = resolved.find(
    (b) => b.bone === "rightUpperArm",
  )!.worldPosition;
  const hand = resolved.find((b) => b.bone === "rightHand")!.worldPosition;
  return Math.hypot(
    hand.x - shoulder.x,
    hand.y - shoulder.y,
    hand.z - shoulder.z,
  );
};

const SWEEP = [0, 15, 30, 60, 90, 150];

/**
 * The arm kinematics assume the VRM T-pose rest convention, and a rig that
 * rests otherwise loses its elbow entirely (#1346).
 *
 * `HUMANOID_JOINT_AXES` maps the arm's `flexion` onto local **+Y** because a
 * T-pose arm points along local X, so flexion swings it sagittally instead of
 * rolling it. Applied to an arm that HANGS along local −Y, that same table
 * names the bone's own long axis: elbow flexion becomes a roll, the hand does
 * not move at all, and the arm is a rigid stick. Nothing refused such a rig.
 * `forge` accepted it, no validator inspects a rest direction, and `getReach`
 * answered `reachable: true` with a pose that loaded abduction and twist onto
 * axes the rig declared immobile, because on that rig those were the only axes
 * that could bend the arm at all.
 *
 * The refusal belongs at the point of USE, not at authoring time: the humanoid
 * bone enum is the only vocabulary the surface has, so a retargeted quadruped's
 * front legs ride the arm chains and legitimately rest along −Y. A blanket
 * `forge` refusal would forbid every quadruped, including the one the benchmark
 * corpus shipped successfully. The test is therefore rig-shaped rather than a
 * convention sniff: is the elbow's flexion axis parallel to the forearm's rest
 * direction?
 *
 * The expected spans below are hand-computed, not sampled from the code: an
 * elbow rolling about the forearm's own axis cannot change the shoulder-to-hand
 * distance, so it stays `0.32 + 0.28 = 0.600000` at EVERY angle, while a T-pose
 * elbow closes the triangle by the law of cosines, `sqrt(0.32² + 0.28² −
 * 2·0.32·0.28·cos(180° − flexion))`.
 *
 * Scenarios:
 *
 * 1. The degeneracy, measured: on the arms-down rig the shoulder-to-hand span is
 *    `0.600000` at every elbow flexion in the sweep. The elbow does nothing.
 * 2. NEGATIVE TWIN: the same sweep on the T-pose rig matches the law of cosines at
 *    every angle and falls from `0.600000` to `0.160026`, so the sweep itself
 *    is a working measurement rather than a constant.
 * 3. `armChainFault` names the arms-down rig's elbow, and returns `null` for the
 *    T-pose rig: the diagnosis matches the measurement on both sides.
 * 4. `reachPose` refuses the arms-down rig rather than returning a pose whose bend
 *    rides axes the rig declares immobile, and still solves the T-pose rig.
 * 5. Boundary, per SIDE not per rig: a rig with one arm T-posed and the other
 *    hanging is faulted on exactly the hanging side.
 * 6. Boundary, nothing to diagnose: a rig with no hand bone is not a convention
 *    fault, it is a missing chain, and the two answers stay distinct.
 * 7. Boundary, an ill-posed question: a zero-length forearm has no direction to be
 *    parallel to, and an axis table that names no elbow hinge (or names a
 *    zero-length one) states no convention to break. None is a fault.
 */
export const test_kinematics_arm_chain_fault = (): void => {
  const down = armRig("down");
  const out = armRig("out");

  // 1. the degeneracy: the elbow cannot change the span at all
  for (const flexion of SWEEP)
    TestValidator.predicate(
      `an arms-down elbow at ${flexion} deg leaves the span at 0.600000`,
      nclose(spanAt(down, flexion), 0.6, 1e-9),
    );

  // 2. NEGATIVE TWIN: the same measurement on the conforming rig moves, and
  // moves to where the law of cosines says it should.
  for (const flexion of SWEEP) {
    const interior = ((180 - flexion) * Math.PI) / 180;
    const expected = Math.sqrt(
      0.32 * 0.32 + 0.28 * 0.28 - 2 * 0.32 * 0.28 * Math.cos(interior),
    );
    TestValidator.predicate(
      `a T-pose elbow at ${flexion} deg closes the triangle to ${expected.toFixed(6)}`,
      nclose(spanAt(out, flexion), expected, 1e-9),
    );
  }
  TestValidator.predicate(
    "and that sweep really moves: 0.600000 at 0 deg down to 0.160026 at 150",
    nclose(spanAt(out, 0), 0.6, 1e-9) &&
      nclose(spanAt(out, 150), 0.160026, 1e-6),
  );

  // 3. the diagnosis agrees with the measurement on both sides
  const fault = armChainFault(down, "right");
  TestValidator.predicate(
    "the arms-down rig is faulted, at its elbow, with a reason that says why",
    fault !== null &&
      fault.side === "right" &&
      fault.bone === "rightLowerArm" &&
      fault.reason.includes("parallel"),
  );
  TestValidator.equals(
    "the conforming rig is not faulted",
    armChainFault(out, "right"),
    null,
  );

  // 4. the refusal lands where the arm IK is actually asked for
  const target: IAutoMovieVector3 = { x: 0.25, y: 1.0, z: 0.35 };
  TestValidator.equals(
    "reachPose refuses an arm whose elbow cannot bend it",
    reachPose(down, "right", target),
    null,
  );
  TestValidator.predicate(
    "and still solves the twin that can",
    reachPose(out, "right", { x: -0.35, y: 1.1, z: 0.3 }) !== null,
  );

  // 5. BOUNDARY: the fault is a property of a SIDE, not of a rig. A rig may
  // legitimately carry one conforming arm and one that does not.
  const mixed: IAutoMovieSkeleton = {
    id: "rig-mixed",
    bones: [
      ...armRig("down").bones,
      bone("leftUpperArm", "chest", { x: 0.09, y: 0, z: 0 }),
      bone("leftLowerArm", "leftUpperArm", { x: 0.32, y: 0, z: 0 }),
      bone("leftHand", "leftLowerArm", { x: 0.28, y: 0, z: 0 }),
    ],
  };
  TestValidator.predicate(
    "a mixed rig faults only the hanging side",
    armChainFault(mixed, "right") !== null &&
      armChainFault(mixed, "left") === null,
  );

  // 6. BOUNDARY: an absent chain is a different fact from an unbendable one.
  const handless: IAutoMovieSkeleton = {
    id: "rig-handless",
    bones: armRig("down").bones.filter((b) => b.bone !== "rightHand"),
  };
  TestValidator.equals(
    "a rig with no hand bone is not a convention fault",
    armChainFault(handless, "right"),
    null,
  );
  TestValidator.equals(
    "though reachPose still has no chain to solve",
    reachPose(handless, "right", target),
    null,
  );

  // 7. BOUNDARY: the inputs the test itself needs to be well posed. A forearm of
  // zero length has no direction to be parallel TO, and an axis table that
  // names no hinge for the elbow states no convention to check against, so
  // neither is a convention fault. The diagnosis answers only the question it
  // can actually decide.
  const collapsed: IAutoMovieSkeleton = {
    id: "rig-collapsed",
    bones: armRig("down").bones.map((b) =>
      b.bone === "rightHand"
        ? { ...b, rest: { ...b.rest, translation: { x: 0, y: 0, z: 0 } } }
        : b,
    ),
  };
  TestValidator.equals(
    "a zero-length forearm is not a convention fault",
    armChainFault(collapsed, "right"),
    null,
  );
  TestValidator.equals(
    "an axis table naming no elbow hinge states no convention to break",
    armChainFault(down, "right", {}),
    null,
  );
  TestValidator.equals(
    "and a zero-length hinge axis names no direction either",
    armChainFault(down, "right", {
      rightLowerArm: {
        flexion: { x: 0, y: 0, z: 0 },
        abduction: { x: 0, y: 0, z: 1 },
        twist: { x: 1, y: 0, z: 0 },
      },
    }),
    null,
  );
};

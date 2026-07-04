import {
  DEFAULT_HUMANOID_ROM,
  gestureMotion,
  validateMotion,
} from "@automovie/engine";
import {
  AutoMovieHumanoidBone,
  IAutoMovieBone,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

// Every bone validates against the default anatomical table — including the
// arms, now that gestures are authored in **clinical** space (abduction 180
// raises either arm alike; the per-side rest-frame remap lives in the render,
// not in the gesture values). So "ROM-legal" here is the real pipeline gate: a
// knee that only flexes 0–150°, a shoulder abduction −30–180°.
const bone = (b: AutoMovieHumanoidBone): IAutoMovieBone => ({
  bone: b,
  parent: null,
  rest: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  constraint: DEFAULT_HUMANOID_ROM[b] ?? null,
});

const RIG: IAutoMovieSkeleton = {
  id: "humanoid",
  bones: [
    "spine",
    "head",
    "leftUpperArm",
    "rightUpperArm",
    "leftLowerArm",
    "rightLowerArm",
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerLeg",
    "rightLowerLeg",
  ].map((b) => bone(b as AutoMovieHumanoidBone)),
};

const GENERIC = [
  "bow",
  "nod",
  "shake",
  "crouch",
  "kick",
  "stagger",
  "wave",
  "celebrate",
  "draw",
  "throw",
] as const;

const maxAbs = (
  motion: NonNullable<ReturnType<typeof gestureMotion>>,
  b: AutoMovieHumanoidBone,
  axis: "flexion" | "abduction" | "twist",
): number =>
  Math.max(
    ...motion.keyframes.map((k) =>
      Math.abs(k.pose.joints.find((jj) => jj.bone === b)?.[axis] ?? 0),
    ),
  );

/**
 * `gestureMotion` — the postural/whole-body half of the harness `gesture` verb.
 * The trunk/head/leg gestures are single-axis oscillations; the arm gestures
 * (wave/celebrate/draw/throw) are authored in clinical space and read up
 * through the rig's rest frame at render. All are engine-authored and hand-kept
 * inside the humanoid ROM; only the targeted `strike` jab is left to a richer
 * synthesiser.
 *
 * Scenarios:
 *
 * 1. Each generic kind synthesises a non-empty clip that opens and closes on the
 *    neutral pose (returns to rest) and validates against the default
 *    anatomical ROM — the arms too, since the clinical angles live inside that
 *    table.
 * 2. The gestures move the right joint: bow flexes the spine, nod dips the head
 *    (flexion), shake turns it (twist), crouch folds the knees, kick raises the
 *    leg (hip flexion) and snaps the knee, stagger leans the trunk (spine
 *    abduction) and braces a leg.
 * 3. A gesture stretches to the action's duration (a 2 s bow's last key lands at 2
 *    s).
 * 4. `jump` is a whole-body coil-and-leap: it folds the knees, arcs the root up to
 *    a positive apex (and dips into a coil first), opens/closes grounded, and
 *    stays ROM-legal — no arm abduction, so no left/right mirror needed.
 * 5. The arm gestures abduct in clinical space: `wave` raises the right arm
 *    (+abduction) and swings the forearm; `celebrate` throws both arms up with
 *    the same positive abduction on each side — no per-side mirror. `draw`
 *    reaches the bow arm forward and folds the string arm back; `throw` winds
 *    the arm back then whips it forward while the trunk coils.
 * 6. Only `strike` (a targeted jab) and unknown kinds return null — the compiler
 *    skips them for the reach-based synthesiser.
 */
export const test_motion_gesture = (): void => {
  for (const kind of GENERIC) {
    const clip = gestureMotion(kind, RIG.id, kind, 1);
    TestValidator.predicate(`${kind} synthesises a clip`, clip !== null);
    if (clip === null) continue;
    TestValidator.predicate(
      `${kind} has keyframes`,
      clip.keyframes.length >= 3,
    );
    TestValidator.equals(`${kind} not looped`, clip.loop, false);
    const first = clip.keyframes[0]!.pose.joints;
    const last = clip.keyframes[clip.keyframes.length - 1]!.pose.joints;
    TestValidator.predicate(
      `${kind} opens on neutral`,
      first.every((jj) => (jj.flexion ?? 0) === 0 && (jj.twist ?? 0) === 0),
    );
    TestValidator.predicate(
      `${kind} closes on neutral`,
      last.every((jj) => (jj.flexion ?? 0) === 0 && (jj.twist ?? 0) === 0),
    );
    TestValidator.equals(
      `${kind} is ROM-legal`,
      validateMotion({ motion: clip, skeleton: RIG }).success,
      true,
    );
  }

  TestValidator.predicate(
    "bow flexes the spine forward",
    maxAbs(gestureMotion("b", RIG.id, "bow", 1)!, "spine", "flexion") > 30,
  );
  TestValidator.predicate(
    "nod dips the head (flexion)",
    maxAbs(gestureMotion("n", RIG.id, "nod", 1)!, "head", "flexion") > 10,
  );
  TestValidator.predicate(
    "shake turns the head (twist)",
    maxAbs(gestureMotion("s", RIG.id, "shake", 1)!, "head", "twist") > 10,
  );
  TestValidator.predicate(
    "crouch folds the knees",
    maxAbs(
      gestureMotion("c", RIG.id, "crouch", 1)!,
      "leftLowerLeg",
      "flexion",
    ) > 30,
  );

  // kick — a right-leg front snap: the hip flexes to raise the leg, and the knee
  // chambers folded then snaps near-straight.
  const kick = gestureMotion("k", RIG.id, "kick", 1)!;
  TestValidator.predicate(
    "kick raises the leg (hip flexion)",
    maxAbs(kick, "rightUpperLeg", "flexion") > 40,
  );
  const kneeFlex = kick.keyframes
    .map(
      (kf) => kf.pose.joints.find((jj) => jj.bone === "rightLowerLeg")?.flexion,
    )
    .filter((v): v is number => v !== undefined);
  TestValidator.predicate(
    "kick chambers then snaps the knee (folded → near-straight)",
    Math.max(...kneeFlex) > 60 && Math.min(...kneeFlex) < 15,
  );

  // stagger — the trunk lurches off balance: the spine leans (abduction) and
  // a leg braces.
  const stagger = gestureMotion("st", RIG.id, "stagger", 1)!;
  TestValidator.predicate(
    "stagger leans the trunk (spine abduction) and braces a leg",
    maxAbs(stagger, "spine", "abduction") > 15 &&
      maxAbs(stagger, "rightUpperLeg", "flexion") > 15,
  );

  // The clinical raise is a positive abduction on either side (a rig-space
  // mirror would flip the sign) — take the signed peak, not the magnitude.
  const peakAbd = (
    motion: NonNullable<ReturnType<typeof gestureMotion>>,
    b: AutoMovieHumanoidBone,
  ): number =>
    Math.max(
      ...motion.keyframes.map(
        (k) => k.pose.joints.find((jj) => jj.bone === b)?.abduction ?? 0,
      ),
    );

  // wave — the right arm raised (clinical +abduction) and the elbow swinging.
  const wave = gestureMotion("w", RIG.id, "wave", 1)!;
  TestValidator.predicate(
    "wave raises the right arm (clinical +abduction, read up through the frame)",
    peakAbd(wave, "rightUpperArm") > 120,
  );
  TestValidator.predicate(
    "wave swings the forearm at the elbow",
    maxAbs(wave, "rightLowerArm", "flexion") > 30,
  );

  // celebrate — both arms thrown up by clinical abduction, the SAME positive
  // angle on each side (no per-side mirror; the rest frame reads it up).
  const celebrate = gestureMotion("c2", RIG.id, "celebrate", 1)!;
  TestValidator.predicate(
    "celebrate throws both arms up with the same positive clinical abduction",
    peakAbd(celebrate, "leftUpperArm") > 120 &&
      nclose(
        peakAbd(celebrate, "leftUpperArm"),
        peakAbd(celebrate, "rightUpperArm"),
      ),
  );

  // draw — the bow arm reaches forward (left-arm flexion) and the string hand
  // folds back to the cheek (right forearm flexion).
  const draw = gestureMotion("d", RIG.id, "draw", 1)!;
  TestValidator.predicate(
    "draw reaches the bow arm forward and folds the string arm",
    maxAbs(draw, "leftUpperArm", "flexion") > 60 &&
      maxAbs(draw, "rightLowerArm", "flexion") > 90,
  );

  // throw — the right arm cocks back (negative upper-arm flexion) then whips
  // forward (positive), and the trunk coils on its twist.
  const thrown = gestureMotion("t", RIG.id, "throw", 1)!;
  const throwArmFlex = thrown.keyframes.map(
    (k) =>
      k.pose.joints.find((jj) => jj.bone === "rightUpperArm")?.flexion ?? 0,
  );
  TestValidator.predicate(
    "throw winds the arm back then whips it forward",
    Math.min(...throwArmFlex) < -20 && Math.max(...throwArmFlex) > 40,
  );
  TestValidator.predicate(
    "throw coils the trunk on its twist",
    maxAbs(thrown, "spine", "twist") > 15,
  );

  const long = gestureMotion("bow", RIG.id, "bow", 2)!;
  TestValidator.equals(
    "stretches to the duration",
    long.keyframes[long.keyframes.length - 1]!.time,
    2,
  );

  // jump — a whole-body coil-and-leap. Unlike the postural gestures it carries
  // root translation (the ballistic rise), folds the knees on the coil/landing,
  // opens and closes grounded, and stays ROM-legal.
  const jump = gestureMotion("j", RIG.id, "jump", 1)!;
  TestValidator.predicate("jump synthesises a clip", jump !== null);
  TestValidator.equals(
    "jump is ROM-legal",
    validateMotion({ motion: jump, skeleton: RIG }).success,
    true,
  );
  TestValidator.predicate(
    "jump folds the knees on coil/landing",
    maxAbs(jump, "leftLowerLeg", "flexion") > 30,
  );
  const rootYs = jump.keyframes.map((k) => k.pose.root?.translation.y ?? 0);
  TestValidator.predicate(
    "jump opens and closes grounded (root y = 0)",
    nclose(rootYs[0]!, 0) && nclose(rootYs[rootYs.length - 1]!, 0),
  );
  TestValidator.predicate(
    "jump arcs the root up to a positive apex",
    Math.max(...rootYs) > 0.2,
  );
  TestValidator.predicate(
    "jump dips into a coil before the leap",
    Math.min(...rootYs) < 0,
  );

  for (const kind of ["strike", "somersault"])
    TestValidator.equals(
      `${kind} is not engine-authored (null)`,
      gestureMotion("x", RIG.id, kind, 1),
      null,
    );
};

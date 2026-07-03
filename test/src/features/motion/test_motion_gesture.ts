import { gestureMotion, validateMotion } from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmBone,
  IAutoFilmSkeleton,
} from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

const bone = (b: AutoFilmHumanoidBone): IAutoFilmBone => ({
  bone: b,
  parent: null,
  rest: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  constraint: null,
});

const RIG: IAutoFilmSkeleton = {
  id: "humanoid",
  bones: [
    "spine",
    "head",
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerLeg",
    "rightLowerLeg",
  ].map((b) => bone(b as AutoFilmHumanoidBone)),
};

const GENERIC = ["bow", "nod", "shake", "crouch"] as const;

const maxAbs = (
  motion: NonNullable<ReturnType<typeof gestureMotion>>,
  b: AutoFilmHumanoidBone,
  axis: "flexion" | "twist",
): number =>
  Math.max(
    ...motion.keyframes.map((k) =>
      Math.abs(k.pose.joints.find((jj) => jj.bone === b)?.[axis] ?? 0),
    ),
  );

/**
 * `gestureMotion` — the postural half of the harness `gesture` verb. The four
 * trunk-and-head gestures are engine-authored, single-axis, and hand-kept
 * inside the humanoid ROM; the arm/combat kinds are left to a richer
 * synthesiser.
 *
 * Scenarios:
 *
 * 1. Each of bow/nod/shake/crouch synthesises a non-empty clip that opens and
 *    closes on the neutral pose (returns to rest) and validates against the
 *    humanoid ROM.
 * 2. The gestures move the right joint: bow flexes the spine, nod dips the head
 *    (flexion), shake turns it (twist), crouch folds the knees.
 * 3. A gesture stretches to the action's duration (a 2 s bow's last key lands at 2
 *    s).
 * 4. An arm/combat kind (`strike`, `wave`, `celebrate`) and any unknown kind
 *    return null — the compiler skips them.
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

  const long = gestureMotion("bow", RIG.id, "bow", 2)!;
  TestValidator.equals(
    "stretches to the duration",
    long.keyframes[long.keyframes.length - 1]!.time,
    2,
  );

  for (const kind of ["strike", "wave", "celebrate", "somersault"])
    TestValidator.equals(
      `${kind} is not engine-authored (null)`,
      gestureMotion("x", RIG.id, kind, 1),
      null,
    );
};

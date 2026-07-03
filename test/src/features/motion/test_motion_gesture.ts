import {
  DEFAULT_HUMANOID_ROM,
  gestureMotion,
  validateMotion,
} from "@autofilm/engine";
import {
  AutoFilmHumanoidBone,
  IAutoFilmBone,
  IAutoFilmSkeleton,
} from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

// Carry the real anatomical ROM so "ROM-legal" validates against the actual
// humanoid ranges (a knee that only flexes 0–150°, a hip −30–120°), not a
// permissive stub — every authored gesture must survive the same gate the
// pipeline applies.
const bone = (b: AutoFilmHumanoidBone): IAutoFilmBone => ({
  bone: b,
  parent: null,
  rest: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  constraint: DEFAULT_HUMANOID_ROM[b] ?? null,
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

const GENERIC = ["bow", "nod", "shake", "crouch", "kick"] as const;

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
 * 1. Each of bow/nod/shake/crouch/kick synthesises a non-empty clip that opens and
 *    closes on the neutral pose (returns to rest) and validates against the
 *    real humanoid ROM (the rig carries `DEFAULT_HUMANOID_ROM`).
 * 2. The gestures move the right joint: bow flexes the spine, nod dips the head
 *    (flexion), shake turns it (twist), crouch folds the knees, kick raises the
 *    leg (hip flexion) and snaps the knee from folded to near-straight.
 * 3. A gesture stretches to the action's duration (a 2 s bow's last key lands at 2
 *    s).
 * 4. `jump` is a whole-body coil-and-leap: it folds the knees, arcs the root up to
 *    a positive apex (and dips into a coil first), opens/closes grounded, and
 *    stays ROM-legal — no arm abduction, so no left/right mirror needed.
 * 5. An arm/combat kind (`strike`, `wave`, `celebrate`) and any unknown kind
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

  for (const kind of ["strike", "wave", "celebrate", "somersault"])
    TestValidator.equals(
      `${kind} is not engine-authored (null)`,
      gestureMotion("x", RIG.id, kind, 1),
      null,
    );
};

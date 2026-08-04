import {
  IAutoMovieActorContext,
  makeActorSynthesizer,
} from "@automovie/engine";
import {
  IAutoMovieActionCall,
  IAutoMovieActionTarget,
  IAutoMovieGait,
  IAutoMovieMotion,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

const WALK: IAutoMovieGait = {
  name: "walk",
  period: 1,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 25 }],
};

const actorAt = (
  position: IAutoMovieVector3,
  eyeHeight: number,
): IAutoMovieActorContext => ({
  skeleton: "h",
  gaits: [WALK],
  position,
  speed: 1,
  facingDeg: 0,
  eyeHeight,
  restPose: makePose([joint("spine", { flexion: 0 })]),
});

/** The looker stands at the origin facing +Z, eyes at 1.6 m. */
const HERO = actorAt({ x: 0, y: 0, z: 0 }, 1.6);

/** Conversational range, the distance the staging schema names for a duel. */
const GUARD_PLACEMENT: IAutoMovieVector3 = { x: 0, y: 0, z: 0.7 };

/** A shorter performer, so the lift cannot be a constant in disguise. */
const CHILD_PLACEMENT: IAutoMovieVector3 = { x: 0, y: 0, z: 2 };

/** A staged thing with no actor context: its origin is wherever staging put it. */
const ALTAR_PLACEMENT: IAutoMovieVector3 = { x: 0, y: 0.9, z: 3 };

/** A staged camera: its translation already IS its optical point. */
const LENS_PLACEMENT: IAutoMovieVector3 = { x: 1, y: 1.6, z: 3 };

const contexts = new Map<string, IAutoMovieActorContext>([
  ["hero", HERO],
  ["guard", actorAt(GUARD_PLACEMENT, 1.6)],
  ["child", actorAt(CHILD_PLACEMENT, 1.2)],
  ["statue", actorAt({ x: 0, y: 0, z: 4 }, 0)],
]);

const nodes = new Map<string, IAutoMovieVector3>([
  ["hero", { x: 0, y: 0, z: 0 }],
  ["guard", GUARD_PLACEMENT],
  ["child", CHILD_PLACEMENT],
  ["statue", { x: 0, y: 0, z: 4 }],
  ["altar", ALTAR_PLACEMENT],
  ["lens", LENS_PLACEMENT],
]);

const synth = makeActorSynthesizer(contexts, nodes);

const lookAt = (to: IAutoMovieActionTarget): IAutoMovieActionCall => ({
  verb: "lookAt",
  to,
  actor: "hero",
  start: 0,
  duration: 1,
});

const look = (to: IAutoMovieActionTarget): IAutoMovieMotion | null =>
  synth(lookAt(to), "hero");

const headOf = (
  motion: IAutoMovieMotion,
): { flexion: number; twist: number } => {
  const bone = motion.keyframes[0]!.pose.joints.find((j) => j.bone === "head")!;
  return { flexion: bone.flexion!, twist: bone.twist! };
};

/** Degrees of head flexion the spec's aim formula demands for a raw aim. */
const flexionFor = (dy: number, horizontal: number): number =>
  (-Math.atan2(dy, horizontal) * 180) / Math.PI;

/**
 * A `lookAt` meets its subject's **eyes**, not the ground its feet stand on.
 *
 * A scene node's `transform.translation` is a placement, and staging writes an
 * actor's position straight into it, so a humanoid's node origin sits between
 * its feet. Resolving a `lookAt` there aimed the head at the floor: from 1.6 m
 * of eye height at 0.7 m of separation the aim needs 66.37 degrees of flexion
 * against the 45 degree head limit, so two actors at conversational range could
 * not regard each other at all, and the agent saw only an opaque `rom`
 * violation on the compiled clip. The camera solve had already answered the
 * same problem with a measured aim fraction of the subject's height; this is
 * the aim verb's half of that answer, using `eyeHeight`, the one datum the
 * context defines for exactly this purpose.
 *
 * Every expected angle below is computed from `atan2` on the stated geometry,
 * never read back from the synthesizer.
 *
 * Scenarios:
 *
 * 1. Two 1.6 m-eyed actors 0.7 m apart: the aim is level and dead ahead (`flexion`
 *    and `twist` both 0), and the SAME target written as an explicit point at
 *    the subject's placement still demands `atan2(1.6, 0.7) = 66.37` degrees,
 *    which is the difference the lift makes, stated as a pair.
 * 2. Unequal eye heights (1.6 looking at 1.2 from 2 m) tilt down by `atan2(0.4,
 *    2)`, so the lift is each subject's own datum, not a constant.
 * 3. A `group` target averages the members' EYE points: the centroid of `(0, 1.6,
 *    0.7)` and `(0, 1.2, 2)` is `(0, 1.4, 1.35)`, so the aim is `atan2(0.2,
 *    1.35)` downward. Group support falls out of the table rather than a second
 *    code path, and this is what proves it.
 * 4. Negative twins, the ids with no actor context: a set piece and a camera each
 *    compile byte-identically to an explicit `point` at their placement, so the
 *    lift applies to actors only.
 * 5. Boundary: an actor whose `eyeHeight` is 0 compiles byte-identically to a
 *    point at its placement, the zero-lift case that proves the lift is the
 *    only thing that changed.
 * 6. Regression: a relative target still synthesises nothing, and an unplaced id
 *    still synthesises nothing, so the aim table did not widen what resolves.
 */
export const test_perform_look_at_eye_level = (): void => {
  // 1. eyes meet eyes at conversational range.
  const level = headOf(look({ kind: "node", node: "guard" })!);
  TestValidator.predicate(
    "an actor target at equal eye height needs no head tilt",
    nclose(level.flexion, 0) && nclose(level.twist, 0),
  );
  const ground = headOf(look({ kind: "point", point: GUARD_PLACEMENT })!);
  TestValidator.predicate(
    "the same subject's placement point still demands the ROM-breaking tilt",
    nclose(ground.flexion, flexionFor(-1.6, 0.7)) &&
      // atan2(1.6, 0.7) = 66.3706 degrees, well past DEFAULT_HUMANOID_ROM.head's
      // 45 degree flexion maximum: the stoop this issue is about. These contexts
      // carry no rig, so the whole angle stays on the head (#1360 spreads it
      // over the declared neck/head chain only when a rig declares one).
      nclose(ground.flexion, 66.3706, 1e-4) &&
      ground.flexion > 45,
  );

  // 2. each subject's own eye height, not a shared constant.
  const shorter = headOf(look({ kind: "node", node: "child" })!);
  TestValidator.predicate(
    "a shorter subject tilts the head down by its own height difference",
    nclose(shorter.flexion, flexionFor(1.2 - 1.6, 2)),
  );

  // 3. a group averages eye points, not ground points.
  const group = headOf(look({ kind: "group", nodes: ["guard", "child"] })!);
  TestValidator.predicate(
    "a group target averages the members' eye points",
    nclose(group.flexion, flexionFor((1.6 + 1.2) / 2 - 1.6, (0.7 + 2) / 2)),
  );

  // 4. the negative twins: no context, no lift.
  TestValidator.equals(
    "a set piece target keeps its placement point",
    look({ kind: "node", node: "altar" }),
    look({ kind: "point", point: ALTAR_PLACEMENT }),
  );
  TestValidator.equals(
    "a camera target keeps its placement point",
    look({ kind: "node", node: "lens" }),
    look({ kind: "point", point: LENS_PLACEMENT }),
  );

  // 5. the zero-lift boundary.
  TestValidator.equals(
    "an actor with zero eye height is lifted by nothing",
    look({ kind: "node", node: "statue" }),
    look({ kind: "point", point: { x: 0, y: 0, z: 4 } }),
  );

  // 6. what still resolves to nothing.
  TestValidator.equals(
    "a relative target still synthesises nothing",
    look({ kind: "direction", headingDeg: 90 }),
    null,
  );
  TestValidator.equals(
    "an unplaced id still synthesises nothing",
    look({ kind: "node", node: "ghost" }),
    null,
  );
};

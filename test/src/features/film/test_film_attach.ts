import {
  HUMANOID_JOINT_AXES,
  HUMANOID_REST_FRAME,
  Quaternion,
  Vector3,
  compileAttach,
  resolveAttachment,
  sampleClip,
  sampleMotion,
} from "@automovie/engine";
import { IAutoMovieTransform, IAutoMovieVector3 } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  createSkeleton,
  createValidMotion,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";
import { nclose, qclose, vclose } from "../internal/predicates";

const IDENTITY_OFFSET: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

/** The parent placed off the origin and turned 90° about +Y. */
const parentTransform: IAutoMovieTransform = {
  translation: { x: 1, y: 0, z: 2 },
  rotation: Quaternion.fromAxisAngle({ x: 0, y: 1, z: 0 }, 90),
  scale: { x: 1, y: 1, z: 1 },
};

const posAt = (
  clip: ReturnType<typeof compileAttach>,
  t: number,
): IAutoMovieVector3 => {
  const v = sampleClip(clip, t).get("node:sword:translation")!.value;
  return { x: v[0]!, y: v[1]!, z: v[2]! };
};

/**
 * `compileAttach` — bake the `attachTo` verb into a child object's follow-clip.
 * The contract: the child rides the parent's bone in **scene space** (the
 * parent's staged placement composed onto the bone's per-frame FK), the clip is
 * shot-local, and a resting parent yields a static child while a moving one
 * carries the child with it.
 *
 * Scenarios:
 *
 * 1. A resting parent: the child is static and sits exactly at the bone's world
 *    point — the `leftHand` rest position (0.75, 1.4, 0) in the parent's model
 *    space, composed onto the staged placement (hand-computed FK oracle) — and
 *    inherits the parent's facing.
 * 2. The clip is shot-local: its times run over `[start, start + duration]` and it
 *    spans the shot.
 * 3. A moving parent (an elbow flexing 0 → 120°) carries the child: the baked
 *    position changes over the span, and at a frame-aligned instant it equals
 *    the staged placement composed onto `resolveAttachment` of the sampled
 *    pose.
 * 4. A clinical-space parent motion uses the same rest-frame table as the
 *    renderer/player, so a prop follows the visible hand rather than raw
 *    rig-space FK.
 */
export const test_film_attach = (): void => {
  // 1. a resting parent → a static child at the hand's world point
  const rest = compileAttach({
    child: "sword",
    bone: "leftHand",
    parentTransform,
    parentSkeleton: createSkeleton(),
    start: 0.5,
    duration: 1,
    shotDuration: 3,
  });
  TestValidator.equals("the clip is the child's", rest.id, "attach:sword");
  TestValidator.equals(
    "the clip drives the child node",
    rest.tracks.map((t) => (t.channel.kind === "node" ? t.channel.node : "")),
    ["sword", "sword"],
  );

  // leftHand rest model position: hips(0,1,0) → chest(0,1.4,0) → arm chain
  // +0.2 +0.3 +0.25 along x → (0.75, 1.4, 0). Compose onto the placement.
  const handModel: IAutoMovieVector3 = { x: 0.75, y: 1.4, z: 0 };
  const expected = Vector3.add(
    parentTransform.translation,
    Quaternion.rotateVector(parentTransform.rotation, handModel),
  );
  TestValidator.predicate(
    "the rest attach lands on the hand's world point",
    vclose(posAt(rest, 0.5), expected, 1e-9),
  );
  TestValidator.predicate(
    "a resting parent → a static child",
    vclose(posAt(rest, 0.5), posAt(rest, 1.5), 1e-12),
  );
  const r = sampleClip(rest, 0.5).get("node:sword:rotation")!.value;
  TestValidator.predicate(
    "the child inherits the parent's facing",
    qclose(
      { x: r[0]!, y: r[1]!, z: r[2]!, w: r[3]! },
      parentTransform.rotation,
    ),
  );

  // 2. shot-local timing
  TestValidator.predicate(
    "the coupling begins at the action's start",
    nclose(rest.tracks[0]!.times[0]!, 0.5),
  );
  TestValidator.predicate(
    "and closes at its end",
    nclose(rest.tracks[0]!.times[rest.tracks[0]!.times.length - 1]!, 1.5),
  );
  TestValidator.equals("the clip spans the shot", rest.duration, 3);

  // 3. a moving parent carries the child
  const motion = createValidMotion(); // leftLowerArm flexion 0 → 120° over 1 s
  const dyn = compileAttach({
    child: "sword",
    bone: "leftHand",
    parentTransform,
    parentSkeleton: createSkeleton(),
    parentMotion: motion,
    start: 0,
    duration: 1,
    shotDuration: 1,
    fps: 60,
    jointAxes: HUMANOID_JOINT_AXES,
  });
  TestValidator.predicate(
    "a moving parent → a moving child",
    !vclose(posAt(dyn, 0), posAt(dyn, 1), 1e-3),
  );

  // at a frame-aligned instant the baked value matches the composed FK exactly
  const t = 20 / 30;
  const pose = sampleMotion(motion, t).pose;
  const local = resolveAttachment(
    pose,
    createSkeleton(),
    { parentBone: "leftHand", offset: IDENTITY_OFFSET },
    HUMANOID_JOINT_AXES,
  );
  const composed = Vector3.add(
    parentTransform.translation,
    Quaternion.rotateVector(parentTransform.rotation, local.translation),
  );
  TestValidator.predicate(
    "the child rides the posed bone in scene space",
    vclose(posAt(dyn, t), composed, 1e-9),
  );

  // 4. clinical parent motion → compileAttach follows the renderer's FK path
  const raisedMotion = makeMotion(
    [
      keyframe(0, makePose([joint("leftUpperArm", { abduction: 180 })])),
      keyframe(1, makePose([joint("leftUpperArm", { abduction: 180 })])),
    ],
    1,
  );
  const framed = compileAttach({
    child: "sword",
    bone: "leftHand",
    parentTransform,
    parentSkeleton: createSkeleton(),
    parentMotion: raisedMotion,
    start: 0,
    duration: 1,
    shotDuration: 1,
    jointAxes: HUMANOID_JOINT_AXES,
    restFrames: HUMANOID_REST_FRAME,
  });
  const raw = compileAttach({
    child: "sword",
    bone: "leftHand",
    parentTransform,
    parentSkeleton: createSkeleton(),
    parentMotion: raisedMotion,
    start: 0,
    duration: 1,
    shotDuration: 1,
    jointAxes: HUMANOID_JOINT_AXES,
  });
  const framedLocal = resolveAttachment(
    sampleMotion(raisedMotion, 0.5).pose,
    createSkeleton(),
    { parentBone: "leftHand", offset: IDENTITY_OFFSET },
    HUMANOID_JOINT_AXES,
    HUMANOID_REST_FRAME,
  );
  const framedExpected = Vector3.add(
    parentTransform.translation,
    Quaternion.rotateVector(parentTransform.rotation, framedLocal.translation),
  );
  TestValidator.predicate(
    "rest-framed attach follows clinical FK",
    vclose(posAt(framed, 0.5), framedExpected, 1e-9),
  );
  TestValidator.predicate(
    "rest-framed attach differs from raw rig-space FK",
    !vclose(posAt(framed, 0.5), posAt(raw, 0.5), 1e-3),
  );

  // 5. a non-positive span throws before it can bake a degenerate clip (#1224).
  // With duration 0 the sample loop emits `start` for both endpoints, so the
  // clip's keyframe times would be [start, start] — an unsamplable follow. The
  // baker rejects it up front, the same precondition projectileTrajectory
  // enforces, so no caller can slip a zero-span coupling past.
  const zeroSpanAttach = (): void => {
    compileAttach({
      child: "sword",
      bone: "leftHand",
      parentTransform,
      parentSkeleton: createSkeleton(),
      start: 2,
      duration: 0,
      shotDuration: 2,
    });
  };
  TestValidator.error("a zero-span attach throws", zeroSpanAttach);
};

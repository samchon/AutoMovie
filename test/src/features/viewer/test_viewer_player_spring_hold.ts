import { IAutoMoviePose, IAutoMovieSkeleton } from "@automovie/interface";
import { AutoMoviePlayer, createImportedModelObject } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import {
  IDENTITY_TRANSFORM,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";

const SKELETON: IAutoMovieSkeleton = {
  id: "spring-hold-rig",
  bones: [
    { bone: "hips", parent: null, rest: IDENTITY_TRANSFORM, constraint: null },
  ],
};

const flexionOf = (pose: IAutoMoviePose): number | null =>
  pose.joints.find((j) => j.bone === "hips")?.flexion ?? null;

/**
 * A dt=0 spring frame means "no time elapsed", not "never sprung" (#1098): a
 * paused host loop re-calling `update(sameT)`, a backwards scrub (negative
 * delta clamps to 0), or a capture harness re-rendering a frozen frame must
 * HOLD the live spring — value and velocity — instead of resetting it. The old
 * decay branch conflated the two, snapping a mid-decay joint to null AND
 * zeroing its state (the exact pop #1078 exists to remove); the tracking branch
 * re-seeded a lagging joint AT its target with velocity destroyed.
 *
 * Scenarios (stiffness 100 / damping 5, the #1048 fixture):
 *
 * 1. Mid-DECAY hold: after the pose stops authoring the joint, repeated
 *    `update(sameT)` calls render the identical decayed angle (the joint does
 *    not vanish), and the next advancing frame continues the decay from the
 *    held state instead of teleporting to exactly 0.
 * 2. Mid-LAG hold: while the spring is still chasing a stepped 40° target,
 *    `update(sameT)` renders the identical lagged angle instead of popping to
 *    the target.
 * 3. Negative twin: a genuinely fresh joint (no spring state) at a dt=0 first
 *    frame still initializes AT its target — the hold only protects LIVE
 *    state.
 */
export const test_viewer_player_spring_hold = (): void => {
  // 1. mid-decay hold across repeated same-t updates
  const decayRecord: IAutoMoviePose[] = [];
  const decaying = new AutoMoviePlayer(
    createImportedModelObject({
      object: new THREE.Object3D(),
      afterAutoMovieFrame: ({ pose }) => decayRecord.push(pose),
    }),
    SKELETON,
    makeMotion(
      [
        keyframe(0, makePose([joint("hips", { flexion: 40 })])),
        keyframe(2, makePose([joint("hips", { flexion: 40 })])),
        keyframe(2.5, makePose([])),
        keyframe(6, makePose([])),
      ],
      6,
    ),
    undefined,
    false,
    { joints: ["hips"], stiffness: 100, damping: 5 },
  );
  for (let t = 0; t <= 2.7001; t += 1 / 30) decaying.update(t);
  const held = flexionOf(decayRecord[decayRecord.length - 1]!);
  if (held === null || Math.abs(held) < 0.1)
    throw new Error("fixture must be mid-decay with a live angle");
  decaying.update(2.7 + 1 / 30);
  decaying.update(2.7 + 1 / 30);
  decaying.update(2.7 + 1 / 30);
  const [frozen1, frozen2] = decayRecord.slice(-2).map(flexionOf);
  TestValidator.predicate(
    "repeated same-t updates hold the decayed angle without vanishing",
    frozen1 !== null && frozen2 !== null && frozen1 === frozen2,
  );
  decaying.update(2.7 + 2 / 30);
  const resumed = flexionOf(decayRecord[decayRecord.length - 1]!);
  TestValidator.predicate(
    "the next advancing frame continues the decay from the held state",
    resumed !== null && resumed !== 0 && resumed !== frozen1,
  );

  // 2. mid-lag hold: a paused frame must not pop to the target
  const lagRecord: IAutoMoviePose[] = [];
  const lagging = new AutoMoviePlayer(
    createImportedModelObject({
      object: new THREE.Object3D(),
      afterAutoMovieFrame: ({ pose }) => lagRecord.push(pose),
    }),
    SKELETON,
    makeMotion(
      [
        keyframe(0, makePose([joint("hips", { flexion: 0 })]), "step"),
        keyframe(1, makePose([joint("hips", { flexion: 40 })])),
      ],
      2,
    ),
    undefined,
    false,
    { joints: ["hips"], stiffness: 100, damping: 5 },
  );
  for (let t = 0; t <= 1.0001; t += 1 / 30) lagging.update(t);
  const lagged = flexionOf(lagRecord[lagRecord.length - 1]!);
  if (lagged === null || Math.abs(lagged - 40) < 1)
    throw new Error("fixture must still lag the stepped target");
  lagging.update(1.0001 + 1 / 30);
  const chased = flexionOf(lagRecord[lagRecord.length - 1]!);
  lagging.update(1.0001 + 1 / 30);
  const paused = flexionOf(lagRecord[lagRecord.length - 1]!);
  TestValidator.predicate(
    "a paused frame holds the lagged angle instead of popping to the target",
    chased !== null && paused === chased && paused !== 40,
  );

  // 3. negative twin: no live state → a dt=0 first frame seeds at the target
  const freshRecord: IAutoMoviePose[] = [];
  const fresh = new AutoMoviePlayer(
    createImportedModelObject({
      object: new THREE.Object3D(),
      afterAutoMovieFrame: ({ pose }) => freshRecord.push(pose),
    }),
    SKELETON,
    makeMotion(
      [
        keyframe(0, makePose([joint("hips", { flexion: 25 })])),
        keyframe(1, makePose([joint("hips", { flexion: 25 })])),
      ],
      1,
    ),
    undefined,
    false,
    { joints: ["hips"], stiffness: 100, damping: 5 },
  );
  fresh.update(0.5);
  TestValidator.equals(
    "a fresh joint's dt=0 first frame seeds at its target",
    flexionOf(freshRecord[0]!),
    25,
  );
};

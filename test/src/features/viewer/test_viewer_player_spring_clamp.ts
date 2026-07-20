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
  id: "spring-rig",
  bones: [
    {
      bone: "hips",
      parent: null,
      rest: IDENTITY_TRANSFORM,
      constraint: {
        flexion: { min: -40, max: 40 },
        abduction: null,
        twist: null,
      },
    },
  ],
};

/**
 * The player's secondary-motion springs run between sampling and rendering, and
 * `dampedSpring` OVERSHOOTS by design (ζ < 1). Clamping only before the springs
 * let the render exceed the ROM the `clampToRom` constructor promise guarantees:
 * stiffness 100 / damping 5 stepping toward a 40° cap peaked at ≈ 58°
 * (#1048). A joint vanishing from the sampled pose also hard-reset its spring,
 * popping follow-through to rest mid-swing.
 *
 * Scenarios:
 *
 * 1. A spring stepping toward a 40°-capped flexion never RENDERS past 40°, while
 *    still reaching the cap (the clamp engages; the spring is not simply
 *    critically damped).
 * 2. When the sampled pose stops authoring the joint entirely, its follow-through
 *    DECAYS smoothly toward neutral instead of vanishing: the joint is still
 *    driven on the first absent frame and settles near zero later.
 */
export const test_viewer_player_spring_clamp = (): void => {
  const record: IAutoMoviePose[] = [];

  // 1. render never exceeds the ROM cap
  const stepped = new AutoMoviePlayer(
    createImportedModelObject({
      object: new THREE.Object3D(),
      afterAutoMovieFrame: ({ pose }) => record.push(pose),
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
    true,
    { joints: ["hips"], stiffness: 100, damping: 5 },
  );
  for (let t = 0; t <= 3.0001; t += 1 / 30) stepped.update(t);
  const flexions = record.map(
    (pose) => pose.joints.find((j) => j.bone === "hips")?.flexion ?? 0,
  );
  const peak = Math.max(...flexions);
  TestValidator.predicate(
    "the rendered spring never exceeds the ROM cap yet reaches it",
    peak <= 40 + 1e-9 && peak >= 39.5,
  );

  // 2. follow-through decays instead of popping when the joint vanishes
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
  let firstAbsent: number | null = null;
  let settled: number | null = null;
  for (let t = 0; t <= 6.0001; t += 1 / 30) {
    decaying.update(t);
    const pose = decayRecord[decayRecord.length - 1]!;
    const flexion = pose.joints.find((j) => j.bone === "hips")?.flexion ?? null;
    if (t > 2.51 && firstAbsent === null) firstAbsent = flexion;
    if (t > 5.9) settled = flexion;
  }
  TestValidator.predicate(
    "vanished joints decay their follow-through smoothly to neutral",
    firstAbsent !== null &&
      Math.abs(firstAbsent) > 0.5 &&
      settled !== null &&
      Math.abs(settled) < 0.5,
  );
};

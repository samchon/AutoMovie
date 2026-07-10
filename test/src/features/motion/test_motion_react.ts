import { reactMotion } from "@automovie/engine";
import {
  IAutoMovieBone,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const rest: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
const bone = (
  name: IAutoMovieBone["bone"],
  constraint: IAutoMovieBone["constraint"],
): IAutoMovieBone => ({ bone: name, parent: null, rest, constraint });

const skeleton: IAutoMovieSkeleton = {
  id: "react-rig",
  bones: [
    bone("spine", {
      flexion: { min: -30, max: 40 },
      abduction: null,
      twist: null,
    }),
    bone("chest", null),
  ],
};

const sp = (p: { joints: { bone: string; flexion: number | null }[] }) =>
  p.joints.find((x) => x.bone === "spine")!;

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

/**
 * `reactMotion` — the harness `react` verb as a flinch clip: rest → ROM-clamped
 * recoil (`impactRecoil`) → rest.
 *
 * Scenarios:
 *
 * 1. Three keyframes at 0, peak, duration; the skeleton id is carried.
 * 2. The flinch keyframe is the ROM-clamped recoil (a −200° push at the spine
 *    clamps to its −30° minimum), and an unconstrained bone (chest) takes the
 *    full attenuated push (−200 × 0.6).
 * 3. The clip starts and ends at the neutral rest pose.
 * 4. Invalid explicit timing rejects: non-positive/NaN durations, and explicit
 *    peaks outside (0, duration).
 * 5. The DEFAULT peak scales to the duration: a 0.1 s quick flinch peaks at 0.04 s
 *    instead of rejecting outright, while a 0.5 s react keeps the exact 0.16 s
 *    snap (bit-identical to the old fixed default).
 */
export const test_motion_react = (): void => {
  const clip = reactMotion(
    "r",
    skeleton,
    { flexion: -200 },
    ["spine", "chest"],
    1.0,
    0.2,
  );

  // 1. shape
  TestValidator.equals("three keyframes", clip.keyframes.length, 3);
  TestValidator.predicate(
    "times 0, peak, duration",
    nclose(clip.keyframes[0]!.time, 0) &&
      nclose(clip.keyframes[1]!.time, 0.2) &&
      nclose(clip.keyframes[2]!.time, 1.0),
  );
  TestValidator.equals("skeleton id carried", clip.skeleton, "react-rig");

  // 2. flinch is ROM-clamped
  TestValidator.predicate(
    "spine flinch clamped to ROM min −30",
    nclose(sp(clip.keyframes[1]!.pose).flexion!, -30),
  );
  TestValidator.predicate(
    "unconstrained chest takes the full attenuated push",
    nclose(
      clip.keyframes[1]!.pose.joints.find((x) => x.bone === "chest")!.flexion!,
      -120,
    ),
  );

  // 3. starts and ends at rest
  TestValidator.predicate(
    "starts at rest",
    nclose(sp(clip.keyframes[0]!.pose).flexion!, 0),
  );
  TestValidator.predicate(
    "ends at rest",
    nclose(sp(clip.keyframes[2]!.pose).flexion!, 0),
  );
  // 4. invalid timing rejects before emitting non-increasing keyframes
  for (const duration of [Number.NaN, 0, -1])
    TestValidator.predicate(
      `rejects invalid duration ${duration}`,
      throws(() => {
        reactMotion(
          "badDuration",
          skeleton,
          { flexion: -10 },
          ["spine"],
          duration,
        );
      }),
    );

  for (const peak of [Number.NaN, 0, -0.1, 1])
    TestValidator.predicate(
      `rejects invalid peak ${peak}`,
      throws(() => {
        reactMotion("badPeak", skeleton, { flexion: -10 }, ["spine"], 1, peak);
      }),
    );

  // 5. the default peak scales to a quick flinch instead of rejecting it
  const quick = reactMotion(
    "short",
    skeleton,
    { flexion: -10 },
    ["spine"],
    0.1,
  );
  TestValidator.predicate(
    "a 0.1 s duration scales the default peak to 0.04",
    nclose(quick.keyframes[1]!.time, 0.04) && nclose(quick.duration, 0.1),
  );
  const long = reactMotion("long", skeleton, { flexion: -10 }, ["spine"], 0.5);
  TestValidator.predicate(
    "durations ≥ 0.4 s keep the exact 0.16 s default peak",
    nclose(long.keyframes[1]!.time, 0.16),
  );
};

import { sampleMotion } from "@automovie/engine";
import { IAutoMovieKeyframe } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { joint, keyframe, makeMotion, makePose } from "../internal/fixtures";
import { nclose } from "../internal/predicates";

/**
 * The pose sampler now binary-searches the enclosing keyframe segment instead
 * of scanning front to back: the O(N·F) → O(F·log N) fix for hours-long clips.
 * A closed-form ramp gives an exact oracle at every point of a large clip: with
 * flexion(i) = i° and root.x = i at time i·dt (all linear easing), a linear
 * blend makes the sampled value exactly time/dt everywhere, so the binary
 * search must land on the right segment across the whole 240-key array.
 *
 * Scenarios:
 *
 * 1. Dense sweep (segment midpoints, exact interior keys, off-grid points) → the
 *    sampled flexion and root.x equal time/dt to 1e-9.
 * 2. Exact keyframe times return that keyframe's value verbatim (the endpoint tie
 *    the binary search preserves).
 * 3. The clamped ends still hold the first/last key.
 */

const DT = 0.1;
const N = 240;

const rampClip = () => {
  const frames: IAutoMovieKeyframe[] = [];
  for (let i = 0; i < N; ++i)
    frames.push(
      keyframe(
        i * DT,
        makePose([joint("leftLowerArm", { flexion: i })], {
          translation: { x: i, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        }),
      ),
    );
  return makeMotion(frames, (N - 1) * DT);
};

const flexionAt = (t: number): number => {
  const j = sampleMotion(rampClip(), t).pose.joints.find(
    (x) => x.bone === "leftLowerArm",
  );
  if (j === undefined) throw new Error("leftLowerArm missing");
  return j.flexion ?? NaN;
};

const rootXAt = (t: number): number =>
  sampleMotion(rampClip(), t).pose.root?.translation.x ?? NaN;

export const test_motion_sample_binary_search = (): void => {
  const last = (N - 1) * DT;

  // Dense interior sweep: midpoints, exact interior keys, and off-grid points.
  const queries: number[] = [];
  for (let i = 0; i < N - 1; ++i) queries.push((i + 0.5) * DT); // midpoints
  for (let i = 1; i < N - 1; ++i) queries.push(i * DT); // interior keys
  queries.push(last * 0.137, last * 0.611, last * 0.909); // off-grid

  for (const t of queries) {
    TestValidator.predicate(
      `flexion ramp is exact at t=${t.toFixed(4)}`,
      nclose(flexionAt(t), t / DT, 1e-9),
    );
    TestValidator.predicate(
      `root.x ramp is exact at t=${t.toFixed(4)}`,
      nclose(rootXAt(t), t / DT, 1e-9),
    );
  }

  // Endpoint tie: an exact interior key returns that key's value verbatim.
  TestValidator.equals("exact key 137 returns 137", flexionAt(137 * DT), 137);
  TestValidator.equals("exact key 200 returns 200", flexionAt(200 * DT), 200);

  // Clamped ends hold the first / last key.
  TestValidator.equals("clamp before start holds key 0", flexionAt(-1), 0);
  TestValidator.equals(
    "clamp past end holds last key",
    flexionAt(last + 5),
    N - 1,
  );
};

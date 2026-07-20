import {
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { bakeTimes, clipWorldParity } from "../internal/clipParity";
import {
  createSkeleton,
  joint,
  keyframe,
  makeMotion,
  makePose,
} from "../internal/fixtures";

/**
 * The S1 parity proof: `motionToClip` lowers a humanoid motion onto the general
 * node/clip model such that the general pipeline (`resolveFrame` = sampleClip →
 * composeScene) reproduces humanoid FK (`resolvePose` ∘ `sampleMotion`): the
 * fact that makes "the two motion models are the same thing" provable. At bake
 * sample times the two agree to float precision (both sides sample the same
 * clinical pose); between samples the piecewise-linear bake diverges from the
 * eased curve by O(step²); for this 24 Hz, ≤120°/s, eased test motion the
 * measured mid-sample maxima are ≈3.5e-3 m / ≈9.3e-6 quaternion deviation
 * (worst near the bezier knee where the easing curvature peaks), asserted with
 * ~2-4× headroom.
 *
 * Scenarios:
 *
 * 1. A nontrivial non-looping motion (multi-joint (shoulder two-axis, elbow, hips
 *    twist), easeInOut and cubicBezier segments, an animated root) holds
 *    world-transform parity on every bone at every baked sample time (1e-6).
 * 2. Between samples (segment midpoints) the divergence stays bounded: positions
 *    within 8e-3 m, rotations within qclose 4e-5.
 * 3. A bone rest scale ≠ 1 does not break parity: `resolvePose` ignores rest
 *    scale, and the lowered nodes pin scale to 1 to mirror it.
 */
export const test_motion_to_clip_parity = (): void => {
  const skeleton = createSkeleton();
  const motion = paradeMotion();
  const times = bakeTimes(motion.duration);

  TestValidator.predicate(
    "parity at every baked sample time",
    clipWorldParity({ motion, skeleton, times }),
  );

  const midpoints = times.slice(0, -1).map((t, i) => (t + times[i + 1]!) / 2);
  TestValidator.predicate(
    "bounded divergence between samples",
    clipWorldParity({
      motion,
      skeleton,
      times: midpoints,
      posEps: 8e-3,
      rotEps: 4e-5,
    }),
  );

  const scaled: IAutoMovieSkeleton = {
    id: skeleton.id,
    bones: skeleton.bones.map((bone) =>
      bone.bone === "leftLowerArm"
        ? { ...bone, rest: { ...bone.rest, scale: { x: 2, y: 2, z: 2 } } }
        : bone,
    ),
  };
  TestValidator.predicate(
    "rest scale ignored on both sides",
    clipWorldParity({ motion, skeleton: scaled, times }),
  );
};

/** Multi-joint, multi-easing, root-animated 1 s clip. */
const paradeMotion = (): IAutoMovieMotion => {
  const root0 = {
    translation: { x: 0, y: 1, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  };
  const root1 = {
    translation: { x: 0.4, y: 1, z: 0.2 },
    rotation: {
      x: 0,
      y: Math.sin(Math.PI / 8),
      z: 0,
      w: Math.cos(Math.PI / 8),
    },
    scale: { x: 1, y: 1, z: 1 },
  };
  const bezier: IAutoMovieKeyframe = {
    time: 0.5,
    pose: makePose(
      [
        joint("leftUpperArm", { flexion: 60, abduction: 25 }),
        joint("leftLowerArm", { flexion: 70 }),
        joint("hips", { twist: 10 }),
      ],
      root1,
    ),
    expression: null,
    easing: "cubicBezier",
    bezier: [0.42, 0, 0.58, 1],
  };
  return makeMotion(
    [
      keyframe(
        0,
        makePose(
          [
            joint("leftUpperArm", { flexion: 20, abduction: 5 }),
            joint("leftLowerArm", { flexion: 10 }),
            joint("hips", { twist: -10 }),
          ],
          root0,
        ),
        "easeInOut",
      ),
      bezier,
      keyframe(
        1,
        makePose(
          [
            joint("leftUpperArm", { flexion: 90, abduction: 45 }),
            joint("leftLowerArm", { flexion: 120 }),
            joint("hips", { twist: 20 }),
          ],
          root0,
        ),
      ),
    ],
    1,
  );
};

import { retargetHumanoidMotion } from "@automovie/engine";
import type {
  IAutoMovieJointConstraint,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasViolation } from "../internal/predicates";

const range = (max: number): IAutoMovieJointConstraint => ({
  flexion: { min: -max, max },
  abduction: { min: -180, max: 180 },
  twist: { min: -180, max: 180 },
});

const skeleton = (id: string, flexionMax: number): IAutoMovieSkeleton => ({
  id,
  bones: [
    {
      bone: "hips",
      parent: null,
      rest: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      constraint: null,
    },
    {
      bone: "leftUpperArm",
      parent: "hips",
      rest: {
        translation: { x: 0, y: 1, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      constraint: range(flexionMax),
    },
  ],
});

const motion = (flexion: number, times = [0, 1]): IAutoMovieMotion => ({
  id: "source-motion",
  skeleton: "source-rig",
  duration: 1,
  loop: false,
  keyframes: times.map((time) => ({
    time,
    pose: {
      skeleton: "source-rig",
      root: null,
      joints: [{ bone: "leftUpperArm", flexion, abduction: 0, twist: 0 }],
    },
    expression: null,
    easing: "linear",
    bezier: null,
  })),
  gaitCycle: null,
});

/**
 * Retargeting admits only motion already valid in its declared source rig.
 *
 * Scenarios:
 *
 * 1. A source-valid clip reaches target conversion unchanged apart from target
 *    identity.
 * 2. A pose accepted by the target's wider ROM is still refused when it exceeds
 *    the source rig's authored ROM.
 * 3. A clip with a reversed source clock is refused at its source-motion path
 *    before conversion can relabel it as target motion.
 */
export const test_engine_retarget_source_validation = (): void => {
  const source = skeleton("source-rig", 30);
  const target = skeleton("target-rig", 180);

  const accepted = retargetHumanoidMotion({
    motion: motion(20),
    source,
    target,
    contacts: { enabled: false },
  });
  TestValidator.equals(
    "source-valid motion reaches target conversion",
    {
      validation: accepted.validation,
      target: accepted.motion?.skeleton,
    },
    { validation: { success: true }, target: "target-rig" },
  );

  const sourceRomFailure = retargetHumanoidMotion({
    motion: motion(60),
    source,
    target,
    contacts: { enabled: false },
  });
  TestValidator.equals(
    "source ROM failure is not laundered through a wider target ROM",
    {
      refused: sourceRomFailure.motion === null,
      located: hasViolation(
        sourceRomFailure.validation,
        "rom",
        "$input.motion.keyframes[0].pose.joints[0].flexion",
      ),
    },
    { refused: true, located: true },
  );

  const sourceClockFailure = retargetHumanoidMotion({
    motion: motion(20, [0.75, 0.5]),
    source,
    target,
    contacts: { enabled: false },
  });
  TestValidator.equals(
    "source temporal failure remains located on the source clip",
    {
      refused: sourceClockFailure.motion === null,
      located: hasViolation(
        sourceClockFailure.validation,
        "temporal",
        "$input.motion.keyframes[1].time",
      ),
    },
    { refused: true, located: true },
  );
};

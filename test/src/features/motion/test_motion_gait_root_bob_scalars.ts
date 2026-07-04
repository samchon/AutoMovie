import { gaitMotion } from "@automovie/engine";
import { IAutoMovieGait, IAutoMovieGaitRootBob } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

const gait = (rootBob: IAutoMovieGaitRootBob): IAutoMovieGait => ({
  name: "bob",
  period: 1,
  rootBob,
  limbs: [{ bone: "leftUpperLeg", phase: 0, duty: 0.5, amplitude: 30 }],
});

/**
 * `gaitMotion` root bob writes a root translation from `center + amplitude *
 * sin(...)`. Invalid root-bob scalars must fail before generated clips can
 * carry non-finite root transforms.
 *
 * Scenarios:
 *
 * 1. Non-finite root-bob amplitude, phase, and center values throw.
 * 2. Zero amplitude remains valid and emits a constant vertical root offset.
 */
export const test_motion_gait_root_bob_scalars = (): void => {
  const base: IAutoMovieGaitRootBob = {
    amplitude: 0.1,
    phase: 0,
    center: 1,
  };
  const invalids: [string, IAutoMovieGaitRootBob][] = [
    ["nan amplitude", { ...base, amplitude: Number.NaN }],
    ["nan phase", { ...base, phase: Number.NaN }],
    ["infinite center", { ...base, center: Infinity }],
  ];

  for (const [label, rootBob] of invalids)
    TestValidator.predicate(
      `${label} throws`,
      throws(() => {
        gaitMotion("invalid", "sk", gait(rootBob), 2);
      }),
    );

  const constant = gaitMotion(
    "constant",
    "sk",
    gait({ amplitude: 0, phase: 0.75, center: 1.2 }),
    2,
  );
  TestValidator.predicate(
    "zero amplitude keeps root bob finite and constant",
    constant.keyframes.every((k) => nclose(k.pose.root!.translation.y, 1.2)),
  );
};

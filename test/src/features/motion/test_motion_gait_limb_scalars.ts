import { gaitLimbFlexion } from "@automovie/engine";
import { IAutoMovieGaitLimb } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

const limb: IAutoMovieGaitLimb = {
  bone: "leftUpperLeg",
  phase: 0,
  duty: 0.5,
  amplitude: 30,
};

/**
 * `gaitLimbFlexion` is the public scalar kernel behind gait synthesis. Invalid
 * scalar inputs must fail before modulo/division/easing math can produce
 * non-finite joint values.
 *
 * Scenarios:
 *
 * 1. Invalid period, phase, duty, amplitude, and neutral values throw.
 * 2. Boundary-adjacent duty values inside `(0, 1)` remain valid.
 */
export const test_motion_gait_limb_scalars = (): void => {
  const invalids: [string, IAutoMovieGaitLimb, number][] = [
    ["nan period", limb, Number.NaN],
    ["zero period", limb, 0],
    ["nan phase", { ...limb, phase: Number.NaN }, 1],
    ["nan duty", { ...limb, duty: Number.NaN }, 1],
    ["zero duty", { ...limb, duty: 0 }, 1],
    ["one duty", { ...limb, duty: 1 }, 1],
    ["nan amplitude", { ...limb, amplitude: Number.NaN }, 1],
    ["nan neutral", { ...limb, neutral: Number.NaN }, 1],
  ];

  for (const [label, candidate, period] of invalids)
    TestValidator.predicate(
      `${label} throws`,
      throws(() => {
        gaitLimbFlexion(candidate, 0.25, period);
      }),
    );

  for (const duty of [0.01, 0.99])
    TestValidator.predicate(
      `duty ${duty} remains finite`,
      Number.isFinite(gaitLimbFlexion({ ...limb, duty }, 0.25, 1)),
    );
};

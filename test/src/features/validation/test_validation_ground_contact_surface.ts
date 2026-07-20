import { validateGroundContact } from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { hasWarning } from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

const skeleton: IAutoMovieSkeleton = {
  id: "walker",
  bones: [
    { bone: "hips", parent: null, rest: t(0, 0, 0), constraint: null },
    { bone: "leftFoot", parent: "hips", rest: t(0, 0, 0), constraint: null },
  ],
};

/** Root slides x 0 → 1 over one second at a constant height. */
const slide = (footY: number): IAutoMovieMotion => ({
  id: "slide",
  skeleton: "walker",
  duration: 1,
  loop: false,
  keyframes: [0, 1].map((time) => ({
    time,
    pose: {
      skeleton: "walker",
      root: t(time, footY, 0),
      joints: [],
    },
    expression: null,
    easing: "linear" as const,
    bezier: null,
  })),
});

/** Ground rises with x: h(x) = 0.5·x. */
const rising = (x: number): number => 0.5 * x;

/**
 * `validateGroundContact` now judges each foot against the ground height _at
 * that foot's plan position_, so a clip that clears a flat plane can still sink
 * into a rising slope, and a scalar ground stays byte-compatible with the
 * pre-space behavior.
 *
 * Scenarios:
 *
 * 1. A foot gliding at y=0.1 over ground h(x)=0.5x sinks once 0.5x exceeds 0.1: a
 *    `physics` WARNING (D015: advice, not a gate) on the foot's world y, with
 *    the local ground height in play (overshoot 0.4 at the end); the run
 *    succeeds.
 * 2. The same clip lifted to y=0.6 clears the slope everywhere: no warning (the
 *    negative twin).
 * 3. A constant callback `() => 0` matches the scalar `groundY: 0` verdict on the
 *    same clip: the widened parameter did not change the scalar path.
 */
export const test_validation_ground_contact_surface = (): void => {
  const sunk = validateGroundContact({
    motion: slide(0.1),
    skeleton,
    footBones: ["leftFoot"],
    groundY: rising,
  });
  TestValidator.equals(
    "slope sinks the low glide (succeeds)",
    sunk.success,
    true,
  );
  TestValidator.predicate(
    "warning names the foot's world y",
    hasWarning(sunk, "physics", ".leftFoot.worldPosition.y"),
  );

  TestValidator.equals(
    "high glide clears the slope",
    validateGroundContact({
      motion: slide(0.6),
      skeleton,
      footBones: ["leftFoot"],
      groundY: rising,
    }).success,
    true,
  );

  const scalar = validateGroundContact({
    motion: slide(0.1),
    skeleton,
    footBones: ["leftFoot"],
    groundY: 0,
  });
  const constant = validateGroundContact({
    motion: slide(0.1),
    skeleton,
    footBones: ["leftFoot"],
    groundY: () => 0,
  });
  TestValidator.equals("scalar passes the flat clip", scalar.success, true);
  TestValidator.equals(
    "constant callback matches the scalar verdict",
    constant.success,
    scalar.success,
  );
};

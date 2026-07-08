import {
  followPathMotion,
  plantStanceFeet,
  resolvePose,
  sampleMotion,
  validateFootSkate,
  validateGroundContact,
} from "@automovie/engine";
import {
  IAutoMovieJointPose,
  IAutoMovieKeyframe,
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

// The plant-feet suite's bent-rest leg: hip 0.8 up over an ~0.85 leg, so the
// horizontal reach shell is ~0.29 m — every pin-to-hip distance below stays
// well inside it.
const legSkeleton: IAutoMovieSkeleton = {
  id: "leg",
  bones: [
    { bone: "hips", parent: null, rest: t(0, 0.8, 0), constraint: null },
    {
      bone: "leftUpperLeg",
      parent: "hips",
      rest: t(0.1, 0, 0),
      constraint: null,
    },
    {
      bone: "leftLowerLeg",
      parent: "leftUpperLeg",
      rest: t(0, -0.4, 0.15),
      constraint: null,
    },
    {
      bone: "leftFoot",
      parent: "leftLowerLeg",
      rest: t(0, -0.4, -0.15),
      constraint: null,
    },
  ],
};

// Beside the driving thigh, a zero-articulation shin and foot ride along:
// numerically identity (the toe track is untouched), but the planting
// re-solve's leg-strip filters now see non-thigh joints — the shin is stripped
// with the thigh, the foot is carried through — instead of only ever matching
// the first `bone !== upper` test.
const flex = (deg: number): IAutoMovieJointPose[] => [
  { bone: "leftUpperLeg", flexion: deg, abduction: null, twist: null },
  { bone: "leftLowerLeg", flexion: 0, abduction: null, twist: null },
  { bone: "leftFoot", flexion: 0, abduction: null, twist: null },
];

const kf = (time: number, deg: number): IAutoMovieKeyframe => ({
  time,
  pose: { skeleton: "leg", root: null, joints: flex(deg) },
  expression: null,
  easing: "linear",
  bezier: null,
});

/**
 * A 1 s lifting cycle: the foot stands until t=0.4, the thigh flexes to 20° by
 * t=0.5 (raising the foot 0.8·(1−cos 20°) ≈ 0.048 m) and lands again by t=0.6.
 * With the 0.005 m stance tolerance the 24 Hz plant clock keeps the t = 10/24
 * and 14/24 samples in stance (flexion 3.33°, lift ≈ 0.0014 m) and marks {11,
 * 12, 13}/24 as swing — so each cycle's stance run starts and ends at a mere
 * 3.33° of residual flexion, keeping the run-start pin close to the hip track
 * (the residual swings the foot only ~0.047 m locally; a larger tolerance pins
 * at 11.67° ≈ 0.16 m of swing offset, which the yaw blend then drags past the
 * ~0.29 m reach shell — the documented unreachable-pin extension, not a
 * planting defect, as the diagnosis for this test showed).
 */
const liftGait: IAutoMovieMotion = {
  id: "lift",
  skeleton: "leg",
  duration: 1,
  loop: true,
  keyframes: [kf(0, 0), kf(0.4, 0), kf(0.5, 20), kf(0.6, 0), kf(1, 0)],
};

const LEG = {
  foot: "leftFoot",
  upper: "leftUpperLeg",
  lower: "leftLowerLeg",
} as const;

// Stance runs land at R1 = [0, 10/24], R2 = [14/24, 1+10/24] (straddling the
// t=1 apex), R3 = [1+14/24, 2]; the declared windows sit safely inside them.
const contacts = [
  { bone: "leftFoot", start: 0.05, end: 0.38 },
  { bone: "leftFoot", start: 0.62, end: 1.38 },
  { bone: "leftFoot", start: 1.62, end: 1.95 },
] as const;

const footAt = (motion: IAutoMovieMotion, time: number) =>
  resolvePose(sampleMotion(motion, time).pose, legSkeleton).find(
    (b) => b.bone === "leftFoot",
  )!.worldPosition;

const plantAndAssert = (turnWindow: number, label: string): void => {
  const path = followPathMotion({
    id: `corner-${label}`,
    gait: liftGait,
    waypoints: [
      { x: 0, y: 0, z: 0 },
      { x: 0.12, y: 0, z: 0 },
      { x: 0.12, y: 0, z: 0.12 },
    ],
    speed: 0.12,
    turnWindow,
  });
  TestValidator.equals(`${label}: two cycles sized`, path.cycles, 2);

  TestValidator.equals(
    `${label}: raw corner bake skates the foot`,
    validateFootSkate({
      motion: path.motion,
      skeleton: legSkeleton,
      contacts,
    }).success,
    false,
  );

  const planted = plantStanceFeet({
    skeleton: legSkeleton,
    motion: path.motion,
    groundY: 0,
    tolerance: 0.005,
    legs: [LEG],
    sampleRate: 24,
  });

  TestValidator.equals(
    `${label}: planted corner walk passes foot-skate`,
    validateFootSkate({
      motion: planted.motion,
      skeleton: legSkeleton,
      contacts,
    }).success,
    true,
  );
  TestValidator.equals(
    `${label}: planted corner walk passes ground contact`,
    validateGroundContact({
      motion: planted.motion,
      skeleton: legSkeleton,
      footBones: ["leftFoot"],
      groundY: 0,
      tolerance: 1e-3,
    }).success,
    true,
  );

  TestValidator.equals(
    `${label}: stance runs before/straddling/after the apex`,
    planted.plants.length,
    3,
  );
  const straddle = planted.plants[1]!;
  TestValidator.predicate(
    `${label}: the middle run straddles the corner at t=1`,
    straddle.start < 1 && straddle.end > 1,
  );

  for (const run of planted.plants) {
    const pin = footAt(planted.motion, run.start);
    for (const time of [
      run.start,
      (run.start + run.end) / 2,
      1.0,
      run.end,
    ].filter((s) => s >= run.start && s <= run.end)) {
      const p = footAt(planted.motion, time);
      TestValidator.predicate(
        `${label}: foot XZ pinned through t=${time.toFixed(3)}`,
        nclose(p.x, pin.x, 1e-4) &&
          nclose(p.z, pin.z, 1e-4) &&
          nclose(p.y, 0, 1e-4),
      );
    }
  }

  TestValidator.predicate(
    `${label}: stride clock survives the corner`,
    path.motion.gaitCycle !== undefined &&
      path.motion.gaitCycle !== null &&
      nclose(path.motion.gaitCycle.period, 1) &&
      nclose(path.motion.gaitCycle.phaseAt, 0),
  );
};

/**
 * The ground-IK pass holds through a corner: on an L-path the yaw blend (and
 * the harsher snap) rotates the pelvis over a planted foot, and the pinned
 * stance must survive it — the curved-walking case #599 exists for, which the
 * straight-line composition proof never exercised.
 *
 * Path arithmetic: legs 0.12 m + 0.12 m at speed 0.12 m/s → 2 whole 1 s cycles
 * (duration 2 s), the corner apex at s = 0.12 → t = 1.0 — dead centre of the
 * middle stance run R2 = [14/24, 1+10/24] the lifting gait produces (see
 * {@link liftGait}). The default turn window caps at half of each 0.12 m
 * stretch, blending yaw across s ∈ [0.06, 0.18] → t ∈ [0.5, 1.5]: the ENTIRE
 * straddling stance run rotates. With the 3.33° run-boundary residual the worst
 * pin-to-upper-joint distance is ≈ 0.231 m, inside the leg's ~0.298 m reach
 * shell with a 22% margin (the prior fixture lesson, re-derived through the
 * yaw-rotated hip offset — see {@link liftGait}'s note).
 *
 * Scenarios (each run for the blend window AND the snap corner, turnWindow 0 —
 * the harsher discontinuity):
 *
 * 1. The raw corner bake fails validateFootSkate in the declared stance windows
 *    (the root drags the foot at 0.12 m/s).
 * 2. PlantStanceFeet over the corner bake passes BOTH validateFootSkate and
 *    validateGroundContact — pinning holds under the rotating pelvis.
 * 3. Exactly three stance runs land — before, straddling, and after the apex — and
 *    the middle run brackets t = 1.0 (the straddle fact).
 * 4. Each run's foot world XZ is numerically constant from run start through the
 *    apex to run end (the anti-skate property, through the turn).
 * 5. The composite's gaitCycle meta ({period: 1, phaseAt: 0}) survives the bake —
 *    the stride clock never resets across the corner (#650/#597).
 */
export const test_motion_path_plant_feet_corner = (): void => {
  plantAndAssert(0.5, "blend");
  plantAndAssert(0, "snap");

  // Scenario 6 — the diagnosed failure mode, pinned as fact: with a LOOSE
  // stance tolerance (0.02 m) the run starts at 11.67° of flexion, throwing
  // the pin ~0.16 m behind the yaw-rotated hip; the blend then drags the
  // upper joint past the ~0.298 m reach shell, and the pass extends the leg
  // toward the unreachable pin instead of holding it — so the planted clip
  // honestly FAILS foot-skate (the documented unreachable-pin semantics, the
  // exact trap this test's arithmetic avoids above).
  const loose = followPathMotion({
    id: "corner-loose",
    gait: liftGait,
    waypoints: [
      { x: 0, y: 0, z: 0 },
      { x: 0.12, y: 0, z: 0 },
      { x: 0.12, y: 0, z: 0.12 },
    ],
    speed: 0.12,
    turnWindow: 0.5,
  });
  const overReached = plantStanceFeet({
    skeleton: legSkeleton,
    motion: loose.motion,
    groundY: 0,
    tolerance: 0.02,
    legs: [LEG],
    sampleRate: 24,
  });
  TestValidator.equals(
    "loose tolerance over-reaches through the corner and skates",
    validateFootSkate({
      motion: overReached.motion,
      skeleton: legSkeleton,
      contacts,
    }).success,
    false,
  );
};

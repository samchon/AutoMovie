import {
  plantStanceFeet,
  resolvePose,
  sampleMotion,
  validateFootSkate,
  validateGroundContact,
  validateMotion,
} from "@automovie/engine";
import {
  IAutoMovieMotion,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  namedFacts,
  nclose,
  validationHasNoWarnings,
  validationHasWarnings,
} from "../internal/predicates";

const t = (x: number, y: number, z: number): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

// A bent-rest leg: foot at the ground (y=0) with the hip only 0.8 up over a
// 0.85 leg, so the leg has horizontal reach slack to plant while the hip
// travels. Its mirrored knee axis and non-zero clinical rest flexion make this
// the public ground-pass oracle for both optional rig mappings.
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

// The whole body (and the planted foot) slides +x: a baked gait skating.
const skating: IAutoMovieMotion = {
  id: "skate",
  skeleton: "leg",
  duration: 1,
  loop: false,
  keyframes: [
    {
      time: 0,
      pose: { skeleton: "leg", root: t(0, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
    {
      time: 1,
      pose: { skeleton: "leg", root: t(0.2, 0, 0), joints: [] },
      expression: null,
      easing: "linear",
      bezier: null,
    },
  ],
};

const LEG = {
  foot: "leftFoot",
  upper: "leftUpperLeg",
  lower: "leftLowerLeg",
} as const;
const KNEE_REST_FLEXION = (2 * Math.atan2(0.15, 0.4) * 180) / Math.PI;
const JOINT_AXES = {
  leftLowerLeg: {
    flexion: { x: -1, y: 0, z: 0 },
    abduction: { x: 0, y: 0, z: 1 },
    twist: { x: 0, y: -1, z: 0 },
  },
};
const REST_FRAMES = {
  leftLowerLeg: {
    flexion: { sign: -1 as const, neutral: KNEE_REST_FLEXION },
  },
};

const footAt = (motion: IAutoMovieMotion, time: number) =>
  resolvePose(
    sampleMotion(motion, time).pose,
    legSkeleton,
    JOINT_AXES,
    REST_FRAMES,
  ).find((b) => b.bone === "leftFoot")!.worldPosition;

/**
 * The ground-IK pass plants a stance foot: sampled across its stance run the
 * foot's world XZ is held constant, so a baked gait that skated the foot now
 * passes the very foot-skate and ground-contact validators it failed.
 *
 * Scenarios:
 *
 * 1. The raw skating clip warns from validateFootSkate (foot slides 0.2 m/s, a
 *    D015 plausibility warning, the run still succeeds).
 * 2. The foot-corrected clip produces no such warning over the same window.
 * 3. The corrected clip passes validateGroundContact (foot held at the plane).
 * 4. The planted foot's world XZ is constant across the run (the anti-skate
 *    property, numeric) and pinned to the stance-start contact.
 * 5. One stance run is reported for the whole clip, pinned at y = groundY.
 * 6. The mirrored knee axis and 41.1-degree clinical rest frame survive the whole
 *    plant/playback/validation path: every derived joint stays inside effective
 *    ROM and the dense correction remains temporally coherent.
 */
export const test_motion_plant_feet = (): void => {
  const contacts = [{ bone: "leftFoot", start: 0, end: 1 } as const];

  const raw = validateFootSkate({
    motion: skating,
    skeleton: legSkeleton,
    contacts,
    jointAxes: JOINT_AXES,
    restFrames: REST_FRAMES,
  });
  TestValidator.predicate(
    "raw gait skates the foot (warns)",
    validationHasWarnings("raw skating gait", raw),
  );

  const planted = plantStanceFeet({
    skeleton: legSkeleton,
    motion: skating,
    groundY: 0,
    tolerance: 0.02,
    legs: [LEG],
    sampleRate: 24,
    jointAxes: JOINT_AXES,
    restFrames: REST_FRAMES,
  });

  TestValidator.predicate(
    "corrected clip has no foot-skate warning",
    validationHasNoWarnings(
      "corrected clip foot-skate",
      validateFootSkate({
        motion: planted.motion,
        skeleton: legSkeleton,
        contacts,
        jointAxes: JOINT_AXES,
        restFrames: REST_FRAMES,
      }),
    ),
  );
  TestValidator.predicate(
    "corrected clip has no ground-contact warning",
    validationHasNoWarnings(
      "corrected clip ground-contact",
      validateGroundContact({
        motion: planted.motion,
        skeleton: legSkeleton,
        footBones: ["leftFoot"],
        groundY: 0,
        tolerance: 1e-3,
        jointAxes: JOINT_AXES,
        restFrames: REST_FRAMES,
      }),
    ),
  );

  const start = footAt(planted.motion, 0);
  for (const time of [0, 0.25, 0.5, 0.75, 1])
    TestValidator.predicate(
      `foot XZ pinned at t=${time}`,
      (() => {
        const p = footAt(planted.motion, time);
        return (
          nclose(p.x, 0.1, 1e-4) && nclose(p.z, 0, 1e-4) && nclose(p.y, 0, 1e-4)
        );
      })(),
    );
  TestValidator.predicate(
    "pin equals stance-start contact",
    nclose(start.x, 0.1, 1e-4),
  );

  TestValidator.equals("one stance run", planted.plants.length, 1);
  TestValidator.equals(
    "run spans the clip pinned to ground",
    namedFacts([
      ["plantedPlantsFoot", () => planted.plants[0]!.foot === "leftFoot"],
      ["nclosePlantedPlants", () => nclose(planted.plants[0]!.start, 0)],
      ["nclosePlantedPlants2", () => nclose(planted.plants[0]!.end, 1)],
      ["nclosePlantedPlants3", () => nclose(planted.plants[0]!.position.y, 0)],
    ]),
    {
      plantedPlantsFoot: true,
      nclosePlantedPlants: true,
      nclosePlantedPlants2: true,
      nclosePlantedPlants3: true,
    },
  );
  TestValidator.equals(
    "ground IK stays inside ROM without temporal branch jumps",
    validateMotion({ motion: planted.motion, skeleton: legSkeleton }),
    { success: true },
  );
};

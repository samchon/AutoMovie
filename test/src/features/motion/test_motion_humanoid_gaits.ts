import { HUMANOID_GAITS, gaitMotion, validateMotion } from "@automovie/engine";
import {
  automovieHumanoidBone,
  IautomovieBone,
  IautomovieSkeleton,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const bone = (b: automovieHumanoidBone): IautomovieBone => ({
  bone: b,
  parent: null,
  rest: {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  },
  constraint: null,
});

// A rig carrying exactly the bones the gaits drive, all with null constraints
// so validateMotion falls back to the engine's default humanoid ROM table.
const RIG: IautomovieSkeleton = {
  id: "humanoid",
  bones: [
    "hips",
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerLeg",
    "rightLowerLeg",
    "leftUpperArm",
    "rightUpperArm",
  ].map((b) => bone(b as automovieHumanoidBone)),
};

const NAMES = ["walk", "run", "sprint", "sneak", "march"] as const;

const ampOf = (
  gait: (typeof HUMANOID_GAITS)[keyof typeof HUMANOID_GAITS],
  b: automovieHumanoidBone,
) => gait.limbs.find((l) => l.bone === b)!.amplitude;

/**
 * The canonical humanoid gait library ??`locomote`'s whole `gait` enum as ready
 * data. The point of the library (and of the `neutral` field it leans on):
 * every gait must sit inside the humanoid ROM, so a host can drop any of the
 * five into an actor context and the compiled clip validates without
 * hand-tuning.
 *
 * Scenarios:
 *
 * 1. All five gaits are present under their enum names, each stamping its own
 *    name.
 * 2. Each gait, synthesised densely (24 samples) and validated against the
 *    default-ROM humanoid rig, passes ??knees never hyperextend, fast-gait hips
 *    never cross the ??0째 floor. This is the whole reason `neutral` is tuned
 *    per gait.
 * 3. The gaits are ordered by energy where it should show: sprint's hip swing
 *    exceeds run's exceeds walk's; sprint bends the knee hardest of the five;
 *    sneak is the slowest (longest period) and quietest-armed.
 */
export const test_motion_humanoid_gaits = (): void => {
  TestValidator.equals(
    "all five gaits present",
    Object.keys(HUMANOID_GAITS).sort((a, b) => a.localeCompare(b)),
    [...NAMES].sort((a, b) => a.localeCompare(b)),
  );
  for (const name of NAMES)
    TestValidator.equals(
      `${name} stamps its name`,
      HUMANOID_GAITS[name].name,
      name,
    );

  for (const name of NAMES) {
    const clip = gaitMotion(name, RIG.id, HUMANOID_GAITS[name], 24);
    TestValidator.equals(
      `${name} stays inside ROM`,
      validateMotion({ motion: clip, skeleton: RIG }).success,
      true,
    );
  }

  const hip: automovieHumanoidBone = "leftUpperLeg";
  const knee: automovieHumanoidBone = "leftLowerLeg";
  const arm: automovieHumanoidBone = "leftUpperArm";
  TestValidator.predicate(
    "hip swing grows walk < run < sprint",
    ampOf(HUMANOID_GAITS.walk, hip) < ampOf(HUMANOID_GAITS.run, hip) &&
      ampOf(HUMANOID_GAITS.run, hip) < ampOf(HUMANOID_GAITS.sprint, hip),
  );
  TestValidator.predicate(
    "sprint bends the knee hardest of the five",
    NAMES.filter((n) => n !== "sprint").every(
      (n) =>
        ampOf(HUMANOID_GAITS[n], knee) < ampOf(HUMANOID_GAITS.sprint, knee),
    ),
  );
  TestValidator.predicate(
    "sneak is the slowest and quietest-armed",
    NAMES.filter((n) => n !== "sneak").every(
      (n) => HUMANOID_GAITS.sneak.period > HUMANOID_GAITS[n].period,
    ) &&
      NAMES.filter((n) => n !== "sneak").every(
        (n) => ampOf(HUMANOID_GAITS.sneak, arm) < ampOf(HUMANOID_GAITS[n], arm),
      ),
  );
};

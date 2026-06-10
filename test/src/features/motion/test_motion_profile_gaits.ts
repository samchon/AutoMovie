import { bindProfileGaits } from "@autofilm/engine";
import { IAutoFilmProfile } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const horse: IAutoFilmProfile = {
  id: "equine",
  name: "horse",
  controls: [],
  drivers: [],
  limits: [],
  gaits: [
    {
      name: "walk",
      period: 1,
      limbs: [{ bone: "leftUpperArm", phase: 0, duty: 0.5, amplitude: 25 }],
    },
    {
      name: "trot",
      period: 0.6,
      limbs: [{ bone: "leftUpperArm", phase: 0, duty: 0.4, amplitude: 35 }],
    },
  ],
};

const doorlike: IAutoFilmProfile = {
  id: "hinge",
  name: "door",
  controls: [],
  drivers: [],
  limits: [],
};

/**
 * `bindProfileGaits` — synthesise a profile's declarative gait set onto a
 * concrete skeleton. The same profile bound to two different bodies yields each
 * its own clips: one gait set, many bodies.
 *
 * Scenarios:
 *
 * 1. The horse profile bound to a rig produces a clip per named gait, keyed by
 *    name, each targeting that skeleton with its own period and a
 *    profile-scoped id.
 * 2. The same profile bound to a _different_ skeleton retargets every clip onto
 *    the new body — the point of a binding.
 * 3. A profile that declares no gaits (a door) binds to nothing.
 */
export const test_motion_profile_gaits = (): void => {
  // 1. bind onto one body
  const onHorse = bindProfileGaits(horse, "horse-rig", 4);
  TestValidator.equals("a clip per named gait", Object.keys(onHorse).sort(), [
    "trot",
    "walk",
  ]);
  TestValidator.equals(
    "clip targets the bound skeleton",
    onHorse.walk!.skeleton,
    "horse-rig",
  );
  TestValidator.predicate(
    "walk keeps its period",
    nclose(onHorse.walk!.duration, 1),
  );
  TestValidator.predicate(
    "trot keeps its period",
    nclose(onHorse.trot!.duration, 0.6),
  );
  TestValidator.equals(
    "clip id is profile-scoped",
    onHorse.trot!.id,
    "equine:trot",
  );

  // 2. same profile, a different body
  const onPony = bindProfileGaits(horse, "pony-rig", 4);
  TestValidator.equals(
    "the same profile retargets onto another skeleton",
    onPony.walk!.skeleton,
    "pony-rig",
  );

  // 3. a profile with no gaits
  TestValidator.equals(
    "no gaits → no clips",
    Object.keys(bindProfileGaits(doorlike, "door-rig", 4)).length,
    0,
  );
};

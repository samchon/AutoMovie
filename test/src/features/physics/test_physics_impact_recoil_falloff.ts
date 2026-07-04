import { impactRecoil } from "@automovie/engine";
import {
  IAutoMovieBone,
  IAutoMovieSkeleton,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { nclose } from "../internal/predicates";

const rest: IAutoMovieTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};
const bone = (
  name: IAutoMovieBone["bone"],
  parent: IAutoMovieBone["parent"],
): IAutoMovieBone => ({ bone: name, parent, rest, constraint: null });

const skeleton: IAutoMovieSkeleton = {
  id: "falloff-rig",
  bones: [bone("spine", null), bone("chest", "spine")],
};

const throws = (task: () => void): boolean => {
  try {
    task();
    return false;
  } catch {
    return true;
  }
};

/**
 * `impactRecoil` treats `falloff` as an attenuation coefficient down the recoil
 * chain. Invalid falloff must fail before downstream joints can receive
 * non-finite, reversed, or amplified pushes.
 *
 * Scenarios:
 *
 * 1. Non-finite and out-of-range falloff values throw before propagation.
 * 2. Boundary falloff values `0` and `1` remain valid attenuation choices.
 */
export const test_physics_impact_recoil_falloff = (): void => {
  for (const falloff of [Number.NaN, Infinity, -0.1, 1.1])
    TestValidator.predicate(
      `falloff ${falloff} throws`,
      throws(() =>
        impactRecoil({ flexion: 10 }, ["spine", "chest"], skeleton, falloff),
      ),
    );

  const contactOnly = impactRecoil(
    { flexion: 10 },
    ["spine", "chest"],
    skeleton,
    0,
  );
  TestValidator.predicate(
    "falloff zero stops at the next joint",
    nclose(contactOnly.joints[0]!.flexion!, 10) &&
      nclose(contactOnly.joints[1]!.flexion!, 0),
  );

  const noLoss = impactRecoil({ flexion: 10 }, ["spine", "chest"], skeleton, 1);
  TestValidator.predicate(
    "falloff one preserves the push",
    nclose(noLoss.joints[0]!.flexion!, 10) &&
      nclose(noLoss.joints[1]!.flexion!, 10),
  );
};

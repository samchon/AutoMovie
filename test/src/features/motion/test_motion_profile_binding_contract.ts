import {
  IAutoMovieProfile,
  IAutoMovieProfileBinding,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * Profile v1 contract: a profile carries reusable gait/style data, while a
 * binding applies that profile to one concrete model subtree. This locks the
 * shape needed before playground clips can migrate from TypeScript functions to
 * declarative profile fixtures.
 *
 * Scenarios:
 *
 * 1. A gait can carry normalized style scalars beside its phase/duty limb data.
 * 2. A binding maps one reusable profile onto concrete node ids with an instance
 *    name, leaving the profile descriptor reusable across actors.
 */
export const test_motion_profile_binding_contract = (): void => {
  const profile: IAutoMovieProfile = {
    id: "feline-profile",
    name: "cat",
    controls: [],
    drivers: [],
    limits: [],
    gaits: [
      {
        name: "stalk",
        period: 1.2,
        style: {
          crouch: 0.45,
          weight: 0.2,
          springiness: 0.1,
          strideScale: 0.75,
        },
        limbs: [
          {
            bone: "leftUpperArm",
            phase: 0,
            duty: 0.62,
            amplitude: 20,
          },
        ],
      },
    ],
  };

  const binding: IAutoMovieProfileBinding = {
    profile: profile.id,
    root: "cat-root",
    instanceName: "house-cat",
    boneMap: {
      hips: "cat-hips",
      leftFore: "cat-left-foreleg",
    },
  };

  TestValidator.equals(
    "gait style is data on the profile",
    profile.gaits![0]!.style,
    {
      crouch: 0.45,
      weight: 0.2,
      springiness: 0.1,
      strideScale: 0.75,
    },
  );
  TestValidator.equals(
    "binding targets profile id",
    binding.profile,
    profile.id,
  );
  TestValidator.equals("binding root is concrete", binding.root, "cat-root");
  TestValidator.equals(
    "binding carries an instance name",
    binding.instanceName,
    "house-cat",
  );
  TestValidator.equals(
    "binding maps semantic bone",
    binding.boneMap.hips,
    "cat-hips",
  );
};

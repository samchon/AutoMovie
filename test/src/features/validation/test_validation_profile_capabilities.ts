import { validateModel, validateProfileCapabilities } from "@automovie/engine";
import { IAutoMovieProfile, IAutoMovieValidation } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

const profile = (): IAutoMovieProfile => ({
  id: "carriage",
  name: "Carriage",
  controls: [],
  drivers: [],
  limits: [],
  traits: [
    { kind: "mountable", seats: 1, payloadMass: 100 },
    {
      kind: "destructible",
      durability: 10,
      impactBody: {
        mass: 80,
        restitution: 0.1,
        hardness: 1,
        penetrability: 1,
      },
    },
  ],
});

const violations = (
  value: IAutoMovieValidation,
): NonNullable<
  Extract<IAutoMovieValidation, { success: false }>["violations"]
> => (value.success ? [] : value.violations);

const failsAt = (
  profiles: readonly IAutoMovieProfile[],
  fragment: string,
): boolean =>
  violations(validateProfileCapabilities({ profiles })).some((violation) =>
    violation.path.includes(fragment),
  );

/**
 * Typed capability data is one engine contract for direct and MCP consumers.
 *
 * Scenarios:
 *
 * 1. A complete mountable/destructible profile passes both the focused
 *    validator and `validateModel`.
 * 2. Profile identities are non-blank and unique, and trait kinds are unique.
 * 3. Each mountable and destructible scalar family is independently rejected at
 *    its exact path.
 */
export const test_validation_profile_capabilities = (): void => {
  const valid = profile();
  TestValidator.equals(
    "complete capability profile passes focused and model validation",
    namedFacts([
      [
        "validateProfileCapabilitiesProfilesValid",
        () => validateProfileCapabilities({ profiles: [valid] }).success,
      ],
      [
        "validateModelModelCreateModel",
        () =>
          validateModel({ model: { ...createModel(), profiles: [valid] } })
            .success,
      ],
    ]),
    {
      validateProfileCapabilitiesProfilesValid: true,
      validateModelModelCreateModel: true,
    },
  );

  TestValidator.equals(
    "profile identity is non-blank and unique",
    namedFacts([
      [
        "failsAtProfileId",
        () => failsAt([{ ...profile(), id: "", name: "" }], ".id"),
      ],
      [
        "failsAtProfileProfile",
        () => failsAt([profile(), profile()], "profiles[1].id"),
      ],
    ]),
    { failsAtProfileId: true, failsAtProfileProfile: true },
  );
  TestValidator.predicate(
    "trait kinds are unique",
    failsAt(
      [
        {
          ...profile(),
          traits: [
            { kind: "mountable", seats: 1, payloadMass: 1 },
            { kind: "mountable", seats: 1, payloadMass: 1 },
          ],
        },
      ],
      "traits[1].kind",
    ),
  );
  TestValidator.equals(
    "mountable seats and payload are independently bounded",
    namedFacts([
      [
        "failsAtProfileTraits",
        () =>
          failsAt(
            [
              {
                ...profile(),
                traits: [{ kind: "mountable", seats: 0, payloadMass: 1 }],
              },
            ],
            ".seats",
          ),
      ],
      [
        "failsAtProfileTraits2",
        () =>
          failsAt(
            [
              {
                ...profile(),
                traits: [{ kind: "mountable", seats: 1, payloadMass: 0 }],
              },
            ],
            ".payloadMass",
          ),
      ],
    ]),
    { failsAtProfileTraits: true, failsAtProfileTraits2: true },
  );
  TestValidator.predicate(
    "destructible durability and every impact scalar are bounded",
    [
      "durability",
      "impactBody.mass",
      "impactBody.restitution",
      "impactBody.hardness",
      "impactBody.penetrability",
    ].every((fragment, index) => {
      const invalid = structuredClone(profile());
      const trait = invalid.traits![1]!;
      if (trait.kind !== "destructible") return false;
      if (index === 0) trait.durability = 0;
      else if (index === 1) trait.impactBody.mass = 0;
      else if (index === 2) trait.impactBody.restitution = 2;
      else if (index === 3) trait.impactBody.hardness = 0;
      else trait.impactBody.penetrability = 0;
      return failsAt([invalid], fragment);
    }),
  );
};

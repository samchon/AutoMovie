import { validateModel, validateProfileCapabilities } from "@automovie/engine";
import { IAutoMovieProfile, IAutoMovieValidation } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { namedFacts } from "../internal/predicates";

const profile = (): IAutoMovieProfile => ({
  id: "battle-object",
  name: "Battle object",
  controls: [],
  drivers: [],
  limits: [],
  traits: [
    {
      kind: "shooter",
      weapons: [
        {
          kind: "firearm",
          id: "musket",
          reloadSeconds: 20,
          effectiveRange: 300,
          muzzleVelocity: 305,
          misfireProbability: 0.05,
          accuracy: [
            { distance: 0, probability: 0.5 },
            { distance: 100, probability: 0.1 },
          ],
        },
        {
          kind: "cannon",
          id: "gun",
          reloadSeconds: 30,
          effectiveRange: 1_000,
          muzzleVelocity: 400,
          ammunition: [
            {
              kind: "round-shot",
              mass: 5,
              maxRicochets: 2,
              ricochetRetention: 0.5,
            },
            {
              kind: "canister",
              pellets: 42,
              spreadDegrees: 12,
              pelletMass: 0.18,
            },
          ],
        },
        {
          kind: "melee",
          id: "bayonet",
          reach: 1.5,
          recoverySeconds: 1,
          impact: 1,
        },
      ],
    },
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
 * 1. A complete firearm/cannon/melee/mountable/destructible profile passes both
 *    the focused validator and `validateModel`.
 * 2. Profile/trait/weapon/ammunition identities are non-blank and unique.
 * 3. Each firearm, cannon, melee, mountable, and destructible scalar family is
 *    independently rejected at its exact path.
 * 4. Empty firearm accuracy and cannon ammunition collections fail directly.
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
          validateProfileCapabilities({ profiles: [valid] }).success &&
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
        () =>
          failsAt([{ ...profile(), id: "", name: "" }], ".id") &&
          failsAt([profile(), profile()], "profiles[1].id"),
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
                traits: [{ kind: "mountable", seats: 0, payloadMass: 1 }],
              },
            ],
            ".seats",
          ) &&
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
      const trait = invalid.traits![2]!;
      if (trait.kind !== "destructible") return false;
      if (index === 0) trait.durability = 0;
      else if (index === 1) trait.impactBody.mass = 0;
      else if (index === 2) trait.impactBody.restitution = 2;
      else if (index === 3) trait.impactBody.hardness = 0;
      else trait.impactBody.penetrability = 0;
      return failsAt([invalid], fragment);
    }),
  );
  TestValidator.equals(
    "shooter inventory and weapon identities are explicit",
    namedFacts([
      [
        "failsAtProfileTraits",
        () =>
          failsAt(
            [{ ...profile(), traits: [{ kind: "shooter", weapons: [] }] }],
            ".weapons",
          ),
      ],
      [
        "invalidStructuredCloneProfile",
        () =>
          failsAt(
            [{ ...profile(), traits: [{ kind: "shooter", weapons: [] }] }],
            ".weapons",
          ) &&
          (() => {
            const invalid = structuredClone(profile());
            const shooter = invalid.traits![0]!;
            if (shooter.kind !== "shooter") return false;
            shooter.weapons[0]!.id = "";
            shooter.weapons[1]!.id = "";
            return (
              failsAt([invalid], "weapons[0].id") &&
              failsAt([invalid], "weapons[1].id")
            );
          })(),
      ],
    ]),
    { failsAtProfileTraits: true, invalidStructuredCloneProfile: true },
  );

  const invalidFirearm = (
    mutate: (
      value: Extract<
        NonNullable<IAutoMovieProfile["traits"]>[number],
        { kind: "shooter" }
      >["weapons"][number],
    ) => void,
    fragment: string,
  ): boolean => {
    const invalid = structuredClone(profile());
    const shooter = invalid.traits![0]!;
    if (shooter.kind !== "shooter") return false;
    const weapon = shooter.weapons[0]!;
    mutate(weapon);
    return failsAt([invalid], fragment);
  };
  TestValidator.equals(
    "firearm numeric and accuracy families fail independently",
    namedFacts([
      [
        "invalidFirearmWeaponIf",
        () =>
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.reloadSeconds = 0;
          }, "reloadSeconds"),
      ],
      [
        "invalidFirearmWeaponIf2",
        () =>
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.reloadSeconds = 0;
          }, "reloadSeconds") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.effectiveRange = 0;
          }, "effectiveRange"),
      ],
      [
        "invalidFirearmWeaponIf3",
        () =>
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.reloadSeconds = 0;
          }, "reloadSeconds") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.effectiveRange = 0;
          }, "effectiveRange") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.muzzleVelocity = 0;
          }, "muzzleVelocity"),
      ],
      [
        "invalidFirearmWeaponIf4",
        () =>
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.reloadSeconds = 0;
          }, "reloadSeconds") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.effectiveRange = 0;
          }, "effectiveRange") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.muzzleVelocity = 0;
          }, "muzzleVelocity") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.misfireProbability = 2;
          }, "misfireProbability"),
      ],
      [
        "invalidFirearmWeaponIf5",
        () =>
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.reloadSeconds = 0;
          }, "reloadSeconds") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.effectiveRange = 0;
          }, "effectiveRange") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.muzzleVelocity = 0;
          }, "muzzleVelocity") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.misfireProbability = 2;
          }, "misfireProbability") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.accuracy = [];
          }, ".accuracy"),
      ],
      [
        "invalidFirearmWeaponIf6",
        () =>
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.reloadSeconds = 0;
          }, "reloadSeconds") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.effectiveRange = 0;
          }, "effectiveRange") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.muzzleVelocity = 0;
          }, "muzzleVelocity") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.misfireProbability = 2;
          }, "misfireProbability") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.accuracy = [];
          }, ".accuracy") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm")
              weapon.accuracy = [
                { distance: 10, probability: 0.5 },
                { distance: 5, probability: 0.5 },
              ];
          }, "accuracy[1].distance"),
      ],
      [
        "invalidFirearmWeaponIf7",
        () =>
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.reloadSeconds = 0;
          }, "reloadSeconds") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.effectiveRange = 0;
          }, "effectiveRange") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.muzzleVelocity = 0;
          }, "muzzleVelocity") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.misfireProbability = 2;
          }, "misfireProbability") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.accuracy = [];
          }, ".accuracy") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm")
              weapon.accuracy = [
                { distance: 10, probability: 0.5 },
                { distance: 5, probability: 0.5 },
              ];
          }, "accuracy[1].distance") &&
          invalidFirearm((weapon) => {
            if (weapon.kind === "firearm") weapon.accuracy[0]!.probability = 2;
          }, "accuracy[0].probability"),
      ],
    ]),
    {
      invalidFirearmWeaponIf: true,
      invalidFirearmWeaponIf2: true,
      invalidFirearmWeaponIf3: true,
      invalidFirearmWeaponIf4: true,
      invalidFirearmWeaponIf5: true,
      invalidFirearmWeaponIf6: true,
      invalidFirearmWeaponIf7: true,
    },
  );

  TestValidator.predicate(
    "melee reach recovery and impact fail independently",
    ["reach", "recoverySeconds", "impact"].every((fragment) => {
      const invalid = structuredClone(profile());
      const shooter = invalid.traits![0]!;
      if (shooter.kind !== "shooter") return false;
      const melee = shooter.weapons[2]!;
      if (melee.kind !== "melee") return false;
      melee[fragment as "reach" | "recoverySeconds" | "impact"] = 0;
      return failsAt([invalid], fragment);
    }),
  );

  TestValidator.equals(
    "cannon collection and ammunition families fail independently",
    namedFacts([
      [
        "invalidStructuredCloneProfile",
        () =>
          (() => {
            const invalid = structuredClone(profile());
            const shooter = invalid.traits![0]!;
            if (shooter.kind !== "shooter") return false;
            const cannon = shooter.weapons[1]!;
            if (cannon.kind !== "cannon") return false;
            cannon.ammunition = [];
            return failsAt([invalid], ".ammunition");
          })(),
      ],
      [
        "invalidStructuredCloneProfile2",
        () =>
          (() => {
            const invalid = structuredClone(profile());
            const shooter = invalid.traits![0]!;
            if (shooter.kind !== "shooter") return false;
            const cannon = shooter.weapons[1]!;
            if (cannon.kind !== "cannon") return false;
            cannon.ammunition = [];
            return failsAt([invalid], ".ammunition");
          })() &&
          (() => {
            const invalid = structuredClone(profile());
            const shooter = invalid.traits![0]!;
            if (shooter.kind !== "shooter") return false;
            const cannon = shooter.weapons[1]!;
            if (cannon.kind !== "cannon") return false;
            cannon.ammunition.push(structuredClone(cannon.ammunition[0]!));
            return failsAt([invalid], "ammunition[2].kind");
          })(),
      ],
      [
        "massMaxRicochetsRicochetRetention",
        () =>
          (() => {
            const invalid = structuredClone(profile());
            const shooter = invalid.traits![0]!;
            if (shooter.kind !== "shooter") return false;
            const cannon = shooter.weapons[1]!;
            if (cannon.kind !== "cannon") return false;
            cannon.ammunition = [];
            return failsAt([invalid], ".ammunition");
          })() &&
          (() => {
            const invalid = structuredClone(profile());
            const shooter = invalid.traits![0]!;
            if (shooter.kind !== "shooter") return false;
            const cannon = shooter.weapons[1]!;
            if (cannon.kind !== "cannon") return false;
            cannon.ammunition.push(structuredClone(cannon.ammunition[0]!));
            return failsAt([invalid], "ammunition[2].kind");
          })() &&
          ["mass", "maxRicochets", "ricochetRetention"].every(
            (fragment, index) => {
              const invalid = structuredClone(profile());
              const shooter = invalid.traits![0]!;
              if (shooter.kind !== "shooter") return false;
              const cannon = shooter.weapons[1]!;
              if (cannon.kind !== "cannon") return false;
              const round = cannon.ammunition[0]!;
              if (round.kind !== "round-shot") return false;
              if (index === 0) round.mass = 0;
              else if (index === 1) round.maxRicochets = -1;
              else round.ricochetRetention = 2;
              return failsAt([invalid], fragment);
            },
          ),
      ],
      [
        "pelletsSpreadDegreesPelletMass",
        () =>
          (() => {
            const invalid = structuredClone(profile());
            const shooter = invalid.traits![0]!;
            if (shooter.kind !== "shooter") return false;
            const cannon = shooter.weapons[1]!;
            if (cannon.kind !== "cannon") return false;
            cannon.ammunition = [];
            return failsAt([invalid], ".ammunition");
          })() &&
          (() => {
            const invalid = structuredClone(profile());
            const shooter = invalid.traits![0]!;
            if (shooter.kind !== "shooter") return false;
            const cannon = shooter.weapons[1]!;
            if (cannon.kind !== "cannon") return false;
            cannon.ammunition.push(structuredClone(cannon.ammunition[0]!));
            return failsAt([invalid], "ammunition[2].kind");
          })() &&
          ["mass", "maxRicochets", "ricochetRetention"].every(
            (fragment, index) => {
              const invalid = structuredClone(profile());
              const shooter = invalid.traits![0]!;
              if (shooter.kind !== "shooter") return false;
              const cannon = shooter.weapons[1]!;
              if (cannon.kind !== "cannon") return false;
              const round = cannon.ammunition[0]!;
              if (round.kind !== "round-shot") return false;
              if (index === 0) round.mass = 0;
              else if (index === 1) round.maxRicochets = -1;
              else round.ricochetRetention = 2;
              return failsAt([invalid], fragment);
            },
          ) &&
          ["pellets", "spreadDegrees", "pelletMass"].every(
            (fragment, index) => {
              const invalid = structuredClone(profile());
              const shooter = invalid.traits![0]!;
              if (shooter.kind !== "shooter") return false;
              const cannon = shooter.weapons[1]!;
              if (cannon.kind !== "cannon") return false;
              const canister = cannon.ammunition[1]!;
              if (canister.kind !== "canister") return false;
              if (index === 0) canister.pellets = 0;
              else if (index === 1) canister.spreadDegrees = 181;
              else canister.pelletMass = 0;
              return failsAt([invalid], fragment);
            },
          ),
      ],
    ]),
    {
      invalidStructuredCloneProfile: true,
      invalidStructuredCloneProfile2: true,
      massMaxRicochetsRicochetRetention: true,
      pelletsSpreadDegreesPelletMass: true,
    },
  );
};

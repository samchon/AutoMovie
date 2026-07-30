import {
  findProfileTrait,
  resolveFirearmVolley,
  seededValue,
} from "@automovie/engine";
import {
  IAutoMovieFirearm,
  IAutoMovieModel,
  IAutoMovieProfile,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

const musket = (): IAutoMovieFirearm => ({
  kind: "firearm",
  id: "musket",
  reloadSeconds: 20,
  effectiveRange: 300,
  accuracy: [
    { distance: 0, probability: 1 },
    { distance: 100, probability: 0.5 },
    { distance: 200, probability: 0.1 },
  ],
  misfireProbability: 0.05,
  muzzleVelocity: 305,
});

const profile = (weapon: IAutoMovieFirearm = musket()): IAutoMovieProfile => ({
  id: "line-infantry",
  name: "Line infantry",
  controls: [],
  drivers: [],
  limits: [],
  traits: [{ kind: "shooter", weapons: [weapon] }],
});

const model = (
  profiles: IAutoMovieProfile[] = [profile()],
): Pick<IAutoMovieModel, "id" | "profiles"> => ({
  id: "ranker",
  profiles,
});

/** Profile-gated firearm volleys return stable data for every ordered shooter. */
export const test_combat_firearm_volley = (): void => {
  const input = {
    model: model(),
    profile: "line-infantry",
    weapon: "musket",
    seed: 1_421,
    shooters: Array.from({ length: 500 }, (_, slot) => ({
      id: `ranker-${slot}`,
      distance: 50 + (slot % 200),
      accuracyMultiplier: slot % 2 === 0 ? 1 : 0.8,
    })),
  };
  const first = resolveFirearmVolley(input);
  const second = resolveFirearmVolley(structuredClone(input));
  const deterministicSamples =
    seededValue(1, 2, 3) === seededValue(1, 2, 3) &&
    seededValue(1, 2, 3) !== seededValue(1 + 4_294_967_296, 2, 3);
  TestValidator.predicate(
    "a 500-member volley is reproducible, ordered, and inspectable",
    first.length === 500 &&
      JSON.stringify(first) === JSON.stringify(second) &&
      first.every(
        (event, slot) =>
          event.slot === slot &&
          event.shooter === `ranker-${slot}` &&
          event.muzzleVelocity === 305,
      ) &&
      first.some((event) => event.outcome === "hit") &&
      first.some((event) => event.outcome === "miss") &&
      deterministicSamples,
  );

  const stateCases = resolveFirearmVolley({
    model: model([
      profile({
        ...musket(),
        misfireProbability: 1,
      }),
    ]),
    profile: "line-infantry",
    weapon: "musket",
    seed: 7,
    shooters: [
      { id: "reloading", distance: 50, elapsedSinceLastShot: 10 },
      { id: "misfire", distance: 50 },
    ],
  });
  const rangeCases = resolveFirearmVolley({
    model: model(),
    profile: "line-infantry",
    weapon: "musket",
    seed: 9,
    shooters: [
      { id: "origin", distance: 0 },
      { id: "interpolated", distance: 75 },
      { id: "tail", distance: 250 },
      { id: "beyond", distance: 301 },
      { id: "zero-modifier", distance: 10, accuracyMultiplier: 0 },
    ],
  });
  TestValidator.predicate(
    "reload, misfire, range interpolation and effective-range refusal are separate states",
    stateCases[0]?.outcome === "reloading" &&
      stateCases[0].misfireSample === null &&
      stateCases[0].reloadRemainingSeconds === 10 &&
      stateCases[1]?.outcome === "misfire" &&
      stateCases[1].accuracySample === null &&
      rangeCases[0]?.accuracyProbability === 1 &&
      rangeCases[1]?.accuracyProbability === 0.625 &&
      rangeCases[2]?.accuracyProbability === 0.1 &&
      rangeCases[3]?.accuracyProbability === 0 &&
      rangeCases[4]?.accuracyProbability === 0,
  );

  const shooter = findProfileTrait(profile(), "shooter");
  TestValidator.predicate(
    "trait lookup reads typed data and never infers from a name",
    shooter?.weapons[0]?.id === "musket" &&
      findProfileTrait(
        { ...profile(), traits: [{ kind: "locomotor" }] },
        "shooter",
      ) === null,
  );

  const invalidWeaponMutations: Array<Partial<IAutoMovieFirearm>> = [
    { reloadSeconds: 0 },
    { effectiveRange: Number.NaN },
    { muzzleVelocity: -1 },
    { misfireProbability: 2 },
    { accuracy: [] },
    {
      accuracy: [
        { distance: 1, probability: 0.5 },
        { distance: 1, probability: 0.5 },
      ],
    },
    { accuracy: [{ distance: -1, probability: 0.5 }] },
    { accuracy: [{ distance: 1, probability: 2 }] },
  ];
  const rejected = [
    () =>
      resolveFirearmVolley({
        ...input,
        seed: -1,
      }),
    () =>
      resolveFirearmVolley({
        ...input,
        model: model([]),
      }),
    () =>
      resolveFirearmVolley({
        ...input,
        model: model([{ ...profile(), traits: [] }]),
      }),
    () =>
      resolveFirearmVolley({
        ...input,
        weapon: "missing",
      }),
    () =>
      resolveFirearmVolley({
        ...input,
        model: model([
          {
            ...profile(),
            traits: [
              {
                kind: "shooter",
                weapons: [
                  {
                    kind: "melee",
                    id: "musket",
                    reach: 1,
                    recoverySeconds: 1,
                    impact: 1,
                  },
                ],
              },
            ],
          },
        ]),
      }),
    ...invalidWeaponMutations.map(
      (mutation) => () =>
        resolveFirearmVolley({
          ...input,
          model: model([profile({ ...musket(), ...mutation })]),
        }),
    ),
    () =>
      resolveFirearmVolley({
        ...input,
        shooters: [{ id: "", distance: 1 }],
      }),
    () =>
      resolveFirearmVolley({
        ...input,
        shooters: [
          { id: "duplicate", distance: 1 },
          { id: "duplicate", distance: 1 },
        ],
      }),
    () =>
      resolveFirearmVolley({
        ...input,
        shooters: [{ id: "distance", distance: Number.NaN }],
      }),
    () =>
      resolveFirearmVolley({
        ...input,
        shooters: [{ id: "multiplier", distance: 1, accuracyMultiplier: -1 }],
      }),
    () =>
      resolveFirearmVolley({
        ...input,
        shooters: [
          { id: "elapsed", distance: 1, elapsedSinceLastShot: Number.NaN },
        ],
      }),
  ];
  rejected.forEach((callback, index) =>
    TestValidator.error(`invalid firearm operation ${index} throws`, callback),
  );
};

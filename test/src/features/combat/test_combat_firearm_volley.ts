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

import { namedFacts } from "../internal/predicates";

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
  const repeatedSamples = [seededValue(1, 2, 3), seededValue(1, 2, 3)];
  const deterministicSamples =
    repeatedSamples[0] === repeatedSamples[1] &&
    repeatedSamples[0] !== seededValue(1 + 4_294_967_296, 2, 3);
  TestValidator.equals(
    "a 500-member volley is reproducible, ordered, and inspectable",
    namedFacts([
      ["firstLength", () => first.length === 500],
      [
        "stringifyFirstStringify",
        () =>
          first.length === 500 &&
          JSON.stringify(first) === JSON.stringify(second),
      ],
      [
        "firstEveryEvent",
        () =>
          first.every(
            (event, slot) =>
              event.slot === slot &&
              event.shooter === `ranker-${slot}` &&
              event.muzzleVelocity === 305,
          ),
      ],
      ["firstSomeEvent", () => first.some((event) => event.outcome === "hit")],
      [
        "firstSomeEvent2",
        () => first.some((event) => event.outcome === "miss"),
      ],
      ["deterministicSamples", () => deterministicSamples],
    ]),
    {
      firstLength: true,
      stringifyFirstStringify: true,
      firstEveryEvent: true,
      firstSomeEvent: true,
      firstSomeEvent2: true,
      deterministicSamples: true,
    },
  );
  const exactVector = resolveFirearmVolley({
    model: model([
      profile({
        ...musket(),
        misfireProbability: 0,
      }),
    ]),
    profile: "line-infantry",
    weapon: "musket",
    seed: 99,
    shooters: [
      { id: "certain-hit", distance: 0 },
      { id: "out-of-range", distance: 301 },
      { id: "reloading", distance: 50, elapsedSinceLastShot: 1 },
    ],
  });
  TestValidator.equals(
    "volley event vector preserves slot domains and state fields",
    exactVector,
    [
      {
        kind: "firearm-shot",
        shooter: "certain-hit",
        weapon: "musket",
        slot: 0,
        distance: 0,
        accuracyProbability: 1,
        misfireSample: seededValue(99, 0, 0x6d697366),
        accuracySample: seededValue(99, 0, 0x61636375),
        outcome: "hit",
        reloadRemainingSeconds: 0,
        muzzleVelocity: 305,
      },
      {
        kind: "firearm-shot",
        shooter: "out-of-range",
        weapon: "musket",
        slot: 1,
        distance: 301,
        accuracyProbability: 0,
        misfireSample: seededValue(99, 1, 0x6d697366),
        accuracySample: seededValue(99, 1, 0x61636375),
        outcome: "miss",
        reloadRemainingSeconds: 0,
        muzzleVelocity: 305,
      },
      {
        kind: "firearm-shot",
        shooter: "reloading",
        weapon: "musket",
        slot: 2,
        distance: 50,
        accuracyProbability: 0.75,
        misfireSample: null,
        accuracySample: null,
        outcome: "reloading",
        reloadRemainingSeconds: 19,
        muzzleVelocity: 305,
      },
    ],
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
  TestValidator.equals(
    "reload, misfire, range interpolation and effective-range refusal are separate states",
    namedFacts([
      [
        "stateCasesOutcomeReloading",
        () => stateCases[0]?.outcome === "reloading",
      ],
      ["stateCasesMisfireSample", () => stateCases[0].misfireSample === null],
      [
        "stateCasesReloadRemainingSeconds",
        () => stateCases[0].reloadRemainingSeconds === 10,
      ],
      ["stateCasesOutcomeMisfire", () => stateCases[1]?.outcome === "misfire"],
      ["stateCasesAccuracySample", () => stateCases[1].accuracySample === null],
      [
        "rangeCasesAccuracyProbability",
        () => rangeCases[0]?.accuracyProbability === 1,
      ],
      [
        "rangeCasesAccuracyProbability2",
        () => rangeCases[1]?.accuracyProbability === 0.625,
      ],
      [
        "rangeCasesAccuracyProbability3",
        () => rangeCases[2]?.accuracyProbability === 0.1,
      ],
      [
        "rangeCasesAccuracyProbability4",
        () => rangeCases[3]?.accuracyProbability === 0,
      ],
      [
        "rangeCasesAccuracyProbability5",
        () => rangeCases[4]?.accuracyProbability === 0,
      ],
    ]),
    {
      stateCasesOutcomeReloading: true,
      stateCasesMisfireSample: true,
      stateCasesReloadRemainingSeconds: true,
      stateCasesOutcomeMisfire: true,
      stateCasesAccuracySample: true,
      rangeCasesAccuracyProbability: true,
      rangeCasesAccuracyProbability2: true,
      rangeCasesAccuracyProbability3: true,
      rangeCasesAccuracyProbability4: true,
      rangeCasesAccuracyProbability5: true,
    },
  );

  const shooter = findProfileTrait(profile(), "shooter");
  TestValidator.equals(
    "trait lookup reads typed data and never infers from a name",
    namedFacts([
      ["shooterWeapons0", () => shooter?.weapons[0]?.id === "musket"],
      [
        "findProfileTraitProfileTraits",
        () =>
          shooter?.weapons[0]?.id === "musket" &&
          findProfileTrait({ ...profile(), traits: [] }, "shooter") === null,
      ],
    ]),
    { shooterWeapons0: true, findProfileTraitProfileTraits: true },
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
    () =>
      resolveFirearmVolley({
        ...input,
        shooters: [
          {
            id: "explicit-infinite-elapsed",
            distance: 1,
            elapsedSinceLastShot: Number.POSITIVE_INFINITY,
          },
        ],
      }),
  ];
  rejected.forEach((callback, index) =>
    TestValidator.error(`invalid firearm operation ${index} throws`, callback),
  );
};

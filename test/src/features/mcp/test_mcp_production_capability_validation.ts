import {
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProfile,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  IAutoMovieProductionDesignGraph,
  materializeProductionModels,
  validateAutoMovieProductionGraph,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import {
  modelRecipe,
  productionDesign,
  worldDesign,
} from "./productionFixtures";

const capabilityProfile = (): IAutoMovieProfile => ({
  id: "battle-object",
  name: "Typed battle object",
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
          accuracy: [
            { distance: 0, probability: 0.5 },
            { distance: 100, probability: 0.1 },
          ],
          misfireProbability: 0.05,
          muzzleVelocity: 305,
        },
        {
          kind: "cannon",
          id: "twelve-pounder",
          reloadSeconds: 45,
          effectiveRange: 1_200,
          muzzleVelocity: 440,
          ammunition: [
            {
              kind: "round-shot",
              mass: 5.44,
              maxRicochets: 3,
              ricochetRetention: 0.65,
            },
            {
              kind: "canister",
              pellets: 42,
              spreadDegrees: 12,
              pelletMass: 0.184,
            },
          ],
        },
        {
          kind: "melee",
          id: "bayonet",
          reach: 1.8,
          recoverySeconds: 1.2,
          impact: 1,
        },
      ],
    },
    {
      kind: "mountable",
      seats: 1,
      payloadMass: 120,
    },
    {
      kind: "destructible",
      durability: 100,
      impactBody: {
        mass: 80,
        restitution: 0.1,
        hardness: 1,
        penetrability: 1,
      },
    },
  ],
});

const instances = (): IAutoMovieInstanceSetDesign => ({
  id: "crowd",
  modelRecipe: "sentinel",
  count: 100,
  layout: {
    kind: "grid",
    rows: 10,
    columns: 10,
    spacing: { x: 1, z: 1 },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
  seed: 7,
  variation: {
    scale: { min: 0.9, max: 1.1 },
    palette: ["#335522", "#557733"],
    traits: [{ name: "pace", min: 0.8, max: 1.2 }],
  },
});

const graph = (
  model: IAutoMovieModelRecipe,
  world: IAutoMovieWorldDesign,
): IAutoMovieProductionDesignGraph => ({
  production: productionDesign(),
  models: new Map([[model.id, model]]),
  world,
  formations: new Map(),
  shots: new Map(),
  acceptance: new Map(),
});

const codes = (value: IAutoMovieProductionDesignGraph): Set<string> =>
  new Set(
    validateAutoMovieProductionGraph(value).map(
      (diagnostic) => diagnostic.code,
    ),
  );

/** Design lint validates typed traits and compact general-instance contracts. */
export const test_mcp_production_capability_validation = (): void => {
  const model = {
    ...modelRecipe(),
    profiles: [capabilityProfile()],
  };
  const world = {
    ...worldDesign(),
    routes: [
      {
        id: "road",
        waypoints: [
          { x: -10, z: 0 },
          { x: 10, z: 0 },
        ],
        allowedFormationWidth: 2,
      },
    ],
    instanceSets: [
      instances(),
      {
        ...instances(),
        id: "trees",
        layout: { kind: "scatter" as const, radius: 20 },
      },
      {
        ...instances(),
        id: "roadside",
        layout: {
          kind: "along-route" as const,
          route: "road",
          lateralJitter: 1,
        },
      },
    ],
  };
  const valid = codes(graph(model, world));
  const runtime = materializeProductionModels(new Map([[model.id, model]])).get(
    model.id,
  );
  TestValidator.predicate(
    "valid firearm, cannon, melee, mountable, destructible and three instance layouts pass",
    [
      "design-capability-invalid",
      "design-capability-duplicate",
      "design-reference-missing",
      "design-budget-exceeded",
    ].every((code) => valid.has(code) === false) &&
      runtime?.profiles?.[0]?.traits?.[0]?.kind === "shooter",
  );

  const invalidProfile: IAutoMovieProfile = {
    ...capabilityProfile(),
    id: "",
    name: "",
    traits: [
      { kind: "locomotor" },
      { kind: "locomotor" },
      { kind: "mountable", seats: 0, payloadMass: 0 },
      {
        kind: "destructible",
        durability: 0,
        impactBody: {
          mass: 0,
          restitution: 2,
          hardness: 0,
          penetrability: 0,
        },
      },
      { kind: "shooter", weapons: [] },
      {
        kind: "shooter",
        weapons: [
          {
            kind: "firearm",
            id: "",
            reloadSeconds: 0,
            effectiveRange: 0,
            muzzleVelocity: 0,
            misfireProbability: 2,
            accuracy: [
              { distance: 10, probability: 2 },
              { distance: 5, probability: -1 },
            ],
          },
          {
            kind: "cannon",
            id: "bad-cannon",
            reloadSeconds: 0,
            effectiveRange: 0,
            muzzleVelocity: 0,
            ammunition: [],
          },
          {
            kind: "melee",
            id: "bad-melee",
            reach: 0,
            recoverySeconds: 0,
            impact: 0,
          },
        ],
      },
    ],
  };
  const invalidCapability = codes(
    graph({ ...model, profiles: [invalidProfile] }, world),
  );
  TestValidator.predicate(
    "invalid profile facts fail as typed capability diagnostics",
    invalidCapability.has("design-text-empty") &&
      invalidCapability.has("design-capability-invalid") &&
      invalidCapability.has("design-capability-duplicate") &&
      invalidCapability.has("design-range-invalid"),
  );

  const invalidInstances = codes(
    graph(model, {
      ...world,
      routes: [
        {
          id: "zero",
          waypoints: [
            { x: 0, z: 0 },
            { x: 0, z: 0 },
          ],
          allowedFormationWidth: 1,
        },
      ],
      instanceSets: [
        {
          ...instances(),
          id: "",
          modelRecipe: "missing",
          count: 101,
          layout: {
            kind: "grid",
            rows: 1,
            columns: 1,
            spacing: { x: 0, z: 0 },
          },
          seed: -1,
          variation: {
            scale: { min: 2, max: 1 },
            palette: [],
            traits: [
              { name: "", min: 2, max: 1 },
              { name: "", min: Number.NaN, max: Number.NaN },
            ],
          },
        },
        {
          ...instances(),
          id: "route-missing",
          layout: {
            kind: "along-route",
            route: "missing",
            lateralJitter: -1,
          },
          variation: {
            ...instances().variation,
            palette: ["invalid", "invalid"],
          },
        },
      ],
    }),
  );
  TestValidator.predicate(
    "invalid layouts, routes, references, palettes and trait ranges are rejected",
    invalidInstances.has("design-route-invalid") &&
      invalidInstances.has("design-reference-missing") &&
      invalidInstances.has("design-range-invalid") &&
      invalidInstances.has("design-collection-empty") &&
      invalidInstances.has("design-color-invalid") &&
      invalidInstances.has("design-duplicate-id"),
  );
};

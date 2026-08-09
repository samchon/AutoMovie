import {
  IAutoMovieInstanceSetDesign,
  IAutoMovieModelRecipe,
  IAutoMovieProfile,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  AUTOMOVIE_MAX_GENERAL_INSTANCES,
  IAutoMovieProductionDesignGraph,
  materializeProductionModels,
  validateAutoMovieProductionGraph,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import {
  modelRecipe,
  productionDesign,
  worldDesign,
} from "./productionFixtures";

const capabilityProfile = (): IAutoMovieProfile => ({
  id: "carriage",
  name: "Typed carriage",
  controls: [],
  drivers: [],
  limits: [],
  traits: [
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

const messages = (value: IAutoMovieProductionDesignGraph): string[] =>
  validateAutoMovieProductionGraph(value).map(
    (diagnostic) => diagnostic.message,
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
  TestValidator.equals(
    "valid mountable, destructible and three instance layouts pass",
    namedFacts([
      [
        "designCapabilityClean",
        () =>
          [
            "design-capability-duplicate",
            "design-reference-missing",
            "design-budget-exceeded",
          ].every((code) => valid.has(code) === false),
      ],
      [
        "runtimeProfiles0",
        () => runtime?.profiles?.[0]?.traits?.[0]?.kind === "mountable",
      ],
    ]),
    { designCapabilityClean: true, runtimeProfiles0: true },
  );

  const invalidProfile: IAutoMovieProfile = {
    ...capabilityProfile(),
    id: "",
    name: "",
    traits: [
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
      { kind: "mountable", seats: 0, payloadMass: 0 },
    ],
  };
  const invalidCapability = codes(
    graph({ ...model, profiles: [invalidProfile] }, world),
  );
  TestValidator.equals(
    "invalid profile facts fail as typed capability diagnostics",
    namedFacts([
      [
        "invalidCapabilityHasDesign",
        () => invalidCapability.has("design-text-empty"),
      ],
      [
        "invalidCapabilityHasDesign2",
        () => invalidCapability.has("design-capability-duplicate"),
      ],
      [
        "invalidCapabilityHasDesign3",
        () => invalidCapability.has("design-range-invalid"),
      ],
    ]),
    {
      invalidCapabilityHasDesign: true,
      invalidCapabilityHasDesign2: true,
      invalidCapabilityHasDesign3: true,
    },
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
  TestValidator.equals(
    "invalid layouts, routes, references, palettes and trait ranges are rejected",
    namedFacts([
      [
        "invalidInstancesHasDesign",
        () => invalidInstances.has("design-route-invalid"),
      ],
      [
        "invalidInstancesHasDesign2",
        () => invalidInstances.has("design-reference-missing"),
      ],
      [
        "invalidInstancesHasDesign3",
        () => invalidInstances.has("design-range-invalid"),
      ],
      [
        "invalidInstancesHasDesign4",
        () => invalidInstances.has("design-collection-empty"),
      ],
      [
        "invalidInstancesHasDesign5",
        () => invalidInstances.has("design-color-invalid"),
      ],
      [
        "invalidInstancesHasDesign6",
        () => invalidInstances.has("design-duplicate-id"),
      ],
    ]),
    {
      invalidInstancesHasDesign: true,
      invalidInstancesHasDesign2: true,
      invalidInstancesHasDesign3: true,
      invalidInstancesHasDesign4: true,
      invalidInstancesHasDesign5: true,
      invalidInstancesHasDesign6: true,
    },
  );

  const derivedRangeMessages = [
    ...messages(
      graph(model, {
        ...world,
        routes: [
          {
            id: "overflow",
            waypoints: [
              { x: -Number.MAX_VALUE, z: 0 },
              { x: Number.MAX_VALUE, z: 0 },
            ],
            allowedFormationWidth: 1,
          },
        ],
        instanceSets: [],
      }),
    ),
    ...messages(
      graph(model, {
        ...world,
        instanceSets: [
          {
            ...instances(),
            id: "wide-grid",
            layout: {
              kind: "grid",
              rows: 1,
              columns: 100,
              spacing: { x: 1_000_000_000, z: 1 },
            },
          },
          {
            ...instances(),
            id: "edge-scatter",
            anchor: { x: 1_000_000_000, y: 0, z: 0 },
            layout: { kind: "scatter", radius: 1 },
          },
          {
            ...instances(),
            id: "edge-route",
            layout: {
              kind: "along-route",
              route: "edge",
              lateralJitter: 1,
            },
          },
          {
            ...instances(),
            id: "trait-overflow",
            variation: {
              ...instances().variation,
              traits: [
                {
                  name: "overflow",
                  min: -Number.MAX_VALUE,
                  max: Number.MAX_VALUE,
                },
              ],
            },
          },
        ],
        routes: [
          ...world.routes,
          {
            id: "edge",
            waypoints: [
              { x: 999_999_999.5, z: 0 },
              { x: 999_999_999, z: 1 },
            ],
            allowedFormationWidth: 1,
          },
        ],
      }),
    ),
  ];
  TestValidator.predicate(
    "route accumulation, layout extents, jitter and trait interpolation stay finite",
    [
      "finite non-zero total length",
      "Instance grid derives coordinates",
      "Instance scatter derives coordinates",
      "can jitter beyond the supported world coordinate limit",
      "overflow.min",
      "overflow.max",
    ].every((message) =>
      derivedRangeMessages.some((candidate) => candidate.includes(message)),
    ),
  );

  const excessiveCount = codes(
    graph(model, {
      ...world,
      instanceSets: Array.from({ length: 3 }, (_, index) => ({
        ...instances(),
        id: `large-${index}`,
        count: 100_000,
        layout: {
          kind: "grid" as const,
          rows: 1_000,
          columns: 100,
          spacing: { x: 1, z: 1 },
        },
      })),
    }),
  );
  const excessiveBuffer = codes(
    graph(model, {
      ...world,
      instanceSets: [
        {
          ...instances(),
          id: "attribute-heavy",
          count: 100_000,
          layout: {
            kind: "grid",
            rows: 1_000,
            columns: 100,
            spacing: { x: 1, z: 1 },
          },
          variation: {
            ...instances().variation,
            traits: Array.from({ length: 100 }, (_, index) => ({
              name: `trait-${index}`,
              min: 0,
              max: 1,
            })),
          },
        },
      ],
    }),
  );
  TestValidator.equals(
    "aggregate general-instance count and buffer budgets fail independently",
    namedFacts([
      [
        "AUTOMOVIEMAXGENERALINSTANCES000",
        () => AUTOMOVIE_MAX_GENERAL_INSTANCES === 250_000,
      ],
      [
        "excessiveCountHasDesign",
        () => excessiveCount.has("design-range-invalid"),
      ],
      [
        "excessiveBufferHasDesign",
        () => excessiveBuffer.has("design-budget-exceeded"),
      ],
    ]),
    {
      AUTOMOVIEMAXGENERALINSTANCES000: true,
      excessiveCountHasDesign: true,
      excessiveBufferHasDesign: true,
    },
  );
};

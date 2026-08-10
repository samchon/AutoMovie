import { deriveAutoMovieSemanticMask } from "@automovie/engine";
import { autoMovieRenderSubjectOfCompiledShot } from "@automovie/render";
import { TestValidator } from "@nestia/e2e";

import { fluidDomain, waterFeature } from "../internal/fluidFixtures";
import { throwsError } from "../internal/predicates";
import { compiledShotFixture } from "../internal/renderBudgetFixtures";
import {
  buildingFixture,
  instanceSetFixture,
} from "../internal/renderFixtures";
import {
  plantingCluster,
  plantingInstallation,
  plantingRecipe,
  softFurnishing,
  softPanel,
} from "../internal/softFixtures";

/**
 * A compiled shot converts to the whole drawable world, bindings and all.
 *
 * The engine's own `autoMovieRenderSubjectOfShot` leaves the simulated
 * drawables to its caller, so this conversion is the only thing standing
 * between a render report and a room whose curtain, pond and fern bed are
 * missing from the triangle count. What it has to get right is not a cost but
 * an attribution: which room owns the drawable, which material it binds, and
 * whether the answer depends on the order somebody wrote the bindings in.
 *
 * Scenarios:
 *
 * 1. A shot declaring a bound pond, curtain and fern bed produces one drawable
 *    each, owned by the space its binding names and carrying that binding's
 *    material.
 * 2. A domain nobody bound is still a drawable, with no owner and the renderer's
 *    default material: an unowned pond is not a free pond.
 * 3. Two bindings naming one drawable resolve to the smallest binding id in either
 *    declaration order, so the subject is a property of the design.
 * 4. A planting cluster whose recipe the shot does not carry is refused by name
 *    rather than silently dropped from the cost.
 * 5. A shot declaring none of the optional records produces empty lists, never
 *    `undefined`, and a shot staging a building, an instanced band and a
 *    resolved texture carries all three through unchanged.
 * 6. The semantic mask derived from the same subject addresses every simulated
 *    drawable under the owner the report attributes its cost to.
 */
export const test_render_budget_preflight_subject = (): void => {
  const bound = autoMovieRenderSubjectOfCompiledShot({
    compiled: compiledShotFixture({
      fluidDomains: [fluidDomain({ id: "basin" })],
      waterFeatures: [waterFeature({ domain: "basin", material: "water" })],
      softBodyDomains: [softPanel({ columns: 2, rows: 2 })],
      softFurnishings: [softFurnishing({ material: "linen" })],
      plantingDomains: [plantingRecipe()],
      plantingClusters: [plantingCluster()],
      plantingInstallations: [
        plantingInstallation({ branchMaterial: "bark", leafMaterial: "leaf" }),
      ],
    }),
  });
  TestValidator.equals(
    "a bound pond, curtain and fern bed name their owning space and material",
    {
      water: bound.waterBodies?.map((body) => ({
        id: body.id,
        owner: body.owner,
        material: body.material,
        nodes: body.nodes,
        domain: body.domain?.id ?? null,
        cells: body.cells,
        particles: body.particles,
      })),
      soft: bound.softBodies?.map((panel) => ({
        domain: panel.domain.id,
        owner: panel.owner,
        material: panel.material,
      })),
      planting: bound.plantings?.map((planting) => ({
        cluster: planting.cluster.id,
        domain: planting.domain.id,
        owner: planting.owner,
        branchMaterial: planting.branchMaterial,
        leafMaterial: planting.leafMaterial,
        // The solid a renderer sweeps along a branch is not in any compiled
        // record, so the geometry metrics report `not-run` rather than approve
        // an invented triangle count.
        branch: planting.branch,
        leaf: planting.leaf,
      })),
    },
    {
      water: [
        {
          id: "basin",
          owner: "space:atrium/atrium-basin",
          material: "water",
          nodes: [],
          domain: "basin",
          cells: null,
          particles: null,
        },
      ],
      soft: [
        { domain: "panel", owner: "space:suite/suite-room", material: "linen" },
      ],
      planting: [
        {
          cluster: "atrium-bed",
          domain: "fern",
          owner: "space:suite/suite-room",
          branchMaterial: "bark",
          leafMaterial: "leaf",
          branch: null,
          leaf: null,
        },
      ],
    },
  );

  const unbound = autoMovieRenderSubjectOfCompiledShot({
    compiled: compiledShotFixture({
      fluidDomains: [fluidDomain({ id: "basin" })],
      softBodyDomains: [softPanel({ columns: 2, rows: 2 })],
      plantingDomains: [plantingRecipe()],
      plantingClusters: [plantingCluster()],
    }),
  });
  TestValidator.equals(
    "an unbound domain is still a drawable with no owner and no material",
    {
      water: unbound.waterBodies?.map((body) => [
        body.id,
        body.owner,
        body.material,
      ]),
      soft: unbound.softBodies?.map((panel) => [
        panel.domain.id,
        panel.owner,
        panel.material,
      ]),
      planting: unbound.plantings?.map((planting) => [
        planting.cluster.id,
        planting.owner,
        planting.branchMaterial,
        planting.leafMaterial,
      ]),
    },
    {
      water: [["basin", null, null]],
      soft: [["panel", null, null]],
      planting: [["atrium-bed", null, null, null]],
    },
  );

  const contested = (reversed: boolean) => {
    const features = [
      waterFeature({ id: "north-pond", domain: "basin", material: "north" }),
      waterFeature({ id: "east-pond", domain: "basin", material: "east" }),
    ];
    return autoMovieRenderSubjectOfCompiledShot({
      compiled: compiledShotFixture({
        fluidDomains: [fluidDomain({ id: "basin" })],
        waterFeatures: reversed ? [...features].reverse() : features,
      }),
    }).waterBodies?.[0]?.material;
  };
  TestValidator.equals(
    "two bindings of one drawable resolve to the smallest id, either way round",
    { declared: contested(false), reversed: contested(true) },
    { declared: "east", reversed: "east" },
  );

  TestValidator.predicate(
    "a cluster whose recipe the shot omits is refused by name",
    throwsError(
      () =>
        autoMovieRenderSubjectOfCompiledShot({
          compiled: compiledShotFixture({
            plantingClusters: [plantingCluster()],
          }),
        }),
      ['planting cluster "atrium-bed"', 'recipe "fern"'],
    ),
  );

  const bare = autoMovieRenderSubjectOfCompiledShot({
    compiled: compiledShotFixture(),
  });
  TestValidator.equals(
    "a shot declaring no simulated record produces empty lists, not undefined",
    {
      environments: bare.environments?.length,
      water: bare.waterBodies?.length,
      soft: bare.softBodies?.length,
      planting: bare.plantings?.length,
      textures: bare.textures?.length,
      nodes: bare.scene.nodes.length,
      models: bare.models.length,
      sets: bare.instanceSets?.length,
    },
    {
      environments: 0,
      water: 0,
      soft: 0,
      planting: 0,
      textures: 0,
      nodes: 5,
      models: 5,
      sets: 0,
    },
  );
  const staged = autoMovieRenderSubjectOfCompiledShot({
    compiled: compiledShotFixture({
      builtEnvironments: [buildingFixture()],
      instanceSets: [
        instanceSetFixture({ id: "windows", count: 4, chunks: 2 }),
      ],
    }),
    textures: [
      {
        asset: "textures/stone.png",
        width: 256,
        height: 256,
        mipmapped: false,
      },
    ],
  });
  TestValidator.equals(
    "a staged building, its instanced band and a resolved texture all survive",
    {
      environments: staged.environments?.map((environment) => environment.id),
      sets: staged.instanceSets?.map((set) => [set.id, set.count]),
      textures: staged.textures,
    },
    {
      environments: ["tower"],
      sets: [["windows", 4]],
      textures: [
        {
          asset: "textures/stone.png",
          width: 256,
          height: 256,
          mipmapped: false,
        },
      ],
    },
  );

  const mask = deriveAutoMovieSemanticMask(bound);
  TestValidator.equals(
    "the mask addresses every simulated drawable under its binding's space",
    mask.entries
      .filter((entry) =>
        ["water-body", "soft-body", "planting"].includes(entry.kind),
      )
      .map((entry) => [entry.id, entry.owner, entry.nodes.join(",")]),
    [
      ["planting:atrium-bed", "space:suite/suite-room", "planting:atrium-bed"],
      ["soft-body:panel", "space:suite/suite-room", "soft:panel"],
      ["water-body:basin", "space:atrium/atrium-basin", "water:basin"],
    ],
  );
};

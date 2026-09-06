import {
  autoMovieRenderSubjectOfCompiledShot,
  deriveAutoMovieSemanticMask,
  renderAutoMovieSemanticMaskSidecar,
} from "@automovie/engine";
import {
  IAutoMovieCompiledShotSource,
  IAutoMovieSemanticMask,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { flatBasin, waterFeature } from "../internal/fluidFixtures";
import { throwsError } from "../internal/predicates";
import {
  instanceSetFixture,
  modelsFixture,
  sceneFixture,
} from "../internal/renderFixtures";
import {
  plantingCluster,
  plantingInstallation,
  plantingRecipe,
  softFurnishing,
  softPanel,
} from "../internal/softFixtures";

/**
 * A compiled shot states the whole drawable world one frame commits to, cloth,
 * planting and water included.
 *
 * `autoMovieRenderSubjectOfShot` was written while the artifact carried none of
 * those and leaves them to its caller, which is how the same shot could be read
 * one way by a budget report and another way by a palette. This conversion
 * reads the domains beside the bindings that place them, so a pond has one
 * identity everywhere it is measured, and a viewer can derive the frame's
 * palette in the browser without a second reading of the artifact.
 *
 * Scenarios:
 *
 * 1. A shot declaring no simulated domain converts to empty drawable lists and
 *    passes its scene, models, buildings, compact formations, effects, and
 *    instance sets straight through.
 * 2. Every declared domain becomes exactly one drawable, and a bound one takes the
 *    owning space and the binding's material while an unbound one takes `null`
 *    for both.
 * 3. Two bindings naming one drawable resolve to the smaller binding id whatever
 *    order the array holds them in, so the subject is a function of the
 *    design.
 * 4. A planting cluster whose recipe the shot omits is refused rather than staged
 *    against a recipe nobody supplied.
 * 5. Texture dimensions pass through when supplied and become empty when not.
 * 6. The palette derived from that subject serializes as the sidecar the pixels
 *    travel with: pretty JSON, one trailing newline, round-tripping exactly.
 */
export const test_render_subject_compiled_shot = (): void => {
  const bare = {
    scene: sceneFixture(),
    models: modelsFixture(),
    motions: [],
    eventSamples: [],
    formations: [{ id: "chorus" }],
    instanceSets: [instanceSetFixture({ id: "windows", count: 2, chunks: 1 })],
    formationMotions: [],
    formationSlotMotions: [],
    effects: [{ id: "haze" }],
    shot: {},
  } as unknown as IAutoMovieCompiledShotSource;

  const empty = autoMovieRenderSubjectOfCompiledShot({ compiled: bare });
  TestValidator.equals(
    "a shot declaring no simulated domain converts to empty drawable lists",
    {
      scene: empty.scene.id,
      models: empty.models.length,
      environments: empty.environments,
      sets: empty.instanceSets?.map((set) => set.id),
      formations: empty.formations?.map((formation) => formation.id),
      effects: empty.effects?.map((effect) => effect.id),
      water: empty.waterBodies,
      panels: empty.softBodies,
      plantings: empty.plantings,
      textures: empty.textures,
    },
    {
      scene: "tower-scene",
      models: 5,
      environments: [],
      sets: ["windows"],
      formations: ["chorus"],
      effects: ["haze"],
      water: [],
      panels: [],
      plantings: [],
      textures: [],
    },
  );

  // One bound drawable of each kind and one unbound twin, so the difference the
  // binding makes is visible rather than asserted.
  const furnished = {
    ...bare,
    fluidDomains: [
      flatBasin({ columns: 2, rows: 2, depth: 1 }),
      flatBasin({
        columns: 2,
        rows: 2,
        depth: 1,
        overrides: { id: "orphan-pool" },
      }),
    ],
    waterFeatures: [waterFeature({ material: "materials/water" })],
    softBodyDomains: [
      softPanel({ columns: 2, rows: 2 }),
      softPanel({ columns: 2, rows: 2, overrides: { id: "orphan-panel" } }),
    ],
    softFurnishings: [softFurnishing({ material: "materials/linen" })],
    plantingDomains: [plantingRecipe()],
    plantingClusters: [
      plantingCluster(),
      plantingCluster({ id: "orphan-bed", domain: "fern" }),
    ],
    plantingInstallations: [
      plantingInstallation({
        branchMaterial: "materials/bark",
        leafMaterial: "materials/leaf",
      }),
    ],
  } as unknown as IAutoMovieCompiledShotSource;
  const subject = autoMovieRenderSubjectOfCompiledShot({
    compiled: furnished,
    textures: [
      { asset: "textures/stone.png", width: 2, height: 2, mipmapped: false },
    ],
  });
  TestValidator.equals(
    "every declared domain is one drawable, and only a bound one names a room",
    {
      water: subject.waterBodies?.map((body) => ({
        id: body.id,
        owner: body.owner,
        material: body.material,
        cells: body.domain?.grid.columns ?? null,
        nodes: body.nodes.length,
        proved: [body.cells, body.particles],
      })),
      panels: subject.softBodies?.map((panel) => ({
        id: panel.domain.id,
        owner: panel.owner,
        material: panel.material,
      })),
      plantings: subject.plantings?.map((planting) => ({
        id: planting.cluster.id,
        recipe: planting.domain.id,
        owner: planting.owner,
        branchMaterial: planting.branchMaterial,
        leafMaterial: planting.leafMaterial,
        // The solid a renderer sweeps along a branch is in no compiled record,
        // so an invented cost here would be the number a budget approves.
        cost: [planting.branch, planting.leaf],
      })),
      textures: subject.textures?.map((texture) => texture.asset),
    },
    {
      water: [
        {
          id: "basin",
          owner: "space:atrium/atrium-basin",
          material: "materials/water",
          cells: 2,
          nodes: 0,
          proved: [null, null],
        },
        {
          id: "orphan-pool",
          owner: null,
          material: null,
          cells: 2,
          nodes: 0,
          proved: [null, null],
        },
      ],
      panels: [
        {
          id: "panel",
          owner: "space:suite/suite-room",
          material: "materials/linen",
        },
        { id: "orphan-panel", owner: null, material: null },
      ],
      plantings: [
        {
          id: "atrium-bed",
          recipe: "fern",
          owner: "space:suite/suite-room",
          branchMaterial: "materials/bark",
          leafMaterial: "materials/leaf",
          cost: [null, null],
        },
        {
          id: "orphan-bed",
          recipe: "fern",
          owner: null,
          branchMaterial: null,
          leafMaterial: null,
          cost: [null, null],
        },
      ],
      textures: ["textures/stone.png"],
    },
  );

  // Two bindings on one drawable is an authoring contradiction, but the subject
  // still has to be a function of the design: whichever order the array holds
  // them in, the smaller binding id owns the pond.
  const contested = (order: "ascending" | "descending"): string | null => {
    const bindings = [
      waterFeature({ id: "a-feature", environment: "north", space: "pool" }),
      waterFeature({ id: "b-feature", environment: "south", space: "tank" }),
    ];
    return (
      autoMovieRenderSubjectOfCompiledShot({
        compiled: {
          ...bare,
          fluidDomains: [flatBasin({ columns: 2, rows: 2, depth: 1 })],
          waterFeatures:
            order === "ascending" ? bindings : [...bindings].reverse(),
        } as unknown as IAutoMovieCompiledShotSource,
      }).waterBodies?.[0]?.owner ?? null
    );
  };
  TestValidator.equals(
    "the owning room is a property of the design, not of array order",
    [contested("ascending"), contested("descending")],
    ["space:north/pool", "space:north/pool"],
  );

  TestValidator.equals(
    "a cluster whose recipe the shot omits is refused, never staged",
    throwsError(
      () =>
        autoMovieRenderSubjectOfCompiledShot({
          compiled: {
            ...bare,
            plantingDomains: [],
            plantingClusters: [plantingCluster()],
          } as unknown as IAutoMovieCompiledShotSource,
        }),
      'recipe "fern" is absent from the compiled shot',
    ),
    true,
  );

  const mask = deriveAutoMovieSemanticMask(subject);
  const sidecar = renderAutoMovieSemanticMaskSidecar(mask);
  TestValidator.equals(
    "the sidecar is deterministic bytes that round-trip to the same palette",
    {
      trailing: sidecar.endsWith("\n") && sidecar.endsWith("\n\n") === false,
      indented: sidecar.startsWith('{\n  "version": 2,'),
      stable: sidecar === renderAutoMovieSemanticMaskSidecar(mask),
      digest: (JSON.parse(sidecar) as IAutoMovieSemanticMask).digest,
      pond: (JSON.parse(sidecar) as IAutoMovieSemanticMask).entries.find(
        (entry) => entry.id === "water-body:basin",
      )?.color,
    },
    {
      trailing: true,
      indented: true,
      stable: true,
      digest: mask.digest,
      pond: mask.entries.find((entry) => entry.id === "water-body:basin")
        ?.color,
    },
  );
};

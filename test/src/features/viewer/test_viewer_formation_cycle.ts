import { HUMANOID_GAITS, HUMANOID_PROFILE } from "@automovie/archetypes";
import {
  IAutoMovieFormationDesign,
  IAutoMovieModel,
  IAutoMovieModelRecipe,
} from "@automovie/interface";
import {
  AUTOMOVIE_FORMATION_INSTANCE_BUFFER_BUDGET_BYTES,
  AUTOMOVIE_FORMATION_INSTANCE_BYTES,
  materializeCompiledFormation,
  materializeProductionModels,
} from "@automovie/production";
import {
  EDGE_SHELL_NAME,
  applyRenderMode,
  bakeFormationCycle,
  buildInstancedFormation,
  buildModel,
  formationCycleGait,
  formationCycleOf,
  formationCyclePosition,
  instancedModelParts,
  regenerateFormationSlot,
  sampleFormationCycleMatrix,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, throwsError } from "../internal/predicates";
import { formationDesign, modelRecipe } from "../production/productionFixtures";

/**
 * An anonymous formation member performs a cycle at its own seeded phase.
 *
 * A member is not a scene node and never will be: it owns one instance matrix
 * and one phase scalar, and everything it does has to come out of a table the
 * whole tier shares. These scenarios pin that the table reaches the shader,
 * that the phase actually separates one member from the next, that the same
 * design regenerates the same table anywhere, that a review pass shows what
 * beauty shows, and that none of it costs a byte more per member than a frozen
 * crowd already cost.
 *
 * Scenarios:
 *
 * 1. A gait-bearing LOD tier bakes one part-matrix table per declared gait, and
 *    every chunk of that tier carries the same tables beside its phase and part
 *    attributes, while a tier without a gait carries none.
 * 2. The tier's material injects the phase attribute, the part attribute, and both
 *    vertex writes, and shares the tier's uniform cells; a still tier's
 *    material is left untouched.
 * 3. Members spread across the cycle rather than stacking at one point, a member
 *    moves through the whole of its own cycle and returns to its attitude one
 *    period later, and a part the gait does not articulate holds still.
 * 4. The table is byte-identical across rebuilds and independent of crowd size,
 *    and the instance buffers stay exactly at the declared per-instance cost
 *    and inside the declared budget.
 * 5. Advancing the shot over a unit no cue moves leaves every member exactly where
 *    it stood, and an update without a time does the same.
 * 6. Depth, normal, mask, and outline overrides carry the cycle, outline shells
 *    included, and restore returns the beauty materials untouched.
 * 7. A rigged figure with no gait, a model with no profiles, a profile with no
 *    gaits, a part outside the figure, and a gait whose declared period is not
 *    a positive number all fail closed.
 */
export const test_viewer_formation_cycle = (): void => {
  const near: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "cycle-near",
    lod: [{ tier: "near", maxDistance: null, recipe: "cycle-near" }],
    profiles: [HUMANOID_PROFILE],
  };
  const far: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "cycle-far",
    role: "prop",
    archetype: "primitive-prop",
    parameters: { shape: "box", width: 0.3, height: 1.2, depth: 0.3 },
    capabilities: [],
    lod: [{ tier: "far", maxDistance: null, recipe: "cycle-far" }],
  };
  const figure: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "cycle-figure",
    profiles: [HUMANOID_PROFILE],
    lod: [
      { tier: "hero", maxDistance: 5, recipe: "cycle-figure" },
      { tier: "near", maxDistance: 20, recipe: near.id },
      { tier: "far", maxDistance: null, recipe: far.id },
    ],
  };
  const still: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "cycle-still",
    profiles: [],
    lod: [{ tier: "near", maxDistance: null, recipe: "cycle-still" }],
  };
  const recipes = new Map(
    [figure, near, far, still].map((recipe) => [recipe.id, recipe]),
  );
  const models = new Map(
    [...materializeProductionModels(recipes).values()].map((model) => [
      model.id,
      model,
    ]),
  );
  // Two chunks on purpose: a tier's table is shared by every chunk drawing it,
  // and a single-chunk unit could not tell sharing from rebuilding.
  const design: IAutoMovieFormationDesign = {
    ...formationDesign({
      kind: "line",
      ranks: 2,
      files: 1_024,
      spacing: { lateral: 0.8, depth: 0.9 },
    }),
    id: "cycle-unit",
    modelRecipe: figure.id,
    count: 2_048,
    heroOverrides: [],
  };
  const formation = materializeCompiledFormation(design, recipes);
  const built = buildInstancedFormation({ formation, models });
  const meshes = instancedMeshes(built.object);
  const marching = meshes.filter((mesh) => formationCycleOf(mesh) !== null);
  const frozen = meshes.filter((mesh) => formationCycleOf(mesh) === null);
  const cycle = formationCycleOf(marching[0]!)!;

  TestValidator.equals(
    "a gait-bearing tier bakes one table every chunk of that tier shares",
    namedFacts([
      ["chunks", () => formation.chunks.length === 2],
      ["anonymousTiers", () => formation.lod.length === 2],
      ["meshes", () => meshes.length === 4],
      ["marchingTier", () => marching.length === 2],
      [
        "marchingChunksShareOneTable",
        () => marching.every((mesh) => formationCycleOf(mesh) === cycle),
      ],
      ["frozenTier", () => frozen.length === 2],
      ["gait", () => cycle.fallback.gait === "walk"],
      [
        "wholeRepertoireIsBaked",
        () =>
          cycle.takes.size === HUMANOID_PROFILE.gaits!.length &&
          HUMANOID_PROFILE.gaits!.every((gait) => cycle.takes.has(gait.name)),
      ],
      [
        "phasePerMember",
        () =>
          meshes.every(
            (mesh) =>
              mesh.geometry.getAttribute("automoviePhase")?.count ===
              mesh.count,
          ),
      ],
      [
        "partPerVertex",
        () =>
          meshes.every(
            (mesh) =>
              mesh.geometry.getAttribute("automoviePart")?.count ===
              mesh.geometry.getAttribute("position")?.count,
          ),
      ],
      [
        "partsIndexTheWholeFigure",
        () =>
          maximum(marching[0]!.geometry.getAttribute("automoviePart")) + 1 ===
          cycle.names.length,
      ],
      [
        "tableRows",
        () =>
          cycle.uniforms.automovieCycleRows.value === cycle.names.length * 3,
      ],
      [
        "tableColumns",
        () => cycle.uniforms.automovieCycleSamples.value === cycle.samples,
      ],
      [
        "takePeriodIsTheGaitsOwn",
        () =>
          cycle.takes.get("walk")!.periodSeconds === HUMANOID_GAITS.walk.period,
      ],
      [
        "tableIsThreeRowsPerPart",
        () =>
          cycle.fallback.matrices.length ===
          cycle.names.length * 3 * cycle.samples * 4,
      ],
    ]),
    {
      chunks: true,
      anonymousTiers: true,
      meshes: true,
      marchingTier: true,
      marchingChunksShareOneTable: true,
      frozenTier: true,
      gait: true,
      wholeRepertoireIsBaked: true,
      phasePerMember: true,
      partPerVertex: true,
      partsIndexTheWholeFigure: true,
      tableRows: true,
      tableColumns: true,
      takePeriodIsTheGaitsOwn: true,
      tableIsThreeRowsPerPart: true,
    },
  );

  const injected = compileVertex(firstMaterial(marching[0]!));
  const untouched = compileVertex(firstMaterial(frozen[0]!));
  TestValidator.equals(
    "the tier material carries phase, part, and both vertex writes into the shader",
    namedFacts([
      [
        "phaseAttribute",
        () => injected.vertexShader.includes("attribute float automoviePhase;"),
      ],
      [
        "partAttribute",
        () => injected.vertexShader.includes("attribute float automoviePart;"),
      ],
      [
        "positionWrite",
        () =>
          injected.vertexShader.includes(
            "transformed = (automovieCycleMatrix() * vec4(transformed, 1.0)).xyz;",
          ),
      ],
      [
        "normalWrite",
        () =>
          injected.vertexShader.includes(
            "objectNormal = mat3(automovieCycleMatrix()) * objectNormal;",
          ),
      ],
      [
        "positionWriteFollowsBeginVertex",
        () =>
          injected.vertexShader.indexOf("#include <begin_vertex>") <
          injected.vertexShader.indexOf(
            "transformed = (automovieCycleMatrix()",
          ),
      ],
      [
        "normalWriteFollowsBeginNormalVertex",
        () =>
          injected.vertexShader.indexOf("#include <beginnormal_vertex>") <
          injected.vertexShader.indexOf("objectNormal = mat3("),
      ],
      [
        "sharedUniformCells",
        () =>
          injected.uniforms.automovieCycleAdvance ===
            cycle.uniforms.automovieCycleAdvance &&
          injected.uniforms.automovieCycleTexture ===
            cycle.uniforms.automovieCycleTexture,
      ],
      [
        "distinctProgramCacheKey",
        () => firstMaterial(marching[0]!).customProgramCacheKey().length !== 0,
      ],
      [
        "frozenTierMaterialUntouched",
        () =>
          untouched.vertexShader.includes("automoviePhase") === false &&
          Object.keys(untouched.uniforms).length === 0,
      ],
    ]),
    {
      phaseAttribute: true,
      partAttribute: true,
      positionWrite: true,
      normalWrite: true,
      positionWriteFollowsBeginVertex: true,
      normalWriteFollowsBeginNormalVertex: true,
      sharedUniformCells: true,
      distinctProgramCacheKey: true,
      frozenTierMaterialUntouched: true,
    },
  );

  const thigh = cycle.names.indexOf("left-thigh");
  const pelvis = cycle.names.indexOf("pelvis");
  // Two members picked by index could land on two seeded phases that happen to
  // sit close together, or half a cycle apart on a limb that reads the same at
  // both, and either would make this scenario a coin toss rather than a
  // measurement. The claims are quantified over a scanned band instead: members
  // spread across the cycle, and a member moves through the whole of its own.
  const scanned = Array.from({ length: 16 }, (_, slot) =>
    regenerateFormationSlot(formation, slot),
  );
  const lead = scanned.reduce((chosen, slot) =>
    slot.motionPhase < chosen.motionPhase ? slot : chosen,
  );
  const trail = scanned.reduce((chosen, slot) =>
    slot.motionPhase > chosen.motionPhase ? slot : chosen,
  );
  // Cadence is the ground a unit's cue covers, so a member is walked through
  // its cycle by turning the unit's own accumulator rather than by naming a
  // second. `advance` counts whole cycles: a full one has to come back.
  const covered = (advance: number): { advance: number; turn: number } => ({
    advance,
    turn: 0,
  });
  const leadAt = formationCyclePosition(covered(0), lead.motionPhase);
  const trailAt = formationCyclePosition(covered(0), trail.motionPhase);
  const leadThigh = sampleFormationCycleMatrix(cycle, thigh, leadAt);
  const widestBetweenMembers = Math.max(
    ...scanned.map((slot) =>
      separation(
        leadThigh,
        sampleFormationCycleMatrix(
          cycle,
          thigh,
          formationCyclePosition(covered(0), slot.motionPhase),
        ),
      ),
    ),
  );
  const widestWithinOneMember = Math.max(
    ...Array.from({ length: cycle.samples }, (_, step) =>
      separation(
        leadThigh,
        sampleFormationCycleMatrix(
          cycle,
          thigh,
          formationCyclePosition(
            covered(step / cycle.samples),
            lead.motionPhase,
          ),
        ),
      ),
    ),
  );
  TestValidator.equals(
    "phase puts members at their own points of one shared cycle",
    namedFacts([
      ["namedPartsResolve", () => thigh >= 0 && pelvis >= 0],
      ["phasesDiffer", () => lead.motionPhase !== trail.motionPhase],
      [
        "positionsStayInsideTheCycle",
        () => leadAt >= 0 && leadAt < 1 && trailAt >= 0 && trailAt < 1,
      ],
      ["positionsDiffer", () => Math.abs(leadAt - trailAt) > 1e-6],
      ["membersSpreadAcrossTheCycle", () => widestBetweenMembers > 1e-3],
      ["aMemberMovesThroughItsCycle", () => widestWithinOneMember > 1e-3],
      [
        "aWholeCycleReturnsIt",
        () =>
          separation(
            leadThigh,
            sampleFormationCycleMatrix(
              cycle,
              thigh,
              formationCyclePosition(covered(1), lead.motionPhase),
            ),
          ) < 1e-9,
      ],
      [
        "anUnarticulatedPartHolds",
        () =>
          separation(
            sampleFormationCycleMatrix(cycle, pelvis, leadAt),
            new THREE.Matrix4(),
          ) < 1e-9,
      ],
    ]),
    {
      namedPartsResolve: true,
      phasesDiffer: true,
      positionsStayInsideTheCycle: true,
      positionsDiffer: true,
      membersSpreadAcrossTheCycle: true,
      aMemberMovesThroughItsCycle: true,
      aWholeCycleReturnsIt: true,
      anUnarticulatedPartHolds: true,
    },
  );

  const rebuilt = buildInstancedFormation({ formation, models });
  const rebuiltMarching = instancedMeshes(rebuilt.object).filter(
    (mesh) => formationCycleOf(mesh) !== null,
  );
  const rebuiltCycle = formationCycleOf(rebuiltMarching[0]!)!;
  const compact = materializeCompiledFormation(
    {
      ...design,
      id: "cycle-unit-compact",
      count: 64,
      layout: {
        kind: "line",
        ranks: 1,
        files: 64,
        spacing: { lateral: 0.8, depth: 0.9 },
      },
    },
    recipes,
  );
  const compactCycle = formationCycleOf(
    instancedMeshes(
      buildInstancedFormation({ formation: compact, models }).object,
    ).find((mesh) => formationCycleOf(mesh) !== null)!,
  )!;
  const instanceBytes = meshes.reduce(
    (sum, mesh) =>
      sum +
      mesh.instanceMatrix.array.byteLength +
      floatAttribute(mesh, "automoviePhase").array.byteLength,
    0,
  );
  TestValidator.equals(
    "the table regenerates identically and costs nothing per member",
    namedFacts([
      [
        "rebuildIsIdentical",
        () => same(cycle.fallback.matrices, rebuiltCycle.fallback.matrices),
      ],
      [
        "phasesRebuildIdentically",
        () =>
          marching.every((mesh, index) =>
            same(
              floatAttribute(mesh, "automoviePhase").array,
              floatAttribute(rebuiltMarching[index]!, "automoviePhase").array,
            ),
          ),
      ],
      [
        "crowdSizeDoesNotChangeTheTable",
        () =>
          compactCycle.fallback.matrices.byteLength ===
            cycle.fallback.matrices.byteLength &&
          same(compactCycle.fallback.matrices, cycle.fallback.matrices),
      ],
      [
        "instanceBytesAreExactlyTheDeclaredCost",
        () =>
          instanceBytes ===
          formation.anonymousCount *
            formation.lod.length *
            AUTOMOVIE_FORMATION_INSTANCE_BYTES,
      ],
      [
        "instanceBytesStayInsideTheBudget",
        () => instanceBytes <= AUTOMOVIE_FORMATION_INSTANCE_BUFFER_BUDGET_BYTES,
      ],
    ]),
    {
      rebuildIsIdentical: true,
      phasesRebuildIdentically: true,
      crowdSizeDoesNotChangeTheTable: true,
      instanceBytesAreExactlyTheDeclaredCost: true,
      instanceBytesStayInsideTheBudget: true,
    },
  );

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 2_000);
  camera.position.set(0, 5, 20);
  camera.lookAt(0, 0, 0);
  built.update(camera, 1_080, 2.5);
  const advanced = cycle.uniforms.automovieCycleAdvance.value;
  built.update(camera, 1_080);
  // No cue moves this unit, and a unit that covers no ground takes no step:
  // the whole crowd holds its attitudes while the shot runs past it. Two and a
  // half seconds of nothing is exactly as many cycles as no seconds of it.
  TestValidator.equals(
    "a shot advancing over a unit no cue moves leaves it standing",
    { advanced, rested: cycle.uniforms.automovieCycleAdvance.value },
    { advanced: 0, rested: 0 },
  );

  const scene = new THREE.Scene();
  scene.add(built.object);
  const beautyMaterials = marching[0]!.material;
  const passes = (["depth", "normal", "mask", "outline"] as const).map(
    (pass) => {
      const handle = applyRenderMode(scene, pass);
      const overridden = compileVertex(firstMaterial(marching[0]!));
      const overriddenFrozen = compileVertex(firstMaterial(frozen[0]!));
      const shells = built.object.children
        .filter((child) => child.name === EDGE_SHELL_NAME)
        .map(
          (child) =>
            compileVertex(
              firstMaterial(child as THREE.Mesh),
            ).vertexShader.includes("attribute float automoviePhase;") === true,
        );
      handle.restore();
      return { pass, overridden, overriddenFrozen, shells };
    },
  );
  TestValidator.equals(
    "every material-swapping guide pass moves the crowd exactly as beauty does",
    namedFacts([
      [
        "everyPassCarriesTheCycle",
        () =>
          passes.every((entry) =>
            entry.overridden.vertexShader.includes(
              "attribute float automoviePhase;",
            ),
          ),
      ],
      [
        "everyPassSharesTheTierCadenceCell",
        () =>
          passes.every(
            (entry) =>
              entry.overridden.uniforms.automovieCycleAdvance ===
              cycle.uniforms.automovieCycleAdvance,
          ),
      ],
      [
        "noPassInventsMotionForAFrozenTier",
        () =>
          passes.every(
            (entry) =>
              entry.overriddenFrozen.vertexShader.includes("automoviePhase") ===
              false,
          ),
      ],
      [
        "onlyOutlineBuildsShells",
        () =>
          passes.every(
            (entry) =>
              entry.shells.length === (entry.pass === "outline" ? 4 : 0),
          ),
      ],
      [
        "outlineShellsCarryTheCycle",
        () =>
          passes
            .find((entry) => entry.pass === "outline")!
            .shells.filter((carried) => carried).length === 2,
      ],
      [
        "restoreReturnsTheBeautyMaterials",
        () => marching[0]!.material === beautyMaterials,
      ],
      [
        "restoreLeavesNoShellBehind",
        () =>
          built.object.children.every(
            (child) => child.name !== EDGE_SHELL_NAME,
          ),
      ],
    ]),
    {
      everyPassCarriesTheCycle: true,
      everyPassSharesTheTierCadenceCell: true,
      noPassInventsMotionForAFrozenTier: true,
      onlyOutlineBuildsShells: true,
      outlineShellsCarryTheCycle: true,
      restoreReturnsTheBeautyMaterials: true,
      restoreLeavesNoShellBehind: true,
    },
  );

  const silentFormation = materializeCompiledFormation(
    {
      ...design,
      id: "cycle-unit-silent",
      modelRecipe: still.id,
      count: 4,
      layout: {
        kind: "line",
        ranks: 1,
        files: 4,
        spacing: { lateral: 1, depth: 1 },
      },
    },
    recipes,
  );
  const nearModel = models.get(
    formation.lod.find((lod) => lod.tier === "near")!.model,
  )!;
  const withoutProfiles: IAutoMovieModel = { ...nearModel };
  delete withoutProfiles.profiles;
  const coarseBuilt = buildModel(nearModel);
  coarseBuilt.object.updateMatrixWorld(true);
  const coarse = bakeFormationCycle({
    model: nearModel,
    built: coarseBuilt,
    parts: instancedModelParts(coarseBuilt.object),
    samples: 4,
  })!;
  /** The near figure performing one gait whose declared period is `period`. */
  const timed = (period: number): IAutoMovieModel => ({
    ...nearModel,
    profiles: [
      { ...HUMANOID_PROFILE, gaits: [{ ...HUMANOID_GAITS.walk, period }] },
    ],
  });
  TestValidator.equals(
    "a figure with no gait to perform keeps standing, and a bad cycle fails closed",
    namedFacts([
      [
        "aRiggedFigureWithoutAGaitStaysStill",
        () =>
          instancedMeshes(
            buildInstancedFormation({ formation: silentFormation, models })
              .object,
          ).every((mesh) => formationCycleOf(mesh) === null),
      ],
      [
        "aModelWithoutProfilesHasNoCycle",
        () => formationCycleGait(withoutProfiles) === null,
      ],
      [
        "aProfileWithoutGaitsHasNoCycle",
        () =>
          formationCycleGait({
            ...nearModel,
            profiles: [
              {
                id: "cycle-mute",
                name: "cycle-mute",
                controls: [],
                drivers: [],
                limits: [],
              },
            ],
          }) === null,
      ],
      ["anExplicitSampleCountIsHonoured", () => coarse.samples === 4],
      [
        "anExplicitSampleCountSizesTheTable",
        () =>
          coarse.fallback.matrices.length === coarse.names.length * 3 * 4 * 4,
      ],
      [
        "aPartAboveTheFigureIsRefused",
        () =>
          throwsError(
            () => sampleFormationCycleMatrix(cycle, cycle.names.length, 0),
            "outside",
          ),
      ],
      [
        "aPartBelowZeroIsRefused",
        () =>
          throwsError(
            () => sampleFormationCycleMatrix(cycle, -1, 0),
            "outside",
          ),
      ],
      [
        "aZeroPeriodIsRefused",
        () =>
          throwsError(
            () =>
              bakeFormationCycle({
                model: timed(0),
                built: coarseBuilt,
                parts: [],
              }),
            "gait period",
          ),
      ],
      [
        "aNonFinitePeriodIsRefused",
        () =>
          throwsError(
            () =>
              bakeFormationCycle({
                model: timed(Number.NaN),
                built: coarseBuilt,
                parts: [],
              }),
            "gait period",
          ),
      ],
    ]),
    {
      aRiggedFigureWithoutAGaitStaysStill: true,
      aModelWithoutProfilesHasNoCycle: true,
      aProfileWithoutGaitsHasNoCycle: true,
      anExplicitSampleCountIsHonoured: true,
      anExplicitSampleCountSizesTheTable: true,
      aPartAboveTheFigureIsRefused: true,
      aPartBelowZeroIsRefused: true,
      aZeroPeriodIsRefused: true,
      aNonFinitePeriodIsRefused: true,
    },
  );
};

const instancedMeshes = (root: THREE.Object3D): THREE.InstancedMesh[] =>
  root.children.filter(
    (object): object is THREE.InstancedMesh =>
      object instanceof THREE.InstancedMesh,
  );

const firstMaterial = (mesh: THREE.Mesh): THREE.Material =>
  Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;

/**
 * Run one material's compile hook over a minimal three-shaped vertex stage.
 *
 * No GL context exists here and none is needed: what the hook does is rewrite
 * the include sites and hand back uniform cells, and both are observable as
 * plain values. A material with no injection has three's own empty hook, so the
 * same helper proves absence as well as presence.
 */
const compileVertex = (
  material: THREE.Material,
): {
  uniforms: Record<string, { value: unknown } | undefined>;
  vertexShader: string;
} => {
  const shader = {
    uniforms: {} as Record<string, { value: unknown } | undefined>,
    vertexShader: [
      "#include <common>",
      "void main() {",
      "  #include <beginnormal_vertex>",
      "  #include <begin_vertex>",
      "}",
    ].join("\n"),
    fragmentShader: "void main() {}",
  };
  material.onBeforeCompile(
    shader as unknown as Parameters<THREE.Material["onBeforeCompile"]>[0],
    null as unknown as Parameters<THREE.Material["onBeforeCompile"]>[1],
  );
  return shader;
};

const floatAttribute = (
  mesh: THREE.Mesh,
  name: string,
): THREE.BufferAttribute =>
  mesh.geometry.getAttribute(name) as THREE.BufferAttribute;

const maximum = (
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): number => {
  let found = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < attribute.count; ++index)
    found = Math.max(found, attribute.getX(index));
  return found;
};

/** Largest absolute element difference between two transforms. */
const separation = (left: THREE.Matrix4, right: THREE.Matrix4): number =>
  Math.max(
    ...left.elements.map((value, index) =>
      Math.abs(value - right.elements[index]!),
    ),
  );

const same = (left: ArrayLike<number>, right: ArrayLike<number>): boolean => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; ++index)
    if (left[index] !== right[index]) return false;
  return true;
};

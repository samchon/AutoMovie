import {
  AutoMovieRenderMetric,
  AutoMovieRenderMetricOrder,
  AutoMovieTextureBinding,
  IAutoMovieMaterial,
  IAutoMovieModel,
  IAutoMovieRenderAnalysisGap,
  IAutoMovieRenderInventory,
  IAutoMovieRenderModelCost,
  IAutoMovieRenderOwnerCost,
  IAutoMovieRenderTextureCost,
  IAutoMovieRenderTotals,
  IAutoMovieSemanticMask,
} from "@automovie/interface";

import { fluidDomainBudget } from "../fluid/shallowWater";
import { tessellateSurface } from "../geometry/surfaceMesh";
import { tessellate } from "../geometry/tessellate";
import { plantingBudget } from "../soft/planting";
import { softBodyBudget } from "../soft/softBody";
import { compareAutoMovieRenderIds } from "./renderDigest";
import {
  IAutoMovieRenderPrototypeCost,
  IAutoMovieRenderSubject,
} from "./renderSubject";
import { autoMovieSemanticMaskNodeIndex } from "./semanticMask";

/**
 * Every metric, in the fixed order a report lists them.
 *
 * The single runtime spelling of `AutoMovieRenderMetricOrder`. A report always
 * carries all of them, which is what makes its length independent of the
 * production and what stops an unmeasured cost from disappearing instead of
 * being reported as unmeasured.
 */
export const AUTOMOVIE_RENDER_METRICS: Readonly<AutoMovieRenderMetricOrder> = [
  "triangles",
  "vertices",
  "drawCalls",
  "materials",
  "textures",
  "textureBytes",
  "geometryBytes",
  "lights",
  "shadowMaps",
  "nodes",
  "instanceSets",
  "instanceSlots",
  "instanceChunks",
  "fluidCells",
  "fluidParticles",
];

/** Device bytes of one vertex position: three 32-bit floats. */
export const AUTOMOVIE_POSITION_BYTES = 12;

/** Device bytes of one vertex normal: three 32-bit floats. */
export const AUTOMOVIE_NORMAL_BYTES = 12;

/** Device bytes of one texture coordinate pair: two 32-bit floats. */
export const AUTOMOVIE_UV_BYTES = 8;

/** Device bytes of one triangle index: one 32-bit unsigned integer. */
export const AUTOMOVIE_INDEX_BYTES = 4;

/**
 * Device bytes of one vertex's skin binding: four 16-bit joint indices and four
 * 32-bit weights, the glTF four-influence convention the mesh type documents.
 */
export const AUTOMOVIE_SKIN_BYTES = 24;

/** Device bytes of one RGBA8 texel. */
export const AUTOMOVIE_TEXEL_BYTES = 4;

/**
 * Device bytes of one vertex's free-surface flow vector: two 32-bit floats.
 *
 * A drawn water surface carries this attribute beside position, normal and
 * texture coordinate, and a ripple shader scrolls along it. Leaving it out
 * would understate the one buffer a pond has that a wall does not.
 */
export const AUTOMOVIE_FLOW_BYTES = 8;

/**
 * Measure what one frame of a subject commits the renderer to.
 *
 * Everything here is exact or an explicit upper bound, and the difference is
 * stated per metric rather than left to a reader:
 *
 * - Counts of nodes, lights, slots, chunks, materials and textures are exact;
 * - Triangles, vertices and draw calls for instanced sets are UPPER BOUNDS, taken
 *   over the most expensive level of detail and the most expensive prototype a
 *   slot could select, because level-of-detail selection and frustum culling
 *   are camera facts and a budget must hold for every camera;
 * - Texture bytes are estimated from decoded dimensions, and are absent rather
 *   than invented when a bound asset's dimensions were not supplied.
 *
 * The upper-bound direction is the only safe one. A budget checked against an
 * average would pass a production that stutters whenever the camera turns
 * toward the crowd, which is exactly the frame anyone would have wanted the
 * budget to catch.
 *
 * Simulated drawables — cloth panels, planting clusters and water surfaces —
 * are measured beside the staged ones. They are held by no scene node, so
 * leaving them out was never "not yet supported": it was a triangle count for a
 * room the curtain, the fern bed and the pond are missing from, checked against
 * a budget and reported as cleared. Their cost comes from the domain record
 * alone and no solve has to run, which is what lets a production be refused
 * before the first step is integrated.
 *
 * Owners are the semantic ids of the mask, so a cost in the report and a colour
 * in the mask name the same thing. Shared resources that draw no pixels of
 * their own carry a `material:`, `texture:` or `light:` identity instead.
 *
 * @author Samchon
 */
export const measureAutoMovieRenderInventory = (props: {
  /** The drawable world. */
  subject: IAutoMovieRenderSubject;
  /** Semantic palette derived from the same subject. */
  mask: IAutoMovieSemanticMask;
}): IAutoMovieRenderInventory => {
  const { subject, mask } = props;
  const nodeIndex = autoMovieSemanticMaskNodeIndex(mask);
  const byId = new Map(subject.models.map((model) => [model.id, model]));
  const model = (id: string, cited: string): IAutoMovieModel => {
    const found = byId.get(id);
    if (found === undefined)
      throw new Error(
        `render inventory cannot measure ${cited}: model "${id}" is absent from the subject's models`,
      );
    return found;
  };

  const costs = new Map<string, IAutoMovieRenderModelCost>();
  const owners: IAutoMovieRenderOwnerCost[] = [];
  const gaps: IAutoMovieRenderAnalysisGap[] = [];
  const drawnModels = new Set<string>();
  const add = (
    owner: string,
    source: string,
    metric: AutoMovieRenderMetric,
    cost: number,
  ): void => {
    owners.push({ owner, source, metric, cost });
  };

  // Every material the subject declares, drawn or not. A simulated drawable
  // names a material the way a model part does, and that name has to resolve
  // somewhere before its textures can be counted; resolving it against the
  // DRAWN models only would refuse a curtain fabric declared on a model this
  // shot does not stage.
  const declared = new Map<string, IAutoMovieMaterial>();
  for (const model of subject.models)
    for (const material of model.materials)
      if (!declared.has(material.id)) declared.set(material.id, material);
  const materials = new Map<string, IAutoMovieMaterial>();
  let defaultMaterials = 0;
  /**
   * Count the material one simulated drawable binds.
   *
   * A named material is the same object a model part would bind, so it joins
   * the shared table and its textures are counted once however many drawables
   * name it. An unnamed one is a material the renderer creates for that
   * drawable alone, so it is counted once per drawable and binds no texture:
   * that is what the viewer actually builds, and reporting nothing for it would
   * put the compiled bound below what a live scene submits.
   */
  const cite = (
    material: string | null,
    owner: string,
    source: string,
    cited: string,
  ): void => {
    if (material === null) {
      ++defaultMaterials;
      add(`material:${owner}/default`, source, "materials", 1);
      return;
    }
    const found = declared.get(material);
    if (found === undefined)
      throw new Error(
        `render inventory cannot measure ${cited}: material "${material}" is absent from the subject's models`,
      );
    if (!materials.has(material)) materials.set(material, found);
  };

  // --- ordinary scene nodes -------------------------------------------------
  let triangles = 0;
  let vertices = 0;
  let drawCalls = 0;
  for (const node of subject.scene.nodes) {
    const cost = measure(model(node.model, `scene node "${node.id}"`), costs);
    drawnModels.add(cost.model);
    triangles += cost.triangles;
    vertices += cost.vertices;
    drawCalls += cost.parts;
    const entry = nodeIndex.get(node.id);
    const owner = entry === undefined ? `node:${node.id}` : entry.id;
    // A staged prop is edited in the scene; a lowered building element is
    // edited in the building that produced it. Keying off the entry's KIND and
    // not merely its presence is what keeps a prop from being reported at a
    // building path nobody can open.
    const source =
      entry?.kind === "element"
        ? `builtEnvironments[].elements["${node.id}"]`
        : `scene.nodes["${node.id}"]`;
    add(owner, source, "triangles", cost.triangles);
    add(owner, source, "vertices", cost.vertices);
    add(owner, source, "drawCalls", cost.parts);
    add(owner, source, "nodes", 1);
  }

  // --- the standable ground -------------------------------------------------
  const space = subject.scene.space ?? null;
  let groundBytes = 0;
  if (space !== null) {
    // Measured through the SAME tessellator the viewer draws the ground with,
    // so the ground is counted exactly rather than left out. Leaving it out was
    // the tempting shortcut and the wrong one: a triangle budget that quietly
    // excludes the floor is a budget that clears a scene it never measured.
    // A footprint enclosing no area tessellates to nothing and the viewer draws
    // no mesh for it, so it costs nothing here either.
    const owner = `node:${space.id}`;
    let groundTriangles = 0;
    let groundVertices = 0;
    let groundDraws = 0;
    for (const surface of space.surfaces) {
      const mesh = tessellateSurface(surface);
      if (mesh === null) continue;
      ++groundDraws;
      groundTriangles += mesh.indices.length / 3;
      groundVertices += mesh.positions.length / 3;
      groundBytes +=
        (mesh.positions.length / 3) *
          (AUTOMOVIE_POSITION_BYTES + AUTOMOVIE_NORMAL_BYTES) +
        mesh.indices.length * AUTOMOVIE_INDEX_BYTES;
    }
    triangles += groundTriangles;
    vertices += groundVertices;
    drawCalls += groundDraws;
    add(owner, "scene.space.surfaces", "triangles", groundTriangles);
    add(owner, "scene.space.surfaces", "vertices", groundVertices);
    add(owner, "scene.space.surfaces", "drawCalls", groundDraws);
    add(owner, "scene.space.surfaces", "geometryBytes", groundBytes);
    add(owner, "scene.space.surfaces", "nodes", 1);
  }

  // --- instanced sets -------------------------------------------------------
  let instanceSlots = 0;
  let instanceChunks = 0;
  for (const instanceSet of subject.instanceSets ?? []) {
    const prototypes = instanceSet.prototypes ?? [
      {
        id: "default",
        modelRecipe: instanceSet.modelRecipe,
        weight: 1,
        lod: instanceSet.lod,
        projectionRadius: instanceSet.projectionRadius,
      },
    ];
    let worstTriangles = 0;
    let worstVertices = 0;
    let partsPerChunk = 0;
    for (const prototype of prototypes) {
      // Near-to-far order: the first tier is the most expensive representation
      // any slot of this prototype can select.
      const finest = prototype.lod[0];
      if (finest === undefined)
        throw new Error(
          `render inventory cannot measure instance set "${instanceSet.id}": prototype "${prototype.id}" declares no level of detail`,
        );
      const cost = measure(
        model(
          finest.model,
          `instance set "${instanceSet.id}" prototype "${prototype.id}"`,
        ),
        costs,
        finest.tier,
      );
      drawnModels.add(cost.model);
      worstTriangles = Math.max(worstTriangles, cost.triangles);
      worstVertices = Math.max(worstVertices, cost.vertices);
      partsPerChunk += cost.parts;
    }
    const owner = `instance-set:${instanceSet.id}`;
    const source = `world.instanceSets["${instanceSet.id}"]`;
    const setDraws = instanceSet.chunks.length * partsPerChunk;
    instanceSlots += instanceSet.count;
    instanceChunks += instanceSet.chunks.length;
    triangles += instanceSet.count * worstTriangles;
    vertices += instanceSet.count * worstVertices;
    drawCalls += setDraws;
    add(owner, source, "triangles", instanceSet.count * worstTriangles);
    add(owner, source, "vertices", instanceSet.count * worstVertices);
    add(owner, source, "drawCalls", setDraws);
    add(owner, source, "instanceSlots", instanceSet.count);
    add(owner, source, "instanceChunks", instanceSet.chunks.length);
    add(owner, source, "instanceSets", 1);
  }

  // --- simulated drawables --------------------------------------------------
  // Cloth, planting and water are drawn by the same renderer as everything
  // above and are held by no scene node, so a subject that measured only nodes,
  // ground and instance sets would report a triangle count for a room the
  // curtain, the fern bed and the pond are missing from. Every count here is
  // derived from the domain record alone: no solve has to run, which is the
  // whole point of refusing a production before the first step is integrated.
  let simulatedNodes = 0;
  let simulatedBytes = 0;
  let fluidCells = 0;
  let fluidParticles = 0;
  const unmeasured: string[] = [];

  for (const panel of subject.softBodies ?? []) {
    const owner = `soft-body:${panel.domain.id}`;
    const source = `softBodies["${panel.domain.id}"]`;
    // One vertex per particle and two triangles per lattice quad, read from the
    // domain's own budget rather than recomputed: a second copy of that
    // arithmetic here would keep answering with the old shape the day the panel
    // geometry changes. A lattice one particle wide holds no quad, so it is a
    // cord, it draws nothing, and the viewer hides it rather than submitting a
    // degenerate mesh.
    const cost = softBodyBudget(panel.domain);
    const panelVertices = cost.particles;
    const panelTriangles = cost.triangles;
    const panelDraws = panelTriangles === 0 ? 0 : 1;
    const panelBytes =
      panelVertices *
        (AUTOMOVIE_POSITION_BYTES +
          AUTOMOVIE_NORMAL_BYTES +
          AUTOMOVIE_UV_BYTES) +
      panelTriangles * 3 * AUTOMOVIE_INDEX_BYTES;
    triangles += panelTriangles;
    vertices += panelVertices;
    drawCalls += panelDraws;
    simulatedBytes += panelBytes;
    ++simulatedNodes;
    add(owner, source, "triangles", panelTriangles);
    add(owner, source, "vertices", panelVertices);
    add(owner, source, "drawCalls", panelDraws);
    add(owner, source, "geometryBytes", panelBytes);
    add(owner, source, "nodes", 1);
    // A hidden mesh binds no material the renderer ever has to prepare, so a
    // cord costs its buffers and nothing else.
    if (panelDraws !== 0)
      cite(panel.material, owner, source, `soft body "${panel.domain.id}"`);
  }

  for (const planting of subject.plantings ?? []) {
    const owner = `planting:${planting.cluster.id}`;
    const source = `plantings["${planting.cluster.id}"]`;
    const budget = plantingBudget({
      domain: planting.domain,
      cluster: planting.cluster,
    });
    // Two instanced batches, never two draws per member: that is the whole
    // reason a bed of forty ferns is affordable. A batch with no instance is
    // never built, or is hidden, so it submits nothing and binds nothing.
    //
    // A branch is drawn as whatever solid the renderer sweeps along it, so the
    // per-instance geometry is a renderer fact and not a recipe fact. Stating
    // it is what turns the geometry metrics from unmeasured into measured, and
    // withholding it leaves them unmeasured rather than guessed.
    const batches = [
      {
        part: "branch",
        instances: budget.worstCaseBranchInstances,
        material: planting.branchMaterial,
        cost: statedPrototype(
          planting.branch,
          `planting "${planting.cluster.id}" branch`,
        ),
      },
      {
        part: "leaf",
        instances: budget.worstCaseLeafInstances,
        material: planting.leafMaterial,
        cost: statedPrototype(
          planting.leaf,
          `planting "${planting.cluster.id}" leaf`,
        ),
      },
    ];
    let plantDraws = 0;
    let plantSlots = 0;
    let plantTriangles = 0;
    let plantVertices = 0;
    let plantBytes = 0;
    let stated = true;
    for (const batch of batches) {
      if (batch.instances === 0) continue;
      ++plantDraws;
      plantSlots += batch.instances;
      cite(
        batch.material,
        `${owner}/${batch.part}`,
        source,
        `planting "${planting.cluster.id}" ${batch.part}`,
      );
      if (batch.cost === null) {
        stated = false;
        continue;
      }
      plantTriangles += batch.instances * batch.cost.triangles;
      plantVertices += batch.instances * batch.cost.vertices;
      // The prototype buffers are uploaded once and reused by every instance,
      // which is exactly what makes instancing cheaper than duplication; the
      // per-instance matrices are the caller's stream and are not geometry.
      plantBytes += prototypeBytes(batch.cost);
    }
    drawCalls += plantDraws;
    instanceSlots += plantSlots;
    ++simulatedNodes;
    add(owner, source, "drawCalls", plantDraws);
    add(owner, source, "instanceSlots", plantSlots);
    add(owner, source, "nodes", 1);
    if (!stated) {
      unmeasured.push(planting.cluster.id);
      continue;
    }
    triangles += plantTriangles;
    vertices += plantVertices;
    simulatedBytes += plantBytes;
    add(owner, source, "triangles", plantTriangles);
    add(owner, source, "vertices", plantVertices);
    add(owner, source, "geometryBytes", plantBytes);
  }
  if (unmeasured.length !== 0)
    for (const metric of ["triangles", "vertices", "geometryBytes"] as const)
      gaps.push({
        metric,
        status: "not-run",
        reason: `${unmeasured.length} planting cluster(s) state no drawn prototype cost, starting with "${[...unmeasured].sort(compareAutoMovieRenderIds)[0]!}"`,
        remedy:
          "pass each planting cluster's branch and leaf prototype vertex and triangle counts, as the renderer builds them, in the subject's plantings list",
      });

  // --- water ----------------------------------------------------------------
  const bodies = subject.waterBodies ?? [];
  const unsolved = bodies.filter(
    (body) => body.domain === null && body.cells === null,
  );
  if (unsolved.length !== 0)
    for (const metric of ["fluidCells", "fluidParticles"] as const)
      gaps.push({
        metric,
        status: "unsupported",
        reason: `${unsolved.length} declared water body/bodies carry no solver-proved cost, so this metric has no analysis behind it`,
        remedy:
          "bind each water body to its shallow-water domain, or supply its solver-derived cell and particle cost, or remove the declared water bodies",
      });
  for (const body of bodies) {
    const owner = `water-body:${body.id}`;
    const source = `waterBodies["${body.id}"]`;
    if (body.domain === null) {
      if (body.cells === null) continue;
      fluidCells += body.cells;
      fluidParticles += body.particles ?? 0;
      add(owner, source, "fluidCells", body.cells);
      add(owner, source, "fluidParticles", body.particles ?? 0);
      continue;
    }
    // A bound domain states its own cost exactly, so nothing is copied by hand
    // and nothing can drift from the record it describes.
    const budget = fluidDomainBudget(body.domain);
    fluidCells += budget.cells;
    fluidParticles += budget.sprayParticleCap;
    add(owner, source, "fluidCells", budget.cells);
    add(owner, source, "fluidParticles", budget.sprayParticleCap);
    // One vertex per cell, at the cell centre, and two triangles per quad whose
    // four corner cells are all wet. Dry and solid cells only ever drop quads,
    // so the full lattice is the upper bound a budget has to hold against.
    const { columns, rows } = body.domain.grid;
    const waterVertices = columns * rows;
    const waterTriangles = 2 * quads(columns) * quads(rows);
    const waterDraws = waterTriangles === 0 ? 0 : 1;
    const waterBytes =
      waterVertices *
        (AUTOMOVIE_POSITION_BYTES +
          AUTOMOVIE_NORMAL_BYTES +
          AUTOMOVIE_UV_BYTES +
          AUTOMOVIE_FLOW_BYTES) +
      waterTriangles * 3 * AUTOMOVIE_INDEX_BYTES;
    triangles += waterTriangles;
    vertices += waterVertices;
    drawCalls += waterDraws;
    simulatedBytes += waterBytes;
    ++simulatedNodes;
    add(owner, source, "triangles", waterTriangles);
    add(owner, source, "vertices", waterVertices);
    add(owner, source, "drawCalls", waterDraws);
    add(owner, source, "geometryBytes", waterBytes);
    add(owner, source, "nodes", 1);
    if (waterDraws !== 0)
      cite(body.material, owner, source, `water body "${body.id}"`);
  }

  // --- materials and textures ----------------------------------------------
  for (const id of drawnModels)
    for (const material of byId.get(id)!.materials)
      if (!materials.has(material.id)) materials.set(material.id, material);
  const textureMaterials = new Map<string, Set<string>>();
  for (const material of materials.values()) {
    add(
      `material:${material.id}`,
      `models[].materials["${material.id}"]`,
      "materials",
      1,
    );
    for (const asset of texturesOf(material)) {
      const bucket = textureMaterials.get(asset);
      if (bucket === undefined)
        textureMaterials.set(asset, new Set([material.id]));
      else bucket.add(material.id);
    }
  }
  const sizes = new Map(
    (subject.textures ?? []).map((texture) => [texture.asset, texture]),
  );
  const missing: string[] = [];
  const textures: IAutoMovieRenderTextureCost[] = [...textureMaterials.keys()]
    .sort(compareAutoMovieRenderIds)
    .map((asset) => {
      const size = sizes.get(asset);
      if (size === undefined) missing.push(asset);
      const bytes =
        size === undefined
          ? null
          : Math.round(
              size.width *
                size.height *
                AUTOMOVIE_TEXEL_BYTES *
                (size.mipmapped ? 4 / 3 : 1),
            );
      if (bytes !== null)
        add(`texture:${asset}`, `assets["${asset}"]`, "textureBytes", bytes);
      add(`texture:${asset}`, `assets["${asset}"]`, "textures", 1);
      return {
        asset,
        materials: [...textureMaterials.get(asset)!].sort(
          compareAutoMovieRenderIds,
        ),
        bytes,
      };
    });
  if (missing.length !== 0)
    gaps.push({
      metric: "textureBytes",
      status: "not-run",
      reason: `${missing.length} bound texture asset(s) have no supplied dimensions, starting with "${missing.sort(compareAutoMovieRenderIds)[0]!}"`,
      remedy:
        "pass every bound asset's decoded width, height and mipmap policy in the subject's textures list",
    });

  // --- geometry memory ------------------------------------------------------
  let geometryBytes = groundBytes + simulatedBytes;
  for (const id of [...drawnModels].sort(compareAutoMovieRenderIds)) {
    const cost = costs.get(id)!;
    geometryBytes += cost.geometryBytes;
    add(`model:${id}`, `models["${id}"]`, "geometryBytes", cost.geometryBytes);
  }

  // --- lights and shadow maps ----------------------------------------------
  const shadowsEnabled = subject.scene.environment?.shadows.enabled ?? true;
  const casters: string[] = [];
  for (const light of subject.scene.lights) {
    add(`light:${light.id}`, `scene.lights["${light.id}"]`, "lights", 1);
    // A rectangular area source is analytically integrated and rasterizes no
    // shadow camera, so it can never add a map however it is flagged.
    if (light.type === "area" || light.castShadow !== true || !shadowsEnabled)
      continue;
    casters.push(light.id);
    add(`light:${light.id}`, `scene.lights["${light.id}"]`, "shadowMaps", 1);
  }
  // Each shadow map is one further depth pass over every opaque draw already
  // counted, and the environment background costs one full-screen draw.
  const shadowMaps = casters.length;
  const opaqueDraws = drawCalls;
  for (const caster of casters) {
    drawCalls += opaqueDraws;
    add(
      `light:${caster}`,
      `scene.lights["${caster}"]`,
      "drawCalls",
      opaqueDraws,
    );
  }
  const image = subject.scene.environment?.image ?? null;
  if (image !== null) {
    drawCalls += 1;
    add(`texture:${image}`, "scene.environment.image", "drawCalls", 1);
  }

  const nodes =
    subject.scene.nodes.length + (space === null ? 0 : 1) + simulatedNodes;
  // A cluster whose drawn prototype nobody stated leaves an unknown share of
  // the geometry out, so the totals it belongs to are absent rather than a sum
  // that reads complete while missing a fern bed.
  const partial = unmeasured.length !== 0;
  const totals: IAutoMovieRenderTotals = {
    triangles: partial ? null : triangles,
    vertices: partial ? null : vertices,
    drawCalls,
    materials: materials.size + defaultMaterials,
    textures: textures.length,
    textureBytes: missing.length !== 0 ? null : sumBytes(textures),
    geometryBytes: partial ? null : geometryBytes,
    lights: subject.scene.lights.length,
    shadowMaps,
    nodes,
    instanceSets: (subject.instanceSets ?? []).length,
    instanceSlots,
    instanceChunks,
    fluidCells: unsolved.length !== 0 ? null : fluidCells,
    fluidParticles: unsolved.length !== 0 ? null : fluidParticles,
  };
  return {
    version: 1,
    models: [...costs.values()].sort((left, right) =>
      compareAutoMovieRenderIds(left.model, right.model),
    ),
    textures,
    instanceSets: (subject.instanceSets ?? [])
      .map((instanceSet) => ({
        instanceSet: instanceSet.id,
        slots: instanceSet.count,
        chunks: instanceSet.chunks.length,
        prototypes: (instanceSet.prototypes ?? [null]).length,
        drawCallUpperBound: owners
          .filter(
            (entry) =>
              entry.owner === `instance-set:${instanceSet.id}` &&
              entry.metric === "drawCalls",
          )
          .reduce((sum, entry) => sum + entry.cost, 0),
      }))
      .sort((left, right) =>
        compareAutoMovieRenderIds(left.instanceSet, right.instanceSet),
      ),
    totals,
    owners: owners.sort(
      (left, right) =>
        compareAutoMovieRenderIds(left.owner, right.owner) ||
        compareAutoMovieRenderIds(left.metric, right.metric),
    ),
    gaps,
  };
};

const sumBytes = (textures: readonly IAutoMovieRenderTextureCost[]): number =>
  textures.reduce((sum, texture) => sum + texture.bytes!, 0);

/**
 * Quads one lattice axis of `count` sites spans.
 *
 * A single site spans none, which is what makes a one-particle-wide cloth a
 * cord and a one-cell-wide pond a line: both draw nothing at all, and inventing
 * a sliver for either would be inventing geometry.
 */
const quads = (count: number): number => (count > 1 ? count - 1 : 0);

/**
 * Read one stated prototype cost, refusing a value no renderer could hold.
 *
 * A fractional or negative vertex count is an authoring or adapter mistake, and
 * multiplying one by ten thousand instances would put a fabricated number into
 * the one report that exists to hold real ones.
 */
const statedPrototype = (
  cost: IAutoMovieRenderPrototypeCost | null,
  cited: string,
): IAutoMovieRenderPrototypeCost | null => {
  if (cost === null) return null;
  for (const [field, value] of [
    ["vertices", cost.vertices],
    ["triangles", cost.triangles],
  ] as const)
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error(
        `render inventory cannot measure ${cited} prototype: ${field} must be a safe integer at or above zero, but was ${value}`,
      );
  return cost;
};

/** Device bytes one instanced prototype's own buffers occupy. */
const prototypeBytes = (cost: IAutoMovieRenderPrototypeCost): number =>
  cost.vertices *
    (AUTOMOVIE_POSITION_BYTES + AUTOMOVIE_NORMAL_BYTES + AUTOMOVIE_UV_BYTES) +
  cost.triangles * 3 * AUTOMOVIE_INDEX_BYTES;

/**
 * Exact geometry cost of one model, memoized by model id.
 *
 * Primitives are measured by tessellating them with the engine's own
 * tessellator rather than by a table of formulas: a table would be a second
 * source of truth for how many triangles a sphere has, and the day the
 * tessellator's ring count changes, the budget would still be checking the old
 * number.
 */
const measure = (
  model: IAutoMovieModel,
  cache: Map<string, IAutoMovieRenderModelCost>,
  tier?: "hero" | "near" | "far",
): IAutoMovieRenderModelCost => {
  const cached = cache.get(model.id);
  if (cached !== undefined) {
    // A model cited by several level-of-detail tiers, or by both a tier and a
    // plain scene node, has no single tier to report.
    if (cached.tier !== (tier ?? null)) cached.tier = null;
    return cached;
  }
  let vertices = 0;
  let triangles = 0;
  let geometryBytes = 0;
  const materials = new Set<string>();
  for (const part of model.parts) {
    if (part.material !== null) materials.add(part.material);
    if (part.geometry.type === "primitive") {
      const mesh = tessellate(part.geometry.shape);
      const count = mesh.positions.length / 3;
      vertices += count;
      triangles += mesh.indices.length / 3;
      geometryBytes +=
        count * (AUTOMOVIE_POSITION_BYTES + AUTOMOVIE_NORMAL_BYTES) +
        mesh.indices.length * AUTOMOVIE_INDEX_BYTES;
      continue;
    }
    const mesh = part.geometry.mesh;
    const count = mesh.positions.length / 3;
    vertices += count;
    triangles += mesh.indices === null ? count / 3 : mesh.indices.length / 3;
    geometryBytes +=
      count *
        (AUTOMOVIE_POSITION_BYTES +
          (mesh.normals === null ? 0 : AUTOMOVIE_NORMAL_BYTES) +
          (mesh.uvs === null ? 0 : AUTOMOVIE_UV_BYTES) +
          (mesh.skin === null ? 0 : AUTOMOVIE_SKIN_BYTES)) +
      (mesh.indices === null ? 0 : mesh.indices.length) * AUTOMOVIE_INDEX_BYTES;
  }
  const cost: IAutoMovieRenderModelCost = {
    model: model.id,
    tier: tier ?? null,
    parts: model.parts.length,
    vertices,
    triangles,
    materials: [...materials].sort(compareAutoMovieRenderIds),
    geometryBytes,
  };
  cache.set(model.id, cost);
  return cost;
};

/** Every distinct texture asset one material binds, ascending. */
const texturesOf = (material: IAutoMovieMaterial): string[] => {
  const assets = new Set<string>();
  const bind = (binding: AutoMovieTextureBinding | null | undefined): void => {
    if (binding === null || binding === undefined) return;
    assets.add(typeof binding === "string" ? binding : binding.asset);
  };
  bind(material.baseColorTexture);
  bind(material.metallicRoughnessTexture);
  bind(material.normalTexture);
  bind(material.occlusionTexture);
  bind(material.emissiveTexture);
  return [...assets].sort(compareAutoMovieRenderIds);
};

import {
  IAutoMovieCompiledInstanceSet,
  IAutoMovieInstanceSetDesign,
  IAutoMovieModel,
  IAutoMovieModelRecipe,
  IAutoMovieWorldDesign,
} from "@automovie/interface";
import {
  materializeCompiledInstanceSet,
  materializeInstanceSlot,
  materializeProductionModels,
} from "@automovie/mcp";
import { exportModelToGLB } from "@automovie/render";
import {
  IAutoMovieModelObject,
  buildInstancedInstanceSet,
  createImportedModelObject,
  flattenInstancedObject,
  regenerateInstanceSlot,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { namedFacts, nclose, throwsError } from "../internal/predicates";
import { modelRecipe, worldDesign } from "../mcp/productionFixtures";

const instanceMeshes = (object: THREE.Object3D): THREE.InstancedMesh[] =>
  object.children.filter(
    (child): child is THREE.InstancedMesh =>
      child instanceof THREE.InstancedMesh,
  );

/** Locate the batch and buffer index one compiled slot was written into. */
const locateSlot = (
  object: THREE.Object3D,
  slot: number,
): { mesh: THREE.InstancedMesh; index: number } | null => {
  for (const mesh of instanceMeshes(object)) {
    const index = (mesh.userData.automovieSlots as number[]).indexOf(slot);
    if (index >= 0) return { mesh, index };
  }
  return null;
};

/**
 * True when the GPU matrix of one slot is the compiled slot's exact transform.
 *
 * Translation is anchor-relative because the batch lives under the set's own
 * group; rotation is compared as a rotation rather than as four numbers, so a
 * negated but identical quaternion still counts.
 */
const instanceTransformMatches = (
  object: THREE.Object3D,
  compiled: IAutoMovieCompiledInstanceSet,
  slot: number,
): boolean => {
  const located = locateSlot(object, slot);
  if (located === null) return false;
  const expected = regenerateInstanceSlot(compiled, slot);
  const matrix = new THREE.Matrix4();
  located.mesh.getMatrixAt(located.index, matrix);
  const translation = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(translation, rotation, scale);
  const expectedRotation =
    expected.rotation === undefined
      ? new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          THREE.MathUtils.degToRad(expected.facingDeg),
        )
      : new THREE.Quaternion(
          expected.rotation.x,
          expected.rotation.y,
          expected.rotation.z,
          expected.rotation.w,
        );
  const expectedScale = expected.scale3 ?? {
    x: expected.scale,
    y: expected.scale,
    z: expected.scale,
  };
  return (
    nclose(translation.x, expected.position.x - compiled.anchor.x, 1e-5) &&
    nclose(translation.y, expected.position.y - compiled.anchor.y, 1e-5) &&
    nclose(translation.z, expected.position.z - compiled.anchor.z, 1e-5) &&
    Math.abs(Math.abs(rotation.dot(expectedRotation)) - 1) <= 1e-6 &&
    nclose(scale.x, expectedScale.x, 1e-5) &&
    nclose(scale.y, expectedScale.y, 1e-5) &&
    nclose(scale.z, expectedScale.z, 1e-5)
  );
};

/**
 * The diffuse hex one batch material multiplies, or null when it has none.
 *
 * Read structurally rather than through `instanceof THREE.Color`. A material
 * that came back from `GLTFLoader` carries a colour built by three's ESM entry
 * while this file holds its CommonJS one, so the same class is two different
 * constructors and an identity test calls a perfectly neutral material
 * non-neutral. The value is what the claim is about.
 */
const diffuseHex = (material: THREE.Material): number | null => {
  const color = (material as THREE.Material & { color?: THREE.Color }).color;
  return color === undefined ? null : color.getHex();
};

/** Every instance matrix and color of one built set, in batch order. */
const batchBytes = (object: THREE.Object3D): string =>
  JSON.stringify(
    instanceMeshes(object).map((mesh) => [
      mesh.name,
      [...mesh.instanceMatrix.array],
      [...(mesh.instanceColor?.array ?? [])],
    ]),
  );

/**
 * One rigid source model exported and re-read as registered glTF bytes.
 *
 * Each entry becomes its own part with its own material, which is what a
 * registered asset carrying several primitives decodes back into: one rigid
 * mesh per material rather than one mesh binding a material array.
 */
const staticGltfSource = (
  id: string,
  parts: ReadonlyArray<{
    positions: readonly number[];
    indices: readonly number[];
    color: { r: number; g: number; b: number };
  }>,
): IAutoMovieModel => ({
  id,
  name: null,
  origin: "generated",
  body: null,
  skeleton: null,
  materials: parts.map((part, index) => ({
    id: `surface-${index}`,
    name: null,
    baseColor: { ...part.color, a: 1, hex: null },
    metallic: 0,
    roughness: 0.7,
    emissive: null,
    opacity: 1,
    baseColorTexture: null,
  })),
  parts: parts.map((part, index) => ({
    id: `surface-${index}`,
    name: null,
    material: `surface-${index}`,
    transform: null,
    attachedBone: null,
    geometry: {
      type: "mesh",
      mesh: {
        positions: [...part.positions],
        normals: null,
        uvs: null,
        indices: [...part.indices],
        skin: null,
      },
    },
  })),
  asset: null,
});

/**
 * Decode one registered static glTF exactly the way a viewer host does.
 *
 * The bytes are real: the source model is exported to a `.glb` and read back
 * through `GLTFLoader`, so what the instancing path receives is a decoded asset
 * rather than an object the test assembled to look like one.
 */
const loadStaticGltfPrototype = async (
  source: IAutoMovieModel,
): Promise<IAutoMovieModelObject> => {
  const glb = await exportModelToGLB(source);
  const gltf = await new GLTFLoader().parseAsync(
    glb.buffer.slice(
      glb.byteOffset,
      glb.byteOffset + glb.byteLength,
    ) as ArrayBuffer,
    "",
  );
  return createImportedModelObject({ object: gltf.scene, bones: new Map() });
};

const importedObject = (mesh: THREE.Object3D): IAutoMovieModelObject => {
  const object = new THREE.Group();
  object.add(mesh);
  return createImportedModelObject({ object, bones: new Map() });
};

/**
 * General instance sets stay compact GPU batches with exact full-TRS placement.
 *
 * The claim under test is that many placed copies cost instance matrices rather
 * than scene nodes, and that what the compiler decided for a slot is exactly
 * what the GPU is handed: translation, unit quaternion and per-axis scale, not
 * a heading and a scalar. Prototypes, palettes, traits and visibility ride the
 * same regeneration, and a registered static glTF is a prototype like any
 * other.
 *
 * Scenarios:
 *
 * 1. A legacy grid set regenerates identically in compiler and viewer, carries
 *    exactly the legacy slot fields, streams palette and trait attributes, and
 *    accounts every slot as drawn or culled. Negative twins: a missing runtime
 *    model, an out-of-range slot (non-integer, negative and past the end) and a
 *    route layout with no compiled route each refuse.
 * 2. A rotated set regenerates every slot to the compiler's exact bits at a
 *    heading where the rounded degree-to-radian conversion would not.
 * 3. Scatter and along-route regenerate slot for slot against the compiler, across
 *    a route whose walk both stops inside an early segment and runs on into the
 *    last one, and a one-slot set still keeps a usable chunk radius.
 * 4. Ten thousand lattice slots with independent per-axis scale and three-axis
 *    rotation match their compiled matrices at the first, middle and last slot,
 *    agree bit for bit with the compiler's own regeneration, stay inside
 *    bounded chunks, expand into no scene node, and rebuild byte-identically
 *    from the same seed and input.
 * 5. One logical set selects several prototypes: stable explicit ids, per-slot
 *    palette and trait overrides, an invisible slot that is not batched, and a
 *    declared prototype no slot selects, which contributes no batch.
 * 6. Seeded weighted selection reaches both a leading prototype and the final one
 *    from the same table.
 * 7. Chunk culling admits the extent a rotated, non-uniformly scaled instance
 *    occupies: the same layout culls when its instances are small and stays
 *    drawn when they are large.
 * 8. An explicit block of 42,000 transforms measures its largest scale, which a
 *    spread of 126,000 arguments could not do.
 * 9. A registered static glTF, exported and decoded from real bytes, renders as
 *    chunked instancing with two LOD tiers that swap on camera distance, and a
 *    host material with no color channel is still batched.
 * 10. A decoded prototype carrying two primitives keeps both materials, both
 *     geometry groups and both part indices in one batch per chunk, and the
 *     exact palette still reaches it.
 * 11. Skinned, morphed, multi-material and empty imported prototypes are refused by
 *     name, both directly and through the instancing path a host drives.
 */
export const test_viewer_instance_set = async (): Promise<void> => {
  const recipe: IAutoMovieModelRecipe = {
    ...modelRecipe(),
    id: "tree",
    role: "prop",
    archetype: "primitive-prop",
    parameters: {
      shape: "cone",
      radius: 0.6,
      height: 3,
    },
    palette: { foliage: "#804020" },
    lod: [{ tier: "near", maxDistance: null, recipe: "tree" }],
    capabilities: [],
    attachments: [],
  };
  const design: IAutoMovieInstanceSetDesign = {
    id: "forest",
    modelRecipe: recipe.id,
    count: 32,
    layout: {
      kind: "grid",
      rows: 4,
      columns: 8,
      spacing: { x: 1.5, z: 1.5 },
    },
    anchor: { x: 0, y: 0, z: 0 },
    facingDeg: 15,
    seed: 7,
    variation: {
      scale: { min: 0.8, max: 1.2 },
      palette: ["#335522", "#557733"],
      traits: [
        { name: "wind", min: 0, max: 1 },
        { name: "__proto__", min: 2, max: 3 },
      ],
    },
  };
  const world: IAutoMovieWorldDesign = {
    ...worldDesign(),
    instanceSets: [design],
  };
  const recipes = new Map([[recipe.id, recipe]]);
  const compiled = materializeCompiledInstanceSet(design, world, recipes);
  const runtimeModels = materializeProductionModels(recipes);
  const models = new Map(
    [...runtimeModels.values()].map((model) => [model.id, model]),
  );
  const built = buildInstancedInstanceSet({
    instanceSet: compiled,
    models,
  });
  const meshes = instanceMeshes(built.object);
  const compilerSlot = materializeInstanceSlot(design, world, 17);
  const viewerSlot = regenerateInstanceSlot(compiled, 17);
  const firstSlot = materializeInstanceSlot(design, world, 0);
  const firstColor = new THREE.Color();
  meshes[0]?.getColorAt(0, firstColor);
  TestValidator.equals(
    "viewer batches preserve compiler slot, scale, palette and trait streams",
    namedFacts([
      [
        "stringifyCompilerSlotStringify",
        () => JSON.stringify(compilerSlot) === JSON.stringify(viewerSlot),
      ],
      [
        // A legacy set keeps exactly the fields it always had: gaining a
        // `prototype`, `rotation`, `scale3` or `visible` key would change every
        // compiled byte a shipped production already holds.
        "legacySlotFields",
        () =>
          JSON.stringify(Object.keys(viewerSlot)) ===
          JSON.stringify([
            "slot",
            "node",
            "modelRecipe",
            "position",
            "facingDeg",
            "scale",
            "palette",
            "traits",
          ]),
      ],
      [
        "legacyCompiledFields",
        () => Object.hasOwn(compiled, "prototypes") === false,
      ],
      [
        "legacyMatrix",
        () => instanceTransformMatches(built.object, compiled, 17),
      ],
      [
        "meshesCompiledChunks",
        () => meshes.length === compiled.chunks.length * compiled.lod.length,
      ],
      [
        "meshesMeshMesh",
        () =>
          meshes.every(
            (mesh) =>
              mesh.count > 0 &&
              mesh.instanceColor?.count === mesh.count &&
              mesh.geometry.getAttribute("automovieTrait0")?.count ===
                mesh.count &&
              mesh.geometry.getAttribute("automovieTrait1")?.count ===
                mesh.count &&
              mesh.userData.automovieTraitNames[0] === "wind" &&
              mesh.userData.automovieTraitNames[1] === "__proto__" &&
              mesh.userData.automoviePrototype === "default" &&
              mesh.frustumCulled === false &&
              (Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material]
              ).every(
                (material) =>
                  "color" in material &&
                  material.color instanceof THREE.Color &&
                  material.color.getHex() === 0xffffff,
              ),
          ),
      ],
      ["hiddenNone", () => built.stats.hidden === 0],
      [
        "firstColorGetHexStringFirstSlot",
        () => firstColor.getHexString() === firstSlot.palette.slice(1),
      ],
    ]),
    {
      stringifyCompilerSlotStringify: true,
      legacySlotFields: true,
      legacyCompiledFields: true,
      legacyMatrix: true,
      meshesCompiledChunks: true,
      meshesMeshMesh: true,
      hiddenNone: true,
      firstColorGetHexStringFirstSlot: true,
    },
  );

  // A heading is where the two derivations can quietly part: the viewer
  // regenerates a slot instead of reading one, so it converts degrees to
  // radians itself, and `deg * (PI / 180)` is not the same double as
  // `(deg * PI) / 180`. Three degrees is enough to separate them.
  const headingDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "heading-parity",
    facingDeg: 3,
  };
  const headingWorld: IAutoMovieWorldDesign = {
    ...world,
    instanceSets: [headingDesign],
  };
  const compiledHeading = materializeCompiledInstanceSet(
    headingDesign,
    headingWorld,
    recipes,
  );
  const builtHeading = buildInstancedInstanceSet({
    instanceSet: compiledHeading,
    models,
  });
  TestValidator.equals(
    "a rotated set regenerates every slot to the compiler's exact bits",
    namedFacts([
      [
        // The witness that this heading discriminates at all: under the
        // rounded conversion the sine is a different double, so a viewer
        // using it cannot pass the comparison below by coincidence.
        "headingConversionsDiffer",
        () =>
          Math.sin(THREE.MathUtils.degToRad(headingDesign.facingDeg)) !==
          Math.sin((headingDesign.facingDeg * Math.PI) / 180),
      ],
      [
        "headingSlots",
        () =>
          Array.from({ length: headingDesign.count }, (_, slot) => slot).every(
            (slot) =>
              JSON.stringify(regenerateInstanceSlot(compiledHeading, slot)) ===
              JSON.stringify(
                materializeInstanceSlot(headingDesign, headingWorld, slot),
              ),
          ),
      ],
      [
        "headingMatrices",
        () =>
          [0, 1, headingDesign.count - 1].every((slot) =>
            instanceTransformMatches(
              builtHeading.object,
              compiledHeading,
              slot,
            ),
          ),
      ],
    ]),
    {
      headingConversionsDiffer: true,
      headingSlots: true,
      headingMatrices: true,
    },
  );

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(0, 10, 24);
  camera.lookAt(0, 0, 0);
  built.update(camera, 720);
  TestValidator.predicate(
    "visible and culled accounting always equals the compact inventory",
    built.stats.visible.hero +
      built.stats.visible.near +
      built.stats.visible.far +
      built.stats.culled ===
      compiled.count,
  );
  camera.position.set(0, 10, 24);
  camera.lookAt(0, 0, 500);
  built.update(camera, 720);
  TestValidator.equals(
    "off-frustum chunks are hidden without expanding nodes",
    namedFacts([
      ["builtStatsCulled", () => built.stats.culled === compiled.count],
      [
        "meshesEveryMesh",
        () =>
          built.stats.culled === compiled.count &&
          meshes.every((mesh) => mesh.visible === false),
      ],
    ]),
    { builtStatsCulled: true, meshesEveryMesh: true },
  );

  TestValidator.predicate(
    "missing instance LOD model throws",
    throwsError(() =>
      buildInstancedInstanceSet({
        instanceSet: compiled,
        models: new Map(),
      }),
    ),
  );
  TestValidator.predicate(
    "instance regeneration rejects a fractional slot",
    throwsError(() => regenerateInstanceSlot(compiled, 0.5)),
  );
  TestValidator.predicate(
    "instance regeneration rejects a negative slot",
    throwsError(() => regenerateInstanceSlot(compiled, -1)),
  );
  TestValidator.predicate(
    "instance regeneration rejects an out-of-range slot",
    throwsError(() => regenerateInstanceSlot(compiled, compiled.count)),
  );
  TestValidator.predicate(
    "route regeneration requires compiled route geometry",
    throwsError(() =>
      regenerateInstanceSlot(
        {
          ...compiled,
          layout: {
            kind: "along-route",
            route: "missing",
            lateralJitter: 0,
          },
          route: null,
        },
        0,
      ),
    ),
  );
  TestValidator.predicate(
    "route regeneration requires at least two compiled waypoints",
    throwsError(() =>
      regenerateInstanceSlot(
        {
          ...compiled,
          layout: {
            kind: "along-route",
            route: "stub",
            lateralJitter: 0,
          },
          route: {
            id: "stub",
            waypoints: [{ x: 0, z: 0 }],
            allowedFormationWidth: 3,
          },
        },
        0,
      ),
    ),
  );
  TestValidator.predicate(
    "an explicit layout needs a transform per slot",
    throwsError(() =>
      regenerateInstanceSlot(
        {
          ...compiled,
          layout: { kind: "explicit", transforms: [] },
        },
        0,
      ),
    ),
  );
  TestValidator.predicate(
    "an unknown explicit prototype is refused",
    throwsError(() =>
      regenerateInstanceSlot(
        {
          ...compiled,
          layout: {
            kind: "explicit",
            transforms: [
              {
                id: "only",
                translation: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
                prototype: "absent",
              },
            ],
          },
        },
        0,
      ),
    ),
  );

  const routes = [
    {
      id: "market-road",
      waypoints: [
        { x: -10, z: -5 },
        { x: 0, z: 5 },
        { x: 10, z: -5 },
      ],
      allowedFormationWidth: 3,
    },
  ];
  const routeWorld: IAutoMovieWorldDesign = { ...world, routes };
  const scatterDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "scatter-grove",
    count: 12,
    layout: { kind: "scatter", radius: 9 },
  };
  const alongDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "roadside",
    count: 12,
    layout: {
      kind: "along-route",
      route: "market-road",
      lateralJitter: 0.75,
    },
  };
  const compiledScatter = materializeCompiledInstanceSet(
    scatterDesign,
    routeWorld,
    recipes,
  );
  const compiledAlong = materializeCompiledInstanceSet(
    alongDesign,
    routeWorld,
    recipes,
  );
  TestValidator.equals(
    "every compact placement law regenerates identically in the viewer",
    namedFacts([
      [
        "scatterSlots",
        () =>
          Array.from({ length: scatterDesign.count }, (_, slot) => slot).every(
            (slot) =>
              JSON.stringify(regenerateInstanceSlot(compiledScatter, slot)) ===
              JSON.stringify(
                materializeInstanceSlot(scatterDesign, routeWorld, slot),
              ),
          ),
      ],
      [
        "alongSlots",
        () =>
          Array.from({ length: alongDesign.count }, (_, slot) => slot).every(
            (slot) =>
              JSON.stringify(regenerateInstanceSlot(compiledAlong, slot)) ===
              JSON.stringify(
                materializeInstanceSlot(alongDesign, routeWorld, slot),
              ),
          ),
      ],
      [
        "singleSlotChunkRadius",
        () => {
          const single = materializeCompiledInstanceSet(
            { ...scatterDesign, id: "single", count: 1 },
            routeWorld,
            recipes,
          );
          const object = buildInstancedInstanceSet({
            instanceSet: single,
            models,
          });
          const near = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
          near.position.set(
            single.centroid.x,
            single.centroid.y + 2,
            single.centroid.z + 6,
          );
          near.lookAt(single.centroid.x, single.centroid.y, single.centroid.z);
          object.update(near, 720);
          return object.stats.culled === 0;
        },
      ],
    ]),
    {
      scatterSlots: true,
      alongSlots: true,
      singleSlotChunkRadius: true,
    },
  );

  const facadeDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "facade-window-grid",
    count: 10_000,
    layout: {
      kind: "lattice",
      rows: 100,
      columns: 100,
      layers: 1,
      spacing: { x: 1.2, y: 3, z: 0.05 },
    },
    facingDeg: 17,
    variation: {
      ...design.variation,
      // Independent per-axis ranges and three-axis rotation, so no two slots
      // share a transform and a uniform-scale or yaw-only regression cannot
      // pass by coincidence.
      scale3: {
        min: { x: 0.6, y: 2.4, z: 0.08 },
        max: { x: 1.4, y: 3.6, z: 0.22 },
      },
      rotationDeg: {
        x: { min: -14, max: 14 },
        y: { min: -35, max: 35 },
        z: { min: -9, max: 9 },
      },
      visibleProbability: 1,
    },
  };
  const compiledFacade = materializeCompiledInstanceSet(
    facadeDesign,
    { ...world, instanceSets: [facadeDesign] },
    recipes,
  );
  const builtFacade = buildInstancedInstanceSet({
    instanceSet: compiledFacade,
    models,
  });
  const rebuiltFacade = buildInstancedInstanceSet({
    instanceSet: compiledFacade,
    models,
  });
  const facadeSlots = [0, 5_000, 9_999];
  TestValidator.equals(
    "10,000 full-TRS slots stay in bounded GPU batches with exact matrices",
    namedFacts([
      ["facadeCount", () => compiledFacade.count === 10_000],
      [
        "facadeChunks",
        () =>
          instanceMeshes(builtFacade.object).length ===
          compiledFacade.chunks.length,
      ],
      [
        "facadeNoNodes",
        () =>
          builtFacade.object.children.length ===
          instanceMeshes(builtFacade.object).length,
      ],
      [
        "facadeBatched",
        () =>
          instanceMeshes(builtFacade.object).reduce(
            (count, mesh) => count + mesh.count,
            0,
          ) === compiledFacade.count,
      ],
      [
        "facadeMatrices",
        () =>
          facadeSlots.every((slot) =>
            instanceTransformMatches(builtFacade.object, compiledFacade, slot),
          ),
      ],
      [
        // The viewer regenerates a slot rather than reading one, so the lattice
        // it regenerates has to be the exact lattice the compiler published,
        // down to the last bit of the quaternion.
        "facadeOracle",
        () =>
          facadeSlots.every(
            (slot) =>
              JSON.stringify(regenerateInstanceSlot(compiledFacade, slot)) ===
              JSON.stringify(
                materializeInstanceSlot(facadeDesign, world, slot),
              ),
          ),
      ],
      [
        // Distinct per-axis scale on every sampled slot: a set that had
        // silently fallen back to one scalar would compare equal here.
        "facadeNonUniform",
        () =>
          facadeSlots.every((slot) => {
            const value = regenerateInstanceSlot(compiledFacade, slot);
            return (
              value.scale3 !== undefined &&
              value.scale3.x !== value.scale3.y &&
              value.scale3.y !== value.scale3.z
            );
          }),
      ],
      [
        "facadeRotated",
        () =>
          facadeSlots.every((slot) => {
            const value = regenerateInstanceSlot(compiledFacade, slot);
            return (
              value.rotation !== undefined &&
              nclose(
                Math.hypot(
                  value.rotation.x,
                  value.rotation.y,
                  value.rotation.z,
                  value.rotation.w,
                ),
                1,
              ) &&
              (value.rotation.x !== 0 || value.rotation.z !== 0)
            );
          }),
      ],
      [
        "facadeDeterministic",
        () =>
          batchBytes(builtFacade.object) === batchBytes(rebuiltFacade.object),
      ],
    ]),
    {
      facadeCount: true,
      facadeChunks: true,
      facadeNoNodes: true,
      facadeBatched: true,
      facadeMatrices: true,
      facadeOracle: true,
      facadeNonUniform: true,
      facadeRotated: true,
      facadeDeterministic: true,
    },
  );

  const alternateRecipe: IAutoMovieModelRecipe = {
    ...recipe,
    id: "alternate-tree",
    parameters: { shape: "box", width: 1, height: 2, depth: 1 },
    lod: [{ tier: "near", maxDistance: null, recipe: "alternate-tree" }],
  };
  const unusedRecipe: IAutoMovieModelRecipe = {
    ...alternateRecipe,
    id: "unused-tree",
    lod: [{ tier: "near", maxDistance: null, recipe: "unused-tree" }],
  };
  const multiDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "mixed-prototypes",
    count: 3,
    prototypes: [
      { id: "alternate", modelRecipe: alternateRecipe.id, weight: 1 },
      { id: "unused", modelRecipe: unusedRecipe.id, weight: 1 },
    ],
    layout: {
      kind: "explicit",
      transforms: [
        {
          id: "primary",
          translation: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
        },
        {
          id: "alternate",
          translation: { x: 2, y: 0, z: 0 },
          rotation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 },
          scale: { x: 1, y: 2, z: 1 },
          prototype: "alternate",
          palette: "#abcdef",
          traits: { wind: 0.25 },
        },
        {
          id: "hidden",
          translation: { x: 4, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          scale: { x: 1, y: 1, z: 1 },
          visible: false,
        },
      ],
    },
  };
  const multiRecipes = new Map([
    [recipe.id, recipe],
    [alternateRecipe.id, alternateRecipe],
    [unusedRecipe.id, unusedRecipe],
  ]);
  const multiModels = new Map(
    [...materializeProductionModels(multiRecipes).values()].map((model) => [
      model.id,
      model,
    ]),
  );
  const compiledMulti = materializeCompiledInstanceSet(
    multiDesign,
    { ...world, instanceSets: [multiDesign] },
    multiRecipes,
  );
  const builtMulti = buildInstancedInstanceSet({
    instanceSet: compiledMulti,
    models: multiModels,
  });
  const multiMeshes = instanceMeshes(builtMulti.object);
  const alternateSlot = regenerateInstanceSlot(compiledMulti, 1);
  const hiddenSlot = regenerateInstanceSlot(compiledMulti, 2);
  TestValidator.equals(
    "one logical set batches multiple selected prototypes without nodes",
    namedFacts([
      // Three declared prototypes, two of them chosen by a slot: the prototype
      // no slot selects contributes no batch at all.
      ["multiPrototypeTable", () => compiledMulti.prototypes?.length === 3],
      ["multiMeshes", () => multiMeshes.length === 2],
      [
        "multiPrototypeIds",
        () =>
          JSON.stringify(
            multiMeshes
              .map((mesh) => mesh.userData.automoviePrototype as string)
              .sort((left, right) => left.localeCompare(right)),
          ) === JSON.stringify(["alternate", "default"]),
      ],
      [
        "multiSlotIdentity",
        () =>
          regenerateInstanceSlot(compiledMulti, 0).node ===
            "instance:mixed-prototypes:primary" &&
          alternateSlot.node === "instance:mixed-prototypes:alternate" &&
          hiddenSlot.node === "instance:mixed-prototypes:hidden",
      ],
      [
        "multiRecipes",
        () =>
          regenerateInstanceSlot(compiledMulti, 0).modelRecipe === recipe.id &&
          alternateSlot.modelRecipe === alternateRecipe.id,
      ],
      ["multiPaletteOverride", () => alternateSlot.palette === "#abcdef"],
      ["multiTraitOverride", () => alternateSlot.traits.wind === 0.25],
      [
        // A declared trait the override leaves alone still comes from the seed.
        "multiSeededTrait",
        () =>
          alternateSlot.traits.wind === 0.25 &&
          Object.getOwnPropertyDescriptor(alternateSlot.traits, "__proto__")
            ?.value !== undefined,
      ],
      ["multiHidden", () => hiddenSlot.visible === false],
      ["multiHiddenStat", () => builtMulti.stats.hidden === 1],
      [
        "multiBatched",
        () =>
          multiMeshes.reduce((count, mesh) => count + mesh.count, 0) === 2 &&
          locateSlot(builtMulti.object, 2) === null,
      ],
      [
        "multiMatrices",
        () =>
          instanceTransformMatches(builtMulti.object, compiledMulti, 0) &&
          instanceTransformMatches(builtMulti.object, compiledMulti, 1),
      ],
      [
        "multiOracle",
        () =>
          [0, 1, 2].every(
            (slot) =>
              JSON.stringify(regenerateInstanceSlot(compiledMulti, slot)) ===
              JSON.stringify(materializeInstanceSlot(multiDesign, world, slot)),
          ),
      ],
      [
        "multiOverriddenColor",
        () => {
          const located = locateSlot(builtMulti.object, 1)!;
          const color = new THREE.Color();
          located.mesh.getColorAt(located.index, color);
          return color.getHexString() === "abcdef";
        },
      ],
    ]),
    {
      multiPrototypeTable: true,
      multiMeshes: true,
      multiPrototypeIds: true,
      multiSlotIdentity: true,
      multiRecipes: true,
      multiPaletteOverride: true,
      multiTraitOverride: true,
      multiSeededTrait: true,
      multiHidden: true,
      multiHiddenStat: true,
      multiBatched: true,
      multiMatrices: true,
      multiOracle: true,
      multiOverriddenColor: true,
    },
  );

  const weightedDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "weighted-prototypes",
    count: 64,
    prototypes: [
      { id: "alternate", modelRecipe: alternateRecipe.id, weight: 3 },
    ],
    variation: { ...design.variation, visibleProbability: 0.5 },
  };
  const compiledWeighted = materializeCompiledInstanceSet(
    weightedDesign,
    { ...world, instanceSets: [weightedDesign] },
    multiRecipes,
  );
  const builtWeighted = buildInstancedInstanceSet({
    instanceSet: compiledWeighted,
    models: multiModels,
  });
  const weightedSlots = Array.from(
    { length: weightedDesign.count },
    (_, slot) => regenerateInstanceSlot(compiledWeighted, slot),
  );
  TestValidator.equals(
    "seeded weighted selection reaches every prototype of the table",
    namedFacts([
      [
        "weightedDefault",
        () => weightedSlots.some((slot) => slot.prototype === "default"),
      ],
      [
        "weightedAlternate",
        () => weightedSlots.some((slot) => slot.prototype === "alternate"),
      ],
      [
        // A heavier prototype is chosen more often; the table is a weighting,
        // not a rotation.
        "weightedShare",
        () =>
          weightedSlots.filter((slot) => slot.prototype === "alternate")
            .length >
          weightedSlots.filter((slot) => slot.prototype === "default").length,
      ],
      [
        "weightedVisibility",
        () =>
          weightedSlots.some((slot) => slot.visible === true) &&
          weightedSlots.some((slot) => slot.visible === false),
      ],
      [
        "weightedHiddenStat",
        () =>
          builtWeighted.stats.hidden ===
          weightedSlots.filter((slot) => slot.visible === false).length,
      ],
      [
        "weightedRotationIdentity",
        () =>
          weightedSlots.every(
            (slot) =>
              slot.rotation !== undefined &&
              nclose(
                Math.abs(
                  slot.rotation.w * Math.cos(THREE.MathUtils.degToRad(7.5)) +
                    slot.rotation.y * Math.sin(THREE.MathUtils.degToRad(7.5)),
                ),
                1,
              ),
          ),
      ],
    ]),
    {
      weightedDefault: true,
      weightedAlternate: true,
      weightedShare: true,
      weightedVisibility: true,
      weightedHiddenStat: true,
      weightedRotationIdentity: true,
    },
  );

  const extentDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "extent-probe",
    count: 4,
    layout: { kind: "grid", rows: 2, columns: 2, spacing: { x: 1, z: 1 } },
    facingDeg: 0,
    anchor: { x: 0, y: 0, z: 0 },
    variation: {
      ...design.variation,
      scale3: {
        min: { x: 1, y: 1, z: 1 },
        max: { x: 1, y: 1, z: 1 },
      },
      rotationDeg: {
        x: { min: 30, max: 30 },
        y: { min: 40, max: 40 },
        z: { min: 50, max: 50 },
      },
    },
  };
  const hugeExtentDesign: IAutoMovieInstanceSetDesign = {
    ...extentDesign,
    id: "extent-probe-large",
    variation: {
      ...extentDesign.variation,
      scale3: {
        min: { x: 1, y: 1, z: 60 },
        max: { x: 1, y: 1, z: 60 },
      },
    },
  };
  const compiledExtent = materializeCompiledInstanceSet(
    extentDesign,
    { ...world, instanceSets: [extentDesign] },
    recipes,
  );
  const compiledHugeExtent = materializeCompiledInstanceSet(
    hugeExtentDesign,
    { ...world, instanceSets: [hugeExtentDesign] },
    recipes,
  );
  const extentCamera = (): THREE.PerspectiveCamera => {
    const value = new THREE.PerspectiveCamera(30, 1, 0.1, 500);
    value.position.set(60, 0, 0);
    value.lookAt(120, 0, 0);
    return value;
  };
  const smallExtent = buildInstancedInstanceSet({
    instanceSet: compiledExtent,
    models,
  });
  const largeExtent = buildInstancedInstanceSet({
    instanceSet: compiledHugeExtent,
    models,
  });
  smallExtent.update(extentCamera(), 720);
  largeExtent.update(extentCamera(), 720);
  TestValidator.equals(
    "chunk culling admits the extent a rotated, scaled instance occupies",
    namedFacts([
      ["smallExtentCulled", () => smallExtent.stats.culled === 4],
      ["largeExtentKept", () => largeExtent.stats.culled === 0],
      [
        "largeExtentDrawn",
        () =>
          largeExtent.stats.visible.hero +
            largeExtent.stats.visible.near +
            largeExtent.stats.visible.far ===
          4,
      ],
    ]),
    {
      smallExtentCulled: true,
      largeExtentKept: true,
      largeExtentDrawn: true,
    },
  );

  // Three numbers per transform: a spread of a set this size passes 126,000
  // arguments, which the engine refuses outright.
  const blockCount = 42_000;
  const blockDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "explicit-block",
    count: blockCount,
    facingDeg: 0,
    layout: {
      kind: "explicit",
      transforms: Array.from({ length: blockCount }, (_, slot) => ({
        id: `block-${String(slot).padStart(6, "0")}`,
        translation: { x: (slot % 200) * 0.5, y: 0, z: Math.floor(slot / 200) },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 0.25, y: slot === blockCount - 1 ? 9 : 0.25, z: 0.25 },
      })),
    },
    variation: { ...design.variation, traits: [] },
  };
  const compiledBlock = materializeCompiledInstanceSet(
    blockDesign,
    { ...world, instanceSets: [blockDesign] },
    recipes,
  );
  const builtBlock = buildInstancedInstanceSet({
    instanceSet: compiledBlock,
    models,
  });
  const blockCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 2_000);
  blockCamera.position.set(50, 40, 300);
  blockCamera.lookAt(50, 0, 100);
  builtBlock.update(blockCamera, 720);
  TestValidator.equals(
    "a large explicit block measures its own extent and stays chunked",
    namedFacts([
      [
        "blockChunks",
        () =>
          instanceMeshes(builtBlock.object).length ===
          compiledBlock.chunks.length,
      ],
      [
        "blockBatched",
        () =>
          instanceMeshes(builtBlock.object).reduce(
            (count, mesh) => count + mesh.count,
            0,
          ) === blockCount,
      ],
      [
        "blockAccounted",
        () =>
          builtBlock.stats.visible.hero +
            builtBlock.stats.visible.near +
            builtBlock.stats.visible.far +
            builtBlock.stats.culled ===
          blockCount,
      ],
      [
        "blockLastSlot",
        () =>
          instanceTransformMatches(
            builtBlock.object,
            compiledBlock,
            blockCount - 1,
          ),
      ],
    ]),
    {
      blockChunks: true,
      blockBatched: true,
      blockAccounted: true,
      blockLastSlot: true,
    },
  );

  const panelNearRecipe: IAutoMovieModelRecipe = {
    ...recipe,
    id: "stone-panel",
    parameters: { shape: "box", width: 1, height: 1, depth: 0.2 },
    lod: [
      { tier: "near", maxDistance: 40, recipe: "stone-panel" },
      { tier: "far", maxDistance: null, recipe: "stone-panel-far" },
    ],
  };
  const panelFarRecipe: IAutoMovieModelRecipe = {
    ...panelNearRecipe,
    id: "stone-panel-far",
    lod: [{ tier: "far", maxDistance: null, recipe: "stone-panel-far" }],
  };
  const panelRecipes = new Map([
    [panelNearRecipe.id, panelNearRecipe],
    [panelFarRecipe.id, panelFarRecipe],
  ]);
  const panelModels = new Map(
    [...materializeProductionModels(panelRecipes).values()].map((model) => [
      model.id,
      model,
    ]),
  );
  const panelDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "registered-panels",
    modelRecipe: panelNearRecipe.id,
    count: 2_500,
    layout: {
      kind: "lattice",
      rows: 50,
      columns: 50,
      layers: 1,
      spacing: { x: 1.4, y: 3, z: 0.1 },
    },
    variation: {
      ...design.variation,
      scale3: {
        min: { x: 0.9, y: 0.9, z: 0.9 },
        max: { x: 1.3, y: 1.3, z: 1.3 },
      },
    },
  };
  const compiledPanels = materializeCompiledInstanceSet(
    panelDesign,
    { ...world, instanceSets: [panelDesign] },
    panelRecipes,
  );
  const nearModelId = compiledPanels.lod.find(
    (lod) => lod.tier === "near",
  )!.model;
  const farModelId = compiledPanels.lod.find(
    (lod) => lod.tier === "far",
  )!.model;
  const builtPanels = buildInstancedInstanceSet({
    instanceSet: compiledPanels,
    models: panelModels,
    prototypeObjects: new Map([
      [
        nearModelId,
        await loadStaticGltfPrototype(
          // A quad: four vertices the registered asset owns, and a count the
          // recipe's own box could never produce.
          staticGltfSource("registered-panel-near", [
            {
              positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0],
              indices: [0, 1, 2, 2, 1, 3],
              color: { r: 0.7, g: 0.7, b: 0.7 },
            },
          ]),
        ),
      ],
      [
        farModelId,
        await loadStaticGltfPrototype(
          staticGltfSource("registered-panel-far", [
            {
              positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
              indices: [0, 1, 2],
              color: { r: 0.7, g: 0.7, b: 0.7 },
            },
          ]),
        ),
      ],
    ]),
  });
  const panelMeshes = instanceMeshes(builtPanels.object);
  const nearBatches = panelMeshes.filter((mesh) => mesh.name.endsWith(":near"));
  const farBatches = panelMeshes.filter((mesh) => mesh.name.endsWith(":far"));
  const closeCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 4_000);
  closeCamera.position.set(
    compiledPanels.centroid.x,
    compiledPanels.centroid.y,
    compiledPanels.centroid.z + 8,
  );
  closeCamera.lookAt(
    compiledPanels.centroid.x,
    compiledPanels.centroid.y,
    compiledPanels.centroid.z,
  );
  builtPanels.update(closeCamera, 720);
  const closeTiers = { ...builtPanels.stats.visible };
  const distantCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 4_000);
  distantCamera.position.set(
    compiledPanels.centroid.x,
    compiledPanels.centroid.y,
    compiledPanels.centroid.z + 900,
  );
  distantCamera.lookAt(
    compiledPanels.centroid.x,
    compiledPanels.centroid.y,
    compiledPanels.centroid.z,
  );
  builtPanels.update(distantCamera, 720);
  const distantTiers = { ...builtPanels.stats.visible };
  TestValidator.equals(
    "a registered static glTF renders as chunked, LOD-switched instancing",
    namedFacts([
      [
        "panelChunks",
        () => panelMeshes.length === compiledPanels.chunks.length * 2,
      ],
      [
        // The decoded asset supplies the geometry; the compiler-owned box
        // recipe only ever supplied its projection radius.
        "panelNearGeometry",
        () =>
          nearBatches.length === compiledPanels.chunks.length &&
          nearBatches.every(
            (mesh) => mesh.geometry.getAttribute("position").count === 4,
          ),
      ],
      [
        "panelFarGeometry",
        () =>
          farBatches.length === compiledPanels.chunks.length &&
          farBatches.every(
            (mesh) => mesh.geometry.getAttribute("position").count === 3,
          ),
      ],
      [
        "panelBatched",
        () =>
          nearBatches.reduce((count, mesh) => count + mesh.count, 0) ===
          compiledPanels.count,
      ],
      [
        "panelMatrices",
        () =>
          [0, 1_500, 2_499].every((slot) =>
            instanceTransformMatches(builtPanels.object, compiledPanels, slot),
          ),
      ],
      ["panelCloseTier", () => closeTiers.near > 0],
      [
        "panelDistantTier",
        () => distantTiers.far > 0 && distantTiers.near === 0,
      ],
      [
        "panelTierExclusive",
        () =>
          nearBatches.every((mesh) => mesh.visible === false) ||
          farBatches.every((mesh) => mesh.visible === false),
      ],
    ]),
    {
      panelChunks: true,
      panelNearGeometry: true,
      panelFarGeometry: true,
      panelBatched: true,
      panelMatrices: true,
      panelCloseTier: true,
      panelDistantTier: true,
      panelTierExclusive: true,
    },
  );

  const multiPartDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "two-material-prototype",
    count: 2,
    layout: { kind: "grid", rows: 1, columns: 2, spacing: { x: 3, z: 1 } },
    variation: { ...design.variation, traits: [] },
  };
  const compiledMultiPart = materializeCompiledInstanceSet(
    multiPartDesign,
    { ...world, instanceSets: [multiPartDesign] },
    recipes,
  );
  const builtMultiPart = buildInstancedInstanceSet({
    instanceSet: compiledMultiPart,
    models,
    prototypeObjects: new Map([
      [
        compiledMultiPart.lod[0]!.model,
        await loadStaticGltfPrototype(
          // Two primitives with a material each: what a registered asset that
          // binds more than one finish decodes back into, and the case a
          // single-material batch would either scramble or drop.
          staticGltfSource("registered-two-material", [
            {
              positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
              indices: [0, 1, 2],
              color: { r: 0.9, g: 0.1, b: 0.1 },
            },
            {
              positions: [2, 0, 0, 3, 0, 0, 2, 1, 0],
              indices: [0, 1, 2],
              color: { r: 0.1, g: 0.1, b: 0.9 },
            },
          ]),
        ),
      ],
    ]),
  });
  const multiPartMesh = instanceMeshes(builtMultiPart.object)[0]!;
  const multiPartMaterials = Array.isArray(multiPartMesh.material)
    ? multiPartMesh.material
    : [multiPartMesh.material];
  const multiPartAttribute = multiPartMesh.geometry.getAttribute(
    "automoviePart",
  ) as THREE.BufferAttribute;
  const multiPartColor = new THREE.Color();
  multiPartMesh.getColorAt(1, multiPartColor);
  TestValidator.equals(
    "a multi-material host prototype instances as one batch per chunk",
    namedFacts([
      [
        "multiPartChunks",
        () =>
          instanceMeshes(builtMultiPart.object).length ===
            compiledMultiPart.chunks.length && multiPartMesh.count === 2,
      ],
      [
        // One draw per chunk still, with the source materials kept as the
        // batch's own material list rather than collapsed to the first.
        "multiPartMaterials",
        () =>
          JSON.stringify(
            multiPartMaterials.map((material) => material.name),
          ) === JSON.stringify(["surface-0", "surface-1"]),
      ],
      [
        "multiPartGroups",
        () =>
          JSON.stringify(
            multiPartMesh.geometry.groups.map((group) => group.materialIndex),
          ) === JSON.stringify([0, 1]),
      ],
      [
        // Each source mesh keeps its own part index, which is what a shader
        // needs to tell the two primitives of one prototype apart.
        "multiPartIndices",
        () =>
          multiPartAttribute.count === 6 &&
          JSON.stringify([...(multiPartAttribute.array as Float32Array)]) ===
            JSON.stringify([0, 0, 0, 1, 1, 1]),
      ],
      [
        "multiPartNeutral",
        () =>
          multiPartMaterials.every(
            (material) => diffuseHex(material) === 0xffffff,
          ),
      ],
      [
        // The exact palette still reaches every part of a multi-material
        // instance, because the instance color multiplies a neutral diffuse.
        "multiPartPalette",
        () =>
          multiPartMesh.instanceColor?.count === 2 &&
          multiPartColor.getHexString() ===
            regenerateInstanceSlot(compiledMultiPart, 1).palette.slice(1),
      ],
      [
        "multiPartMatrices",
        () =>
          [0, 1].every((slot) =>
            instanceTransformMatches(
              builtMultiPart.object,
              compiledMultiPart,
              slot,
            ),
          ),
      ],
    ]),
    {
      multiPartChunks: true,
      multiPartMaterials: true,
      multiPartGroups: true,
      multiPartIndices: true,
      multiPartNeutral: true,
      multiPartPalette: true,
      multiPartMatrices: true,
    },
  );

  const colorlessDesign: IAutoMovieInstanceSetDesign = {
    ...design,
    id: "colorless-prototype",
    count: 2,
    layout: { kind: "grid", rows: 1, columns: 2, spacing: { x: 1, z: 1 } },
    variation: { ...design.variation, traits: [] },
  };
  const compiledColorless = materializeCompiledInstanceSet(
    colorlessDesign,
    { ...world, instanceSets: [colorlessDesign] },
    recipes,
  );
  const builtColorless = buildInstancedInstanceSet({
    instanceSet: compiledColorless,
    models,
    prototypeObjects: new Map([
      [
        compiledColorless.lod[0]!.model,
        importedObject(
          new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshDepthMaterial(),
          ),
        ),
      ],
    ]),
  });
  TestValidator.predicate(
    "a host prototype with no color channel is still batched",
    instanceMeshes(builtColorless.object).every(
      (mesh) =>
        mesh.count === 2 &&
        // The negative twin of the neutralized two-material batch, read through
        // the same channel: there is no diffuse to override, and the batch is
        // built anyway.
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).every(
          (material) => diffuseHex(material) === null,
        ),
    ),
  );

  const staticRoot = new THREE.Group();
  staticRoot.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 3),
      new THREE.MeshStandardMaterial(),
    ),
  );
  const staticRepresentation = flattenInstancedObject(
    createImportedModelObject({ object: staticRoot, bones: new Map() }),
    "static glTF prototype",
  );
  TestValidator.equals(
    "a loaded rigid static prototype flattens to shared instance geometry",
    namedFacts([
      [
        "vertices",
        () => staticRepresentation.geometry.getAttribute("position").count > 0,
      ],
      ["oneMaterial", () => staticRepresentation.materials.length === 1],
    ]),
    { vertices: true, oneMaterial: true },
  );
  TestValidator.predicate(
    "skinned imported prototypes are refused",
    throwsError(() =>
      flattenInstancedObject(
        importedObject(
          new THREE.SkinnedMesh(
            new THREE.BoxGeometry(),
            new THREE.MeshBasicMaterial(),
          ),
        ),
      ),
    ),
  );
  const morphed = new THREE.BoxGeometry();
  morphed.morphAttributes.position = [morphed.getAttribute("position").clone()];
  TestValidator.predicate(
    "morphed imported prototypes are refused",
    throwsError(() =>
      flattenInstancedObject(
        importedObject(new THREE.Mesh(morphed, new THREE.MeshBasicMaterial())),
      ),
    ),
  );
  TestValidator.predicate(
    "multi-material imported meshes are refused",
    throwsError(() =>
      flattenInstancedObject(
        importedObject(
          new THREE.Mesh(new THREE.BoxGeometry(), [
            new THREE.MeshBasicMaterial(),
            new THREE.MeshBasicMaterial(),
          ]),
        ),
      ),
    ),
  );
  TestValidator.predicate(
    "empty imported prototypes are refused",
    throwsError(() =>
      flattenInstancedObject(
        createImportedModelObject({
          object: new THREE.Group(),
          bones: new Map(),
        }),
      ),
    ),
  );
  TestValidator.predicate(
    "an unsupported host prototype is refused on the instancing path",
    throwsError(() =>
      buildInstancedInstanceSet({
        instanceSet: compiledColorless,
        models,
        prototypeObjects: new Map([
          [
            compiledColorless.lod[0]!.model,
            importedObject(
              new THREE.SkinnedMesh(
                new THREE.BoxGeometry(),
                new THREE.MeshBasicMaterial(),
              ),
            ),
          ],
        ]),
      }),
    ),
  );
};

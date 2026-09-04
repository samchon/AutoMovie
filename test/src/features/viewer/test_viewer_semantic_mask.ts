import {
  AUTOMOVIE_SEMANTIC_MASK_SPACE_NODE,
  IAutoMovieRenderSubject,
  autoMovieFluidSurfaceNodeName,
  autoMoviePlantingNodeName,
  autoMovieSoftBodyNodeName,
  deriveAutoMovieSemanticMask,
} from "@automovie/engine";
import { IAutoMovieScene, IAutoMovieSemanticMask } from "@automovie/interface";
import {
  IAutoMovieFormationCycle,
  SPACE_GROUP_NAME,
  applyAutoMovieSemanticMask,
  buildFluidSurfaceObject,
  buildPlantingObject,
  buildSoftBodyObject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { flatBasin } from "../internal/fluidFixtures";
import { namedFacts, throwsError } from "../internal/predicates";
import {
  buildingFixture,
  instanceSetFixture,
  modelsFixture,
  sceneFixture,
} from "../internal/renderFixtures";
import {
  plantingCluster,
  plantingRecipe,
  softPanel,
} from "../internal/softFixtures";

/**
 * The viewer paints the stable palette, and what it draws stays inside the
 * bound the compiled report cleared.
 *
 * The scene is assembled the way `buildScene` assembles one: one anonymous
 * group per designed node in declaration order, named groups for the ground and
 * for each compiled instance set. That construction contract is what the mask
 * resolves against, so a test that named the node groups would prove the mask
 * works on a scene the viewer does not build.
 *
 * Scenarios:
 *
 * 1. Every mesh takes the exact colour of the entry that owns it, and a mesh no
 *    entry claims takes the reserved background and is counted.
 * 2. Repeated instanced slots take their own per-slot colours through
 *    `instanceColor`, and an instanced batch with no slot metadata keeps the
 *    set colour.
 * 3. Rebuilding the scene with the designed nodes reversed paints every id the
 *    same colour it had before.
 * 4. `restore` puts every material and every instance colour back, removes an
 *    instance colour that did not exist before, restores the background, and is
 *    idempotent.
 * 5. A scene with fewer top-level children than designed nodes is refused rather
 *    than resolved positionally against the wrong objects.
 * 6. The engine and the viewer agree on the name of every simulated drawable, so a
 *    curtain, a fern bed and a pond paint their own identity instead of the
 *    reserved background.
 */
export const test_viewer_semantic_mask = (): void => {
  const subject = (design: IAutoMovieScene): IAutoMovieRenderSubject => ({
    scene: design,
    models: modelsFixture(),
    environments: [buildingFixture()],
    instanceSets: [instanceSetFixture({ id: "windows", count: 3, chunks: 1 })],
  });
  const ground = { id: "tower-ground", surfaces: [], walkable: [] };
  const design = { ...sceneFixture(), space: ground };
  const mask = deriveAutoMovieSemanticMask(subject(design));
  const colorOf = (id: string): string =>
    mask.entries.find((entry) => entry.id === id)!.color;

  // The engine names the ground group without importing the viewer, so the one
  // constant both sides agree on is checked here rather than asserted in a
  // comment nobody runs.
  TestValidator.equals(
    "the engine and the viewer agree on the ground group's name",
    AUTOMOVIE_SEMANTIC_MASK_SPACE_NODE,
    SPACE_GROUP_NAME,
  );

  const built = build(design, mask);
  const handle = applyAutoMovieSemanticMask({
    scene: built.scene,
    design,
    mask,
  });
  const hex = (object: THREE.Mesh): string =>
    `#${(object.material as THREE.MeshBasicMaterial).color.getHexString().toUpperCase()}`;

  TestValidator.equals(
    "every mesh takes the colour its own semantic id earned",
    {
      wall: hex(built.meshes.get("tower/hall-wall")!),
      door: hex(built.meshes.get("tower/hall-door-leaf")!),
      prop: hex(built.meshes.get("lantern")!),
      ground: hex(built.meshes.get("__automovie_space")!),
      batch: hex(built.batch),
      orphan: hex(built.orphan),
      painted: handle.painted,
      unaddressed: handle.unaddressed,
    },
    {
      wall: colorOf("element:tower/hall-wall"),
      door: colorOf("element:tower/hall-door-leaf"),
      prop: colorOf("node:lantern"),
      ground: colorOf("node:tower-ground"),
      // Three multiplies this base by `instanceColor`; a slotted batch must use
      // white or every semantic colour is darkened into a different identity.
      batch: "#FFFFFF",
      orphan: mask.background,
      // Eight drawables the design names, plus the three further shapes the
      // instance-set group holds.
      painted: 11,
      // The unclaimed mesh, the hidden one, and the two loose geometries: a
      // structural pass paints what is in the graph, and counts what no entry
      // named.
      unaddressed: 4,
    },
  );
  TestValidator.equals(
    "a segmentation pass suspends everything that would overwrite an identity",
    namedFacts([
      ["fog", () => built.scene.fog === null],
      ["image lighting", () => built.scene.environment === null],
      [
        "background",
        () => (built.scene.background as THREE.Color).getHex() === 0,
      ],
      ["grid hidden", () => !built.grid.visible],
      ["sprite hidden", () => !built.sprite.visible],
      ["points hidden", () => !built.points.visible],
    ]),
    {
      fog: true,
      "image lighting": true,
      background: true,
      "grid hidden": true,
      "sprite hidden": true,
      "points hidden": true,
    },
  );

  // A crowd that marched in the beauty pass has to march in the mask: the
  // replacement material carries the mesh's baked cycle, and a mesh with no
  // cycle keeps three's own default program key so nothing pays for an
  // injection it does not use.
  const programKey = (mesh: THREE.Mesh): string =>
    (mesh.material as THREE.Material).customProgramCacheKey();
  TestValidator.equals(
    "the mask deforms exactly as the beauty pass does",
    {
      cycled: programKey(built.meshes.get("tower/hall-wall")!),
      // Three's own default key is the stringified no-op `onBeforeCompile`, so
      // the fact asserted is that the still mesh did NOT get the injection.
      still:
        programKey(built.meshes.get("__automovie_space")!) ===
        "automovie-formation-cycle",
    },
    { cycled: "automovie-formation-cycle", still: false },
  );

  const instanceHex = (mesh: THREE.InstancedMesh, index: number): string =>
    `#${new THREE.Color()
      .fromBufferAttribute(mesh.instanceColor!, index)
      .getHexString()
      .toUpperCase()}`;
  const effectiveInstanceHex = (
    mesh: THREE.InstancedMesh,
    index: number,
  ): string =>
    `#${new THREE.Color()
      .fromBufferAttribute(mesh.instanceColor!, index)
      .multiply((mesh.material as THREE.MeshBasicMaterial).color)
      .getHexString()
      .toUpperCase()}`;
  const slotHex = (index: number): string =>
    effectiveInstanceHex(built.batch, index);
  TestValidator.equals(
    "base-material multiplication renders each repeated slot's exact colour",
    [slotHex(0), slotHex(1), slotHex(2), slotHex(3)],
    [
      colorOf("instance-slot:windows#0"),
      colorOf("instance-slot:windows#1"),
      colorOf("instance-slot:windows#2"),
      colorOf("instance-set:windows"),
    ],
  );
  TestValidator.equals(
    "slot colours are created where none existed, and unslotted batches keep the set colour",
    {
      createdAttribute: instanceHex(built.bare, 0),
      createdPixel: effectiveInstanceHex(built.bare, 0),
      createdBase: hex(built.bare),
      unslotted: hex(built.unslotted),
    },
    {
      createdAttribute: colorOf("instance-slot:windows#1"),
      createdPixel: colorOf("instance-slot:windows#1"),
      createdBase: "#FFFFFF",
      unslotted: colorOf("instance-set:windows"),
    },
  );

  const original = built.palette.slice();
  handle.restore();
  handle.restore();
  TestValidator.equals(
    "restore returns every material, instance colour and background exactly",
    namedFacts([
      [
        "materials",
        () =>
          [...built.meshes.values()].every(
            (mesh) => mesh.material === built.beauty.get(mesh),
          ),
      ],
      [
        "instance colours",
        () =>
          built.batch.instanceColor !== null &&
          [...(built.batch.instanceColor.array as Float32Array)].every(
            (value, index) => value === original[index],
          ),
      ],
      ["created attribute removed", () => built.bare.instanceColor === null],
      [
        "background",
        () => (built.scene.background as THREE.Color).getHex() === 0x123456,
      ],
      ["fog", () => built.scene.fog !== null],
      ["image lighting", () => built.scene.environment !== null],
      ["grid visible again", () => built.grid.visible],
      ["already-hidden line untouched", () => !built.darkLine.visible],
    ]),
    {
      materials: true,
      "instance colours": true,
      "created attribute removed": true,
      background: true,
      fog: true,
      "image lighting": true,
      "grid visible again": true,
      "already-hidden line untouched": true,
    },
  );

  const reversedDesign = { ...sceneFixture({ reversed: true }), space: ground };
  const reversedBuilt = build(reversedDesign, mask);
  const reversedHandle = applyAutoMovieSemanticMask({
    scene: reversedBuilt.scene,
    design: reversedDesign,
    mask,
  });
  TestValidator.equals(
    "reversing the staged nodes repaints nothing",
    ["tower/hall-wall", "tower/hall-door-leaf", "lantern"].map((id) =>
      hex(reversedBuilt.meshes.get(id)!),
    ),
    [
      colorOf("element:tower/hall-wall"),
      colorOf("element:tower/hall-door-leaf"),
      colorOf("node:lantern"),
    ],
  );
  reversedHandle.restore();

  TestValidator.equals(
    "a scene with too few children is refused rather than mis-resolved",
    throwsError(
      () =>
        applyAutoMovieSemanticMask({
          scene: new THREE.Scene(),
          design,
          mask,
        }),
      "cannot resolve staged nodes",
    ),
    true,
  );

  // Cloth, planting and water are held by no scene node, so the mask joins them
  // by the names their own builders assign. The engine states those names
  // without importing the viewer, exactly as it states the ground group's, so
  // the agreement is checked here rather than asserted in a comment nobody runs.
  const panel = buildSoftBodyObject({
    surface: {
      domain: "panel",
      step: 0,
      mesh: {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        uvs: [0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
        skin: null,
      },
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
    },
    status: "derived",
  });
  const bed = buildPlantingObject({
    plant: {
      domain: "fern",
      stage: 1,
      branches: [],
      leaves: [],
      bounds: null,
    },
    arrangement: {
      cluster: "atrium-bed",
      domain: "fern",
      placements: [],
      rejected: 0,
      bounds: null,
    },
  });
  const pond = buildFluidSurfaceObject({
    surface: {
      domain: "basin",
      step: 0,
      mesh: {
        positions: [0, 0, 0, 1, 0, 0, 0, 0, 1],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
        uvs: [0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
        skin: null,
      },
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0, z: 1 } },
      flow: [0, 0, 0, 0, 0, 0],
    },
  });
  TestValidator.equals(
    "the engine and the viewer agree on every simulated drawable's name",
    [
      autoMovieSoftBodyNodeName("panel"),
      autoMoviePlantingNodeName("atrium-bed"),
      autoMovieFluidSurfaceNodeName("basin"),
    ],
    [panel.object.name, bed.object.name, pond.object.name],
  );

  const simulatedDesign: IAutoMovieScene = {
    id: "simulated",
    name: null,
    nodes: [],
    cameras: [],
    lights: [],
  };
  const simulatedSubject: IAutoMovieRenderSubject = {
    scene: simulatedDesign,
    models: modelsFixture(),
    softBodies: [
      {
        domain: softPanel({ columns: 2, rows: 2 }),
        owner: null,
        material: null,
      },
    ],
    plantings: [
      {
        domain: plantingRecipe(),
        cluster: plantingCluster(),
        owner: null,
        branchMaterial: null,
        leafMaterial: null,
        branch: { vertices: 40, triangles: 24 },
        leaf: { vertices: 4, triangles: 2 },
      },
    ],
    waterBodies: [
      {
        id: "atrium-pool",
        owner: null,
        nodes: [],
        domain: flatBasin({ columns: 2, rows: 2, depth: 1 }),
        cells: null,
        particles: null,
        material: null,
      },
    ],
  };
  const simulatedMask = deriveAutoMovieSemanticMask(simulatedSubject);
  const simulatedScene = new THREE.Scene();
  simulatedScene.add(panel.object, bed.object, pond.object);
  const stray = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(),
  );
  simulatedScene.add(stray);
  const simulatedHandle = applyAutoMovieSemanticMask({
    scene: simulatedScene,
    design: simulatedDesign,
    mask: simulatedMask,
  });
  const simulatedColor = (id: string): string =>
    simulatedMask.entries.find((item) => item.id === id)!.color;
  TestValidator.equals(
    "a curtain, a bed and a pond paint their own identity instead of background",
    {
      panel: hex(panel.object),
      // The branch batch is a child of the cluster group, so it resolves
      // through the ancestor the mask names rather than needing a name of its
      // own: a bed is one thing a consumer asks about, not two.
      bed: hex(bed.branches),
      pond: hex(pond.object),
      stray: hex(stray),
      painted: simulatedHandle.painted,
      unaddressed: simulatedHandle.unaddressed,
    },
    {
      panel: simulatedColor("soft-body:panel"),
      bed: simulatedColor("planting:atrium-bed"),
      pond: simulatedColor("water-body:atrium-pool"),
      stray: simulatedMask.background,
      painted: 3,
      unaddressed: 1,
    },
  );
  simulatedHandle.restore();
  panel.dispose();
  bed.dispose();
  pond.dispose();
};

/** A minimal baked cycle: enough for material injection, no renderer needed. */
const cycle = (): IAutoMovieFormationCycle =>
  ({
    samples: 1,
    names: [],
    takes: new Map(),
    fallback: null,
    active: null,
    uniforms: {},
  }) as unknown as IAutoMovieFormationCycle;

/** Assemble the scene exactly the way `buildScene` assembles one. */
const build = (
  design: IAutoMovieScene,
  mask: IAutoMovieSemanticMask,
): {
  scene: THREE.Scene;
  meshes: Map<string, THREE.Mesh>;
  beauty: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  batch: THREE.InstancedMesh;
  bare: THREE.InstancedMesh;
  unslotted: THREE.InstancedMesh;
  grid: THREE.Object3D;
  darkLine: THREE.Object3D;
  sprite: THREE.Object3D;
  points: THREE.Object3D;
  orphan: THREE.Mesh;
  palette: Float32Array;
} => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x123456);
  scene.fog = new THREE.FogExp2(0x223344, 0.02);
  scene.environment = new THREE.Texture();
  const meshes = new Map<string, THREE.Mesh>();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  for (const node of design.nodes) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    // A crowd carries its baked cycle on the mesh; the override must inherit it.
    mesh.userData.automovieFormationCycle = cycle();
    group.add(mesh);
    scene.add(group);
    meshes.set(node.id, mesh);
  }
  const groundGroup = new THREE.Group();
  groundGroup.name = "__automovie_space";
  const groundPatch = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial(),
  );
  groundGroup.add(groundPatch);
  scene.add(groundGroup);
  meshes.set("__automovie_space", groundPatch);

  const setGroup = new THREE.Group();
  setGroup.name = "instance-set:windows";
  const textured = new THREE.MeshStandardMaterial();
  textured.map = new THREE.Texture();
  // Slot 99 is outside the compiled set, so the batch also proves what happens
  // when a drawn slot has no entry of its own: it falls back to the set colour
  // instead of painting an unowned identity.
  const batch = new THREE.InstancedMesh(geometry, textured, 4);
  batch.userData.automovieSlots = [0, 1, 2, 99];
  const seed = new THREE.Color(0.25, 0.5, 0.75);
  for (let index = 0; index < 4; ++index) batch.setColorAt(index, seed);
  // An instanced batch with slots but no palette of its own: the override has
  // to create the attribute and take it away again on restore.
  const bare = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial(),
    1,
  );
  bare.userData.automovieSlots = [1];
  // Three more shapes the resolver must survive under one instance-set group:
  // a batch declaring no slots, a batch declaring an empty slot list, and an
  // ordinary mesh that is not instanced at all.
  const unslotted = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial(),
    1,
  );
  const emptySlots = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial(),
    1,
  );
  emptySlots.userData.automovieSlots = [];
  const plain = new THREE.Mesh(geometry, [
    new THREE.MeshStandardMaterial(),
    new THREE.MeshStandardMaterial(),
  ]);
  setGroup.add(batch);
  setGroup.add(bare);
  setGroup.add(unslotted);
  setGroup.add(emptySlots);
  setGroup.add(plain);
  scene.add(setGroup);

  // Geometry with no index, and geometry with neither index nor positions:
  // the observation must count both without inventing a triangle.
  const loose = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(9), 3),
    ),
    new THREE.MeshStandardMaterial(),
  );
  scene.add(loose);
  scene.add(
    new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial(),
    ),
  );

  // One mesh no entry claims, and one hidden mesh nothing draws.
  const orphan = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  scene.add(orphan);
  const hidden = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  hidden.visible = false;
  scene.add(hidden);

  // Non-mesh renderables draw their live beauty material straight into a
  // structural pass unless it hides them; one is already hidden, and must stay
  // hidden after restore.
  const grid = new THREE.LineSegments(new THREE.BufferGeometry());
  const darkLine = new THREE.LineSegments(new THREE.BufferGeometry());
  darkLine.visible = false;
  const sprite = new THREE.Sprite();
  const points = new THREE.Points(new THREE.BufferGeometry());
  scene.add(grid);
  scene.add(darkLine);
  scene.add(sprite);
  scene.add(points);

  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  scene.add(sun);
  const dark = new THREE.PointLight();
  dark.visible = false;
  scene.add(dark);

  const beauty = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh === true) beauty.set(mesh, mesh.material);
  });
  void mask;
  return {
    scene,
    meshes,
    beauty,
    batch,
    bare,
    unslotted,
    grid,
    darkLine,
    sprite,
    points,
    orphan,
    palette: (batch.instanceColor!.array as Float32Array).slice(),
  };
};

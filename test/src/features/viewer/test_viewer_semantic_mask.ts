import {
  AUTOMOVIE_SEMANTIC_MASK_SPACE_NODE,
  IAutoMovieRenderSubject,
  deriveAutoMovieSemanticMask,
  evaluateAutoMovieRenderBudget,
  measureAutoMovieRenderInventory,
  sealAutoMovieRenderTarget,
} from "@automovie/engine";
import { IAutoMovieScene, IAutoMovieSemanticMask } from "@automovie/interface";
import {
  IAutoMovieFormationCycle,
  SPACE_GROUP_NAME,
  applyAutoMovieSemanticMask,
  auditAutoMovieRenderObservation,
  observeAutoMovieSceneRender,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  buildingFixture,
  instanceSetFixture,
  modelsFixture,
  sceneFixture,
} from "../internal/renderFixtures";

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
 * 6. What the scene draws stays inside the compiled report's upper bounds, hidden
 *    geometry is not counted, and a scene drawing more than the report cleared
 *    is reported as a breach.
 * 7. Metrics the report never measured are returned as unchecked, never as
 *    agreement.
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
      batch: colorOf("instance-set:windows"),
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
  const slotHex = (index: number): string => instanceHex(built.batch, index);
  TestValidator.equals(
    "each repeated slot carries its own colour in the instance attribute",
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
      created: instanceHex(built.bare, 0),
      unslotted: hex(built.unslotted),
    },
    {
      created: colorOf("instance-slot:windows#1"),
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
    ]),
    {
      materials: true,
      "instance colours": true,
      "created attribute removed": true,
      background: true,
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

  const inventory = measureAutoMovieRenderInventory({
    subject: subject(design),
    mask,
  });
  const report = evaluateAutoMovieRenderBudget({
    inventory,
    budget: null,
    mask,
    target: sealAutoMovieRenderTarget({
      renderer: { api: "webgl2", vendor: "acme", device: "gpu-1" },
      settings: {
        width: 640,
        height: 480,
        pixelRatio: 1,
        shadows: true,
        shadowType: "pcf",
        toneMapping: "none",
        exposure: 1,
      },
      assets: [],
    }),
  });
  const observed = observeAutoMovieSceneRender(built.scene);
  const audited = auditAutoMovieRenderObservation({ report, observed });
  TestValidator.equals(
    "hidden geometry is not counted, and drawing past the report is a breach",
    {
      lights: observed.lights,
      shadowMaps: observed.shadowMaps,
      instanceSlots: observed.instanceSlots,
      textures: observed.textures,
      hiddenExcluded: observed.meshes,
      agrees: audited.agrees,
      breaches: audited.breaches.map((breach) => breach.metric),
      unchecked: audited.unchecked,
    },
    {
      // One directional light casts; the point light is hidden and draws
      // nothing. The scene deliberately holds geometry the design never
      // declared, so the audit must say so instead of clearing it.
      lights: 1,
      shadowMaps: 1,
      instanceSlots: 7,
      textures: 1,
      hiddenExcluded: 14,
      agrees: false,
      breaches: ["triangles", "drawCalls", "materials", "instanceSlots"],
      unchecked: [],
    },
  );

  const solo: IAutoMovieScene = {
    id: "solo",
    name: null,
    nodes: [sceneFixture().nodes[4]!],
    cameras: [],
    lights: [],
  };
  const soloSubject: IAutoMovieRenderSubject = {
    scene: solo,
    models: modelsFixture(),
  };
  const soloMask = deriveAutoMovieSemanticMask(soloSubject);
  const soloScene = new THREE.Scene();
  const soloGroup = new THREE.Group();
  soloGroup.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    ),
  );
  soloScene.add(soloGroup);
  TestValidator.equals(
    "a faithful scene stays inside every bound the report cleared",
    auditAutoMovieRenderObservation({
      report: evaluateAutoMovieRenderBudget({
        inventory: measureAutoMovieRenderInventory({
          subject: soloSubject,
          mask: soloMask,
        }),
        budget: null,
        mask: soloMask,
        target: report.target,
      }),
      observed: observeAutoMovieSceneRender(soloScene),
    }),
    { agrees: true, breaches: [], unchecked: [] },
  );

  TestValidator.equals(
    "a metric the report never measured is unchecked, never agreement",
    auditAutoMovieRenderObservation({
      report: {
        ...report,
        findings: report.findings.map((finding) => ({
          ...finding,
          measured: finding.metric === "triangles" ? null : finding.measured,
        })),
      },
      observed,
    }).unchecked,
    ["triangles"],
  );
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
  orphan: THREE.Mesh;
  palette: Float32Array;
} => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x123456);
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
    orphan,
    palette: (batch.instanceColor!.array as Float32Array).slice(),
  };
};

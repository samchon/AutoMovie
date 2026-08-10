import {
  autoMovieFluidSurfaceNodeName,
  autoMoviePlantingNodeName,
  autoMovieRenderSubjectOfCompiledShot,
  autoMovieSoftBodyNodeName,
  deriveAutoMovieSemanticMask,
} from "@automovie/engine";
import {
  IAutoMovieCompiledShotSource,
  IAutoMovieScene,
} from "@automovie/interface";
import {
  applyRenderMode,
  attachAutoMovieSemanticMask,
  auditAutoMovieSemanticMaskScene,
  autoMovieSemanticMaskOf,
  maskColor,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { flatBasin, waterFeature } from "../internal/fluidFixtures";
import { namedFacts } from "../internal/predicates";
import {
  buildingFixture,
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
 * The packaged `mask` pass paints the stable semantic palette, and it says what
 * the shot declared and never drew.
 *
 * The palette and its painter both shipped with no caller, so the pass a
 * capture actually renders coloured the Nth top-level child with the Nth colour
 * of a ramp while the guides described stable per-entity identity. Here a scene
 * handed its palette is painted by semantic id through the same
 * `applyRenderMode` call the compiled shot runtime makes, and a scene handed
 * none keeps the ramp, which is what an asset turntable draws.
 *
 * The second half is the join the pipeline never had: the palette names every
 * drawable the compiled shot commits to, the scene is what a viewer assembled,
 * and holding one against the other is what turns "declared" into "drawn".
 *
 * Scenarios:
 *
 * 1. A scene handed no palette keeps the index ramp and the handle reports no
 *    semantic result, so nothing claims identity it did not paint.
 * 2. `autoMovieSemanticMaskOf` answers `null` before the attach and the binding
 *    after, which is the only thing that decides which of the two passes runs.
 * 3. A scene handed its palette paints every mesh the colour its own semantic id
 *    earned, an unclaimed mesh the reserved background, and the handle carries
 *    the painted, unaddressed and unresolved counts back to its caller.
 * 4. Restoring the pass returns every material and the background, and restoring
 *    twice is a no-op.
 * 5. A pond, a curtain and a fern bed the shot declared and the scene never built
 *    are named by the audit and by the pass; entries that claim no drawable of
 *    their own, such as a room, an opening or an instanced slot, are never
 *    named.
 * 6. A scene that drew every declared drawable audits clean, and an instanced set
 *    whose viewer group is missing is named by its own set id.
 */
export const test_viewer_semantic_mask_pass = (): void => {
  const design = sceneFixture();
  const compiled = {
    scene: design,
    models: modelsFixture(),
    motions: [],
    eventSamples: [],
    formations: [],
    instanceSets: [instanceSetFixture({ id: "windows", count: 2, chunks: 1 })],
    formationMotions: [],
    formationSlotMotions: [],
    effects: [],
    shot: {},
    builtEnvironments: [buildingFixture()],
    fluidDomains: [flatBasin({ columns: 2, rows: 2, depth: 1 })],
    waterFeatures: [waterFeature()],
    softBodyDomains: [softPanel({ columns: 2, rows: 2 })],
    softFurnishings: [softFurnishing()],
    plantingDomains: [plantingRecipe()],
    plantingClusters: [plantingCluster()],
    plantingInstallations: [plantingInstallation()],
  } as unknown as IAutoMovieCompiledShotSource;
  const mask = deriveAutoMovieSemanticMask(
    autoMovieRenderSubjectOfCompiledShot({ compiled }),
  );
  const colorOf = (id: string): string =>
    mask.entries.find((entry) => entry.id === id)!.color;
  const hex = (mesh: THREE.Mesh): string =>
    `#${(mesh.material as THREE.MeshBasicMaterial).color.getHexString().toUpperCase()}`;

  // A scene that draws everything the shot declared: one group per designed
  // node, the instance-set group, and the three simulated drawables no node
  // holds.
  const complete = build(design, { simulated: true });
  const ramp = applyRenderMode(complete.scene, "mask");
  const rampWall = hex(complete.meshes.get("tower/hall-wall")!);
  const rampSemantic = ramp.semantic;
  ramp.restore();
  TestValidator.equals(
    "a scene with no palette keeps the index ramp and claims no identity",
    {
      semantic: rampSemantic,
      // The ramp is keyed by top-level child index, and the wall's group is the
      // first child, which is exactly why it can never mean identity.
      wall: rampWall,
    },
    { semantic: null, wall: `#${maskColor(0).getHexString().toUpperCase()}` },
  );

  TestValidator.equals(
    "the attached palette is what decides which mask pass runs",
    namedFacts([
      ["unattached", () => autoMovieSemanticMaskOf(complete.scene) === null],
      [
        "attached",
        () => {
          attachAutoMovieSemanticMask(complete.scene, { design, mask });
          return autoMovieSemanticMaskOf(complete.scene)?.mask === mask;
        },
      ],
    ]),
    { unattached: true, attached: true },
  );

  const handle = applyRenderMode(complete.scene, "mask");
  TestValidator.equals(
    "an attached palette paints every drawable the colour its own id earned",
    {
      wall: hex(complete.meshes.get("tower/hall-wall")!),
      door: hex(complete.meshes.get("tower/hall-door-leaf")!),
      prop: hex(complete.meshes.get("lantern")!),
      batch: hex(complete.meshes.get("instance-set:windows")!),
      pond: hex(complete.meshes.get(autoMovieFluidSurfaceNodeName("basin"))!),
      curtain: hex(complete.meshes.get(autoMovieSoftBodyNodeName("panel"))!),
      bed: hex(complete.meshes.get(autoMoviePlantingNodeName("atrium-bed"))!),
      stray: hex(complete.stray),
      semantic: handle.semantic,
    },
    {
      wall: colorOf("element:tower/hall-wall"),
      door: colorOf("element:tower/hall-door-leaf"),
      prop: colorOf("node:lantern"),
      batch: colorOf("instance-set:windows"),
      pond: colorOf("water-body:basin"),
      curtain: colorOf("soft-body:panel"),
      bed: colorOf("planting:atrium-bed"),
      stray: mask.background,
      semantic: {
        // Five staged nodes, the instanced batch, and the three simulated
        // drawables the mask joins by the viewer's own names for them.
        painted: 9,
        unaddressed: 1,
        unresolved: [],
      },
    },
  );

  handle.restore();
  handle.restore();
  TestValidator.equals(
    "restoring the pass returns the scene it borrowed, once",
    namedFacts([
      [
        "materials",
        () =>
          [...complete.meshes.values()].every(
            (mesh) => mesh.material === complete.beauty.get(mesh),
          ),
      ],
      [
        "stray material",
        () => complete.stray.material === complete.strayBeauty,
      ],
      [
        "background",
        () => (complete.scene.background as THREE.Color).getHex() === 0x123456,
      ],
      ["mode", () => handle.mode === "mask"],
    ]),
    {
      materials: true,
      "stray material": true,
      background: true,
      mode: true,
    },
  );

  // The same design with the three simulated drawables never built: the shot
  // still declares them, so the audit is what notices they reach no pixel.
  const missing = build(design, { simulated: false });
  attachAutoMovieSemanticMask(missing.scene, { design, mask });
  const missingHandle = applyRenderMode(missing.scene, "mask");
  TestValidator.equals(
    "a drawable the shot declared and the scene never built is named",
    {
      audit: auditAutoMovieSemanticMaskScene({
        scene: missing.scene,
        design,
        mask,
      }),
      // The pass reports the same list, so a caller holding only the handle
      // learns it without auditing the scene a second time.
      handle: missingHandle.semantic?.unresolved,
      painted: missingHandle.semantic?.painted,
      // Neither run may name a room, an opening or an instanced slot: those
      // claim no drawable of their own and are reached through `owner`.
      quiet: mask.entries
        .filter(
          (entry) => entry.nodes.length === 0 && entry.kind !== "instance-set",
        )
        .every(
          (entry) =>
            missingHandle.semantic!.unresolved.includes(entry.id) === false,
        ),
    },
    {
      audit: ["planting:atrium-bed", "soft-body:panel", "water-body:basin"],
      handle: ["planting:atrium-bed", "soft-body:panel", "water-body:basin"],
      painted: 6,
      quiet: true,
    },
  );
  missingHandle.restore();

  TestValidator.equals(
    "a scene that drew every declared drawable audits clean",
    auditAutoMovieSemanticMaskScene({ scene: complete.scene, design, mask }),
    [],
  );

  // An instanced set claims no `nodes` of its own and is joined by its entry id,
  // so a missing batch needs its own case rather than riding on the others.
  const setless = build(design, { simulated: true, instanceSet: false });
  TestValidator.equals(
    "an instanced batch the scene never built is named by its set id",
    auditAutoMovieSemanticMaskScene({ scene: setless.scene, design, mask }),
    ["instance-set:windows"],
  );
};

/**
 * Assemble the scene `buildScene` and the compiled shot runtime assemble: one
 * named group per designed node in declaration order, a named group for the
 * compiled instance set, and one named object per simulated drawable.
 */
const build = (
  design: IAutoMovieScene,
  props: { simulated: boolean; instanceSet?: boolean },
): {
  scene: THREE.Scene;
  meshes: Map<string, THREE.Mesh>;
  beauty: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  stray: THREE.Mesh;
  strayBeauty: THREE.Material | THREE.Material[];
} => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x123456);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const meshes = new Map<string, THREE.Mesh>();
  const add = (name: string, parent: THREE.Object3D): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = name;
    parent.add(mesh);
    meshes.set(name, mesh);
    return mesh;
  };
  for (const node of design.nodes) {
    const group = new THREE.Group();
    group.name = node.id;
    scene.add(group);
    add(node.id, group);
  }
  if (props.instanceSet !== false) {
    const setGroup = new THREE.Group();
    setGroup.name = "instance-set:windows";
    scene.add(setGroup);
    add("instance-set:windows", setGroup);
  }
  if (props.simulated) {
    add(autoMovieFluidSurfaceNodeName("basin"), scene);
    add(autoMovieSoftBodyNodeName("panel"), scene);
    const cluster = new THREE.Group();
    cluster.name = autoMoviePlantingNodeName("atrium-bed");
    scene.add(cluster);
    add(autoMoviePlantingNodeName("atrium-bed"), cluster);
  }
  // One mesh no entry claims: a segmentation pass paints it the reserved
  // background and counts it rather than leaving a lit surface in the frame.
  const stray = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  scene.add(stray);
  const beauty = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  for (const mesh of meshes.values()) beauty.set(mesh, mesh.material);
  return { scene, meshes, beauty, stray, strayBeauty: stray.material };
};

import type { IAutoMovieCompiledShotSource } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";
import * as THREE from "three";

import { flatBasin, waterFeature } from "../internal/fluidFixtures";
import { compiledShotFixture } from "../internal/renderBudgetFixtures";
import { boxModel, material } from "../internal/renderFixtures";
import {
  plantingCluster,
  plantingInstallation,
  plantingRecipe,
  softFurnishing,
  softPanel,
} from "../internal/softFixtures";

interface IScaffoldRuntime {
  scene: THREE.Scene;
  dispose: () => Promise<void>;
}

interface IScaffoldRuntimeModule {
  createCompiledShotRuntime: (
    compiled: IAutoMovieCompiledShotSource,
  ) => Promise<IScaffoldRuntime>;
}

const IDENTITY = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

const compiledSurfaceShot = (): IAutoMovieCompiledShotSource => {
  const accent = {
    ...material("surface-accent"),
    baseColor: { r: 1, g: 0, b: 0, a: 1, hex: "#ff0000" },
  };
  return compiledShotFixture({
    models: [boxModel({ id: "material-carrier", materials: [accent] })],
    scene: {
      id: "surface-material-scene",
      name: null,
      nodes: [],
      cameras: [
        {
          id: "camera",
          transform: IDENTITY,
          fovY: 45,
          near: 0.1,
          far: 100,
        },
      ],
      lights: [],
      environment: null,
      space: null,
      fog: null,
    },
    shot: {
      id: "surface-material-shot",
      name: null,
      scene: "surface-material-scene",
      duration: 1,
      camera: "camera",
      performances: [],
      objectMotions: [],
      cameraMotion: null,
      lightMotions: [],
    },
    fluidDomains: [flatBasin({ columns: 2, rows: 2, depth: 1 })],
    waterFeatures: [
      waterFeature({ mode: "static", material: "surface-accent" }),
    ],
    softBodyDomains: [softPanel({ columns: 2, rows: 2 })],
    softFurnishings: [
      softFurnishing({ mode: "rest", material: "surface-accent" }),
    ],
    plantingDomains: [
      plantingRecipe({
        foliage: {
          density: 4,
          minLevel: 1,
          size: { x: 0.05, y: 0.1, z: 0.05 },
          scaleJitter: 0,
          rollJitter: 0,
        },
      }),
    ],
    plantingClusters: [plantingCluster({ count: 1 })],
    plantingInstallations: [
      plantingInstallation({
        branchMaterial: "surface-accent",
        leafMaterial: "surface-accent",
      }),
    ],
  });
};

const materialOf = (
  runtime: IScaffoldRuntime,
  name: string,
): THREE.Material => {
  const object = runtime.scene.getObjectByName(name) as
    | THREE.Mesh
    | THREE.InstancedMesh
    | undefined;
  if (object === undefined || Array.isArray(object.material))
    throw new Error(`Runtime object "${name}" has no singular material.`);
  return object.material;
};

/**
 * The generated viewer carries simulated-surface material ids into its scene.
 *
 * The runtime module is loaded by absolute URL so this test executes the exact
 * scaffold source every generated project inherits without widening the test
 * project's TypeScript root to include another package.
 *
 * Scenarios:
 *
 * 1. Water, static cloth, planting branches, and planting leaves that cite one
 *    model material borrow the same built `THREE.Material` object.
 * 2. Runtime disposal releases that shared material exactly once even when the
 *    public disposal boundary is called twice.
 * 3. An absent material and two furnishings owning one world-space soft domain
 *    are refused instead of falling back to an arbitrary visible result.
 */
export const test_cli_scaffold_surface_material_runtime =
  async (): Promise<void> => {
    const source = path.resolve(
      __dirname,
      "../../../../packages/cli/scaffold/viewer/src/shotRuntime.ts",
    );
    const runtimeModule = (await import(source)) as IScaffoldRuntimeModule;
    const compiled = compiledSurfaceShot();
    const runtime = await runtimeModule.createCompiledShotRuntime(compiled);
    const water = materialOf(runtime, "water:basin");
    const cloth = materialOf(runtime, "soft:panel");
    const branches = materialOf(runtime, "planting-branches:atrium-bed");
    const leaves = materialOf(runtime, "planting-leaves:atrium-bed");
    let disposals = 0;
    water.addEventListener("dispose", () => ++disposals);

    TestValidator.equals(
      "every simulated drawable borrows the one resolved material identity",
      [cloth === water, branches === water, leaves === water],
      [true, true, true],
    );
    await runtime.dispose();
    await runtime.dispose();
    TestValidator.equals(
      "the shot runtime releases its shared surface material exactly once",
      disposals,
      1,
    );

    const missing = compiledSurfaceShot();
    missing.waterFeatures![0] = {
      ...missing.waterFeatures![0]!,
      material: "absent-surface",
    };
    const missingMessage = await runtimeModule
      .createCompiledShotRuntime(missing)
      .then(() => null)
      .catch((error: unknown) => (error as Error).message);
    const ambiguous = compiledSurfaceShot();
    ambiguous.softFurnishings!.push({
      ...ambiguous.softFurnishings![0]!,
      id: "second-curtain",
      environment: "annex",
    });
    const ambiguousMessage = await runtimeModule
      .createCompiledShotRuntime(ambiguous)
      .then(() => null)
      .catch((error: unknown) => (error as Error).message);
    TestValidator.equals(
      "the runtime refuses unresolved and multiply owned surface identity",
      [
        missingMessage?.includes('material "absent-surface" is absent') ===
          true,
        ambiguousMessage?.includes("ownership is ambiguous") === true,
        ambiguousMessage?.includes('soft body domain "panel"') === true,
      ],
      [true, true, true],
    );
  };

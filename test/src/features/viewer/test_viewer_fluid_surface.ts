import {
  fluidSurfaceGeometry,
  sampleFluidSpray,
  simulateFluidDomain,
} from "@automovie/engine";
import { IAutoMovieFluidDomain } from "@automovie/interface";
import {
  applyRenderMode,
  buildFluidSprayObject,
  buildFluidSurfaceObject,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { flatBasin } from "../internal/fluidFixtures";
import { namedFacts, nclose, throwsError } from "../internal/predicates";

const pool = (overrides: Partial<IAutoMovieFluidDomain> = {}) =>
  flatBasin({
    columns: 4,
    rows: 4,
    depth: 0.25,
    overrides: {
      id: "atrium-pool",
      sprays: [
        {
          id: "mist",
          column: 1,
          row: 1,
          rate: 8,
          lifetime: 1,
          speed: 2,
          direction: { x: 0, y: 1, z: 0 },
          spread: 0,
          size: 0.05,
          seed: 5,
          maxParticles: 16,
          lodDistance: 10,
        },
      ],
      sources: [
        { id: "jet", column: 1, row: 1, flowRate: 0.05, start: 0, end: null },
      ],
      ...overrides,
    },
  });

const surfaceAt = (domain: IAutoMovieFluidDomain, step: number) =>
  fluidSurfaceGeometry({ domain, state: simulateFluidDomain(domain, step) });

/**
 * The viewer projects the engine's water and adds nothing of its own, so an
 * indoor pond appears in the beauty, normal, depth and mask passes without any
 * pass knowing that water exists.
 *
 * Water participating in the structural passes is what lets a diffusion guide
 * see a pond as surface rather than as a hole, and it comes for free precisely
 * because the surface is an ordinary mesh in the scene graph: the passes swap
 * the material of every mesh they find. Spray is the deliberate opposite —
 * `THREE.Points` that the same passes hide, because mist is decoration and must
 * not colour a segmentation mask or read as geometry in a depth pass.
 *
 * Scenarios:
 *
 * 1. The uploaded attributes are the engine's arrays: vertex count, index count,
 *    the first position, the per-vertex `aFlow` velocity, the name and the
 *    recorded step. The bounding sphere is the engine's extent of the DRAWN
 *    surface rather than of the vertex buffer, which carries a vertex per cell
 *    including the dry ones.
 * 2. `flowing` is the only mode that asks for scrolling ripples; a feature that
 *    did not declare one does not get one.
 * 3. The depth, normal and mask passes each replace the water's material and put
 *    the original back on restore, and the beauty pass leaves it alone.
 * 4. A structural pass hides the spray and restores its visibility.
 * 5. `update` re-uploads a later step in place, and a drained pool hides itself
 *    rather than drawing a sheet of nothing. A surface belonging to another
 *    domain is refused instead: the mesh is named for the domain it was built
 *    from and a segmentation pass resolves it by that name, so uploading
 *    someone else's water under it would paint one pond as another.
 * 6. `dispose` releases what the object created and never disposes a material the
 *    caller supplied and still owns.
 */
export const test_viewer_fluid_surface = (): void => {
  const domain = pool();
  const surface = surfaceAt(domain, 40);
  const water = buildFluidSurfaceObject({ surface, mode: "flowing" });
  const plain = buildFluidSurfaceObject({ surface: surfaceAt(domain, 0) });
  const position = water.object.geometry.getAttribute("position");
  const flow = water.object.geometry.getAttribute("aFlow");

  TestValidator.equals(
    "the uploaded mesh is the engine's surface, verbatim",
    namedFacts([
      ["vertexCount", () => position.count === 16],
      [
        "indexCount",
        () =>
          (water.object.geometry.getIndex()?.count ?? 0) ===
          (surface.mesh.indices ?? []).length,
      ],
      [
        "firstPosition",
        () =>
          nclose(position.getX(0), surface.mesh.positions[0], 1e-6) &&
          nclose(position.getY(0), surface.mesh.positions[1], 1e-6) &&
          nclose(position.getZ(0), surface.mesh.positions[2], 1e-6),
      ],
      ["flowItems", () => flow.itemSize === 2 && flow.count === 16],
      [
        "flowValues",
        () =>
          Array.from({ length: 16 }, (_, at) =>
            nclose(flow.getX(at), surface.flow[at * 2], 1e-6),
          ).every(Boolean),
      ],
      [
        "boundsFromEngine",
        () => {
          const sphere = water.object.geometry.boundingSphere;
          const bounds = surface.bounds;
          if (sphere === null || bounds === null) return false;
          const min = new THREE.Vector3(
            bounds.min.x,
            bounds.min.y,
            bounds.min.z,
          );
          const max = new THREE.Vector3(
            bounds.max.x,
            bounds.max.y,
            bounds.max.z,
          );
          return (
            nclose(sphere.center.x, (bounds.min.x + bounds.max.x) / 2, 1e-9) &&
            nclose(sphere.center.z, (bounds.min.z + bounds.max.z) / 2, 1e-9) &&
            nclose(sphere.radius, min.distanceTo(max) / 2, 1e-9)
          );
        },
      ],
      ["name", () => water.object.name === "water:atrium-pool"],
      ["domain", () => water.object.userData.domain === "atrium-pool"],
      ["step", () => water.object.userData.step === 40],
      ["visible", () => water.object.visible === true],
      ["flowing", () => water.object.userData.flowing === true],
      ["notFlowing", () => plain.object.userData.flowing === false],
    ]),
    {
      vertexCount: true,
      indexCount: true,
      firstPosition: true,
      flowItems: true,
      flowValues: true,
      boundsFromEngine: true,
      name: true,
      domain: true,
      step: true,
      visible: true,
      flowing: true,
      notFlowing: true,
    },
  );

  const spray = buildFluidSprayObject({
    sample: sampleFluidSpray({
      domain,
      state: simulateFluidDomain(domain, 64),
    }),
  });
  const scene = new THREE.Scene();
  scene.add(water.object);
  scene.add(spray.object);
  const original = water.object.material;

  const passes = (["depth", "normal", "mask"] as const).map((mode) => {
    const handle = applyRenderMode(scene, mode);
    const overridden = water.object.material !== original;
    const sprayHidden = spray.object.visible === false;
    handle.restore();
    return {
      overridden,
      sprayHidden,
      restored: water.object.material === original,
      sprayShown: spray.object.visible === true,
    };
  });
  const beauty = applyRenderMode(scene, "beauty");
  const untouched = water.object.material === original;
  beauty.restore();

  TestValidator.equals(
    "water reads in every structural pass while its mist does not",
    namedFacts([
      ["overridden", () => passes.every((pass) => pass.overridden)],
      ["restored", () => passes.every((pass) => pass.restored)],
      ["sprayHidden", () => passes.every((pass) => pass.sprayHidden)],
      ["sprayShown", () => passes.every((pass) => pass.sprayShown)],
      ["beautyUntouched", () => untouched],
      ["sprayCount", () => spray.count() === 8],
      ["sprayName", () => spray.object.name === "water-spray"],
      ["sprayStep", () => spray.object.userData.step === 64],
      [
        "sprayAttributes",
        () =>
          spray.object.geometry.getAttribute("position").count === 8 &&
          spray.object.geometry.getAttribute("aSize").count === 8 &&
          spray.object.geometry.getAttribute("aAge").count === 8,
      ],
    ]),
    {
      overridden: true,
      restored: true,
      sprayHidden: true,
      sprayShown: true,
      beautyUntouched: true,
      sprayCount: true,
      sprayName: true,
      sprayStep: true,
      sprayAttributes: true,
    },
  );

  water.update(surfaceAt(domain, 120));
  const drained = pool({ depth: new Array(16).fill(0), sources: [] });
  const empty = buildFluidSurfaceObject({ surface: surfaceAt(drained, 0) });
  const emptySpray = buildFluidSprayObject({
    sample: { step: 0, time: 0, particles: [] },
  });
  // `IAutoMovieMesh` allows a normal-less, UV-less, non-indexed surface, so a
  // caller that hands one over must get empty attributes rather than a throw.
  const bare = buildFluidSurfaceObject({
    surface: {
      domain: "hand-built",
      step: 3,
      mesh: {
        positions: [0, 0, 0],
        normals: null,
        uvs: null,
        indices: null,
        skin: null,
      },
      bounds: null,
      flow: [0, 0],
    },
  });
  TestValidator.equals(
    "a later step re-uploads in place and a drained pool draws nothing",
    namedFacts([
      ["updatedStep", () => water.object.userData.step === 120],
      [
        "updatedGeometry",
        () => water.object.geometry.getAttribute("position").count === 16,
      ],
      ["emptyHidden", () => empty.object.visible === false],
      [
        "emptyIndices",
        () => (empty.object.geometry.getIndex()?.count ?? 0) === 0,
      ],
      ["emptySprayHidden", () => emptySpray.object.visible === false],
      ["emptySprayCount", () => emptySpray.count() === 0],
      [
        "bareAttributes",
        () =>
          bare.object.geometry.getAttribute("normal").count === 0 &&
          bare.object.geometry.getAttribute("uv").count === 0 &&
          (bare.object.geometry.getIndex()?.count ?? 0) === 0,
      ],
      ["bareHidden", () => bare.object.visible === false],
      [
        "bareEmptySphere",
        () => (bare.object.geometry.boundingSphere?.radius ?? -1) === 0,
      ],
      [
        "foreignUpload",
        () =>
          throwsError(
            () => bare.update(surfaceAt(domain, 0)),
            ["hand-built", "atrium-pool"],
          ),
      ],
      ["foreignName", () => bare.object.name === "water:hand-built"],
    ]),
    {
      updatedStep: true,
      updatedGeometry: true,
      emptyHidden: true,
      emptyIndices: true,
      emptySprayHidden: true,
      emptySprayCount: true,
      bareAttributes: true,
      bareHidden: true,
      bareEmptySphere: true,
      foreignUpload: true,
      foreignName: true,
    },
  );

  let ownedDisposed = 0;
  let borrowedDisposed = 0;
  (water.object.material as THREE.Material).addEventListener("dispose", () => {
    ownedDisposed += 1;
  });
  const borrowed = new THREE.MeshBasicMaterial();
  borrowed.addEventListener("dispose", () => {
    borrowedDisposed += 1;
  });
  const guest = buildFluidSurfaceObject({
    surface: surfaceAt(domain, 0),
    material: borrowed,
  });
  const borrowedPoints = new THREE.PointsMaterial();
  let borrowedPointsDisposed = 0;
  borrowedPoints.addEventListener("dispose", () => {
    borrowedPointsDisposed += 1;
  });
  const guestSpray = buildFluidSprayObject({
    sample: sampleFluidSpray({
      domain,
      state: simulateFluidDomain(domain, 64),
    }),
    material: borrowedPoints,
  });
  water.dispose();
  guest.dispose();
  guestSpray.dispose();
  spray.dispose();
  empty.dispose();
  emptySpray.dispose();
  plain.dispose();
  bare.dispose();
  TestValidator.equals(
    "dispose releases what it created and never what it borrowed",
    namedFacts([
      ["ownedDisposed", () => ownedDisposed === 1],
      ["borrowedKept", () => borrowedDisposed === 0],
      ["borrowedInUse", () => guest.object.material === borrowed],
      ["borrowedPointsKept", () => borrowedPointsDisposed === 0],
      [
        "borrowedPointsInUse",
        () => guestSpray.object.material === borrowedPoints,
      ],
    ]),
    {
      ownedDisposed: true,
      borrowedKept: true,
      borrowedInUse: true,
      borrowedPointsKept: true,
      borrowedPointsInUse: true,
    },
  );
};

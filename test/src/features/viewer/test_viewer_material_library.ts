import {
  AutoMovieTextureCache,
  buildAutoMovieMaterialLibrary,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { throwsError } from "../internal/predicates";
import { boxModel, material } from "../internal/renderFixtures";

/**
 * Simulated surfaces borrow one shot-owned material and texture lifetime.
 *
 * Scenarios:
 *
 * 1. Null selects a builder's own default, while blank, absent, conflicting,
 *    and unrequested ids are refused rather than rendered with a fallback.
 * 2. Repeated requests for one flat material build one shared object without
 *    requiring a texture cache, and library disposal releases it exactly once.
 * 3. A textured material requires the shot cache, decodes once, and separates
 *    ownership: the library disposes the material while the cache later
 *    disposes its binding-private texture and decoded source.
 */
export const test_viewer_material_library = async (): Promise<void> => {
  const stone = material("stone");
  const flatModel = boxModel({ id: "flat-model", materials: [stone] });
  const defaults = await buildAutoMovieMaterialLibrary({
    models: [flatModel],
    materialIds: [null],
  });
  TestValidator.equals(
    "null selects the renderer default and unrequested ids are refused",
    [
      defaults.resolve(null),
      throwsError(() => defaults.resolve("stone"), "was not requested"),
    ],
    [undefined, true],
  );
  defaults.dispose();

  const blank = await buildAutoMovieMaterialLibrary({
    models: [flatModel],
    materialIds: ["  "],
  })
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);
  const absent = await buildAutoMovieMaterialLibrary({
    models: [flatModel],
    materialIds: ["fabric"],
  })
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);
  const conflictingModel = boxModel({
    id: "conflicting-model",
    materials: [{ ...stone, roughness: 0.25 }],
  });
  const conflicting = await buildAutoMovieMaterialLibrary({
    models: [conflictingModel, flatModel],
    materialIds: ["stone"],
  })
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);
  TestValidator.equals(
    "invalid cross-model identities retain the resolver's explicit refusal",
    [
      blank?.includes("must not be blank") === true,
      absent?.includes("is absent") === true,
      conflicting?.includes(
        'conflicting definitions in models: "conflicting-model", "flat-model"',
      ) === true,
    ],
    [true, true, true],
  );

  const flat = await buildAutoMovieMaterialLibrary({
    models: [flatModel],
    materialIds: ["stone", "stone"],
  });
  const first = flat.resolve("stone")!;
  let flatDisposals = 0;
  first.addEventListener("dispose", () => ++flatDisposals);
  TestValidator.predicate(
    "one requested id is one shared runtime material",
    first === flat.resolve("stone"),
  );
  flat.dispose();
  flat.dispose();
  TestValidator.equals(
    "library materials are released once and cannot be borrowed afterwards",
    [
      flatDisposals,
      throwsError(() => flat.resolve("stone"), "already been disposed"),
      throwsError(() => flat.resolve(null), "already been disposed"),
    ],
    [1, true, true],
  );

  const TILE = "textures/water.png";
  const decoded: string[] = [];
  let sourceDisposals = 0;
  const cache = new AutoMovieTextureCache(async (asset) => {
    decoded.push(asset);
    const texture = new THREE.Texture();
    texture.name = asset;
    texture.addEventListener("dispose", () => ++sourceDisposals);
    return texture;
  });
  const water = {
    ...material("water"),
    baseColorTexture: TILE,
    transmission: 0.8,
    thickness: 0.1,
  };
  const texturedModel = boxModel({
    id: "textured-model",
    materials: [water],
  });
  const missingCache = await buildAutoMovieMaterialLibrary({
    models: [texturedModel],
    materialIds: ["water"],
  })
    .then(() => null)
    .catch((error: unknown) => (error as Error).message);
  const textured = await buildAutoMovieMaterialLibrary({
    models: [texturedModel],
    materialIds: ["water", "water"],
    textures: cache,
  });
  const built = textured.resolve("water") as THREE.MeshPhysicalMaterial;
  let materialDisposals = 0;
  let cloneDisposals = 0;
  built.addEventListener("dispose", () => ++materialDisposals);
  built.map!.addEventListener("dispose", () => ++cloneDisposals);
  textured.dispose();
  textured.dispose();
  TestValidator.equals(
    "the library owns the material but leaves texture lifetime to the cache",
    {
      refusal: missingCache?.includes("no shot texture cache") === true,
      decoded,
      cacheSize: cache.size,
      materialDisposals,
      cloneDisposals,
      sourceDisposals,
      texture: built.map?.name,
    },
    {
      refusal: true,
      decoded: [TILE],
      cacheSize: 1,
      materialDisposals: 1,
      cloneDisposals: 0,
      sourceDisposals: 0,
      texture: TILE,
    },
  );
  await cache.dispose();
  await cache.dispose();
  TestValidator.equals(
    "the cache later releases its clone and source exactly once",
    [cache.size, cloneDisposals, sourceDisposals],
    [0, 1, 1],
  );
};

import { IAutoMovieMaterial } from "@automovie/interface";
import {
  AutoMovieTextureCache,
  buildMaterial,
  materialTextureBindings,
  textureBindingAsset,
} from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";
import * as THREE from "three";

import { createModel } from "../internal/fixtures";
import { namedFacts, throwsError } from "../internal/predicates";

/** A loader that counts decodes and lets one named asset fail. */
const recordingLoader = (props?: { fails?: string }) => {
  const decoded: string[] = [];
  const disposals: string[] = [];
  const load = async (asset: string): Promise<THREE.Texture> => {
    decoded.push(asset);
    if (asset === props?.fails)
      throw new Error(`decode refused for "${asset}"`);
    const texture = new THREE.Texture();
    texture.name = asset;
    texture.addEventListener("dispose", () => disposals.push(asset));
    return texture;
  };
  return { decoded, disposals, load };
};

const TILE = "public/textures/tile.png";
const NORMAL = "public/textures/tile-normal.png";

const material = (patch: Partial<IAutoMovieMaterial>): IAutoMovieMaterial => ({
  ...createModel().materials[0]!,
  ...patch,
});

/**
 * One texture asset is decoded once, sampled per binding, and released once.
 *
 * Scenarios:
 *
 * 1. Two models and two slots naming the same image decode it exactly once, and
 *    every binding receives a distinct texture object over the one shared
 *    `Source`, so per-binding repeat and wrap cannot contaminate each other.
 * 2. Disposal releases every issued clone and every decoded source exactly once
 *    however many times it is called, and a disposed cache refuses further
 *    priming and resolving instead of filling a bucket nobody will empty.
 * 3. A binding whose asset was never primed throws rather than silently rendering
 *    an untextured surface, and a decode failure names every asset that failed
 *    while leaving the ones that succeeded disposable.
 */
export const test_viewer_texture_cache = async (): Promise<void> => {
  const loader = recordingLoader();
  const cache = new AutoMovieTextureCache(loader.load);
  const floor = material({
    id: "floor",
    baseColorTexture: {
      asset: TILE,
      texCoord: 0,
      colorSpace: "srgb",
      transform: {
        offset: { x: 0, y: 0 },
        scale: { x: 40, y: 40 },
        rotationDeg: 0,
      },
    },
    normalTexture: { asset: NORMAL, texCoord: 0, colorSpace: "linear" },
  });
  const tabletop = material({
    id: "tabletop",
    baseColorTexture: {
      asset: TILE,
      texCoord: 0,
      colorSpace: "srgb",
      transform: {
        offset: { x: 0, y: 0 },
        scale: { x: 2, y: 2 },
        rotationDeg: 0,
      },
    },
  });
  await cache.prime([
    ...materialTextureBindings(floor),
    ...materialTextureBindings(tabletop),
  ]);
  // Priming again is what a second model in the same shot does; it must not
  // decode a second copy of anything.
  await cache.prime(materialTextureBindings(tabletop));

  const builtFloor = buildMaterial(floor, cache.resolve);
  const builtTable = buildMaterial(tabletop, cache.resolve);
  TestValidator.equals(
    "one asset, one decode, one upload source, separate sampling state",
    namedFacts([
      [
        "decodedOnce",
        () => loader.decoded.filter((a) => a === TILE).length === 1,
      ],
      ["twoAssets", () => loader.decoded.length === 2 && cache.size === 2],
      ["distinctObjects", () => builtFloor.map !== builtTable.map],
      ["sharedSource", () => builtFloor.map!.source === builtTable.map!.source],
      [
        "independentRepeat",
        () => builtFloor.map!.repeat.x === 40 && builtTable.map!.repeat.x === 2,
      ],
      ["normalResolved", () => builtFloor.normalMap?.name === NORMAL],
      ["tableHasNoNormal", () => builtTable.normalMap === null],
    ]),
    {
      decodedOnce: true,
      twoAssets: true,
      distinctObjects: true,
      sharedSource: true,
      independentRepeat: true,
      normalResolved: true,
      tableHasNoNormal: true,
    },
  );

  TestValidator.equals(
    "a binding names the one asset it samples",
    [textureBindingAsset(TILE), textureBindingAsset(floor.baseColorTexture!)],
    [TILE, TILE],
  );

  await cache.dispose();
  await cache.dispose();
  const primeAfterDispose = await cache
    .prime([TILE])
    .then(() => null)
    .catch((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    );
  TestValidator.equals(
    "every source is released exactly once, and the cache is closed",
    namedFacts([
      [
        "sourcesDisposedOnce",
        () =>
          loader.disposals.length === 2 && new Set(loader.disposals).size === 2,
      ],
      ["emptied", () => cache.size === 0],
      [
        "primeRefused",
        () => primeAfterDispose?.includes("already been disposed") === true,
      ],
      [
        "resolveRefused",
        () => throwsError(() => cache.resolve(TILE), "already been disposed"),
      ],
    ]),
    {
      sourcesDisposedOnce: true,
      emptied: true,
      primeRefused: true,
      resolveRefused: true,
    },
  );

  const strict = new AutoMovieTextureCache(recordingLoader().load);
  TestValidator.predicate(
    "an unprimed asset is refused rather than rendered untextured",
    throwsError(
      () => strict.resolve(TILE),
      [TILE, "was never primed into this shot cache"],
    ),
  );

  const failing = recordingLoader({ fails: NORMAL });
  const partial = new AutoMovieTextureCache(failing.load);
  const refusal = await partial
    .prime([TILE, NORMAL])
    .then(() => null)
    .catch((error: unknown) =>
      error instanceof Error ? error.message : String(error),
    );
  await partial.dispose();
  TestValidator.equals(
    "a failed decode names its asset and leaves the rest releasable",
    [
      refusal !== null && refusal.includes(NORMAL),
      refusal !== null && refusal.includes(TILE),
      failing.disposals,
    ],
    [true, false, [TILE]],
  );
};

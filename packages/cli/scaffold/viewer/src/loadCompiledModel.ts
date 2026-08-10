import type { IAutoMovieModel } from "@automovie/interface";
import {
  AutoMovieTextureCache,
  buildModel,
  createImportedModelObject,
  materialTextureBindings,
} from "@automovie/viewer";
import {
  VRM,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from "@pixiv/three-vrm";
import { Object3D, Texture, TextureLoader } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

/**
 * One shot's shared texture cache over the scaffold asset proxy.
 *
 * Created once per shot runtime and disposed once with it, so a tile a floor
 * and a table top both bind is one download and one GPU upload carrying two
 * independent repeats. {@link loadEnvironmentAsset} is the loader because it
 * already routes `.hdr` through `RGBELoader` and everything else through
 * `TextureLoader`, which is exactly the decode an environment image and a
 * material map each need from the same cache.
 */
export const createShotTextureCache = (): AutoMovieTextureCache =>
  new AutoMovieTextureCache(loadEnvironmentAsset);

/** Load the final registered mesh or build the compiler-owned primitive. */
export const loadCompiledModel = async (
  model: IAutoMovieModel,
  textures?: AutoMovieTextureCache,
) => {
  if (model.origin !== "imported" || model.asset === null) {
    const bindings = model.materials.flatMap(materialTextureBindings);
    // A model binding no image needs no cache, which is what keeps every
    // pre-texture production loading exactly as it did.
    if (bindings.length === 0) return buildModel(model);
    if (textures === undefined)
      throw new Error(
        `Model "${model.id}" binds ${bindings.length} texture asset(s) but no shot texture cache was supplied.`,
      );
    await textures.prime(bindings);
    return buildModel(model, textures.resolve);
  }
  if (model.imported === undefined)
    throw new Error(
      `Imported model "${model.id}" has no compiler-sealed ingest binding.`,
    );
  const loader = new GLTFLoader();
  if (model.imported.profile === "vrm-humanoid-v1")
    loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(assetUrl(model.asset));
  const slots = model.skeleton?.bones.map((bone) => bone.bone) ?? [];
  if (model.imported.profile === "vrm-humanoid-v1") {
    const vrm = gltf.userData.vrm as VRM | undefined;
    if (vrm === undefined)
      throw new Error(
        `Imported model "${model.id}" did not produce an authoritative VRM runtime.`,
      );
    VRMUtils.rotateVRM0(vrm);
    const bones = new Map(
      slots.flatMap((bone) => {
        const node = vrm.humanoid.getNormalizedBoneNode(
          bone as VRMHumanBoneName,
        );
        return node === null ? [] : [[bone, node] as const];
      }),
    );
    return createImportedModelObject({
      object: vrm.scene,
      bones,
      expressionTargets: [
        {
          setExpressionValue: (name, weight) =>
            vrm.expressionManager?.setValue(name, weight),
        },
      ],
      afterAutoMovieFrame: ({ deltaSeconds }) =>
        vrm.update(deltaSeconds > 0 ? deltaSeconds : 1 / 60),
    });
  }
  const requested = new Set(slots);
  const bones = new Map(
    (
      await Promise.all(
        model.imported.humanoidBones
          .filter((mapping) => requested.has(mapping.bone))
          .map(async (mapping) => {
            const node = (await gltf.parser.getDependency(
              "node",
              mapping.node,
            )) as Object3D | null;
            return node === null ? null : ([mapping.bone, node] as const);
          }),
      )
    ).filter(
      (entry): entry is readonly [(typeof slots)[number], Object3D] =>
        entry !== null,
    ),
  );
  return createImportedModelObject({
    object: gltf.scene,
    bones,
  });
};

/** Load one project texture through the scaffold asset proxy. */
export const loadTextureAsset = (asset: string): Promise<Texture> =>
  new TextureLoader().loadAsync(assetUrl(asset));

/** Load an LDR or Radiance HDR environment through the same asset proxy. */
export const loadEnvironmentAsset = (asset: string): Promise<Texture> =>
  asset.toLowerCase().endsWith(".hdr")
    ? new RGBELoader().loadAsync(assetUrl(asset))
    : loadTextureAsset(asset);

export const assetUrl = (asset: string): string =>
  `/__automovie/assets/${asset
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

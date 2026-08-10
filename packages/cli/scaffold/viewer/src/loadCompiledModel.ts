import type {
  AutoMovieTextureBinding,
  IAutoMovieModel,
} from "@automovie/interface";
import { buildModel, createImportedModelObject } from "@automovie/viewer";
import {
  VRM,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from "@pixiv/three-vrm";
import { Object3D, Texture, TextureLoader } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

/** Load the final registered mesh or build the compiler-owned primitive. */
export const loadCompiledModel = async (
  model: IAutoMovieModel,
  textureCache?: AutoMovieTextureAssetCache,
) => {
  if (model.origin !== "imported" || model.asset === null) {
    const bindings = model.materials.flatMap(materialTextureBindings);
    const textures = new Map(
      await Promise.all(
        [...new Set(bindings.map(textureAsset))].map(
          async (asset) =>
            [
              asset,
              textureCache === undefined
                ? await loadTextureAsset(asset)
                : await textureCache.load(asset),
            ] as const,
        ),
      ),
    );
    return buildModel(model, (binding) =>
      textures.get(textureAsset(binding))?.clone(),
    );
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

/** Host-owned decoded texture cache shared by every model in one shot. */
export class AutoMovieTextureAssetCache {
  private readonly textures = new Map<string, Promise<Texture>>();
  private disposed = false;

  /** Load or reuse one project texture asset. */
  public load(asset: string): Promise<Texture> {
    if (this.disposed)
      throw new Error("Cannot load a texture through a disposed shot cache.");
    const existing = this.textures.get(asset);
    if (existing !== undefined) return existing;
    const pending = loadEnvironmentAsset(asset);
    this.textures.set(asset, pending);
    return pending;
  }

  /** Dispose every successfully loaded source texture exactly once. */
  public async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const settled = await Promise.allSettled(this.textures.values());
    for (const result of settled)
      if (result.status === "fulfilled") result.value.dispose();
    this.textures.clear();
  }
}

/** Load one project texture through the scaffold asset proxy. */
export const loadTextureAsset = (asset: string): Promise<Texture> =>
  new TextureLoader().loadAsync(assetUrl(asset));

/** Load an LDR or Radiance HDR environment through the same asset proxy. */
export const loadEnvironmentAsset = (asset: string): Promise<Texture> =>
  asset.toLowerCase().endsWith(".hdr")
    ? new RGBELoader().loadAsync(assetUrl(asset))
    : loadTextureAsset(asset);

/** Resolve a legacy or structured texture binding to its asset identity. */
export const textureAsset = (binding: AutoMovieTextureBinding): string =>
  typeof binding === "string" ? binding : binding.asset;

const materialTextureBindings = (
  material: IAutoMovieModel["materials"][number],
): AutoMovieTextureBinding[] =>
  [
    material.baseColorTexture,
    material.metallicRoughnessTexture,
    material.normalTexture,
    material.occlusionTexture,
    material.emissiveTexture,
  ].filter((value): value is AutoMovieTextureBinding => value != null);

export const assetUrl = (asset: string): string =>
  `/__automovie/assets/${asset
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

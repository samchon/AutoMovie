import type { IAutoMovieModel } from "@automovie/interface";
import { buildModel, createImportedModelObject } from "@automovie/viewer";
import {
  VRM,
  VRMHumanBoneName,
  VRMLoaderPlugin,
  VRMUtils,
} from "@pixiv/three-vrm";
import type { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Load the final registered mesh or build the compiler-owned primitive. */
export const loadCompiledModel = async (model: IAutoMovieModel) => {
  if (model.origin !== "imported" || model.asset === null)
    return buildModel(model);
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

const assetUrl = (asset: string): string =>
  `/__automovie/assets/${asset
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

import type { IAutoMovieModel } from "@automovie/interface";
import {
  buildModel,
  createImportedModelObject,
  mapImportedHumanoidBones,
} from "@automovie/viewer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Load the final registered mesh or build the compiler-owned primitive. */
export const loadCompiledModel = async (model: IAutoMovieModel) => {
  if (model.origin !== "imported" || model.asset === null)
    return buildModel(model);
  const gltf = await new GLTFLoader().loadAsync(assetUrl(model.asset));
  const slots = model.skeleton?.bones.map((bone) => bone.bone) ?? [];
  return createImportedModelObject({
    object: gltf.scene,
    bones: mapImportedHumanoidBones(gltf.scene, slots),
  });
};

const assetUrl = (asset: string): string =>
  `/__automovie/assets/${asset
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;

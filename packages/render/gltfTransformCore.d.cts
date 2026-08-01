import type * as GltfTransformCore from "@gltf-transform/core" with {
  "resolution-mode": "import",
};

export declare const importGltfTransformCore: () => Promise<
  typeof GltfTransformCore
>;

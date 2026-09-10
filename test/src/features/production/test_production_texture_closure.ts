import type { IAutoMovieAssetProvenance } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { productionTextureClosureDiagnostics } from "../../../../packages/production/src/production/productionTextureClosure";
import { createModel } from "../internal/fixtures";

export const test_production_texture_closure = (): void => {
  const model = createModel();
  model.materials[0]!.baseColorTexture = {
    asset: "assets/tile.png",
    texCoord: 0,
    colorSpace: "srgb",
  };
  const asset: IAutoMovieAssetProvenance = {
    path: "assets/tile.png",
    digest: `sha256:${"0".repeat(64)}`,
    original: {
      url: "https://example.com/tile.png",
      digest: `sha256:${"0".repeat(64)}`,
    },
    license: { identifier: "CC0-1.0", url: "https://example.com/license" },
    processing: [],
    uses: [
      {
        production: "library",
        consumer: { kind: "material-texture", id: model.id },
        reason: "Surface finish",
      },
    ],
  };
  const png = Buffer.alloc(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(64, 16);
  png.writeUInt32BE(64, 20);
  const input = {
    production: "library",
    models: [],
    environments: [{ models: [model] }],
    scenes: [],
    assets: [asset],
    content: [{ path: asset.path, bytes: png }],
  };
  TestValidator.equals(
    "registered building texture",
    productionTextureClosureDiagnostics(input),
    [],
  );
  TestValidator.equals(
    "standalone model uses the same gate",
    productionTextureClosureDiagnostics({
      ...input,
      models: [model],
      environments: [],
    }),
    [],
  );
  const missing = productionTextureClosureDiagnostics({ ...input, assets: [] });
  TestValidator.equals(
    "unregistered building image is refused",
    missing.map((entry) => entry.code),
    ["asset-texture-unclosed"],
  );
  TestValidator.equals(
    "missing bytes are refused",
    productionTextureClosureDiagnostics({ ...input, content: [] }).length,
    1,
  );
  TestValidator.equals(
    "unreadable bytes are refused",
    productionTextureClosureDiagnostics({
      ...input,
      content: [{ path: asset.path, bytes: new Uint8Array() }],
    }).length,
    1,
  );
  TestValidator.equals(
    "wrong consumer is refused",
    productionTextureClosureDiagnostics({
      ...input,
      assets: [{ ...asset, uses: [] }],
    }).length,
    1,
  );
  const other = {
    ...model,
    materials: model.materials.map((material) => ({
      ...material,
      baseColorTexture: "assets/other.png",
    })),
  };
  TestValidator.equals(
    "same model id cannot hide another environment's texture",
    productionTextureClosureDiagnostics({
      ...input,
      environments: [{ models: [model] }, { models: [other] }],
    }).length,
    1,
  );
  TestValidator.equals(
    "empty library",
    productionTextureClosureDiagnostics({
      ...input,
      environments: [],
      assets: [],
      content: [],
    }),
    [],
  );
};

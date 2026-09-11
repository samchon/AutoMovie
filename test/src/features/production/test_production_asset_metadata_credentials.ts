import type { IAutoMovieAssetProvenance } from "@automovie/interface";
import { assetUrlAdmissionRefusal } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

/**
 * Local assets carry their byte identity without an acquisition dossier.
 * Optional metadata still cannot carry embedded credentials into output.
 *
 * Scenarios:
 * 1. A local asset with only its current identity and consumer passes.
 * 2. Descriptive local and HTTPS locations introduce no credential failure.
 * 3. Source and license locators with credentials report only their field.
 */
export const test_production_asset_metadata_credentials = (): void => {
  const asset: IAutoMovieAssetProvenance = {
    path: "assets/tile.png",
    digest: `sha256:${"0".repeat(64)}`,
    uses: [
      {
        production: "library",
        consumer: { kind: "material-texture", id: "wall" },
        reason: "Wall surface",
      },
    ],
  };
  TestValidator.equals("local bytes", assetUrlAdmissionRefusal(asset), null);
  TestValidator.equals(
    "descriptive metadata",
    assetUrlAdmissionRefusal({
      ...asset,
      original: { url: "internal-art/tile", digest: asset.digest },
      license: { identifier: "", url: "https://example.com/terms" },
    }),
    null,
  );
  for (const field of ["original", "license"] as const)
    TestValidator.equals(
      `credential in ${field}`,
      assetUrlAdmissionRefusal({
        ...asset,
        [field]: {
          url: "https://user:secret@example.com/asset",
          ...(field === "original"
            ? { digest: asset.digest }
            : { identifier: "internal" }),
        },
      }),
      { field, reason: "credential-bearing" },
    );
};

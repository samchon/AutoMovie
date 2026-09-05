import type {
  IAutoMovieAssetManifest,
  IAutoMovieAssetProvenance,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { completedFilmJson } from "../internal/completedFilmFixture";
import { loadSourceModule } from "../internal/loadSourceModule";
import { productionFixture } from "./productionFixtures";

type UrlRefusal = {
  field: "original" | "license";
  reason: "malformed" | "unsupported-protocol" | "credential-bearing";
};

const admission = loadSourceModule<{
  assetAcquisitionIncomplete: (asset: IAutoMovieAssetProvenance) => boolean;
  assetUrlAdmissionRefusal: (
    asset: IAutoMovieAssetProvenance,
  ) => UrlRefusal | null;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/assetAcquisition.ts",
  ),
);

/**
 * Asset locators share one credential-free HTTP(S) admission boundary.
 *
 * Scenarios:
 *
 * 1. Clean HTTP and HTTPS locators, including an opaque query value, remain
 *    admissible for fetched sources and licenses.
 * 2. Username-only, password-only, and percent-encoded userinfo are refused
 *    from a fetched source without returning the rejected locator.
 * 3. Malformed and non-HTTP source locators retain their existing refusals.
 * 4. The same typed predicate refuses credential-bearing license locators,
 *    including for a generated asset that has no fetched source URL.
 * 5. Compiler lint accepts the clean fixture and rejects source and license
 *    credentials without copying either secret into diagnostics.
 */
export const test_production_asset_url_admission = (): void => {
  const manifest = completedFilmJson<IAutoMovieAssetManifest>(
    "automovie/assets.json",
  );
  const fetched = manifest.assets.find((asset) => asset.original !== undefined);
  if (fetched?.original === undefined)
    throw new Error("The completed asset fixture needs one fetched asset.");
  const withUrls = (source: string, license: string = fetched.license.url) => ({
    ...fetched,
    original: { ...fetched.original!, url: source },
    license: { ...fetched.license, url: license },
  });
  const sourceCases = [
    ["https://assets.example/image.png", null],
    ["http://assets.example/image.png", null],
    ["https://assets.example/image.png?token=opaque", null],
    [
      "https://user@assets.example/image.png",
      { field: "original", reason: "credential-bearing" },
    ],
    [
      "https://:secret@assets.example/image.png",
      { field: "original", reason: "credential-bearing" },
    ],
    [
      "https://user:secret@assets.example/image.png",
      { field: "original", reason: "credential-bearing" },
    ],
    [
      "https://us%65r:sec%72et@assets.example/image.png",
      { field: "original", reason: "credential-bearing" },
    ],
    ["https://[invalid", { field: "original", reason: "malformed" }],
    ["not a url", { field: "original", reason: "malformed" }],
    [
      "file:///assets/image.png",
      { field: "original", reason: "unsupported-protocol" },
    ],
  ] as const;
  TestValidator.equals(
    "source URL admission parses protocol and userinfo without guessing query secrets",
    sourceCases.map(([source]) =>
      admission.assetUrlAdmissionRefusal(withUrls(source)),
    ),
    sourceCases.map(([, refusal]) => refusal),
  );
  TestValidator.equals(
    "the acquisition ledger consumes the same source URL boundary",
    sourceCases.map(([source]) =>
      admission.assetAcquisitionIncomplete(withUrls(source)),
    ),
    sourceCases.map(([, refusal]) => refusal !== null),
  );

  const generated = {
    ...fetched,
    original: undefined,
  } as IAutoMovieAssetProvenance;
  const licenseSecret = "https://license-user:license-secret@licenses.example";
  TestValidator.equals(
    "license URL admission uses the same redacted refusal for fetched and generated assets",
    [
      admission.assetUrlAdmissionRefusal(
        withUrls(fetched.original.url, licenseSecret),
      ),
      admission.assetUrlAdmissionRefusal({
        ...generated,
        license: { ...generated.license, url: licenseSecret },
      }),
      admission.assetUrlAdmissionRefusal(
        withUrls(fetched.original.url, "https://[invalid"),
      ),
      admission.assetUrlAdmissionRefusal(generated),
    ],
    [
      { field: "license", reason: "credential-bearing" },
      { field: "license", reason: "credential-bearing" },
      { field: "license", reason: "malformed" },
      null,
    ],
  );
  TestValidator.predicate(
    "typed refusals never retain the credential-bearing locator",
    JSON.stringify(
      admission.assetUrlAdmissionRefusal(
        withUrls(fetched.original.url, licenseSecret),
      ),
    ).includes("license-secret") === false,
  );

  const fixture = productionFixture();
  try {
    const manifestPath = path.join(fixture.root, "automovie", "assets.json");
    const compilerManifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8"),
    ) as IAutoMovieAssetManifest;
    const compile = (
      mutate?: (asset: IAutoMovieAssetProvenance) => void,
    ): ReturnType<AutoMovieProductionCompiler["lint"]> => {
      const value = structuredClone(compilerManifest);
      const target = value.assets.find((asset) => asset.original !== undefined);
      if (target === undefined)
        throw new Error("The compiler fixture needs one fetched asset.");
      mutate?.(target);
      fs.writeFileSync(
        manifestPath,
        `${JSON.stringify(value, null, 2)}\n`,
        "utf8",
      );
      return new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
      ).lint({ scope: "source" });
    };
    const clean = compile();
    const sourceSecret = "source-password";
    const rejectedSource = compile((asset) => {
      asset.original!.url = `https://source-user:${sourceSecret}@assets.example/image.png`;
    });
    const rejectedLicense = compile((asset) => {
      asset.license.url = licenseSecret;
    });
    TestValidator.equals(
      "compiler keeps the clean twin URL-admissible and refuses source and license credentials without publication",
      {
        cleanProvenanceRefusal: clean.diagnostics.some(
          (entry) => entry.code === "asset-provenance-incomplete",
        ),
        source: {
          success: rejectedSource.success,
          provenance: rejectedSource.diagnostics.some(
            (entry) => entry.code === "asset-provenance-incomplete",
          ),
        },
        license: {
          success: rejectedLicense.success,
          provenance: rejectedLicense.diagnostics.some(
            (entry) => entry.code === "asset-provenance-incomplete",
          ),
        },
      },
      {
        cleanProvenanceRefusal: false,
        source: { success: false, provenance: true },
        license: { success: false, provenance: true },
      },
    );
    TestValidator.predicate(
      "compiler diagnostics omit both rejected credential-bearing locators",
      [...rejectedSource.diagnostics, ...rejectedLicense.diagnostics].every(
        (entry) =>
          entry.message.includes(sourceSecret) === false &&
          entry.message.includes("license-secret") === false,
      ),
    );
  } finally {
    fixture.dispose();
  }
};

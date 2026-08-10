import {
  IAutoMovieTextureImageFacts,
  validateTextureAssets,
} from "@automovie/engine";
import {
  IAutoMovieAssetProvenance,
  IAutoMovieAssetUse,
  IAutoMovieMaterial,
  IAutoMovieModel,
  IAutoMovieSceneEnvironment,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import {
  hasViolation,
  namedFacts,
  violationCount,
} from "../internal/predicates";

const PRODUCTION = "atrium";

const FACTS: Record<string, IAutoMovieTextureImageFacts> = {
  "public/textures/tile-base.png": {
    mediaType: "image/png",
    width: 1024,
    height: 1024,
  },
  "public/textures/tile-normal.png": {
    mediaType: "image/png",
    width: 1024,
    height: 1024,
  },
  "public/textures/studio.hdr": {
    mediaType: "image/vnd.radiance",
    width: 2048,
    height: 1024,
  },
};

const facts = (asset: string): IAutoMovieTextureImageFacts | undefined =>
  FACTS[asset];

const use = (
  kind: "material-texture" | "scene-environment" | "audio-cue",
  id: string,
  production = PRODUCTION,
): IAutoMovieAssetUse => ({
  production,
  consumer: { kind, id },
  reason: "built environment finish",
});

const record = (
  path: string,
  uses: IAutoMovieAssetUse[],
): IAutoMovieAssetProvenance => ({
  path,
  digest: `sha256:${"0".repeat(64)}`,
  original: {
    url: "https://example.com/source",
    digest: `sha256:${"0".repeat(64)}`,
  },
  license: { identifier: "CC0-1.0", url: "https://example.com/licence" },
  processing: [],
  uses,
});

const material = (patch: Partial<IAutoMovieMaterial>): IAutoMovieMaterial => ({
  ...createModel().materials[0]!,
  ...patch,
});

const model = (
  id: string,
  materials: IAutoMovieMaterial[],
): IAutoMovieModel => ({ ...createModel(), id, materials });

const TILED_FLOOR = model("floor", [
  material({
    id: "tile",
    baseColorTexture: {
      asset: "public/textures/tile-base.png",
      texCoord: 0,
      colorSpace: "srgb",
    },
    normalTexture: {
      asset: "public/textures/tile-normal.png",
      texCoord: 0,
      colorSpace: "linear",
    },
  }),
]);

const ENVIRONMENT: IAutoMovieSceneEnvironment = {
  image: "public/textures/studio.hdr",
  background: null,
  intensity: 1,
  rotationDeg: 0,
  exposure: 1,
  toneMapping: "acesFilmic",
  shadows: { enabled: true, type: "pcfSoft" },
};

const CLEAN_ASSETS: IAutoMovieAssetProvenance[] = [
  record("public/textures/tile-base.png", [use("material-texture", "floor")]),
  record("public/textures/tile-normal.png", [use("material-texture", "floor")]),
  record("public/textures/studio.hdr", [use("scene-environment", "opening")]),
];

const closure = (props: {
  models?: IAutoMovieModel[];
  scenes?: Array<{
    shot: string;
    environment?: IAutoMovieSceneEnvironment | null;
  }>;
  assets?: IAutoMovieAssetProvenance[];
  facts?: (asset: string) => IAutoMovieTextureImageFacts | undefined;
}) =>
  validateTextureAssets({
    production: PRODUCTION,
    models: props.models ?? [TILED_FLOOR],
    scenes: props.scenes ?? [{ shot: "opening", environment: ENVIRONMENT }],
    assets: props.assets ?? CLEAN_ASSETS,
    facts: props.facts ?? facts,
  });

/**
 * A compiled production may sample only images its asset ledger authorizes.
 *
 * Scenarios:
 *
 * 1. A tiled floor binding two registered images and a shot lighting itself from a
 *    registered HDR closes cleanly, and a production that binds no image at all
 *    stays clean whether its scene declares no environment, a null one, or one
 *    with no image.
 * 2. Each failure mode is located at the authored path: an unregistered image, a
 *    registered one with no typed use, a use whose production or consumer id
 *    does not match, and a ledger entry for a consumer that no longer binds
 *    it.
 * 3. Bytes decide media and size: unreadable bytes, an HDR bound as base color, a
 *    zero, fractional or over-budget edge are all refused, while the exact
 *    portable limit and a PNG environment are accepted.
 * 4. One image bound as both a colour and a measurement is refused at every
 *    contradicting slot, including through legacy bare-id bindings whose intent
 *    comes from the slot itself.
 */
export const test_validation_texture_assets = (): void => {
  TestValidator.equals(
    "an authorized floor and environment close cleanly",
    closure({}).success,
    true,
  );
  TestValidator.equals(
    "a production binding no image needs no texture ledger",
    namedFacts([
      [
        "noEnvironmentKey",
        () =>
          closure({
            models: [model("bare", [material({})])],
            scenes: [{ shot: "opening" }],
            assets: [],
          }).success,
      ],
      [
        "nullEnvironment",
        () =>
          closure({
            models: [],
            scenes: [{ shot: "opening", environment: null }],
            assets: [],
          }).success,
      ],
      [
        "imagelessEnvironment",
        () =>
          closure({
            models: [],
            scenes: [
              {
                shot: "opening",
                environment: {
                  ...ENVIRONMENT,
                  image: null,
                  background: { r: 0, g: 0, b: 0, a: null, hex: null },
                },
              },
            ],
            assets: [],
          }).success,
      ],
      [
        "otherProductionLedgerIgnored",
        () =>
          closure({
            models: [],
            scenes: [{ shot: "opening" }],
            assets: [
              record("public/textures/tile-base.png", [
                use("material-texture", "floor", "other-production"),
              ]),
            ],
          }).success,
      ],
      [
        "nonTextureConsumerIgnored",
        () =>
          closure({
            models: [],
            scenes: [{ shot: "opening" }],
            assets: [
              record("public/audio/stem.wav", [use("audio-cue", "theme")]),
            ],
          }).success,
      ],
    ]),
    {
      noEnvironmentKey: true,
      nullEnvironment: true,
      imagelessEnvironment: true,
      otherProductionLedgerIgnored: true,
      nonTextureConsumerIgnored: true,
    },
  );

  TestValidator.equals(
    "every closure failure is located at its authored path",
    namedFacts([
      [
        "unregisteredTexture",
        () =>
          hasViolation(
            closure({ assets: CLEAN_ASSETS.slice(1) }),
            "type",
            "$input.models[0].materials[0].baseColorTexture",
          ),
      ],
      [
        "unregisteredEnvironment",
        () =>
          hasViolation(
            closure({ assets: CLEAN_ASSETS.slice(0, 2) }),
            "type",
            "$input.scenes[0].environment.image",
          ),
      ],
      [
        "noTypedUse",
        () =>
          hasViolation(
            closure({
              assets: [
                record("public/textures/tile-base.png", []),
                ...CLEAN_ASSETS.slice(1),
              ],
            }),
            "type",
            "$input.models[0].materials[0].baseColorTexture",
          ),
      ],
      [
        "wrongConsumerId",
        () =>
          hasViolation(
            closure({
              assets: [
                record("public/textures/tile-base.png", [
                  use("material-texture", "ceiling"),
                ]),
                ...CLEAN_ASSETS.slice(1),
              ],
            }),
            "type",
            "$input.models[0].materials[0].baseColorTexture",
          ),
      ],
      [
        "wrongConsumerKind",
        () =>
          hasViolation(
            closure({
              assets: [
                ...CLEAN_ASSETS.slice(0, 2),
                record("public/textures/studio.hdr", [
                  use("material-texture", "opening"),
                ]),
              ],
            }),
            "type",
            "$input.scenes[0].environment.image",
          ),
      ],
      [
        "wrongProduction",
        () =>
          hasViolation(
            closure({
              assets: [
                record("public/textures/tile-base.png", [
                  use("material-texture", "floor", "other-production"),
                ]),
                ...CLEAN_ASSETS.slice(1),
              ],
            }),
            "type",
            "$input.models[0].materials[0].baseColorTexture",
          ),
      ],
      [
        "staleMaterialUse",
        () =>
          hasViolation(
            closure({
              models: [model("floor", [material({})])],
              scenes: [{ shot: "opening" }],
              assets: [CLEAN_ASSETS[0]!],
            }),
            "type",
            "$input.assets[0].uses[0]",
          ),
      ],
      [
        "staleEnvironmentUse",
        () =>
          hasViolation(
            closure({
              models: [],
              scenes: [{ shot: "opening" }],
              assets: [CLEAN_ASSETS[2]!],
            }),
            "type",
            "$input.assets[0].uses[0]",
          ),
      ],
    ]),
    {
      unregisteredTexture: true,
      unregisteredEnvironment: true,
      noTypedUse: true,
      wrongConsumerId: true,
      wrongConsumerKind: true,
      wrongProduction: true,
      staleMaterialUse: true,
      staleEnvironmentUse: true,
    },
  );

  TestValidator.equals(
    "media and dimensions are decided by the bytes",
    namedFacts([
      [
        "unreadable",
        () =>
          hasViolation(
            closure({ facts: () => undefined }),
            "type",
            "$input.models[0].materials[0].baseColorTexture",
          ),
      ],
      [
        "hdrAsBaseColor",
        () =>
          hasViolation(
            closure({
              facts: (asset) =>
                asset === "public/textures/tile-base.png"
                  ? { mediaType: "image/vnd.radiance", width: 8, height: 8 }
                  : facts(asset),
            }),
            "type",
            "$input.models[0].materials[0].baseColorTexture",
          ),
      ],
      [
        "pngEnvironmentAccepted",
        () =>
          closure({
            facts: (asset) =>
              asset === "public/textures/studio.hdr"
                ? { mediaType: "image/png", width: 64, height: 32 }
                : facts(asset),
          }).success,
      ],
      [
        "zeroEdge",
        () =>
          hasViolation(
            closure({
              facts: (asset) =>
                asset === "public/textures/tile-base.png"
                  ? { mediaType: "image/png", width: 0, height: 16 }
                  : facts(asset),
            }),
            "range",
            ".baseColorTexture.width",
          ),
      ],
      [
        "fractionalEdge",
        () =>
          hasViolation(
            closure({
              facts: (asset) =>
                asset === "public/textures/tile-base.png"
                  ? { mediaType: "image/png", width: 16, height: 16.5 }
                  : facts(asset),
            }),
            "range",
            ".baseColorTexture.height",
          ),
      ],
      [
        "overBudget",
        () =>
          hasViolation(
            closure({
              facts: (asset) =>
                asset === "public/textures/tile-base.png"
                  ? { mediaType: "image/png", width: 8193, height: 16 }
                  : facts(asset),
            }),
            "range",
            ".baseColorTexture.width",
          ),
      ],
      [
        "exactBudgetAccepted",
        () =>
          closure({
            facts: (asset) =>
              asset === "public/textures/tile-base.png"
                ? { mediaType: "image/png", width: 8192, height: 8192 }
                : facts(asset),
          }).success,
      ],
    ]),
    {
      unreadable: true,
      hdrAsBaseColor: true,
      pngEnvironmentAccepted: true,
      zeroEdge: true,
      fractionalEdge: true,
      overBudget: true,
      exactBudgetAccepted: true,
    },
  );

  const contradiction = closure({
    models: [
      model("floor", [
        material({
          baseColorTexture: {
            asset: "public/textures/tile-base.png",
            texCoord: 0,
            colorSpace: "srgb",
          },
          normalTexture: {
            asset: "public/textures/tile-base.png",
            texCoord: 0,
            colorSpace: "linear",
          },
        }),
      ]),
    ],
    scenes: [{ shot: "opening" }],
    assets: [CLEAN_ASSETS[0]!],
  });
  TestValidator.equals(
    "one image cannot be both a colour and a measurement",
    [
      hasViolation(contradiction, "type", ".baseColorTexture"),
      hasViolation(contradiction, "type", ".normalTexture"),
      violationCount(contradiction),
    ],
    [true, true, 2],
  );

  const legacyContradiction = closure({
    models: [
      model("floor", [
        material({
          baseColorTexture: "public/textures/tile-base.png",
          emissiveTexture: "public/textures/tile-base.png",
          occlusionTexture: "public/textures/tile-base.png",
        }),
      ]),
    ],
    scenes: [{ shot: "opening" }],
    assets: [CLEAN_ASSETS[0]!],
  });
  TestValidator.equals(
    "a legacy bare-id binding takes its intent from the slot it fills",
    violationCount(legacyContradiction),
    3,
  );

  TestValidator.equals(
    "one image serving two agreeing slots of one model stays clean",
    closure({
      models: [
        model("floor", [
          material({
            metallicRoughnessTexture: "public/textures/tile-normal.png",
            occlusionTexture: "public/textures/tile-normal.png",
          }),
        ]),
      ],
      scenes: [{ shot: "opening" }],
      assets: [CLEAN_ASSETS[1]!],
    }).success,
    true,
  );
};

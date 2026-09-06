import type {
  IAutoMovieAssetManifest,
  IAutoMovieAssetProvenance,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  digestAutoMovieBytes,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { productionFixture } from "./productionFixtures";

const MODEL = "public/models/box.glb";
const PROXY = "public/models/box.proxy.json";
const COLLISION_ONLY = "public/models/collision-only.proxy.json";
const BROKEN = "public/models/broken.proxy.json";
const NOTE = "public/models/box.txt";

/**
 * An external model's collision and measurement proxies may be adopted from a
 * project-owned proxy asset instead of declared inline, and that adoption is
 * byte-grounded: the proxy bytes are read from the exact registered asset, the
 * asset must be authorized as this model's proxy, and anything the proxy file
 * does not state is absent rather than inferred.
 *
 * Scenarios:
 *
 * 1. A registered, authorized JSON proxy asset supplies both proxies and the
 *    model raises no proxy diagnostic.
 * 2. A proxy asset that omits the requested kind, unparsable proxy bytes, a
 *    non-JSON asset, an asset the manifest does not register, and a registered
 *    asset not authorized as this model's proxy each leave the proxy dangling.
 */
export const test_production_asset_proxy_reference = (): void => {
  const fixture = productionFixture();
  try {
    const manifestPath = path.join(fixture.root, "automovie", "assets.json");
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8"),
    ) as IAutoMovieAssetManifest;
    const files: Record<string, Uint8Array> = {
      [MODEL]: Buffer.from("not a model", "utf8"),
      [PROXY]: Buffer.from(
        JSON.stringify({
          version: 1,
          collision: {
            recipe: "box-v1",
            parameters: { width: 1, height: 1, depth: 1 },
          },
          measurement: {
            recipe: "box-v1",
            parameters: { width: 1, height: 1, depth: 1 },
          },
        }),
        "utf8",
      ),
      [COLLISION_ONLY]: Buffer.from(
        JSON.stringify({
          version: 1,
          collision: {
            recipe: "capsule-v1",
            parameters: { radius: 0.5, height: 2 },
          },
        }),
        "utf8",
      ),
      [BROKEN]: Buffer.from("{not json", "utf8"),
      [NOTE]: Buffer.from("plain text", "utf8"),
    };
    for (const [relative, bytes] of Object.entries(files)) {
      const file = path.join(fixture.root, ...relative.split("/"));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
    }
    const record = (
      relative: string,
      uses: IAutoMovieAssetProvenance["uses"],
    ): IAutoMovieAssetProvenance => ({
      path: relative,
      digest: digestAutoMovieBytes(files[relative]!),
      original: {
        url: `https://assets.example/${path.posix.basename(relative)}`,
        digest: digestAutoMovieBytes(files[relative]!),
      },
      license: {
        identifier: "MIT",
        url: "https://licenses.example/mit",
        notice: "Fixture bytes distributed under the MIT License.",
      },
      processing: [],
      uses,
    });
    const proxyUse = (owner: string): IAutoMovieAssetProvenance["uses"] => [
      {
        production: "fixture-film",
        consumer: { kind: "model-proxy", id: owner },
        reason: "The proxy asset states the model's exact proxy decisions.",
      },
    ];
    const compile = (props: {
      collision: string;
      measurement: string;
      registered?: readonly string[];
      authorizedFor?: string;
    }): number => {
      const registered = props.registered ?? [
        PROXY,
        COLLISION_ONLY,
        BROKEN,
        NOTE,
      ];
      const value: IAutoMovieAssetManifest = {
        ...manifest,
        assets: [
          ...manifest.assets,
          {
            ...record(MODEL, [
              {
                production: "fixture-film",
                consumer: { kind: "model-recipe", id: "box" },
                reason: "The fixture adopts one external box appearance.",
              },
            ]),
            model: {
              ingestProfile: "gltf-static-v1",
              lod: [{ level: "hero", asset: MODEL }],
              collisionProxy: { kind: "asset", asset: props.collision },
              measurementProxy: { kind: "asset", asset: props.measurement },
            },
          },
          ...registered.map((relative) =>
            record(relative, proxyUse(props.authorizedFor ?? MODEL)),
          ),
        ],
      };
      fs.writeFileSync(manifestPath, `${JSON.stringify(value, null, 2)}\n`);
      return new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(fixture.root),
      )
        .lint({ scope: "source" })
        .diagnostics.filter(
          (diagnostic) => diagnostic.code === "asset-model-proxy-dangling",
        ).length;
    };
    TestValidator.equals(
      "adopted proxies are read from the exact authorized proxy asset or left dangling",
      {
        adopted: compile({ collision: PROXY, measurement: PROXY }),
        missingKind: compile({ collision: PROXY, measurement: COLLISION_ONLY }),
        unparsable: compile({ collision: BROKEN, measurement: PROXY }),
        notJson: compile({ collision: NOTE, measurement: PROXY }),
        unregistered: compile({
          collision: PROXY,
          measurement: PROXY,
          registered: [],
        }),
        unauthorized: compile({
          collision: PROXY,
          measurement: PROXY,
          authorizedFor: "public/models/other.glb",
        }),
      },
      {
        adopted: 0,
        missingKind: 1,
        unparsable: 1,
        notJson: 1,
        unregistered: 2,
        unauthorized: 2,
      },
    );
  } finally {
    fixture.dispose();
  }
};

import {
  IAutoMovieAssetManifest,
  IAutoMovieModel,
  IAutoMovieProductionRenderManifest,
  IAutoMovieProductionRenderReceipt,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  AutoMovieProductionReviewService,
  canonicalizeAutoMovieJson,
  compareCodeUnits,
  digestAutoMovieBytes,
  muxProductionFeatureMp4,
  probeProductionMedia,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";

import {
  formationDesign,
  modelRecipe,
  productionCompileSucceeded,
  productionDesign,
  productionFixture,
  setProductionFixtureShotContract,
  shotContract,
  worldDesign,
} from "./productionFixtures";
import {
  productionH264Mp4,
  productionOpusMp4,
  productionPng,
} from "./productionMediaFixtures";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

interface IProductionCompilerFixtureFailure {
  error: unknown;
}

class ProductionCompilerFixtureCleanupError extends AggregateError {}

/** Remove one compiler fixture without replacing its primary failure. */
export const preserveProductionCompilerFixtureCleanup = (
  failure: IProductionCompilerFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new ProductionCompilerFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Production-compiler fixture teardown failed after the test failed.",
    );
  }
};

const minimalExternalModelJson = (): string => {
  const vertexCount = 15;
  const positions = Buffer.alloc(
    vertexCount * 3 * Float32Array.BYTES_PER_ELEMENT,
  );
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) =>
    positions.writeFloatLE(value, index * Float32Array.BYTES_PER_ELEMENT),
  );
  const joints = Buffer.alloc(vertexCount * 4);
  const weights = Buffer.alloc(vertexCount * 4);
  for (let vertex = 0; vertex < vertexCount; ++vertex) {
    joints[vertex * 4] = Math.min(vertex, 12);
    weights[vertex * 4] = 255;
  }
  const payload = Buffer.concat([positions, joints, weights]);
  return JSON.stringify({
    asset: { version: "2.0" },
    buffers: [
      {
        byteLength: payload.length,
        uri: `data:application/octet-stream;base64,${payload.toString("base64")}`,
      },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.length },
      { buffer: 0, byteOffset: positions.length, byteLength: joints.length },
      {
        buffer: 0,
        byteOffset: positions.length + joints.length,
        byteLength: weights.length,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      {
        bufferView: 1,
        componentType: 5121,
        count: vertexCount,
        type: "VEC4",
      },
      {
        bufferView: 2,
        componentType: 5121,
        normalized: true,
        count: vertexCount,
        type: "VEC4",
      },
    ],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } },
        ],
      },
    ],
    nodes: [
      { mesh: 0, skin: 0, name: "RegisteredTriangle" },
      { name: "Hips" },
      { name: "Spine" },
      { name: "Head" },
      { name: "LeftArm" },
      { name: "LeftForeArm" },
      { name: "LeftHand" },
      { name: "RightArm" },
      { name: "RightForeArm" },
      { name: "RightHand" },
      { name: "LeftUpLeg" },
      { name: "LeftLeg" },
      { name: "RightUpLeg" },
      { name: "RightLeg" },
    ],
    skins: [{ joints: Array.from({ length: 13 }, (_, index) => index + 1) }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  });
};

const diagnosticCodes = (
  output: ReturnType<AutoMovieProductionCompiler["compile"]>,
): Set<string> => new Set(output.diagnostics.map((item) => item.code));

/**
 * Rewrite scaffold source, refusing to return it unchanged.
 *
 * Every refusal case here mutates the starter into the shape it is meant to
 * reject, so an anchor the scaffold no longer contains does not weaken the
 * case, it silently inverts it: the compile then runs against valid source and
 * whatever it says is read as the answer to a question never asked.
 */
const mutate = (source: string, from: string, to: string): string => {
  const next = source.replace(from, to);
  if (next === source)
    throw new Error(
      `Scaffold source no longer contains ${JSON.stringify(from)}.`,
    );
  return next;
};

/** Source compilation is sandboxed, recoverable and stable after reopen. */
export const test_mcp_production_compiler = async (): Promise<void> => {
  let productionCompilerFailure: IProductionCompilerFixtureFailure | undefined;
  const fixture = productionFixture();
  try {
    const sourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const original = fs.readFileSync(sourcePath, "utf8");
    const {
      id: _fixtureShotId,
      source: _fixtureShotSource,
      ...fixtureRegistration
    } = shotContract();
    // Anchor on the builder's own closing brace rather than on the comment
    // that follows it. Prose above the next declaration moves whenever the
    // scaffold's documentation changes, and a mutation that silently fails to
    // apply turns these cases into assertions about untouched source.
    const mutateSourceOutput = (
      mutation: string,
      source: string = original,
    ): string => {
      const opened = mutate(
        source,
        "  return {\n    actors:",
        "  const output = {\n    actors:",
      );
      const marker = "\n  };\n};\n";
      const at = opened.indexOf(marker);
      if (at < 0)
        throw new Error("Scaffold source no longer closes its shot builder.");
      return `${opened.slice(0, at)}\n  };\n${mutation}\n  return output;\n};\n${opened.slice(at + marker.length)}`;
    };
    const injectBuildSignal = (...statements: string[]): string =>
      mutate(
        original,
        "): IAutoMovieProductionShotProgram => {",
        ["): IAutoMovieProductionShotProgram => {", ...statements].join("\n"),
      );
    const project = AutoMovieProductionProject.open(fixture.root);
    const review = new AutoMovieProductionReviewService(project);
    const compiler = new AutoMovieProductionCompiler(
      project,
      (status, snapshot) => review.queue(status, snapshot),
    );
    TestValidator.predicate(
      "the sliced fixture keeps its source registration equal to its design",
      original.includes(
        `const OPENING_CONTRACT: IAutoMovieDefinedShotContract = ${JSON.stringify(
          fixtureRegistration,
          null,
          2,
        )};`,
      ),
    );

    const designOnly = compiler.lint({ scope: "design" });
    TestValidator.predicate(
      "read-only design lint does not materialize",
      designOnly.success && designOnly.materialized.length === 0,
    );
    const preexistingGenerated = path.join(
      fixture.root,
      "generated/fixture-film/intruder.txt",
    );
    fs.writeFileSync(preexistingGenerated, "unowned");
    TestValidator.predicate(
      "the first compile refuses preexisting unowned generated bytes",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "generated-unowned",
      ),
    );
    fs.rmSync(preexistingGenerated);
    const firstContentInputs = project.contentInputs;
    let firstContentReads = 0;
    project.contentInputs = (() => {
      ++firstContentReads;
      return firstContentInputs.call(project);
    }) as typeof project.contentInputs;
    const first = compiler.compile({ scope: "source" });
    project.contentInputs = firstContentInputs;
    TestValidator.equals(
      "starter source compiles from one shared snapshot and two commit guards",
      namedFacts([
        [
          "productionCompileSucceededStarter",
          () => productionCompileSucceeded("starter source fixture", first),
        ],
        ["firstContentReads", () => firstContentReads === 3],
        [
          "firstMaterialized",
          () =>
            first.materialized.some(
              (file) =>
                file.path === "shots/opening.json" && file.status === "created",
            ),
        ],
        [
          "firstReviews",
          () =>
            first.reviews.entries.every(
              (entry) => entry.currentFingerprint !== null,
            ),
        ],
      ]),
      {
        productionCompileSucceededStarter: true,
        firstContentReads: true,
        firstMaterialized: true,
        firstReviews: true,
      },
    );

    const assetManifestPath = path.join(fixture.root, ".automovie/assets.json");
    const assetPath = path.join(fixture.root, "public/audio/starter-tone.json");
    const originalAssetManifest = fs.readFileSync(assetManifestPath, "utf8");
    const originalAssetBytes = fs.readFileSync(assetPath);
    const assetManifest = JSON.parse(
      originalAssetManifest,
    ) as IAutoMovieAssetManifest;
    const assetCodes = (value: unknown): Set<string> => {
      fs.writeFileSync(
        assetManifestPath,
        typeof value === "string" ? value : JSON.stringify(value),
      );
      return diagnosticCodes(compiler.lint({ scope: "source" }));
    };

    fs.appendFileSync(assetPath, "drift");
    const driftedAsset = diagnosticCodes(compiler.lint({ scope: "source" }));
    fs.writeFileSync(assetPath, originalAssetBytes);
    fs.rmSync(assetManifestPath);
    const missingAssetManifest = diagnosticCodes(
      compiler.lint({ scope: "source" }),
    );
    fs.writeFileSync(assetManifestPath, originalAssetManifest);
    const malformedAssetManifest = assetCodes("{bad");
    const invalidAssetManifest = assetCodes({});
    const incompleteAssetManifest = assetCodes({
      ...assetManifest,
      assets: assetManifest.assets.map((asset) => ({
        ...asset,
        original: { ...asset.original, url: "not a URL" },
        license: { ...asset.license, identifier: "", url: "ftp://license" },
        uses: [
          {
            ...asset.uses[0]!,
            consumer: { ...asset.uses[0]!.consumer, id: "" },
            reason: "",
          },
        ],
        processing: [{ tool: "", command: "", parameters: {} }],
      })),
    });
    const provenanceFieldFailures = [
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          digest: "sha256:not-hex",
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          original: { ...asset.original, digest: "sha256:not-hex" },
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          original: { ...asset.original, url: "not-a-url" },
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          original: { ...asset.original, url: "ftp://example.com/asset" },
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          license: { ...asset.license, identifier: "" },
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          license: { ...asset.license, url: "ftp://example.com/license" },
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          uses: [],
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          uses: [
            {
              ...asset.uses[0]!,
              production: "",
              consumer: { ...asset.uses[0]!.consumer, id: "consumer" },
              reason: "reason",
            },
          ],
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          uses: [
            {
              ...asset.uses[0]!,
              production: "fixture-library",
              consumer: { ...asset.uses[0]!.consumer, id: "" },
              reason: "reason",
            },
          ],
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          uses: [
            {
              ...asset.uses[0]!,
              production: "fixture-library",
              consumer: { ...asset.uses[0]!.consumer, id: "consumer" },
              reason: "",
            },
          ],
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          processing: [
            { tool: "", command: "copy", parameters: { stable: true } },
          ],
        })),
      },
      {
        ...assetManifest,
        assets: assetManifest.assets.map((asset) => ({
          ...asset,
          processing: [
            { tool: "fixture", command: "", parameters: { stable: true } },
          ],
        })),
      },
    ].map(assetCodes);
    const missingProcessing = assetCodes({
      ...assetManifest,
      assets: assetManifest.assets.map((asset) => ({
        ...asset,
        original: {
          ...asset.original,
          digest: `sha256:${"f".repeat(64)}`,
        },
      })),
    });
    const nonCanonicalAsset = assetCodes({
      ...assetManifest,
      assets: [
        ...assetManifest.assets,
        { ...assetManifest.assets[0]! },
        {
          ...assetManifest.assets[0]!,
          path: "public\\audio\\starter-tone.json",
        },
      ],
    });
    const invalidPathCodes = [
      "/absolute.bin",
      "C:/drive.bin",
      ".",
      "public/../escape.bin",
      "../escape.bin",
      "",
    ].map((invalidPath) =>
      assetCodes({
        ...assetManifest,
        assets: [
          {
            ...assetManifest.assets[0]!,
            path: invalidPath,
          },
        ],
      }),
    );
    const caseCollision = assetCodes({
      ...assetManifest,
      assets: [
        {
          ...assetManifest.assets[0]!,
          path: "PUBLIC/AUDIO/STARTER-TONE.JSON",
        },
        assetManifest.assets[0]!,
      ],
    });
    const sourceAssetPath = path.join(fixture.root, "src/shots/opening.ts");
    const sourceAssetBytes = fs.readFileSync(sourceAssetPath);
    const nonRenderAsset = assetCodes({
      version: 1,
      assets: [
        {
          ...assetManifest.assets[0]!,
          path: "src/shots/opening.ts",
          digest: digestAutoMovieBytes(sourceAssetBytes),
          original: {
            ...assetManifest.assets[0]!.original,
            digest: digestAutoMovieBytes(sourceAssetBytes),
          },
        },
      ],
    });
    const originalContentInputs = project.contentInputs;
    project.contentInputs = (() => [
      ...originalContentInputs.call(project),
      {
        path: "public/audio/declared-missing.json",
        bytes: null,
        source: false,
        render: true,
      },
    ]) as typeof project.contentInputs;
    const nullAssetBytes = assetCodes({
      version: 1,
      assets: [
        {
          ...assetManifest.assets[0]!,
          path: "public/audio/declared-missing.json",
        },
      ],
    });
    project.contentInputs = originalContentInputs;
    fs.rmSync(assetPath);
    const missingAssetBytes = assetCodes(assetManifest);
    fs.writeFileSync(assetPath, originalAssetBytes);

    const modelPath = path.join(fixture.root, "public/models/actor.gltf");
    const modelBytes = Buffer.from(minimalExternalModelJson(), "utf8");
    fs.mkdirSync(path.dirname(modelPath), { recursive: true });
    fs.writeFileSync(modelPath, modelBytes);
    const modelDigest = digestAutoMovieBytes(modelBytes);
    const modelAsset = {
      path: "public/models/actor.gltf",
      digest: modelDigest,
      original: {
        url: "https://example.com/actor.gltf",
        digest: modelDigest,
      },
      license: {
        identifier: "CC0-1.0",
        url: "https://creativecommons.org/publicdomain/zero/1.0/",
      },
      processing: [],
      uses: [
        {
          production: "fixture-library",
          consumer: { kind: "model-recipe" as const, id: "sentinel" },
          reason: "The fixture casts this external model.",
        },
      ],
      model: {
        ingestProfile: "gltf-humanoid-v1",
        lod: [
          {
            level: "hero" as const,
            asset: "public/models/actor.gltf",
          },
        ],
        collisionProxy: {
          kind: "generated" as const,
          recipe: "capsule-v1" as const,
          parameters: { radius: 0.3, height: 1.8 },
        },
        measurementProxy: {
          kind: "generated" as const,
          recipe: "humanoid-landmarks-v1" as const,
          parameters: {
            height: 1.8,
            shoulderWidth: 0.45,
            hipWidth: 0.32,
          },
        },
      },
    };
    const validModelManifest = {
      ...assetManifest,
      assets: [...assetManifest.assets, modelAsset],
    } satisfies IAutoMovieAssetManifest;
    const validModelAsset = assetCodes(validModelManifest);
    const missingModelProvenance = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path ? { ...asset, model: undefined } : asset,
      ),
    });
    const incompleteModelDecisions = [
      {
        ...validModelManifest,
        assets: validModelManifest.assets.map((asset) =>
          asset.path === modelAsset.path
            ? {
                ...asset,
                model: { ...modelAsset.model, ingestProfile: "" },
              }
            : asset,
        ),
      },
      {
        ...validModelManifest,
        assets: validModelManifest.assets.map((asset) =>
          asset.path === modelAsset.path
            ? {
                ...asset,
                model: { ...modelAsset.model, lod: [] },
              }
            : asset,
        ),
      },
    ].map(assetCodes);
    const danglingModelLod = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? {
              ...asset,
              model: {
                ...modelAsset.model,
                lod: [
                  {
                    level: "hero" as const,
                    asset: "public/models/missing.glb",
                  },
                ],
              },
            }
          : asset,
      ),
    });
    const wrongTypeModelLod = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? {
              ...asset,
              model: {
                ...modelAsset.model,
                lod: [
                  {
                    level: "hero" as const,
                    asset: "public/audio/starter-tone.json",
                  },
                ],
              },
            }
          : asset,
      ),
    });
    const duplicateModelLod = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? {
              ...asset,
              model: {
                ...modelAsset.model,
                lod: [...modelAsset.model.lod, ...modelAsset.model.lod],
              },
            }
          : asset,
      ),
    });
    const outOfOrderModelLod = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? {
              ...asset,
              model: {
                ...modelAsset.model,
                lod: [
                  {
                    level: "far" as const,
                    asset: modelAsset.path,
                  },
                  {
                    level: "near" as const,
                    asset: modelAsset.path,
                  },
                ],
              },
            }
          : asset,
      ),
    });
    const danglingModelProxy = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? {
              ...asset,
              model: {
                ...modelAsset.model,
                collisionProxy: {
                  kind: "asset" as const,
                  asset: "public/models/missing-proxy.glb",
                },
              },
            }
          : asset,
      ),
    });
    const danglingMeasurementProxy = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? {
              ...asset,
              model: {
                ...modelAsset.model,
                measurementProxy: {
                  kind: "asset" as const,
                  asset: "public/models/missing-measurement.json",
                },
              },
            }
          : asset,
      ),
    });
    fs.writeFileSync(modelPath, "not glTF");
    const invalidModelBytes = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? { ...asset, digest: digestAutoMovieBytes(Buffer.from("not glTF")) }
          : asset,
      ),
    });
    fs.writeFileSync(modelPath, modelBytes);
    const sidecarModel = JSON.parse(modelBytes.toString("utf8")) as {
      buffers: Array<{ uri: string }>;
    };
    sidecarModel.buffers[0]!.uri = "actor.bin";
    const sidecarBytes = Buffer.from(JSON.stringify(sidecarModel), "utf8");
    fs.writeFileSync(modelPath, sidecarBytes);
    const unboundModelSidecar = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? { ...asset, digest: digestAutoMovieBytes(sidecarBytes) }
          : asset,
      ),
    });
    fs.writeFileSync(modelPath, modelBytes);
    const emptyGeneratedProxy = assetCodes({
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? {
              ...asset,
              model: {
                ...modelAsset.model,
                collisionProxy: {
                  kind: "generated",
                  recipe: "capsule-v1",
                  parameters: {},
                },
              },
            }
          : asset,
      ),
    });
    const filmPath = path.join(fixture.root, "src/film.ts");
    const originalFilmSource = fs.readFileSync(filmPath, "utf8");
    fs.writeFileSync(
      filmPath,
      mutate(
        originalFilmSource,
        "audio: []",
        `audio: [{
          id: "bound-audio",
          asset: "public/audio/starter-tone.json",
          sourceDuration: { seconds: 6 },
          sourceOffset: { frame: 0 },
          start: { frame: 0 },
          duration: { seconds: 6 },
          gain: 0,
          fadeIn: { frame: 0 },
          fadeOut: { frame: 0 },
          bus: "ambience",
        }]`,
      ),
    );
    const boundModel = project.graph().models.values().next().value!;
    const blankModelAsset = project.setModelRecipe({
      ...boundModel,
      asset: " ",
    });
    project.setModelRecipe({ ...boundModel, asset: modelAsset.path });
    const activeAudioManifest = {
      ...validModelManifest,
      assets: validModelManifest.assets.map((asset) => ({
        ...asset,
        uses:
          asset.path === modelAsset.path
            ? [
                {
                  production: "fixture-film",
                  consumer: {
                    kind: "model-recipe" as const,
                    id: boundModel.id,
                  },
                  reason: "The fixture binds the registered model appearance.",
                },
              ]
            : [
                {
                  production: "fixture-film",
                  consumer: {
                    kind: "audio-cue" as const,
                    id: "bound-audio",
                  },
                  reason: "The fixture binds the exact film audio cue.",
                },
              ],
      })),
    } satisfies IAutoMovieAssetManifest;
    const staticRigBinding = assetCodes({
      ...activeAudioManifest,
      assets: activeAudioManifest.assets.map((asset) =>
        asset.path === modelAsset.path
          ? {
              ...asset,
              model: {
                ...modelAsset.model,
                ingestProfile: "gltf-static-v1",
              },
            }
          : asset,
      ),
    });
    const exactActiveUse = assetCodes(activeAudioManifest);
    const externalCompile = compiler.compile({ scope: "source" });
    const externalCompileSucceeded = productionCompileSucceeded(
      "external asset fixture",
      externalCompile,
    );
    const importedRuntime = externalCompileSucceeded
      ? (JSON.parse(
          Buffer.from(
            project.readGeneratedFile(`models/${boundModel.id}.json`),
          ).toString("utf8"),
        ) as IAutoMovieModel)
      : null;
    const wrongProductionUse = assetCodes({
      ...activeAudioManifest,
      assets: activeAudioManifest.assets.map((asset) => ({
        ...asset,
        uses: asset.uses.map((use) => ({
          ...use,
          production: "another-production",
        })),
      })),
    });
    const wrongAudioConsumer = assetCodes({
      ...activeAudioManifest,
      assets: activeAudioManifest.assets.map((asset) => ({
        ...asset,
        uses: asset.uses.map((use) =>
          use.consumer.kind === "audio-cue"
            ? {
                ...use,
                consumer: { kind: "audio-cue" as const, id: "stale-audio" },
              }
            : use,
        ),
      })),
    });
    const duplicateActiveUse = assetCodes({
      ...activeAudioManifest,
      assets: activeAudioManifest.assets.map((asset) => ({
        ...asset,
        uses: [...asset.uses, asset.uses[0]!],
      })),
    });
    const danglingModelConsumer = assetCodes({
      ...activeAudioManifest,
      assets: activeAudioManifest.assets.map((asset) => ({
        ...asset,
        uses: asset.uses.map((use) =>
          use.consumer.kind === "model-recipe"
            ? {
                ...use,
                consumer: {
                  kind: "model-recipe" as const,
                  id: "missing-consumer",
                },
              }
            : use,
        ),
      })),
    });
    project.setModelRecipe(boundModel);
    fs.writeFileSync(filmPath, originalFilmSource);
    fs.rmSync(modelPath);
    fs.rmdirSync(path.dirname(modelPath));
    fs.writeFileSync(assetManifestPath, originalAssetManifest);

    const assetCompilerContracts = {
      "drifted bytes report asset-digest-mismatch": driftedAsset.has(
        "asset-digest-mismatch",
      ),
      "missing manifest reports asset-manifest-missing":
        missingAssetManifest.has("asset-manifest-missing"),
      "malformed manifest reports asset-manifest-invalid":
        malformedAssetManifest.has("asset-manifest-invalid"),
      "invalid manifest reports asset-manifest-invalid":
        invalidAssetManifest.has("asset-manifest-invalid"),
      "incomplete provenance reports asset-provenance-incomplete":
        incompleteAssetManifest.has("asset-provenance-incomplete"),
      "every incomplete provenance field reports asset-provenance-incomplete":
        provenanceFieldFailures.every((codes) =>
          codes.has("asset-provenance-incomplete"),
        ),
      "missing processing reports asset-processing-missing":
        missingProcessing.has("asset-processing-missing"),
      "non-canonical path reports asset-path-invalid":
        nonCanonicalAsset.has("asset-path-invalid"),
      "non-canonical manifest reports asset-manifest-order":
        nonCanonicalAsset.has("asset-manifest-order"),
      "every invalid path reports asset-path-invalid": invalidPathCodes.every(
        (codes) => codes.has("asset-path-invalid"),
      ),
      "case collision reports asset-path-invalid":
        caseCollision.has("asset-path-invalid"),
      "source-only asset reports asset-bytes-missing": nonRenderAsset.has(
        "asset-bytes-missing",
      ),
      "null asset bytes report asset-bytes-missing": nullAssetBytes.has(
        "asset-bytes-missing",
      ),
      "missing asset bytes report asset-bytes-missing": missingAssetBytes.has(
        "asset-bytes-missing",
      ),
      "valid model asset has no asset diagnostics": [...validModelAsset].every(
        (code) => !code.startsWith("asset-"),
      ),
      "missing model provenance reports asset-model-provenance-missing":
        missingModelProvenance.has("asset-model-provenance-missing"),
      "every incomplete model decision reports asset-model-provenance-missing":
        incompleteModelDecisions.every((codes) =>
          codes.has("asset-model-provenance-missing"),
        ),
      "dangling model LOD reports asset-model-lod-dangling":
        danglingModelLod.has("asset-model-lod-dangling"),
      "wrong-type model LOD reports asset-model-lod-dangling":
        wrongTypeModelLod.has("asset-model-lod-dangling"),
      "duplicate model LOD reports asset-model-lod-dangling":
        duplicateModelLod.has("asset-model-lod-dangling"),
      "out-of-order model LOD reports asset-model-lod-dangling":
        outOfOrderModelLod.has("asset-model-lod-dangling"),
      "dangling collision proxy reports asset-model-proxy-dangling":
        danglingModelProxy.has("asset-model-proxy-dangling"),
      "dangling measurement proxy reports asset-model-proxy-dangling":
        danglingMeasurementProxy.has("asset-model-proxy-dangling"),
      "invalid model bytes report asset-model-ingest-invalid":
        invalidModelBytes.has("asset-model-ingest-invalid"),
      "unbound model sidecar reports asset-model-resource-unbound":
        unboundModelSidecar.has("asset-model-resource-unbound"),
      "empty generated proxy reports asset-manifest-invalid":
        emptyGeneratedProxy.has("asset-manifest-invalid"),
      "blank model asset reports design-text-empty":
        blankModelAsset.accepted === false &&
        blankModelAsset.diagnostics.some(
          (diagnostic) => diagnostic.code === "design-text-empty",
        ),
      "static rig binding reports asset-model-rig-incompatible":
        staticRigBinding.has("asset-model-rig-incompatible"),
      "exact active uses have no asset diagnostics": [...exactActiveUse].every(
        (code) => !code.startsWith("asset-"),
      ),
      "external asset compile succeeds": externalCompileSucceeded,
      "imported runtime records imported origin":
        importedRuntime?.origin === "imported",
      "imported runtime records the source asset":
        importedRuntime?.asset === modelAsset.path,
      "imported runtime clears procedural profiles":
        importedRuntime?.profiles?.length === 0,
      "imported runtime records the ingest profile":
        importedRuntime?.imported?.profile === "gltf-humanoid-v1",
      "imported runtime maps the hips node":
        importedRuntime?.imported?.humanoidBones.some(
          (mapping) => mapping.bone === "hips" && mapping.node === 1,
        ) === true,
      "every imported humanoid bone is weighted":
        importedRuntime?.imported?.humanoidBones.every(
          (mapping) => mapping.weighted,
        ) === true,
      "imported runtime records the model digest":
        importedRuntime?.imported?.assets.some(
          (entry) =>
            entry.path === modelAsset.path && entry.digest === modelDigest,
        ) === true,
      "imported runtime has one collision proxy":
        importedRuntime?.parts.length === 1,
      "imported runtime registers the collision proxy":
        importedRuntime?.parts[0]?.id === "registered-collision-proxy",
      "wrong-production use reports film-audio-cue-invalid":
        wrongProductionUse.has("film-audio-cue-invalid"),
      "wrong audio consumer reports asset-use-stale":
        wrongAudioConsumer.has("asset-use-stale"),
      "wrong audio consumer reports asset-use-missing":
        wrongAudioConsumer.has("asset-use-missing"),
      "duplicate active use reports asset-use-duplicate":
        duplicateActiveUse.has("asset-use-duplicate"),
      "dangling model consumer reports asset-use-dangling":
        danglingModelConsumer.has("asset-use-dangling"),
    } satisfies Record<string, boolean>;
    const failedAssetCompilerContracts = Object.entries(assetCompilerContracts)
      .filter(([, accepted]) => accepted === false)
      .map(([contract]) => `- ${contract}`);
    if (failedAssetCompilerContracts.length !== 0)
      throw new Error(
        [
          "Asset compiler contract failures:",
          ...failedAssetCompilerContracts,
          "External compile diagnostics:",
          JSON.stringify(externalCompile.diagnostics, null, 2),
        ].join("\n"),
      );
    TestValidator.predicate(
      "compiler binds asset references to a byte-exact licensed manifest",
      failedAssetCompilerContracts.length === 0,
    );

    let unmanifestedFixtureFailure:
      | IProductionCompilerFixtureFailure
      | undefined;
    const unmanifestedFixture = productionFixture();
    try {
      const ownershipPath = path.join(
        unmanifestedFixture.root,
        ".automovie/manifest.json",
      );
      const ownership = JSON.parse(
        fs.readFileSync(ownershipPath, "utf8"),
      ) as Record<string, unknown>;
      delete ownership.assetManifest;
      fs.writeFileSync(ownershipPath, JSON.stringify(ownership));
      const unmanifestedFilmPath = path.join(
        unmanifestedFixture.root,
        "src/film.ts",
      );
      fs.writeFileSync(
        unmanifestedFilmPath,
        mutate(
          fs.readFileSync(unmanifestedFilmPath, "utf8"),
          "audio: []",
          `audio: [{
          id: "unmanifested",
          asset: "public/audio/starter-tone.json",
          sourceDuration: { seconds: 6 },
          sourceOffset: { frame: 0 },
          start: { frame: 0 },
          duration: { seconds: 6 },
          gain: 0,
          fadeIn: { frame: 0 },
          fadeOut: { frame: 0 },
          bus: "ambience",
        }]`,
        ),
      );
      const unmanifestedProject = AutoMovieProductionProject.open(
        unmanifestedFixture.root,
      );
      const unmanifested = new AutoMovieProductionCompiler(
        unmanifestedProject,
        () => ({ entries: [] }),
      ).lint({ scope: "source" });
      TestValidator.predicate(
        "a referenced content file cannot become a film asset without a provenance manifest",
        unmanifested.success === false &&
          diagnosticCodes(unmanifested).has("film-audio-cue-invalid"),
      );
    } catch (error) {
      unmanifestedFixtureFailure = { error };
      throw error;
    } finally {
      preserveProductionCompilerFixtureCleanup(unmanifestedFixtureFailure, () =>
        unmanifestedFixture.dispose(),
      );
    }

    let singleQueueCalls = 0;
    const singleQueueCompile = new AutoMovieProductionCompiler(
      project,
      (status, snapshot) => {
        ++singleQueueCalls;
        if (singleQueueCalls > 1)
          throw new Error("review queue was called after generated commit");
        return review.queue(status, snapshot);
      },
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "successful compile derives its response queue exactly once before commit",
      productionCompileSucceeded(
        "single review-queue compile",
        singleQueueCompile,
      ) && singleQueueCalls === 1,
    );
    fs.writeFileSync(
      sourcePath,
      `${original}\nexport const compilerDiagnostic = ;\n`,
    );
    const ordinaryDiagnostic = compiler.compile({ scope: "source" });
    TestValidator.equals(
      "ordinary compiler diagnostics preserve the current review queue",
      namedFacts([
        [
          "ordinaryDiagnosticSuccess",
          () => ordinaryDiagnostic.success === false,
        ],
        [
          "diagnosticCodesOrdinaryDiagnostic",
          () =>
            diagnosticCodes(ordinaryDiagnostic).has("compile-input-changed") ===
            false,
        ],
        [
          "ordinaryDiagnosticCount",
          () => ordinaryDiagnostic.reviews.entries.length !== 0,
        ],
      ]),
      {
        ordinaryDiagnosticSuccess: true,
        diagnosticCodesOrdinaryDiagnostic: true,
        ordinaryDiagnosticCount: true,
      },
    );
    const diagnosticRevisionRacer = AutoMovieProductionProject.open(
      fixture.root,
    );
    let diagnosticRevisionRaced = false;
    const racedDiagnostic = new AutoMovieProductionCompiler(
      project,
      (status, snapshot) => {
        const queue = review.queue(status, snapshot);
        diagnosticRevisionRacer.setWorldDesign(worldDesign());
        diagnosticRevisionRaced = true;
        return queue;
      },
    ).compile({ scope: "source" });
    fs.writeFileSync(sourcePath, original);
    TestValidator.equals(
      "diagnostic responses discard a review queue derived across an input race",
      namedFacts([
        ["racedDiagnosticSuccess", () => racedDiagnostic.success === false],
        [
          "diagnosticCodesRacedDiagnostic",
          () => diagnosticCodes(racedDiagnostic).has("compile-input-changed"),
        ],
        [
          "racedDiagnosticCount",
          () => racedDiagnostic.reviews.entries.length === 0,
        ],
        ["diagnosticRevisionRaced", () => diagnosticRevisionRaced],
      ]),
      {
        racedDiagnosticSuccess: true,
        diagnosticCodesRacedDiagnostic: true,
        racedDiagnosticCount: true,
        diagnosticRevisionRaced: true,
      },
    );
    let lintRevisionRaced = false;
    const racedLint = new AutoMovieProductionCompiler(
      project,
      (status, snapshot) => {
        const queue = review.queue(status, snapshot);
        diagnosticRevisionRacer.setWorldDesign(worldDesign());
        lintRevisionRaced = true;
        return queue;
      },
    ).lint({ scope: "source" });
    TestValidator.equals(
      "read-only compile responses are fenced after review derivation",
      namedFacts([
        ["racedLintSuccess", () => racedLint.success === false],
        [
          "diagnosticCodesRacedLint",
          () => diagnosticCodes(racedLint).has("compile-input-changed"),
        ],
        ["racedLintCount", () => racedLint.reviews.entries.length === 0],
        ["lintRevisionRaced", () => lintRevisionRaced],
      ]),
      {
        racedLintSuccess: true,
        diagnosticCodesRacedLint: true,
        racedLintCount: true,
        lintRevisionRaced: true,
      },
    );
    const residentGraph = project.graph;
    let graphRecheckCalls = 0;
    project.graph = (() => {
      ++graphRecheckCalls;
      if (graphRecheckCalls === 1) return residentGraph.call(project);
      throw new Error("compiler graph became unreadable");
    }) as typeof project.graph;
    const unavailableGraphRecheck = new AutoMovieProductionCompiler(
      project,
      () => ({ entries: [] }),
    ).lint({ scope: "source" });
    project.graph = residentGraph;
    TestValidator.equals(
      "an unreadable current graph invalidates a read-only compiler response",
      namedFacts([
        [
          "unavailableGraphRecheckSuccess",
          () => unavailableGraphRecheck.success === false,
        ],
        [
          "diagnosticCodesUnavailableGraphRecheck",
          () =>
            diagnosticCodes(unavailableGraphRecheck).has(
              "compile-input-changed",
            ),
        ],
        [
          "unavailableGraphRecheckCount",
          () => unavailableGraphRecheck.reviews.entries.length === 0,
        ],
        ["graphRecheckCalls", () => graphRecheckCalls === 2],
      ]),
      {
        unavailableGraphRecheckSuccess: true,
        diagnosticCodesUnavailableGraphRecheck: true,
        unavailableGraphRecheckCount: true,
        graphRecheckCalls: true,
      },
    );
    const residentConfirmCurrentSnapshot = project.confirmCurrentSnapshot;
    project.confirmCurrentSnapshot = (() => {
      throw new Error("generic snapshot confirmation failure");
    }) as typeof project.confirmCurrentSnapshot;
    let genericSnapshotFailure = "";
    try {
      new AutoMovieProductionCompiler(project, () => ({
        entries: [],
      })).lint({ scope: "source" });
    } catch (error) {
      genericSnapshotFailure =
        error instanceof Error ? error.message : String(error);
    }
    project.confirmCurrentSnapshot = residentConfirmCurrentSnapshot;
    TestValidator.equals(
      "non-race snapshot confirmation failures remain loud",
      genericSnapshotFailure,
      "generic snapshot confirmation failure",
    );
    // The sabotage above left the generated snapshot stale on purpose. The
    // fence claim below is about a settled read-only response, so restore a
    // current compilation first rather than measuring the fence through an
    // unrelated staleness failure.
    new AutoMovieProductionCompiler(project).compile({ scope: "source" });
    const postFenceRevision = project.revision;
    // The claim is that a settled response takes its fence and never reads the
    // revision again, so the injection point must sit exactly one read past
    // whatever the current fence costs. Measuring that cost keeps the claim
    // about the fence; a written-down count would instead fail whenever an
    // unrelated read is added or removed.
    const countRevisionReads = (run: () => unknown): number => {
      let reads = 0;
      project.revision = (() => {
        ++reads;
        return postFenceRevision.call(project);
      }) as typeof project.revision;
      run();
      project.revision = postFenceRevision;
      return reads;
    };
    const readOnlyLint = (): unknown =>
      new AutoMovieProductionCompiler(project, () => ({ entries: [] })).lint({
        scope: "source",
      });
    const lintReadBudget = countRevisionReads(readOnlyLint);
    let postFenceLintReads = 0;
    let postFenceLintMutation = false;
    project.revision = (() => {
      ++postFenceLintReads;
      if (postFenceLintReads === lintReadBudget + 1) {
        diagnosticRevisionRacer.setWorldDesign(worldDesign());
        postFenceLintMutation = true;
      }
      return postFenceRevision.call(project);
    }) as typeof project.revision;
    const stableLint = new AutoMovieProductionCompiler(project, () => ({
      entries: [],
    })).lint({ scope: "source" });
    project.revision = postFenceRevision;
    TestValidator.equals(
      "read-only success returns the fenced revision without a later read",
      {
        success: stableLint.success,
        // The one-shot fixture leaves its second scene unrealized, so the
        // screenplay-coverage warning is expected here. What this case pins is
        // read-only success under a revision fence, not the diagnostic set.
        codes: [...diagnosticCodes(stableLint)]
          .filter((code) => code !== "screenplay-scene-unrealized")
          .sort(compareCodeUnits),
        budgetIsPositive: lintReadBudget > 0,
        readsMatchBudget: postFenceLintReads === lintReadBudget,
        mutated: postFenceLintMutation,
      },
      {
        success: true,
        codes: [],
        budgetIsPositive: true,
        readsMatchBudget: true,
        mutated: false,
      },
    );
    fs.writeFileSync(
      sourcePath,
      `${original}\nexport const postFenceDiagnostic = ;\n`,
    );
    const diagnosticCompile = (): unknown =>
      new AutoMovieProductionCompiler(project, () => ({
        entries: [],
      })).compile({ scope: "source" });
    const diagnosticReadBudget = countRevisionReads(diagnosticCompile);
    let postFenceDiagnosticReads = 0;
    let postFenceDiagnosticMutation = false;
    project.revision = (() => {
      ++postFenceDiagnosticReads;
      if (postFenceDiagnosticReads === diagnosticReadBudget + 1) {
        diagnosticRevisionRacer.setWorldDesign(worldDesign());
        postFenceDiagnosticMutation = true;
      }
      return postFenceRevision.call(project);
    }) as typeof project.revision;
    const stableDiagnostic = new AutoMovieProductionCompiler(project, () => ({
      entries: [],
    })).compile({ scope: "source" });
    project.revision = postFenceRevision;
    fs.writeFileSync(sourcePath, original);
    TestValidator.equals(
      "ordinary diagnostics return the fenced revision without a later read",
      namedFacts([
        ["stableDiagnosticSuccess", () => stableDiagnostic.success === false],
        [
          "diagnosticCodesStableDiagnostic",
          () =>
            diagnosticCodes(stableDiagnostic).has("compile-input-changed") ===
            false,
        ],
        ["diagnosticReadBudget", () => diagnosticReadBudget > 0],
        [
          "postFenceDiagnosticReadsDiagnosticReadBudget",
          () => postFenceDiagnosticReads === diagnosticReadBudget,
        ],
        [
          "postFenceDiagnosticMutation",
          () => postFenceDiagnosticMutation === false,
        ],
      ]),
      {
        stableDiagnosticSuccess: true,
        diagnosticCodesStableDiagnostic: true,
        diagnosticReadBudget: true,
        postFenceDiagnosticReadsDiagnosticReadBudget: true,
        postFenceDiagnosticMutation: true,
      },
    );
    const recipeFile = path.join(
      fixture.root,
      ".automovie/design/shared/models/sentinel.json",
    );
    const recipeBytes = fs.readFileSync(recipeFile);
    const recipeWithoutMaterial = JSON.parse(recipeBytes.toString("utf8"));
    recipeWithoutMaterial.palette = {};
    fs.writeFileSync(recipeFile, JSON.stringify(recipeWithoutMaterial));
    const failedMaterialization = compiler.compile({ scope: "source" });
    fs.writeFileSync(recipeFile, recipeBytes);
    TestValidator.predicate(
      "invalid design is refused before compiler-owned model materialization",
      diagnosticCodes(failedMaterialization).has("design-collection-empty") &&
        diagnosticCodes(failedMaterialization).has(
          "model-materialization-failed",
        ) === false,
    );
    project.setFormationDesign(formationDesign());
    const formationFile = path.join(
      fixture.root,
      ".automovie/design/shared/formations/line.json",
    );
    const formationBytes = fs.readFileSync(formationFile);
    const oversizedFormation = formationDesign();
    oversizedFormation.count = Number.MAX_SAFE_INTEGER;
    oversizedFormation.layout = {
      kind: "line",
      ranks: Number.MAX_SAFE_INTEGER,
      files: 1,
      spacing: { lateral: 1, depth: 1 },
    };
    fs.writeFileSync(formationFile, JSON.stringify(oversizedFormation));
    const oversizedDesign = compiler.lint({ scope: "source" });
    fs.writeFileSync(formationFile, formationBytes);
    TestValidator.equals(
      "invalid huge formation is diagnosed before allocating explicit slots",
      namedFacts([
        ["oversizedDesignSuccess", () => oversizedDesign.success === false],
        [
          "diagnosticCodesOversizedDesign",
          () => diagnosticCodes(oversizedDesign).has("design-range-invalid"),
        ],
        [
          "diagnosticCodesOversizedDesign2",
          () =>
            diagnosticCodes(oversizedDesign).has(
              "model-materialization-failed",
            ) === false,
        ],
      ]),
      {
        oversizedDesignSuccess: true,
        diagnosticCodesOversizedDesign: true,
        diagnosticCodesOversizedDesign2: true,
      },
    );
    const generatedManifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/generated-manifest.json",
    );
    const generatedBeforeDesignGate = fs.readFileSync(
      generatedManifestPath,
      "utf8",
    );
    const compileDesignOnly = compiler.compile({ scope: "design" });
    TestValidator.equals(
      "design scope never replaces current generated source output",
      namedFacts([
        [
          "productionCompileSucceededDesign",
          () =>
            productionCompileSucceeded(
              "design-only compile",
              compileDesignOnly,
            ),
        ],
        [
          "compileDesignOnlyCount",
          () => compileDesignOnly.materialized.length === 0,
        ],
        [
          "generatedManifestPathUtf8",
          () =>
            fs.readFileSync(generatedManifestPath, "utf8") ===
            generatedBeforeDesignGate,
        ],
        [
          "fixtureResident",
          () =>
            fs.existsSync(
              path.join(
                fixture.root,
                "generated/fixture-film/shots/opening.json",
              ),
            ),
        ],
      ]),
      {
        productionCompileSucceededDesign: true,
        compileDesignOnlyCount: true,
        generatedManifestPathUtf8: true,
        fixtureResident: true,
      },
    );
    const designRevisionRacer = AutoMovieProductionProject.open(fixture.root);
    const residentRevision = project.revision;
    const designConfirmCurrentSnapshot = project.confirmCurrentSnapshot;
    let designRevisionRaced = false;
    project.confirmCurrentSnapshot = ((inputCurrent, expectedRevision) => {
      if (designRevisionRaced === false) {
        designRevisionRacer.setWorldDesign(worldDesign());
        designRevisionRaced = true;
      }
      return designConfirmCurrentSnapshot.call(
        project,
        inputCurrent,
        expectedRevision,
      );
    }) as typeof project.confirmCurrentSnapshot;
    const racedDesignOnly = compiler.compile({ scope: "design" });
    project.confirmCurrentSnapshot = designConfirmCurrentSnapshot;
    TestValidator.equals(
      "design-only success cannot cross a concurrent design revision",
      namedFacts([
        ["racedDesignOnlySuccess", () => racedDesignOnly.success === false],
        [
          "diagnosticCodesRacedDesignOnly",
          () => diagnosticCodes(racedDesignOnly).has("compile-input-changed"),
        ],
        [
          "racedDesignOnlyCount",
          () => racedDesignOnly.reviews.entries.length === 0,
        ],
        ["designRevisionRaced", () => designRevisionRaced],
      ]),
      {
        racedDesignOnlySuccess: true,
        diagnosticCodesRacedDesignOnly: true,
        racedDesignOnlyCount: true,
        designRevisionRaced: true,
      },
    );
    let postFenceDesignReads = 0;
    let postFenceDesignMutation = false;
    project.revision = (() => {
      ++postFenceDesignReads;
      if (postFenceDesignReads === 6) {
        designRevisionRacer.setWorldDesign(worldDesign());
        postFenceDesignMutation = true;
      }
      return residentRevision.call(project);
    }) as typeof project.revision;
    const stableDesignOnly = compiler.compile({ scope: "design" });
    project.revision = residentRevision;
    TestValidator.equals(
      "design-only success returns the fenced revision without a later read",
      namedFacts([
        [
          "productionCompileSucceededFenced",
          () =>
            productionCompileSucceeded(
              "fenced design-only compile",
              stableDesignOnly,
            ),
        ],
        ["postFenceDesignReads", () => postFenceDesignReads === 5],
        ["postFenceDesignMutation", () => postFenceDesignMutation === false],
      ]),
      {
        productionCompileSucceededFenced: true,
        postFenceDesignReads: true,
        postFenceDesignMutation: true,
      },
    );
    const reopenedWithFormation = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "a restored valid formation changes identity and materializes its contract",
      reopenedWithFormation.compiler.inputFingerprint !==
        first.compiler.inputFingerprint &&
        reopenedWithFormation.materialized.some(
          (file) =>
            file.path === "contracts/formations/line.json" &&
            file.status === "created",
        ),
    );
    const reopened = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
    ).compile({ scope: "source" });
    TestValidator.predicate(
      "reopen preserves the expanded identity and unchanged status",
      reopened.compiler.inputFingerprint ===
        reopenedWithFormation.compiler.inputFingerprint &&
        reopened.materialized.every((file) => file.status === "unchanged"),
    );
    const canonicalShotBytes = fs.readFileSync(
      path.join(fixture.root, "generated/fixture-film/shots/opening.json"),
      "utf8",
    );
    TestValidator.equals(
      "generated JSON bytes are canonical regardless of source insertion order",
      canonicalShotBytes,
      `${canonicalizeAutoMovieJson(JSON.parse(canonicalShotBytes))}\n`,
    );
    const boundSourcePath = path.join(fixture.root, "src/shots/opening.ts");
    const boundSourceBytes = fs.readFileSync(boundSourcePath);
    fs.writeFileSync(
      boundSourcePath,
      Buffer.from(
        `\uFEFF${boundSourceBytes
          .toString("utf8")
          .replace(/\r\n|\r|\n/g, "\r\n")}`,
        "utf8",
      ),
    );
    const normalizedSourceStatus = compiler.lint({ scope: "source" });
    fs.writeFileSync(boundSourcePath, boundSourceBytes);
    TestValidator.predicate(
      "bound TypeScript BOM and EOL changes do not re-enter through source-root content identity",
      normalizedSourceStatus.compiler.inputFingerprint ===
        reopened.compiler.inputFingerprint && normalizedSourceStatus.success,
    );
    const statusReadGenerated = project.readGeneratedFile;
    project.readGeneratedFile = ((relativePath: string) => {
      if (new Error("status race").stack?.includes("statusesOf"))
        throw new Error("generated status read denied");
      return statusReadGenerated.call(project, relativePath);
    }) as typeof project.readGeneratedFile;
    let statusRaceSurfaced = false;
    try {
      compiler.compile({ scope: "source" });
    } catch (error) {
      statusRaceSurfaced =
        error instanceof Error &&
        error.message.includes("generated status read denied");
    } finally {
      project.readGeneratedFile = statusReadGenerated;
    }
    TestValidator.predicate(
      "non-missing materialization status races remain loud",
      statusRaceSurfaced,
    );
    const viewerInput = path.join(fixture.root, "viewer/src/main.ts");
    const viewerBytes = fs.readFileSync(viewerInput);
    fs.appendFileSync(viewerInput, "\n// content identity mutation\n");
    const changedContent = compiler.lint({ scope: "source" });
    fs.writeFileSync(viewerInput, viewerBytes);
    const restoredContent = compiler.compile({ scope: "source" });
    TestValidator.equals(
      "declared viewer and runtime content participates in compile identity",
      namedFacts([
        [
          "changedContentCompiler",
          () =>
            changedContent.compiler.inputFingerprint !==
            reopened.compiler.inputFingerprint,
        ],
        [
          "diagnosticCodesChangedContent",
          () => diagnosticCodes(changedContent).has("generated-stale"),
        ],
        [
          "restoredContentCompiler",
          () =>
            restoredContent.compiler.inputFingerprint ===
            reopened.compiler.inputFingerprint,
        ],
      ]),
      {
        changedContentCompiler: true,
        diagnosticCodesChangedContent: true,
        restoredContentCompiler: true,
      },
    );

    const generatedShot = path.join(
      fixture.root,
      "generated/fixture-film/shots/opening.json",
    );
    fs.writeFileSync(generatedShot, "{}\n");
    const tamperedLint = compiler.lint({ scope: "source" });
    TestValidator.predicate(
      "lint refuses direct generated edits",
      tamperedLint.success === false &&
        diagnosticCodes(tamperedLint).has("generated-tampered"),
    );
    const repaired = compiler.compile({ scope: "source" });
    TestValidator.equals(
      "compile repairs a declared generated file",
      namedFacts([
        [
          "productionCompileSucceededTampered",
          () =>
            productionCompileSucceeded("tampered generated repair", repaired),
        ],
        [
          "repairedMaterialized",
          () =>
            repaired.materialized.some(
              (file) =>
                file.path === "shots/opening.json" && file.status === "updated",
            ),
        ],
        [
          "repairedDiagnostics",
          () =>
            repaired.diagnostics.some(
              (item) =>
                item.code === "generated-tampered" &&
                item.category === "warning",
            ),
        ],
        [
          "generatedShotUtf8",
          () =>
            JSON.parse(fs.readFileSync(generatedShot, "utf8")).shot.id ===
            "opening",
        ],
      ]),
      {
        productionCompileSucceededTampered: true,
        repairedMaterialized: true,
        repairedDiagnostics: true,
        generatedShotUtf8: true,
      },
    );
    fs.rmSync(generatedShot);
    const missingLint = compiler.lint({ scope: "source" });
    const recreated = compiler.compile({ scope: "source" });
    TestValidator.equals(
      "lint rejects and compile recreates a missing declared generated file",
      namedFacts([
        [
          "missingLintDiagnostics",
          () =>
            missingLint.diagnostics.some(
              (item) =>
                item.code === "generated-tampered" &&
                item.message.includes("null"),
            ),
        ],
        [
          "productionCompileSucceededMissing",
          () =>
            productionCompileSucceeded("missing generated repair", recreated),
        ],
        [
          "recreatedMaterialized",
          () =>
            recreated.materialized.some(
              (file) =>
                file.path === "shots/opening.json" && file.status === "created",
            ),
        ],
      ]),
      {
        missingLintDiagnostics: true,
        productionCompileSucceededMissing: true,
        recreatedMaterialized: true,
      },
    );
    fs.rmSync(generatedManifestPath);
    const missingOwnershipManifest = compiler.lint({ scope: "source" });
    const repairedOwnershipManifest = compiler.compile({ scope: "source" });
    TestValidator.equals(
      "lint rejects a missing ownership manifest and compile recreates it",
      namedFacts([
        [
          "diagnosticCodesMissingOwnershipManifest",
          () =>
            diagnosticCodes(missingOwnershipManifest).has(
              "generated-manifest-missing",
            ),
        ],
        [
          "productionCompileSucceededMissing",
          () =>
            productionCompileSucceeded(
              "missing ownership-manifest repair",
              repairedOwnershipManifest,
            ),
        ],
        [
          "repairedOwnershipManifestDiagnostics",
          () =>
            repairedOwnershipManifest.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "generated-manifest-missing" &&
                diagnostic.category === "warning",
            ),
        ],
        [
          "generatedManifestPathResident",
          () => fs.existsSync(generatedManifestPath),
        ],
      ]),
      {
        diagnosticCodesMissingOwnershipManifest: true,
        productionCompileSucceededMissing: true,
        repairedOwnershipManifestDiagnostics: true,
        generatedManifestPathResident: true,
      },
    );
    const unowned = path.join(
      fixture.root,
      "generated/fixture-film/hand-edited.json",
    );
    fs.writeFileSync(unowned, "{}\n");
    TestValidator.predicate(
      "unowned generated output blocks compilation",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "generated-unowned",
      ),
    );
    fs.rmSync(unowned);
    const currentGeneratedManifest = JSON.parse(
      fs.readFileSync(generatedManifestPath, "utf8"),
    ) as {
      files: Array<{
        path: string;
        owner: "compiler";
        digest: `sha256:${string}`;
        sourceTargets: string[];
      }>;
    };
    const forgedBytes = Buffer.from("{}\n");
    fs.writeFileSync(generatedShot, forgedBytes);
    const forgedManifest = structuredClone(currentGeneratedManifest);
    forgedManifest.files.find(
      (entry) => entry.path === "shots/opening.json",
    )!.digest = digestAutoMovieBytes(forgedBytes);
    fs.writeFileSync(generatedManifestPath, JSON.stringify(forgedManifest));
    const forgedOwnership = compiler.lint({ scope: "source" });
    TestValidator.equals(
      "a self-consistent forged generated manifest cannot redefine compiler truth",
      namedFacts([
        [
          "diagnosticCodesForgedOwnership",
          () => diagnosticCodes(forgedOwnership).has("generated-tampered"),
        ],
        [
          "diagnosticCodesForgedOwnership2",
          () =>
            diagnosticCodes(forgedOwnership).has("generated-manifest-stale"),
        ],
        [
          "productionCompileSucceededForged",
          () =>
            productionCompileSucceeded(
              "forged generated manifest recovery",
              compiler.compile({ scope: "source" }),
            ),
        ],
      ]),
      {
        diagnosticCodesForgedOwnership: true,
        diagnosticCodesForgedOwnership2: true,
        productionCompileSucceededForged: true,
      },
    );
    const stalePath = path.join(
      fixture.root,
      "generated/fixture-film/stale-output.json",
    );
    const staleBytes = Buffer.from('{"stale":true}\n');
    const withStale = JSON.parse(
      fs.readFileSync(generatedManifestPath, "utf8"),
    ) as typeof currentGeneratedManifest;
    withStale.files.push({
      path: "stale-output.json",
      owner: "compiler",
      digest: digestAutoMovieBytes(staleBytes),
      sourceTargets: ["compiler"],
    });
    fs.writeFileSync(stalePath, staleBytes);
    fs.writeFileSync(generatedManifestPath, JSON.stringify(withStale));
    const staleDeclaredLint = compiler.lint({ scope: "source" });
    const staleDeclaredCompile = compiler.compile({ scope: "source" });
    TestValidator.equals(
      "prior compiler-owned files are diagnosed then removed by materialization",
      namedFacts([
        [
          "diagnosticCodesStaleDeclaredLint",
          () =>
            diagnosticCodes(staleDeclaredLint).has("generated-stale-output"),
        ],
        [
          "staleDeclaredCompileDiagnostics",
          () =>
            staleDeclaredCompile.diagnostics.some(
              (diagnostic) =>
                diagnostic.code === "generated-stale-output" &&
                diagnostic.category === "warning",
            ),
        ],
        ["stalePathResident", () => fs.existsSync(stalePath) === false],
      ]),
      {
        diagnosticCodesStaleDeclaredLint: true,
        staleDeclaredCompileDiagnostics: true,
        stalePathResident: true,
      },
    );
    const unreadableManifest = JSON.parse(
      fs.readFileSync(generatedManifestPath, "utf8"),
    ) as typeof currentGeneratedManifest;
    unreadableManifest.files.push({
      path: "stale-output.json",
      owner: "compiler",
      digest: digestAutoMovieBytes(staleBytes),
      sourceTargets: ["compiler"],
    });
    fs.writeFileSync(stalePath, staleBytes);
    fs.writeFileSync(generatedManifestPath, JSON.stringify(unreadableManifest));
    const residentGeneratedRead = project.readGeneratedFile;
    project.readGeneratedFile = ((relativePath: string) => {
      if (relativePath === "stale-output.json")
        throw new Error("stale output became unreadable");
      return residentGeneratedRead.call(project, relativePath);
    }) as typeof project.readGeneratedFile;
    const unreadableStale = compiler.lint({ scope: "source" });
    project.readGeneratedFile = residentGeneratedRead;
    fs.rmSync(stalePath);
    compiler.compile({ scope: "source" });
    TestValidator.predicate(
      "unreadable formerly declared output loses compiler ownership",
      diagnosticCodes(unreadableStale).has("generated-unowned"),
    );

    fs.rmSync(sourcePath);
    TestValidator.predicate(
      "missing bound source is diagnosed",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-path-missing",
      ),
    );
    fs.writeFileSync(sourcePath, original);
    const missingOutsideNamed = {
      ...shotContract(),
      source: { module: "src/outside.ts", export: "opening" },
    };
    const missingOutsideNamedMutation =
      project.setShotContract(missingOutsideNamed);
    const missingOutsideNamedCompile = compiler.compile({ scope: "source" });
    TestValidator.equals(
      "missing source names cannot impersonate an outside-root failure",
      namedFacts([
        [
          "missingOutsideNamedMutationAccepted",
          () => missingOutsideNamedMutation.accepted,
        ],
        [
          "diagnosticCodesMissingOutsideNamedCompile",
          () =>
            diagnosticCodes(missingOutsideNamedCompile).has(
              "source-path-missing",
            ),
        ],
        [
          "diagnosticCodesMissingOutsideNamedCompile2",
          () =>
            diagnosticCodes(missingOutsideNamedCompile).has(
              "source-path-outside-root",
            ) === false,
        ],
      ]),
      {
        missingOutsideNamedMutationAccepted: true,
        diagnosticCodesMissingOutsideNamedCompile: true,
        diagnosticCodesMissingOutsideNamedCompile2: true,
      },
    );
    project.setShotContract(shotContract());
    const outsideRoot = {
      ...shotContract(),
      source: { module: "outside/source.ts", export: "opening" },
    };
    const outsideRootMutation = project.setShotContract(outsideRoot);
    TestValidator.predicate(
      "canonical source outside configured roots reaches the compiler boundary",
      outsideRootMutation.accepted &&
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          "source-path-outside-root",
        ),
    );
    project.setShotContract(shotContract());
    const outside = {
      ...shotContract(),
      source: { module: "../outside.ts", export: "opening" },
    };
    const outsideMutation = project.setShotContract(outside);
    TestValidator.predicate(
      "source traversal is refused before commit",
      outsideMutation.accepted === false &&
        outsideMutation.diagnostics.some(
          (diagnostic) => diagnostic.code === "design-source-path-invalid",
        ),
    );
    TestValidator.predicate(
      "refused source traversal leaves the current source compilable",
      productionCompileSucceeded(
        "refused source traversal recovery",
        compiler.compile({ scope: "source" }),
      ),
    );

    fs.writeFileSync(
      sourcePath,
      [
        'import "side-effect";',
        'import fs from "node:fs";',
        'import * as runtimeNamespace from "runtime-namespace";',
        'import { type TypeOnly, runtimeName } from "mixed-runtime";',
        'export const opening = { id: "opening", build() {',
        "async function delayed() { return 1; } void delayed;",
        'void import("node:path");',
        "Math.random(); Math.random(); Date.now(); performance.now(); crypto.randomUUID(); Intl.Collator();",
        '"a".localeCompare("b"); "a"["toLocaleUpperCase"]();',
        'process.cwd(); require("x"); fetch("x");',
        "({ process: 1 }).process;",
        "setTimeout(() => {}, 0); setInterval(() => {}, 0);",
        "return {};",
        "} };",
      ].join("\n"),
    );
    const capabilityOutput = compiler.compile({ scope: "source" });
    const capabilities = diagnosticCodes(capabilityOutput);
    TestValidator.equals(
      "runtime imports, entropy and ambient capabilities are rejected",
      namedFacts([
        [
          "capabilitiesHas",
          () => capabilities.has("source-import-unsupported"),
        ],
        ["capabilitiesHas2", () => capabilities.has("source-nondeterministic")],
        [
          "capabilitiesHas3",
          () => capabilities.has("source-capability-forbidden"),
        ],
        [
          "capabilityOutputDiagnostics",
          () =>
            capabilityOutput.diagnostics.some((diagnostic) =>
              diagnostic.message.includes("Intl"),
            ),
        ],
      ]),
      {
        capabilitiesHas: true,
        capabilitiesHas2: true,
        capabilitiesHas3: true,
        capabilityOutputDiagnostics: true,
      },
    );
    fs.writeFileSync(
      sourcePath,
      [
        'import type { IAutoMovieScene } from "@automovie/interface";',
        'import { type IAutoMovieShot } from "@automovie/interface";',
        original,
      ].join("\n"),
    );
    TestValidator.predicate(
      "pure type-only imports remain valid coding-agent source",
      productionCompileSucceeded(
        "type-only source import",
        compiler.compile({ scope: "source" }),
      ),
    );
    fs.writeFileSync(
      sourcePath,
      injectBuildSignal(
        '  context.engine.distance.constructor("return process")();',
      ),
    );
    TestValidator.predicate(
      "VM source cannot climb through an injected host function constructor",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-execution-failed",
      ),
    );

    fs.writeFileSync(sourcePath, "export const somethingElse = 1;\n");
    TestValidator.predicate(
      "missing named build export is rejected",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-export-missing",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      injectBuildSignal("  return Promise.resolve({}) as never;"),
    );
    TestValidator.predicate(
      "async source is rejected",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-capability-forbidden",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      injectBuildSignal("  return { then() {} } as never;"),
    );
    TestValidator.predicate(
      "thenable source results are rejected even without the Promise global",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-export-invalid",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      injectBuildSignal("  Promise.resolve().then(() => { while (true) {} });"),
    );
    TestValidator.predicate(
      "Promise microtasks are rejected before VM execution",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-capability-forbidden",
      ),
    );
    for (const expression of ["{}", "undefined"]) {
      fs.writeFileSync(
        sourcePath,
        injectBuildSignal(`  return ${expression} as never;`),
      );
      TestValidator.predicate(
        `structurally invalid source result ${expression} is rejected`,
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          "source-export-invalid",
        ),
      );
    }
    fs.writeFileSync(
      sourcePath,
      mutate(original, 'defineShot("opening"', 'defineShot("another-shot"'),
    );
    TestValidator.predicate(
      "registered export id is bound to contract module and export",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-registration-mismatch",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      mutate(original, 'defineShot("opening"', 'defineShot(""'),
    );
    TestValidator.predicate(
      "registered source export requires an explicit string id",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-registration-mismatch",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      mutate(original, 'scene: "opening-scene"', 'scene: "unregistered-scene"'),
    );
    TestValidator.predicate(
      "registered scene remains authoritative over the built stage",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "contract-mismatch",
      ),
    );
    fs.writeFileSync(sourcePath, injectBuildSignal('  throw "boom";'));
    TestValidator.predicate(
      "source exceptions are isolated",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-execution-failed",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      injectBuildSignal('  throw { message: "object boom" };'),
    );
    TestValidator.predicate(
      "object-shaped source exceptions retain their message",
      compiler
        .compile({ scope: "source" })
        .diagnostics.some((item) => item.message.includes("object boom")),
    );
    for (const expression of ["null", "{}"]) {
      fs.writeFileSync(sourcePath, injectBuildSignal(`  throw ${expression};`));
      TestValidator.predicate(
        `source exception ${expression} is stringified`,
        diagnosticCodes(compiler.compile({ scope: "source" })).has(
          "source-execution-failed",
        ),
      );
    }
    fs.writeFileSync(sourcePath, injectBuildSignal("  while (true) {}"));
    TestValidator.predicate(
      "source execution has a hard timeout",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-execution-timeout",
      ),
    );
    const getterSource = mutateSourceOutput(
      [
        '  Object.defineProperty(output, "eventSamples", {',
        "    get() { while (true) {} },",
        "  });",
      ].join("\n"),
    );
    // Linking widened what a shot may import, so the refusals that bound it
    // have to be exercised through the compiler rather than only through the
    // linker: a rule the compiler never applies is not a rule.
    fs.writeFileSync(
      sourcePath,
      `import { missing } from "../units/missing";
${original}`,
    );
    TestValidator.predicate(
      "a shot importing a module that does not exist is refused",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-import-unresolved",
      ),
    );
    fs.writeFileSync(
      sourcePath,
      `import { readFileSync } from "node:fs";
${original}`,
    );
    TestValidator.predicate(
      "a shot importing outside the project is still refused",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-import-unsupported",
      ),
    );
    fs.writeFileSync(sourcePath, original);

    // The film edit is the same kind of deterministic source as a shot, and
    // `SOURCE_COMPOSITION.md` tells an author to assemble it by walking the
    // same table its shots derive from. It therefore links the same way: a
    // missing import is refused at compile time by the rule that owns imports,
    // not met as an unavailable module once the sandbox is already running.
    const filmSourcePath = path.join(fixture.root, "src/film.ts");
    const linkedFilmSource = fs.readFileSync(filmSourcePath, "utf8");
    fs.writeFileSync(
      filmSourcePath,
      `import { headHandleFrames } from "./editTable";
${linkedFilmSource}`,
    );
    TestValidator.predicate(
      "a film edit importing a module that does not exist is refused",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-import-unresolved",
      ),
    );
    const editTablePath = path.join(fixture.root, "src/editTable.ts");
    fs.writeFileSync(editTablePath, "export const headHandleFrames = 0;\n");
    fs.writeFileSync(
      filmSourcePath,
      `import { headHandleFrames } from "./editTable";
${mutate(
  linkedFilmSource,
  "head: { frame: 0 }",
  "head: { frame: headHandleFrames }",
)}`,
    );
    TestValidator.equals(
      "a film edit reads the table module it imports",
      namedFacts([
        [
          "sourceImportUnresolved",
          () =>
            diagnosticCodes(compiler.compile({ scope: "source" })).has(
              "source-import-unresolved",
            ) === false,
        ],
        [
          "sourceExecutionFailed",
          () =>
            diagnosticCodes(compiler.compile({ scope: "source" })).has(
              "source-execution-failed",
            ) === false,
        ],
      ]),
      { sourceImportUnresolved: true, sourceExecutionFailed: true },
    );
    fs.rmSync(editTablePath);
    fs.writeFileSync(filmSourcePath, linkedFilmSource);

    fs.writeFileSync(sourcePath, getterSource);
    TestValidator.predicate(
      "returned getters are snapshotted inside the VM timeout",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-execution-timeout",
      ),
    );
    // The actor is authored by the subject class rather than spelled in the
    // shot, so the mutation retargets the returned program instead of the
    // literal. What the case pins is unchanged: a staged actor naming a model
    // the compiler did not build is refused.
    fs.writeFileSync(
      sourcePath,
      mutateSourceOutput('  output.actors[0].model = "absent-model";'),
    );
    TestValidator.predicate(
      "compiled scenes cannot reference an absent model",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-actor-runtime-invalid",
      ),
    );
    fs.writeFileSync(sourcePath, "export const opening = { build: ( => 1 };\n");
    TestValidator.predicate(
      "transpile failures are source diagnostics",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "source-transpile-failed",
      ),
    );

    const instrumented = injectBuildSignal(
      "  console.log(context.engine.distance(",
      "    { x: 0, y: 0, z: 0 },",
      "    { x: 3, y: 4, z: 0 },",
      "  ));",
      "  console.warn(context.engine.groundHeight({ x: 1, z: 1 }));",
      "  console.error(context.engine.groundHeight({ x: 99, z: 99 }));",
    );
    fs.writeFileSync(sourcePath, instrumented);
    TestValidator.predicate(
      "constant ground geometry is available in the source oracle",
      productionCompileSucceeded(
        "constant ground geometry source oracle",
        compiler.compile({ scope: "source" }),
      ),
    );
    project.setWorldDesign({
      ...worldDesign(),
      surfaces: [
        {
          ...worldDesign().surfaces[0]!,
          height: {
            kind: "plane",
            originHeight: 1,
            slopeX: 0.1,
            slopeZ: 0.2,
          },
        },
      ],
    });
    fs.writeFileSync(sourcePath, instrumented);
    TestValidator.predicate(
      "explicit geometry helpers run in the frozen sandbox",
      productionCompileSucceeded(
        "explicit geometry helper sandbox",
        compiler.compile({ scope: "source" }),
      ),
    );
    project.setWorldDesign(worldDesign());
    fs.writeFileSync(sourcePath, original);

    fs.writeFileSync(
      sourcePath,
      // The clip is authored by the subject class, so the mutation retargets
      // the returned program. What the case pins is unchanged: a motion naming
      // a skeleton the compiler did not build is refused.
      mutateSourceOutput('  output.clips[0].skeleton = "missing-skeleton";'),
    );
    const missingSkeleton = compiler.compile({ scope: "source" });
    const missingSkeletonIsRejected = missingSkeleton.diagnostics.some(
      (item) =>
        item.code === "performance-invalid" &&
        item.phase === "source" &&
        item.target === "shot:opening" &&
        item.message.includes(
          'motion skeleton "missing-skeleton" does not match target skeleton "automovie:skeleton:sentinel"',
        ),
    );
    if (missingSkeletonIsRejected === false)
      throw new Error(
        `Missing-skeleton compile did not reach the expected engine gate:\n${JSON.stringify(
          missingSkeleton.diagnostics,
          null,
          2,
        )}`,
      );
    TestValidator.predicate(
      "motion skeleton mismatches are source performance gates",
      missingSkeletonIsRejected,
    );
    fs.writeFileSync(sourcePath, original);

    const residentReadSource = project.readSource;
    project.readSource = (() => {
      const iterator = (function* (): Generator<void> {
        yield;
      })();
      iterator.next();
      return iterator.throw("non-error source failure") as never;
    }) as typeof project.readSource;
    TestValidator.predicate(
      "non-Error source failures remain actionable diagnostics",
      compiler
        .compile({ scope: "source" })
        .diagnostics.some((item) =>
          item.message.includes("non-error source failure"),
        ),
    );
    project.readSource = residentReadSource;
    const residentContentInputs = project.contentInputs;
    project.contentInputs = (() => {
      throw new Error("design scope read declared content");
    }) as typeof project.contentInputs;
    const contentIndependentDesign = compiler.compile({ scope: "design" });
    TestValidator.predicate(
      "design scope does not read declared content or derive review fingerprints",
      productionCompileSucceeded(
        "content-independent design compile",
        contentIndependentDesign,
      ) && contentIndependentDesign.reviews.entries.length === 0,
    );
    for (const failure of [
      new Error("declared content junction"),
      "non-error declared content failure",
    ]) {
      project.contentInputs = (() => {
        if (failure instanceof Error) throw failure;
        const iterator = (function* (): Generator<void> {
          yield;
        })();
        iterator.next();
        return iterator.throw(failure) as never;
      }) as typeof project.contentInputs;
      const unsafeContent = compiler.compile({ scope: "source" });
      TestValidator.predicate(
        "declared content inventory failures are compiler diagnostics",
        unsafeContent.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "content-input-unsafe" &&
            diagnostic.message.includes(
              String(failure instanceof Error ? failure.message : failure),
            ),
        ) && unsafeContent.reviews.entries.length === 0,
      );
    }
    project.contentInputs = residentContentInputs;
    const generatedBeforeContentRace = fs.readFileSync(
      generatedManifestPath,
      "utf8",
    );
    const revisionBeforeContentRace = project.revision();
    const currentContent = residentContentInputs.call(project);
    let noWriteRaceReads = 0;
    project.contentInputs = (() => {
      ++noWriteRaceReads;
      if (noWriteRaceReads === 1) return currentContent;
      throw new Error("no-write content inventory raced");
    }) as typeof project.contentInputs;
    const noWriteContentRace = compiler.compile({ scope: "source" });
    project.contentInputs = residentContentInputs;
    TestValidator.equals(
      "no-write compile confirms current inputs under the commit lock",
      namedFacts([
        [
          "noWriteContentRaceSuccess",
          () => noWriteContentRace.success === false,
        ],
        [
          "diagnosticCodesNoWriteContentRace",
          () =>
            diagnosticCodes(noWriteContentRace).has("compile-input-changed"),
        ],
        [
          "noWriteContentRaceCount",
          () => noWriteContentRace.reviews.entries.length === 0,
        ],
        ["noWriteRaceReads", () => noWriteRaceReads === 2],
        [
          "projectRevision",
          () => project.revision() === revisionBeforeContentRace,
        ],
        [
          "generatedManifestPathUtf8",
          () =>
            fs.readFileSync(generatedManifestPath, "utf8") ===
            generatedBeforeContentRace,
        ],
      ]),
      {
        noWriteContentRaceSuccess: true,
        diagnosticCodesNoWriteContentRace: true,
        noWriteContentRaceCount: true,
        noWriteRaceReads: true,
        projectRevision: true,
        generatedManifestPathUtf8: true,
      },
    );
    let noWriteLateRaceReads = 0;
    project.contentInputs = (() => {
      ++noWriteLateRaceReads;
      if (noWriteLateRaceReads < 3) return currentContent;
      let changed = false;
      return currentContent.map((content) => {
        if (changed || content.bytes === null) return content;
        changed = true;
        return {
          ...content,
          bytes: Buffer.concat([
            Buffer.from(content.bytes),
            Buffer.from("\nlate no-write content race"),
          ]),
        };
      });
    }) as typeof project.contentInputs;
    const noWriteLateContentRace = compiler.compile({ scope: "source" });
    project.contentInputs = residentContentInputs;
    TestValidator.equals(
      "no-write confirmation rejects changes between its two guarded reads",
      namedFacts([
        [
          "noWriteLateContentRaceSuccess",
          () => noWriteLateContentRace.success === false,
        ],
        [
          "diagnosticCodesNoWriteLateContentRace",
          () =>
            diagnosticCodes(noWriteLateContentRace).has(
              "compile-input-changed",
            ),
        ],
        [
          "noWriteLateContentRaceCount",
          () => noWriteLateContentRace.reviews.entries.length === 0,
        ],
        ["noWriteLateRaceReads", () => noWriteLateRaceReads === 3],
        [
          "projectRevision",
          () => project.revision() === revisionBeforeContentRace,
        ],
        [
          "generatedManifestPathUtf8",
          () =>
            fs.readFileSync(generatedManifestPath, "utf8") ===
            generatedBeforeContentRace,
        ],
      ]),
      {
        noWriteLateContentRaceSuccess: true,
        diagnosticCodesNoWriteLateContentRace: true,
        noWriteLateContentRaceCount: true,
        noWriteLateRaceReads: true,
        projectRevision: true,
        generatedManifestPathUtf8: true,
      },
    );
    const generatedShotBeforeOutputRace = fs.readFileSync(generatedShot);
    let noWriteFileRaceReads = 0;
    project.contentInputs = (() => {
      ++noWriteFileRaceReads;
      if (noWriteFileRaceReads === 3) fs.writeFileSync(generatedShot, "{}\n");
      return currentContent;
    }) as typeof project.contentInputs;
    const noWriteFileRace = compiler.compile({ scope: "source" });
    project.contentInputs = residentContentInputs;
    fs.writeFileSync(generatedShot, generatedShotBeforeOutputRace);
    TestValidator.equals(
      "no-write publication rejects raw generated file tampering after its plan",
      namedFacts([
        ["noWriteFileRaceSuccess", () => noWriteFileRace.success === false],
        [
          "diagnosticCodesNoWriteFileRace",
          () => diagnosticCodes(noWriteFileRace).has("compile-input-changed"),
        ],
        [
          "noWriteFileRaceCount",
          () => noWriteFileRace.reviews.entries.length === 0,
        ],
        ["noWriteFileRaceReads", () => noWriteFileRaceReads === 3],
        [
          "projectRevision",
          () => project.revision() === revisionBeforeContentRace,
        ],
      ]),
      {
        noWriteFileRaceSuccess: true,
        diagnosticCodesNoWriteFileRace: true,
        noWriteFileRaceCount: true,
        noWriteFileRaceReads: true,
        projectRevision: true,
      },
    );
    let noWriteManifestRaceReads = 0;
    project.contentInputs = (() => {
      ++noWriteManifestRaceReads;
      if (noWriteManifestRaceReads === 3)
        fs.writeFileSync(
          generatedManifestPath,
          `${generatedBeforeContentRace}\n`,
        );
      return currentContent;
    }) as typeof project.contentInputs;
    const noWriteManifestRace = compiler.compile({ scope: "source" });
    project.contentInputs = residentContentInputs;
    fs.writeFileSync(generatedManifestPath, generatedBeforeContentRace);
    TestValidator.equals(
      "no-write publication rejects raw generated manifest tampering after its plan",
      namedFacts([
        [
          "noWriteManifestRaceSuccess",
          () => noWriteManifestRace.success === false,
        ],
        [
          "diagnosticCodesNoWriteManifestRace",
          () =>
            diagnosticCodes(noWriteManifestRace).has("compile-input-changed"),
        ],
        [
          "noWriteManifestRaceCount",
          () => noWriteManifestRace.reviews.entries.length === 0,
        ],
        ["noWriteManifestRaceReads", () => noWriteManifestRaceReads === 3],
        [
          "projectRevision",
          () => project.revision() === revisionBeforeContentRace,
        ],
      ]),
      {
        noWriteManifestRaceSuccess: true,
        diagnosticCodesNoWriteManifestRace: true,
        noWriteManifestRaceCount: true,
        noWriteManifestRaceReads: true,
        projectRevision: true,
      },
    );
    const rawGeneratedIntruder = path.join(
      fixture.root,
      "generated/fixture-film/raw-race.txt",
    );
    let noWriteInventoryRaceReads = 0;
    project.contentInputs = (() => {
      ++noWriteInventoryRaceReads;
      if (noWriteInventoryRaceReads === 3)
        fs.writeFileSync(rawGeneratedIntruder, "raw race");
      return currentContent;
    }) as typeof project.contentInputs;
    const noWriteInventoryRace = compiler.compile({ scope: "source" });
    project.contentInputs = residentContentInputs;
    fs.rmSync(rawGeneratedIntruder);
    TestValidator.equals(
      "no-write publication rejects raw generated inventory growth after its plan",
      namedFacts([
        [
          "noWriteInventoryRaceSuccess",
          () => noWriteInventoryRace.success === false,
        ],
        [
          "diagnosticCodesNoWriteInventoryRace",
          () =>
            diagnosticCodes(noWriteInventoryRace).has("compile-input-changed"),
        ],
        [
          "noWriteInventoryRaceCount",
          () => noWriteInventoryRace.reviews.entries.length === 0,
        ],
        ["noWriteInventoryRaceReads", () => noWriteInventoryRaceReads === 3],
        [
          "projectRevision",
          () => project.revision() === revisionBeforeContentRace,
        ],
      ]),
      {
        noWriteInventoryRaceSuccess: true,
        diagnosticCodesNoWriteInventoryRace: true,
        noWriteInventoryRaceCount: true,
        noWriteInventoryRaceReads: true,
        projectRevision: true,
      },
    );
    const outputVerificationReadGenerated = project.readGeneratedFile;
    project.readGeneratedFile = ((relativePath: string) => {
      if (
        new Error("output verification stack").stack?.includes(
          "assertGeneratedOutputCurrent",
        )
      )
        throw new Error("generated output verification read raced");
      return outputVerificationReadGenerated.call(project, relativePath);
    }) as typeof project.readGeneratedFile;
    const unreadableOutputRace = compiler.compile({ scope: "source" });
    project.readGeneratedFile = outputVerificationReadGenerated;
    TestValidator.equals(
      "unreadable final generated verification becomes a structured input race",
      namedFacts([
        [
          "unreadableOutputRaceSuccess",
          () => unreadableOutputRace.success === false,
        ],
        [
          "diagnosticCodesUnreadableOutputRace",
          () =>
            diagnosticCodes(unreadableOutputRace).has("compile-input-changed"),
        ],
        [
          "unreadableOutputRaceCount",
          () => unreadableOutputRace.reviews.entries.length === 0,
        ],
        [
          "unreadableOutputRaceDiagnostics",
          () =>
            unreadableOutputRace.diagnostics.some((diagnostic) =>
              diagnostic.message.includes(
                "generated output verification read raced",
              ),
            ),
        ],
        [
          "projectRevision",
          () => project.revision() === revisionBeforeContentRace,
        ],
      ]),
      {
        unreadableOutputRaceSuccess: true,
        diagnosticCodesUnreadableOutputRace: true,
        unreadableOutputRaceCount: true,
        unreadableOutputRaceDiagnostics: true,
        projectRevision: true,
      },
    );
    const writeManifestVerificationReadGenerated = project.readGeneratedFile;
    let writeManifestRaceInjected = false;
    project.readGeneratedFile = ((relativePath: string) => {
      if (
        writeManifestRaceInjected === false &&
        new Error("write manifest verification stack").stack?.includes(
          "assertGeneratedOutputCurrent",
        )
      ) {
        fs.writeFileSync(
          generatedManifestPath,
          `${generatedBeforeContentRace}\n`,
        );
        writeManifestRaceInjected = true;
      }
      return writeManifestVerificationReadGenerated.call(project, relativePath);
    }) as typeof project.readGeneratedFile;
    fs.writeFileSync(sourcePath, `${original}\n// guarded output race\n`);
    const writeManifestRace = compiler.compile({ scope: "source" });
    project.readGeneratedFile = writeManifestVerificationReadGenerated;
    fs.writeFileSync(sourcePath, original);
    TestValidator.equals(
      "write publication rolls back when its staged manifest changes during the final guard",
      namedFacts([
        ["writeManifestRaceSuccess", () => writeManifestRace.success === false],
        [
          "diagnosticCodesWriteManifestRace",
          () => diagnosticCodes(writeManifestRace).has("compile-input-changed"),
        ],
        [
          "writeManifestRaceCount",
          () => writeManifestRace.reviews.entries.length === 0,
        ],
        ["writeManifestRaceInjected", () => writeManifestRaceInjected],
        [
          "projectRevision",
          () => project.revision() === revisionBeforeContentRace,
        ],
        [
          "generatedManifestPathUtf8",
          () =>
            fs.readFileSync(generatedManifestPath, "utf8") ===
            generatedBeforeContentRace,
        ],
        [
          "generatedShotGeneratedShotBeforeOutputRace",
          () =>
            fs
              .readFileSync(generatedShot)
              .equals(generatedShotBeforeOutputRace),
        ],
      ]),
      {
        writeManifestRaceSuccess: true,
        diagnosticCodesWriteManifestRace: true,
        writeManifestRaceCount: true,
        writeManifestRaceInjected: true,
        projectRevision: true,
        generatedManifestPathUtf8: true,
        generatedShotGeneratedShotBeforeOutputRace: true,
      },
    );
    const revisionRacer = AutoMovieProductionProject.open(fixture.root);
    let revisionRaced = false;
    const revisionRaceCompile = new AutoMovieProductionCompiler(
      project,
      (status, snapshot) => {
        const queue = review.queue(status, snapshot);
        if (revisionRaced === false) {
          revisionRacer.setWorldDesign(worldDesign());
          revisionRaced = true;
        }
        return queue;
      },
    ).compile({ scope: "source" });
    TestValidator.equals(
      "no-write confirmation cannot publish another process revision",
      namedFacts([
        [
          "revisionRaceCompileSuccess",
          () => revisionRaceCompile.success === false,
        ],
        [
          "diagnosticCodesRevisionRaceCompile",
          () =>
            diagnosticCodes(revisionRaceCompile).has("compile-input-changed"),
        ],
        [
          "revisionRaceCompileCount",
          () => revisionRaceCompile.reviews.entries.length === 0,
        ],
        ["revisionRaced", () => revisionRaced],
      ]),
      {
        revisionRaceCompileSuccess: true,
        diagnosticCodesRevisionRaceCompile: true,
        revisionRaceCompileCount: true,
        revisionRaced: true,
      },
    );
    const revisionAfterRace = project.revision();
    let contentRaceReads = 0;
    project.contentInputs = (() => {
      ++contentRaceReads;
      if (contentRaceReads < 3) return currentContent;
      let changed = false;
      return currentContent.map((content) => {
        if (changed || content.bytes === null) return content;
        changed = true;
        return {
          ...content,
          bytes: Buffer.concat([
            Buffer.from(content.bytes),
            Buffer.from("\ncontent race"),
          ]),
        };
      });
    }) as typeof project.contentInputs;
    fs.writeFileSync(sourcePath, `${original}\n// guarded content race\n`);
    const racedContentCommit = compiler.compile({ scope: "source" });
    project.contentInputs = residentContentInputs;
    fs.writeFileSync(sourcePath, original);
    TestValidator.equals(
      "late content races roll generated output back before revision publication",
      namedFacts([
        [
          "racedContentCommitSuccess",
          () => racedContentCommit.success === false,
        ],
        [
          "diagnosticCodesRacedContentCommit",
          () =>
            diagnosticCodes(racedContentCommit).has("compile-input-changed"),
        ],
        [
          "racedContentCommitCount",
          () => racedContentCommit.reviews.entries.length === 0,
        ],
        ["contentRaceReads", () => contentRaceReads === 3],
        ["projectRevision", () => project.revision() === revisionAfterRace],
        [
          "generatedManifestPathUtf8",
          () =>
            fs.readFileSync(generatedManifestPath, "utf8") ===
            generatedBeforeContentRace,
        ],
      ]),
      {
        racedContentCommitSuccess: true,
        diagnosticCodesRacedContentCommit: true,
        racedContentCommitCount: true,
        contentRaceReads: true,
        projectRevision: true,
        generatedManifestPathUtf8: true,
      },
    );
    const residentCommitGenerated = project.commitGenerated;
    project.commitGenerated = (() => {
      throw new Error("generic generated commit failure");
    }) as typeof project.commitGenerated;
    let genericCommitFailure = "";
    try {
      compiler.compile({ scope: "source" });
    } catch (error) {
      genericCommitFailure =
        error instanceof Error ? error.message : String(error);
    }
    project.commitGenerated = residentCommitGenerated;
    TestValidator.equals(
      "non-race generated commit failures remain loud",
      genericCommitFailure,
      "generic generated commit failure",
    );
    const residentReadGenerated = project.readGeneratedFile;
    project.readGeneratedFile = (() => {
      const iterator = (function* (): Generator<void> {
        yield;
      })();
      iterator.next();
      return iterator.throw("non-error generated failure") as never;
    }) as typeof project.readGeneratedFile;
    TestValidator.predicate(
      "non-Error generated path failures remain actionable diagnostics",
      compiler
        .lint({ scope: "source" })
        .diagnostics.some(
          (item) =>
            item.code === "generated-path-outside" &&
            item.message.includes("unsafe"),
        ),
    );
    project.readGeneratedFile = residentReadGenerated;

    const wrongIdentity = mutate(
      original,
      "duration: context.contract.durationSeconds,\n    },\n    eventSamples:",
      "duration: context.contract.durationSeconds - 1,\n    },\n    eventSamples:",
    );
    fs.writeFileSync(sourcePath, wrongIdentity);
    TestValidator.predicate(
      "compiled shot identity and duration are engine gates",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "contract-mismatch",
      ),
    );
    for (const [name, expectedCode, mutation] of [
      [
        "duplicate-invalid-event-sample",
        "contract-mismatch",
        [
          "  output.eventSamples[0]!.time = 999;",
          "  output.eventSamples.push({ ...output.eventSamples[0]! });",
        ].join("\n"),
      ],
      [
        "missing-event-sample",
        "contract-mismatch",
        "  output.eventSamples = [];",
      ],
      [
        "false-opening-state",
        "contract-realization-failed",
        "  output.clips![0]!.keyframes[0]!.pose.joints[0]!.abduction = 50;",
      ],
      [
        "false-closing-state",
        "contract-realization-failed",
        "  output.clips![0]!.keyframes[output.clips![0]!.keyframes.length - 1]!.pose.joints[0]!.abduction = 0;",
      ],
      [
        "unreadable-camera",
        "contract-realization-failed",
        '  output.performance.draft[1]!.on = { kind: "point", point: { x: 100, y: 0, z: 0 } };',
      ],
    ] as const) {
      fs.writeFileSync(sourcePath, mutateSourceOutput(mutation));
      const realizationOutput = compiler.compile({ scope: "source" });
      TestValidator.predicate(
        `compiler rejects ${name} with ${expectedCode}: ${realizationOutput.diagnostics
          .map((diagnostic) => diagnostic.code)
          .join(",")}`,
        diagnosticCodes(realizationOutput).has(expectedCode),
      );
    }
    fs.writeFileSync(sourcePath, original);

    TestValidator.equals(
      "formation witness fixture mutation is accepted",
      namedFacts([
        [
          "projectSetModelRecipe",
          () =>
            project.setModelRecipe({
              ...modelRecipe(),
              id: "formation-sentinel",
              role: "prop",
              archetype: "primitive-prop",
              parameters: { shape: "sphere", radius: 0.25 },
              capabilities: [],
              attachments: [],
            }).accepted,
        ],
        [
          "projectSetFormationDesign",
          () =>
            project.setFormationDesign({
              ...formationDesign(),
              modelRecipe: "formation-sentinel",
            }).accepted,
        ],
        [
          "setProductionFixtureShotContractProject",
          () =>
            setProductionFixtureShotContract(project, {
              ...shotContract(),
              participants: [
                { kind: "actor", id: "sentinel" },
                { kind: "formation", id: "line" },
              ],
            }).accepted,
        ],
      ]),
      {
        projectSetModelRecipe: true,
        projectSetFormationDesign: true,
        setProductionFixtureShotContractProject: true,
      },
    );
    const materializedFormation = compiler.compile({ scope: "source" });
    const formationCompileSucceeded = productionCompileSucceeded(
      "formation materialization fixture",
      materializedFormation,
    );
    const formationShot = JSON.parse(
      fs.readFileSync(
        path.join(fixture.root, "generated/fixture-film/shots/opening.json"),
        "utf8",
      ),
    ) as {
      scene: { nodes: Array<{ id: string }> };
      formations: Array<{
        id: string;
        count: number;
        anonymousCount: number;
      }>;
    };
    const formationRealization = JSON.parse(
      fs.readFileSync(
        path.join(
          fixture.root,
          "generated/fixture-film/realizations/opening.json",
        ),
        "utf8",
      ),
    ) as {
      formations: Array<{ id: string; count: number; passed: boolean }>;
    };
    TestValidator.equals(
      "formation count, compact anonymous runtime, hero identity and realization come from the compiler",
      namedFacts([
        ["formationCompileSucceeded", () => formationCompileSucceeded],
        [
          "formationShotScene",
          () => formationShot.scene.nodes.some((node) => node.id === "captain"),
        ],
        [
          "formationShotCount",
          () =>
            formationShot.scene.nodes.filter(
              (node) =>
                node.id === "captain" ||
                node.id.startsWith("formation:line:slot:"),
            ).length === 1,
        ],
        [
          "formationShotFormations",
          () =>
            formationShot.formations.some(
              (formation) =>
                formation.id === "line" &&
                formation.count === 6 &&
                formation.anonymousCount === 5,
            ),
        ],
        [
          "formationRealizationFormations",
          () =>
            formationRealization.formations.some(
              (formation) =>
                formation.id === "line" &&
                formation.count === 6 &&
                formation.passed,
            ),
        ],
      ]),
      {
        formationCompileSucceeded: true,
        formationShotScene: true,
        formationShotCount: true,
        formationShotFormations: true,
        formationRealizationFormations: true,
      },
    );
    const formationSource = fs.readFileSync(sourcePath, "utf8");
    fs.writeFileSync(
      sourcePath,
      mutateSourceOutput(
        [
          "  output.stage.set = [{",
          '    node: "formation:line:slot:000001",',
          '    model: "sentinel",',
          "    position: { x: 0, y: 0, z: 0 },",
          "  }];",
        ].join("\n"),
        formationSource,
      ),
    );
    TestValidator.predicate(
      "coding-agent source cannot replace an ordinary compiler-owned formation slot",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "contract-realization-failed",
      ),
    );
    fs.writeFileSync(sourcePath, formationSource);
    fs.rmSync(
      path.join(fixture.root, ".automovie/design/shared/formations/line.json"),
    );
    TestValidator.predicate(
      "a physically missing formation design is a reference-graph failure",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "design-reference-missing",
      ),
    );
    project.setFormationDesign({
      ...formationDesign(),
      modelRecipe: "formation-sentinel",
    });
    setProductionFixtureShotContract(project, shotContract());
    project.eraseDesignArtifact(
      { kind: "formation", id: "line" },
      "restore the one-shot compiler fixture after formation witness coverage",
    );
    project.eraseDesignArtifact(
      { kind: "model", id: "formation-sentinel" },
      "remove the formation-only recipe after witness coverage",
    );

    const fingerprints = {
      currentFingerprint: null,
      storedFingerprint: null,
    } as const;
    const reviewGate = new AutoMovieProductionCompiler(project, () => ({
      entries: [
        {
          target: { kind: "source", path: "src/shots/opening.ts" },
          state: "missing",
          ...fingerprints,
        },
        {
          target: { kind: "shot", id: "opening" },
          state: "stale",
          ...fingerprints,
        },
        {
          target: { kind: "film", id: "fixture-film" },
          state: "revise",
          ...fingerprints,
        },
        {
          target: {
            kind: "design",
            design: { kind: "model", id: "sentinel" },
          },
          state: "incomplete",
          ...fingerprints,
        },
        {
          target: {
            kind: "design",
            design: { kind: "production" },
          },
          state: "complete",
          ...fingerprints,
        },
        {
          target: { kind: "design", design: { kind: "world" } },
          state: "complete",
          ...fingerprints,
        },
      ],
    }));
    const reviewCodes = diagnosticCodes(
      reviewGate.compile({ scope: "review" }),
    );
    TestValidator.predicate(
      "review compile maps every queue state to a hard gate",
      [
        "review-missing",
        "review-stale",
        "review-revise",
        "review-incomplete",
      ].every((code) => reviewCodes.has(code)),
    );

    const optionalFinalWithoutLedger = compiler.compile({ scope: "final" });
    TestValidator.predicate(
      "final scope requires an aggregate byte ledger even when every deliverable is optional",
      optionalFinalWithoutLedger.success === false &&
        diagnosticCodes(optionalFinalWithoutLedger).has(
          "render-deliverable-missing",
        ),
    );

    const requiredProduction = {
      ...productionDesign(),
      deliverables: [
        {
          id: "required-feature" as const,
          kind: "feature" as const,
          required: true,
        },
        {
          id: "optional-preview" as const,
          kind: "preview" as const,
          required: false,
        },
      ],
    };
    project.setProductionDesign(requiredProduction);
    const finalCompiler = new AutoMovieProductionCompiler(project);
    const missingRender = finalCompiler.compile({ scope: "final" });
    const renderManifestPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/render-manifest.json",
    );
    const renderReceiptPath = path.join(
      fixture.root,
      ".automovie/productions/fixture-film/render-manifest-receipt.json",
    );
    fs.writeFileSync(renderManifestPath, "{}");
    const unownedRender = finalCompiler.compile({ scope: "final" });
    fs.writeFileSync(
      renderReceiptPath,
      JSON.stringify({
        version: 2,
        manifestDigest: digestAutoMovieBytes(Buffer.from("{}")),
        files: [],
      }),
    );
    const invalidRender = finalCompiler.compile({ scope: "final" });
    fs.writeFileSync(renderManifestPath, "{bad");
    fs.writeFileSync(
      renderReceiptPath,
      JSON.stringify({
        version: 2,
        manifestDigest: digestAutoMovieBytes(Buffer.from("{bad")),
        files: [],
      }),
    );
    const malformedRender = finalCompiler.compile({ scope: "final" });
    fs.rmSync(renderManifestPath);
    fs.mkdirSync(renderManifestPath);
    const unsafeRender = finalCompiler.compile({ scope: "final" });
    fs.rmdirSync(renderManifestPath);
    const featurePath = "deliverables/required-feature.mp4";
    const featureFrameCount = Math.round(
      requiredProduction.targetRuntimeSeconds *
        requiredProduction.frameFormat.fps,
    );
    const featureVideoBytes = await productionH264Mp4({
      width: requiredProduction.frameFormat.width,
      height: requiredProduction.frameFormat.height,
      fps: requiredProduction.frameFormat.fps,
      frameCount: featureFrameCount,
    });
    const featureBytes = muxProductionFeatureMp4({
      video: featureVideoBytes,
      audio: productionOpusMp4(
        Math.round(requiredProduction.targetRuntimeSeconds * 48_000),
      ),
    });
    fs.mkdirSync(path.join(fixture.root, "renders/fixture-film/deliverables"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(fixture.root, "renders", "fixture-film", featurePath),
      featureBytes,
    );
    const fakeFeaturePath = "deliverables/fake-feature.mp4";
    const fakeFeatureBytes = Buffer.from("this is not an MP4 container");
    fs.writeFileSync(
      path.join(fixture.root, "renders", "fixture-film", fakeFeaturePath),
      fakeFeatureBytes,
    );
    const previewPath = "deliverables/optional-preview.png";
    const optionalPreviewBytes = productionPng(
      requiredProduction.frameFormat.width,
      requiredProduction.frameFormat.height,
    );
    fs.writeFileSync(
      path.join(fixture.root, "renders", "fixture-film", previewPath),
      optionalPreviewBytes,
    );
    const currentFingerprint = unsafeRender.compiler.inputFingerprint;
    const completeRenderManifest = {
      version: 1 as const,
      compileFingerprint: currentFingerprint,
      deliverables: [
        {
          id: "required-feature",
          kind: "feature" as const,
          files: [
            {
              path: featurePath,
              digest: digestAutoMovieBytes(featureBytes),
              bytes: featureBytes.length,
              mediaType: "video/mp4",
            },
          ],
          runtimeSeconds: requiredProduction.targetRuntimeSeconds,
          frameCount: featureFrameCount,
          codec: "h264",
        },
      ],
    };
    const fakeMediaCommitRefused = (() => {
      try {
        project.commitProductionRenderManifest({
          ...completeRenderManifest,
          deliverables: completeRenderManifest.deliverables.map(
            (deliverable) => ({
              ...deliverable,
              files: [
                {
                  path: fakeFeaturePath,
                  digest: digestAutoMovieBytes(fakeFeatureBytes),
                  bytes: fakeFeatureBytes.length,
                  mediaType: "video/mp4",
                },
              ],
            }),
          ),
        });
        return false;
      } catch {
        return true;
      }
    })();
    project.commitProductionRenderManifest(completeRenderManifest);
    fs.writeFileSync(renderReceiptPath, "{bad");
    const malformedReceipt = finalCompiler.compile({ scope: "final" });
    project.commitProductionRenderManifest({
      ...completeRenderManifest,
      compileFingerprint:
        "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });
    const staleRender = finalCompiler.compile({ scope: "final" });
    project.commitProductionRenderManifest({
      ...completeRenderManifest,
      deliverables: [],
    });
    const incompleteRender = finalCompiler.compile({ scope: "final" });
    const mismatchedCommitRefused = (() => {
      try {
        project.commitProductionRenderManifest({
          ...completeRenderManifest,
          deliverables: completeRenderManifest.deliverables.map(
            (deliverable) => ({
              ...deliverable,
              files: deliverable.files.map((file) => ({
                ...file,
                digest:
                  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
              })),
            }),
          ),
        });
        return false;
      } catch {
        return true;
      }
    })();
    project.commitProductionRenderManifest(completeRenderManifest);
    fs.appendFileSync(
      path.join(fixture.root, "renders", "fixture-film", featurePath),
      Buffer.from([0]),
    );
    const mismatchedRender = finalCompiler.compile({ scope: "final" });
    fs.writeFileSync(
      path.join(fixture.root, "renders", "fixture-film", featurePath),
      featureBytes,
    );
    project.commitProductionRenderManifest(completeRenderManifest);
    project.commitProductionRenderManifest({
      ...completeRenderManifest,
      deliverables: [
        ...completeRenderManifest.deliverables,
        {
          id: "optional-preview",
          kind: "preview",
          files: [
            {
              path: previewPath,
              digest: digestAutoMovieBytes(optionalPreviewBytes),
              bytes: optionalPreviewBytes.length,
              mediaType: "image/png",
            },
          ],
          runtimeSeconds: null,
          frameCount: null,
          codec: null,
          rendition: {
            kind: "repainted",
            shots: [],
            aggregateReviews: [],
          },
        },
      ],
    });
    const nominalPreviewRendition = finalCompiler.compile({ scope: "final" });
    project.commitProductionRenderManifest(completeRenderManifest);
    TestValidator.predicate(
      "final compile requires an aggregate deliverable manifest",
      diagnosticCodes(missingRender).has("render-deliverable-missing"),
    );
    TestValidator.predicate(
      "final compile rejects direct aggregate manifest edits",
      diagnosticCodes(unownedRender).has("render-deliverable-unowned"),
    );
    TestValidator.predicate(
      "final compile rejects malformed renderer receipts",
      diagnosticCodes(malformedReceipt).has("render-deliverable-unowned"),
    );
    TestValidator.predicate(
      "final compile rejects an invalid aggregate deliverable manifest",
      diagnosticCodes(invalidRender).has("render-deliverable-invalid"),
    );
    TestValidator.predicate(
      "final compile rejects malformed aggregate deliverable JSON",
      diagnosticCodes(malformedRender).has("render-deliverable-invalid"),
    );
    TestValidator.predicate(
      "final compile rejects unsafe aggregate deliverable paths",
      diagnosticCodes(unsafeRender).has("render-deliverable-unowned"),
    );
    TestValidator.predicate(
      "final compile rejects a stale aggregate compile fingerprint",
      diagnosticCodes(staleRender).has("render-deliverable-stale"),
    );
    TestValidator.predicate(
      "final compile requires every declared deliverable",
      diagnosticCodes(incompleteRender).has("render-deliverable-missing"),
    );
    TestValidator.predicate(
      "renderer commit and final compile both reject byte-mismatched deliverables",
      mismatchedCommitRefused &&
        diagnosticCodes(mismatchedRender).has("render-deliverable-stale"),
    );
    TestValidator.predicate(
      "final compile accepts complete byte-exact aggregate deliverables",
      fakeMediaCommitRefused &&
        productionCompileSucceeded(
          "byte-exact final deliverables",
          finalCompiler.compile({ scope: "final" }),
        ),
    );
    TestValidator.predicate(
      "non-feature outputs cannot carry nominal repaint provenance",
      diagnosticCodes(nominalPreviewRendition).has(
        "render-rendition-provenance-invalid",
      ),
    );
    const edgeAudioBytes = productionOpusMp4(48_000);
    const edgeAudioProbe = probeProductionMedia({
      kind: "audio-mix",
      mediaType: "audio/mp4",
      bytes: edgeAudioBytes,
    });
    if (edgeAudioProbe.kind !== "audio")
      throw new Error("The compiler edge fixture requires parsed AAC audio.");
    // Every edge deliverable below is measured against the production runtime,
    // and that runtime is the parsed audio's so the valid audio-mix case can
    // match its own bytes. The compiled film now answers to the same target, so
    // the edit has to end there too: the shot is longer, and the segment trims.
    fs.writeFileSync(
      path.join(fixture.root, "src/film.ts"),
      `import type { IAutoMovieFilmSource } from "@automovie/interface";

export const film = {
  build(context) {
    return {
      id: context.production.id,
      omissions: [],
      tracks: {
        video: [{
          shot: "opening",
          sourceIn: { frame: 0 },
          sourceOut: { seconds: ${edgeAudioProbe.runtimeSeconds} },
          start: { frame: 0 },
          handles: { head: { frame: 0 }, tail: { frame: 0 } },
          transitionIn: { kind: "cut" },
          transitionOut: { kind: "cut" },
        }],
        audio: [],
        captions: [],
        effects: [],
      },
    };
  },
} satisfies IAutoMovieFilmSource;
`,
    );
    const edgeProduction = {
      ...productionDesign(),
      targetRuntimeSeconds: edgeAudioProbe.runtimeSeconds,
      frameFormat: {
        ...productionDesign().frameFormat,
        fps: edgeAudioProbe.sampleRate,
      },
    };
    edgeProduction.deliverables = [
      { id: "feature-runtime", kind: "feature", required: true },
      { id: "preview-runtime", kind: "preview", required: false },
      { id: "feature-frame", kind: "feature", required: false },
      { id: "captions-frame", kind: "captions", required: false },
      { id: "captions-invalid", kind: "captions", required: false },
      { id: "feature-codec", kind: "feature", required: false },
      { id: "guide-codec", kind: "guide-pass", required: false },
      { id: "guide-controls", kind: "guide-pass", required: false },
      { id: "audio-codec", kind: "audio-mix", required: false },
      { id: "audio-runtime", kind: "audio-mix", required: false },
      { id: "audio-valid", kind: "audio-mix", required: false },
      { id: "audio-missing", kind: "audio-mix", required: false },
      { id: "preview-codec", kind: "preview", required: false },
      { id: "invalid-file", kind: "preview", required: false },
      { id: "empty-files", kind: "preview", required: false },
      { id: "duplicate-file-owner", kind: "preview", required: false },
      { id: "missing-file", kind: "preview", required: false },
      { id: "kind-mismatch", kind: "captions", required: false },
    ];
    const edgeDesign = project.setProductionDesign(edgeProduction);
    const edgeCompile = finalCompiler.compile({ scope: "source" });
    TestValidator.equals(
      "final semantic edge production compiles",
      {
        accepted: edgeDesign.accepted,
        designCodes: [
          ...new Set(
            edgeDesign.diagnostics
              .filter((diagnostic) => diagnostic.category === "error")
              .map((diagnostic) => diagnostic.code),
          ),
        ].sort(compareCodeUnits),
        compiled: edgeCompile.success,
        compileCodes: [
          ...new Set(
            edgeCompile.diagnostics
              .filter((diagnostic) => diagnostic.category === "error")
              .map((diagnostic) => diagnostic.code),
          ),
        ].sort(compareCodeUnits),
      },
      { accepted: true, designCodes: [], compiled: true, compileCodes: [] },
    );
    const edgeFingerprint = finalCompiler.lint({ scope: "source" }).compiler
      .inputFingerprint;
    type RenderedDeliverable =
      IAutoMovieProductionRenderManifest["deliverables"][number];
    const previewImage = new PNG({
      width: edgeProduction.frameFormat.width,
      height: edgeProduction.frameFormat.height,
    });
    previewImage.data.fill(180);
    previewImage.data[0] = 0;
    const previewBytes = PNG.sync.write(previewImage);
    const captionBytes = Buffer.from(
      "WEBVTT\n\n00:00:00.000 --> 00:00:06.000\nSignal raised.\n",
      "utf8",
    );
    const edgeFile = (id: string, kind: RenderedDeliverable["kind"]) => {
      const medium =
        kind === "feature"
          ? {
              extension: "mp4",
              bytes: featureBytes,
              mediaType: "video/mp4",
            }
          : kind === "guide-pass"
            ? {
                extension: "mp4",
                bytes: featureVideoBytes,
                mediaType: "video/mp4",
              }
            : kind === "audio-mix"
              ? {
                  extension: "m4a",
                  bytes: edgeAudioBytes,
                  mediaType: "audio/mp4",
                }
              : kind === "captions"
                ? {
                    extension: "vtt",
                    bytes: captionBytes,
                    mediaType: "text/vtt",
                  }
                : {
                    extension: "png",
                    bytes: previewBytes,
                    mediaType: "image/png",
                  };
      const relative = `deliverables/final-edges/${id}.${medium.extension}`;
      const absolute = path.join(
        fixture.root,
        "renders",
        "fixture-film",
        relative,
      );
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, medium.bytes);
      return {
        path: relative,
        digest: digestAutoMovieBytes(medium.bytes),
        bytes: medium.bytes.length,
        mediaType: medium.mediaType,
      };
    };
    const edgeSoundEvidenceFile = (id: string) => {
      const bytes = Buffer.from(
        JSON.stringify({
          version: 1,
          plan: { events: [] },
          analysis: { clippingSamples: 0, eventAlignment: [] },
          tts: [],
        }),
      );
      const relative = `deliverables/final-edges/${id}.json`;
      const absolute = path.join(
        fixture.root,
        "renders",
        "fixture-film",
        relative,
      );
      fs.writeFileSync(absolute, bytes);
      return {
        path: relative,
        digest: digestAutoMovieBytes(bytes),
        bytes: bytes.length,
        mediaType: "application/json",
      };
    };
    const validRendered = (
      id: string,
      kind: RenderedDeliverable["kind"],
    ): RenderedDeliverable => {
      const timed = ["feature", "guide-pass", "captions", "audio-mix"].includes(
        kind,
      );
      const framed = kind === "feature" || kind === "guide-pass";
      const encoded =
        kind === "feature" || kind === "guide-pass" || kind === "audio-mix";
      return {
        id,
        kind,
        files:
          kind === "audio-mix"
            ? [
                edgeFile(id, kind),
                edgeFile(`${id}-waveform`, "preview"),
                edgeFile(`${id}-spectrogram`, "preview"),
                edgeSoundEvidenceFile(`${id}-evidence`),
              ]
            : [edgeFile(id, kind)],
        runtimeSeconds: timed ? edgeProduction.targetRuntimeSeconds : null,
        frameCount: framed
          ? Math.round(
              edgeProduction.targetRuntimeSeconds *
                edgeProduction.frameFormat.fps,
            )
          : null,
        codec:
          kind === "audio-mix"
            ? edgeAudioProbe.codec
            : encoded
              ? "edge-codec"
              : null,
      };
    };
    const invalidDeliverables = edgeProduction.deliverables.map((contract) =>
      validRendered(contract.id, contract.kind),
    );
    const edge = (id: string): RenderedDeliverable =>
      invalidDeliverables.find((deliverable) => deliverable.id === id)!;
    edge("guide-controls").files.push(
      edgeFile("guide-controls-frame", "preview"),
    );
    edge("feature-runtime").runtimeSeconds =
      edgeProduction.targetRuntimeSeconds / 2;
    edge("preview-runtime").runtimeSeconds = 0;
    edge("feature-frame").frameCount = 0;
    edge("captions-frame").frameCount = 0;
    edge("feature-codec").codec = null;
    edge("guide-codec").codec = null;
    edge("audio-codec").codec = null;
    edge("audio-runtime").runtimeSeconds =
      edgeProduction.targetRuntimeSeconds / 2;
    edge("audio-missing").files = [];
    edge("preview-codec").codec = "";
    edge("empty-files").files = [];
    edge("kind-mismatch").kind = "preview";
    edge("kind-mismatch").files = [];
    const duplicateFileManifest: IAutoMovieProductionRenderManifest = {
      version: 1,
      compileFingerprint: edgeFingerprint,
      deliverables: [
        structuredClone(edge("invalid-file")),
        {
          ...structuredClone(edge("duplicate-file-owner")),
          files: [
            {
              ...edge("invalid-file").files[0]!,
              path: edge("invalid-file").files[0]!.path.toUpperCase(),
            },
          ],
        },
      ],
    };
    const duplicateFileCommitRefused = (() => {
      try {
        project.commitProductionRenderManifest(duplicateFileManifest);
        return false;
      } catch {
        return true;
      }
    })();
    const invalidFileManifest: IAutoMovieProductionRenderManifest = {
      version: 1,
      compileFingerprint: edgeFingerprint,
      deliverables: [
        {
          ...structuredClone(edge("invalid-file")),
          files: [
            {
              ...edge("invalid-file").files[0]!,
              bytes: 0,
              mediaType: "",
            },
          ],
        },
      ],
    };
    const invalidFileCommitRefused = (() => {
      try {
        project.commitProductionRenderManifest(invalidFileManifest);
        return false;
      } catch {
        return true;
      }
    })();
    const duplicateDeliverable = {
      ...structuredClone(edge("feature-runtime")),
      files: [],
    };
    const edgeManifest: IAutoMovieProductionRenderManifest = {
      version: 1,
      compileFingerprint: edgeFingerprint,
      deliverables: [
        ...invalidDeliverables,
        duplicateDeliverable,
        validRendered("undeclared", "preview"),
      ],
    };
    project.commitProductionRenderManifest(edgeManifest);
    const edgeReceipt = JSON.parse(
      fs.readFileSync(renderReceiptPath, "utf8"),
    ) as IAutoMovieProductionRenderReceipt;
    const writeReceipt = (receipt: IAutoMovieProductionRenderReceipt): void => {
      fs.writeFileSync(renderReceiptPath, JSON.stringify(receipt));
    };
    const restoreEdgeLedger = (): void => {
      project.commitProductionRenderManifest(edgeManifest);
    };
    writeReceipt({
      ...edgeReceipt,
      files: [...edgeReceipt.files, structuredClone(edgeReceipt.files[0]!)],
    });
    const duplicateReceiptRender = finalCompiler.compile({ scope: "final" });
    restoreEdgeLedger();
    writeReceipt({
      ...edgeReceipt,
      files: edgeReceipt.files.map((file, index) =>
        index === 0 ? { ...file, deliverable: "wrong-owner" } : file,
      ),
    });
    const mismatchedReceiptRender = finalCompiler.compile({ scope: "final" });
    restoreEdgeLedger();
    writeReceipt({
      ...edgeReceipt,
      files: edgeReceipt.files.map((file) => ({
        ...file,
        probe:
          file.probe.kind === "video" || file.probe.kind === "png"
            ? { ...file.probe, width: file.probe.width + 1 }
            : file.probe,
      })),
    });
    const staleProbeRender = finalCompiler.compile({ scope: "final" });
    restoreEdgeLedger();
    writeReceipt({
      ...edgeReceipt,
      files: [
        ...edgeReceipt.files,
        {
          ...structuredClone(edgeReceipt.files[0]!),
          path: "deliverables/final-edges/receipt-only.png",
        },
      ],
    });
    const receiptOnlyRender = finalCompiler.compile({ scope: "final" });
    restoreEdgeLedger();
    const probeFailureFile = edge("invalid-file").files[0]!;
    const probeFailurePath = path.join(
      fixture.root,
      "renders",
      "fixture-film",
      probeFailureFile.path,
    );
    const probeFailureBytes = fs.readFileSync(probeFailurePath);
    fs.writeFileSync(probeFailurePath, "not a PNG");
    const currentProbeFailure = finalCompiler.compile({ scope: "final" });
    fs.writeFileSync(probeFailurePath, probeFailureBytes);
    restoreEdgeLedger();
    const captionFailureFile = edge("captions-invalid").files[0]!;
    const captionFailurePath = path.join(
      fixture.root,
      "renders",
      "fixture-film",
      captionFailureFile.path,
    );
    const captionFailureBytes = fs.readFileSync(captionFailurePath);
    fs.writeFileSync(captionFailurePath, "not WebVTT");
    const currentCaptionFailure = finalCompiler.compile({ scope: "final" });
    fs.writeFileSync(captionFailurePath, captionFailureBytes);
    restoreEdgeLedger();
    fs.writeFileSync(
      captionFailurePath,
      `WEBVTT\n\n00:00:00.000 --> 00:00:${String(
        Math.ceil(edgeProduction.targetRuntimeSeconds) + 1,
      ).padStart(2, "0")}.000\nOutside runtime.\n`,
    );
    const outOfRuntimeCaption = finalCompiler.compile({ scope: "final" });
    fs.writeFileSync(captionFailurePath, captionFailureBytes);
    restoreEdgeLedger();
    const writeDirectLedger = (
      manifest: IAutoMovieProductionRenderManifest,
    ): void => {
      const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
      fs.writeFileSync(renderManifestPath, manifestBytes);
      writeReceipt({
        ...edgeReceipt,
        manifestDigest: digestAutoMovieBytes(manifestBytes),
      });
    };
    const duplicateOwnedManifest = structuredClone(edgeManifest);
    const duplicateOwner = duplicateOwnedManifest.deliverables.find(
      (deliverable) => deliverable.id === "duplicate-file-owner",
    )!;
    duplicateOwner.files = [
      {
        ...edge("invalid-file").files[0]!,
        path: edge("invalid-file").files[0]!.path.toUpperCase(),
      },
    ];
    writeDirectLedger(duplicateOwnedManifest);
    const duplicateOwnedRender = finalCompiler.compile({ scope: "final" });
    restoreEdgeLedger();
    const invalidEntryManifest = structuredClone(edgeManifest);
    const invalidEntry = invalidEntryManifest.deliverables.find(
      (deliverable) => deliverable.id === "invalid-file",
    )!.files[0]!;
    invalidEntry.bytes = 0;
    invalidEntry.mediaType = "";
    writeDirectLedger(invalidEntryManifest);
    const invalidEntryRender = finalCompiler.compile({ scope: "final" });
    restoreEdgeLedger();
    fs.rmSync(
      path.join(
        fixture.root,
        "renders",
        "fixture-film",
        edge("missing-file").files[0]!.path,
      ),
    );
    const semanticRender = finalCompiler.compile({ scope: "final" });
    const residentRenderRead = project.readRenderFile;
    project.readRenderFile = ((relativePath: string) => {
      if (relativePath.endsWith("/missing-file.png")) {
        const iterator = (function* (): Generator<void> {
          yield;
        })();
        iterator.next();
        return iterator.throw("non-error render read failure") as never;
      }
      return residentRenderRead.call(project, relativePath);
    }) as typeof project.readRenderFile;
    const nonErrorRenderRead = finalCompiler.compile({ scope: "final" });
    project.readRenderFile = residentRenderRead;
    TestValidator.predicate(
      `final ledger rejects duplicate, undeclared, incomplete and unreadable outputs: duplicate=${duplicateFileCommitRefused}, invalid=${invalidFileCommitRefused}, duplicateReceipt=${[...diagnosticCodes(duplicateReceiptRender)]}, mismatchedReceipt=${[...diagnosticCodes(mismatchedReceiptRender)]}, staleProbe=${[...diagnosticCodes(staleProbeRender)]}, receiptOnly=${[...diagnosticCodes(receiptOnlyRender)]}, probeFailure=${[...diagnosticCodes(currentProbeFailure)]}, duplicateOwned=${[...diagnosticCodes(duplicateOwnedRender)]}, invalidEntry=${[...diagnosticCodes(invalidEntryRender)]}, semantic=${semanticRender.diagnostics
        .map((diagnostic) => diagnostic.code)
        .join(",")}, nonError=${nonErrorRenderRead.diagnostics
        .map((diagnostic) => `${diagnostic.code}:${diagnostic.message}`)
        .join("|")}`,
      duplicateFileCommitRefused &&
        invalidFileCommitRefused &&
        diagnosticCodes(duplicateReceiptRender).has(
          "render-deliverable-unowned",
        ) &&
        diagnosticCodes(mismatchedReceiptRender).has(
          "render-deliverable-unowned",
        ) &&
        diagnosticCodes(staleProbeRender).has("render-deliverable-unowned") &&
        diagnosticCodes(receiptOnlyRender).has("render-deliverable-unowned") &&
        diagnosticCodes(currentProbeFailure).has(
          "render-deliverable-invalid",
        ) &&
        currentCaptionFailure.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "render-deliverable-media-mismatch" &&
            diagnostic.message.includes(
              'Caption deliverable "captions-invalid"',
            ),
        ) &&
        outOfRuntimeCaption.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "render-deliverable-media-mismatch" &&
            diagnostic.message.includes("production timeline"),
        ) &&
        diagnosticCodes(duplicateOwnedRender).has(
          "render-deliverable-invalid",
        ) &&
        diagnosticCodes(invalidEntryRender).has("render-deliverable-invalid") &&
        [
          "render-deliverable-invalid",
          "render-deliverable-incomplete",
          "render-deliverable-missing",
        ].every((code) => diagnosticCodes(semanticRender).has(code)) &&
        semanticRender.diagnostics.some(
          (diagnostic) =>
            diagnostic.target === "guide-controls" &&
            diagnostic.code === "render-deliverable-media-mismatch" &&
            diagnostic.message.includes("continuous"),
        ) &&
        nonErrorRenderRead.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "render-deliverable-missing" &&
            diagnostic.message.includes("non-error render read failure"),
        ),
    );
    fs.rmSync(
      path.join(fixture.root, ".automovie/design/fixture-film/production.json"),
    );
    TestValidator.predicate(
      "final diagnostics tolerate an absent production while design owns error",
      diagnosticCodes(finalCompiler.compile({ scope: "final" })).has(
        "design-missing",
      ),
    );
    TestValidator.predicate(
      "mutation consequences retain a film target without production metadata",
      project
        .setWorldDesign(worldDesign())
        .consequences.staleReviews.some(
          (target) => target.kind === "film" && target.id === "film",
        ),
    );
    project.setProductionDesign(productionDesign());

    project.eraseDesignArtifact({ kind: "world" });
    fs.writeFileSync(sourcePath, instrumented);
    TestValidator.predicate(
      "missing world uses the bounded empty source context before design refusal",
      diagnosticCodes(compiler.compile({ scope: "source" })).has(
        "design-missing",
      ),
    );
    fs.writeFileSync(sourcePath, original);
    project.setWorldDesign(worldDesign());

    let noDesignFailure: IProductionCompilerFixtureFailure | undefined;
    const noDesignRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-production-empty-"),
    );
    try {
      const empty = new AutoMovieProductionCompiler(
        AutoMovieProductionProject.open(noDesignRoot),
      ).compile({ scope: "design" });
      TestValidator.predicate(
        "empty repository reports all required design classes",
        empty.success === false &&
          empty.diagnostics.filter((item) => item.code === "design-missing")
            .length === 3,
      );
    } catch (error) {
      noDesignFailure = { error };
      throw error;
    } finally {
      preserveProductionCompilerFixtureCleanup(noDesignFailure, () =>
        fs.rmSync(noDesignRoot, { force: true, recursive: true }),
      );
    }
  } catch (error) {
    productionCompilerFailure = { error };
    throw error;
  } finally {
    preserveProductionCompilerFixtureCleanup(productionCompilerFailure, () =>
      fixture.dispose(),
    );
  }
};

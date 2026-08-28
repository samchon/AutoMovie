import type {
  AutoMovieContentDigest,
  IAutoMovieProductionTtsReceipt,
} from "@automovie/interface";
import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";

interface IDialogueRuntime {
  version: 1;
  inputFingerprint: AutoMovieContentDigest;
  fps: number;
  segments: Array<{
    shot: string;
    startFrame: number;
    endFrame: number;
    sourceInFrame: number;
    sourceOutFrame: number;
  }>;
  receipts: IAutoMovieProductionTtsReceipt[];
  timelines: Array<{
    line: string;
    actor: string;
    ranges: Array<{
      startFrame: number;
      endFrame: number;
      viseme: "aa" | "ih";
    }>;
  }>;
}

interface ICaptureRuntime {
  installDialogue(runtime: IDialogueRuntime | null): Promise<void>;
  pageIdentity(input: Record<string, unknown>): string;
  viewerRuntime(): { dialogue(): IDialogueRuntime | null };
}

interface IRuntimeModules {
  PRODUCTION_DIALOGUE_CACHE_VERSION: 5;
  captureExistingDialogueCache(
    base: string,
    target: string,
  ): null | { pcm: Uint8Array; receipt: Uint8Array };
  createProductionFrameCaptureRuntime(): ICaptureRuntime;
  generatedShotPlugin(
    root: string,
    productionId: string,
    provider: { dialogue(): IDialogueRuntime | null },
  ): { configureServer(server: unknown): unknown };
  productionDialogueCacheIdentity(props: {
    cacheRoot: string;
    selection: Record<string, unknown>;
    text: string;
    language: string;
    speaker: string | null;
    runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
  }): { key: AutoMovieContentDigest; path: string };
  productionDialogueFrameForShotTime(
    runtime: IDialogueRuntime | null,
    props: { shot: string; time: number },
  ): number | null;
  productionDialogueRuntimeIdentity(
    runtime: IDialogueRuntime | null,
  ): string | null;
  productionSoundSourceDigest(props: {
    project: {
      contentInputs(): Array<{
        path: string;
        bytes: Uint8Array | null;
        render: boolean;
      }>;
    };
    timeline: { tracks: { audio: Array<{ asset: string }> } };
    runtimeIdentity: unknown;
    dialogueRuntime: IDialogueRuntime;
  }): AutoMovieContentDigest;
  publishDialogueCache(props: {
    base: string;
    pcm: Uint8Array;
    receipt: Uint8Array;
    target: string;
  }): unknown;
  resolveProductionDialogueCache<Runtime, Cached>(props: {
    assets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
    identify(assets: IAutoMovieProductionTtsReceipt["runtimeAssets"]): {
      key: AutoMovieContentDigest;
      path: string;
    };
    load(): Promise<Runtime>;
    read(
      identity: { key: AutoMovieContentDigest; path: string },
      assets: IAutoMovieProductionTtsReceipt["runtimeAssets"],
    ): Cached | undefined;
    runtimeAssets(
      runtime: Runtime,
    ): IAutoMovieProductionTtsReceipt["runtimeAssets"];
  }): Promise<{
    assets: IAutoMovieProductionTtsReceipt["runtimeAssets"];
    cached: Cached | undefined;
    identity: { key: AutoMovieContentDigest; path: string };
    runtime: Runtime | undefined;
  }>;
}

const linkWorkspacePackage = (project: string, name: string): void => {
  const manifest = createRequire(__filename)
    .resolve.paths(name)
    ?.map((base) => path.join(base, ...name.split("/"), "package.json"))
    .find((candidate) => fs.existsSync(candidate));
  if (manifest === undefined)
    throw new Error(`Dialogue runtime package root did not resolve: ${name}.`);
  const target = path.join(project, "node_modules", ...name.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(
    path.dirname(manifest),
    target,
    process.platform === "win32" ? "junction" : "dir",
  );
};

const loadModules = (root: string): IRuntimeModules => {
  const scripts = path.join(root, "scripts");
  return {
    ...(require(path.join(scripts, "capture.ts")) as object),
    ...(require(path.join(scripts, "dialogueCacheSnapshot.ts")) as object),
    ...(require(path.join(scripts, "generatedShotPlugin.ts")) as object),
    ...(require(path.join(scripts, "productionRuntimeState.ts")) as object),
    ...(require(path.join(scripts, "renderSoundRuntime.ts")) as object),
  } as IRuntimeModules;
};

const dialogueRuntime = (
  name: "A" | "B",
  startFrame: number,
): IDialogueRuntime => ({
  version: 1,
  inputFingerprint: `sha256:${name.toLowerCase().repeat(64)}`,
  fps: 24,
  segments: [
    {
      shot: `shot-${name}`,
      startFrame,
      endFrame: startFrame + 24,
      sourceInFrame: 0,
      sourceOutFrame: 24,
    },
  ],
  receipts: [],
  timelines: [
    {
      line: `line-${name}`,
      actor: `actor-${name}`,
      ranges: [
        {
          startFrame,
          endFrame: startFrame + 24,
          viseme: name === "A" ? "aa" : "ih",
        },
      ],
    },
  ],
});

const runtimeEndpoint = (
  module: IRuntimeModules,
  root: string,
  productionId: string,
  provider: { dialogue(): IDialogueRuntime | null },
): IDialogueRuntime | null => {
  let middleware:
    | ((
        request: { url: string },
        response: {
          statusCode: number;
          setHeader(name: string, value: string): void;
          end(value: Uint8Array): void;
        },
        next: () => void,
      ) => void)
    | undefined;
  module.generatedShotPlugin(root, productionId, provider).configureServer({
    middlewares: {
      use: (candidate: typeof middleware) => {
        middleware = candidate;
      },
    },
  });
  let body: Uint8Array | undefined;
  middleware?.(
    { url: "/__automovie/production-runtime.json" },
    {
      statusCode: 0,
      setHeader: () => undefined,
      end: (value) => {
        body = value;
      },
    },
    () => {
      throw new Error("The production runtime endpoint fell through.");
    },
  );
  if (body === undefined)
    throw new Error("The production runtime endpoint emitted no body.");
  return (
    JSON.parse(Buffer.from(body).toString("utf8")) as {
      dialogue: IDialogueRuntime | null;
    }
  ).dialogue;
};

const dialogueSelection = (): Record<string, unknown> => ({
  provider: "kokoro-local-v1",
  model: "onnx-community/Kokoro-82M-v1.0-ONNX",
  modelRevision: "1939ad2a8e416c0acfeecc08a694d14ef25f2231",
  dtype: "q8",
  device: "cpu",
  voice: "af_heart",
  speed: 1,
  generatorProvenance: { source: "local-test", license: "reviewed" },
});

/**
 * Dialogue execution state and partially populated model caches are isolated.
 *
 * Scenarios:
 *
 * 1. Distinct physical generated roots own non-null dialogue objects, visemes,
 *    frame mappings, page identities, runtime endpoints, and source digests.
 * 2. A viewer provider opened before B starts remains an immutable A snapshot
 *    even after A's capture owner is updated, while B serves only B.
 * 3. A public v3 underpaid receipt under a partial asset key is not reused;
 *    loading discovers the complete inventory, re-keys and seals v4 bytes, and
 *    the next complete-inventory invocation hits without loading.
 */
export const test_cli_scaffold_dialogue_runtime_isolation =
  async (): Promise<void> => {
    const fixtureRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "automovie-dialogue-runtime-isolation-"),
    );
    let failure: { error: unknown } | undefined;
    try {
      const firstRoot = path.join(fixtureRoot, "proxy-root");
      const secondRoot = path.join(fixtureRoot, "final-root");
      writeFiles(firstRoot, renderScaffold({ name: "dialogue-proxy" }));
      writeFiles(secondRoot, renderScaffold({ name: "dialogue-final" }));
      for (const root of [firstRoot, secondRoot])
        for (const name of [
          "@automovie/archetypes",
          "@automovie/engine",
          "@automovie/interface",
          "@automovie/production",
          "@automovie/render",
          "@automovie/viewer",
          "@types/node",
          "@types/pngjs",
          "@types/three",
          "h264-mp4-encoder",
          "mp4box",
          "playwright",
          "pngjs",
          "three",
          "vite",
        ])
          linkWorkspacePackage(root, name);
      const first = loadModules(firstRoot);
      const second = loadModules(secondRoot);
      const dialogueA = dialogueRuntime("A", 0);
      const dialogueB = dialogueRuntime("B", 48);
      const captureA = first.createProductionFrameCaptureRuntime();
      const captureB = second.createProductionFrameCaptureRuntime();
      await captureA.installDialogue(dialogueA);
      const openA = captureA.viewerRuntime();
      await captureB.installDialogue(dialogueB);
      await captureA.installDialogue(dialogueB);
      const endpointA = runtimeEndpoint(
        first,
        firstRoot,
        "dialogue-proxy",
        openA,
      );
      const endpointB = runtimeEndpoint(
        second,
        secondRoot,
        "dialogue-final",
        captureB.viewerRuntime(),
      );
      const basePage = {
        compileFingerprint:
          `sha256:${"c".repeat(64)}` as AutoMovieContentDigest,
        globalFrame: 0,
        height: 360,
        pass: "beauty",
        time: 0.5,
        width: 640,
      };
      const emptyPage = first.createProductionFrameCaptureRuntime();
      const pageRuntimeA = first.createProductionFrameCaptureRuntime();
      await pageRuntimeA.installDialogue(dialogueA);
      const pageA = JSON.parse(
        pageRuntimeA.pageIdentity({
          ...basePage,
          projectRoot: firstRoot,
          productionId: "dialogue-proxy",
          target: { kind: "shot", id: "shot-A" },
        }),
      ) as { dialogueRuntime: string | null };
      const pageB = JSON.parse(
        captureB.pageIdentity({
          ...basePage,
          projectRoot: secondRoot,
          productionId: "dialogue-final",
          target: { kind: "shot", id: "shot-B" },
        }),
      ) as { dialogueRuntime: string | null };
      const pageEmpty = JSON.parse(
        emptyPage.pageIdentity({
          ...basePage,
          projectRoot: firstRoot,
          productionId: "dialogue-proxy",
          target: { kind: "shot", id: "shot-A" },
        }),
      ) as { dialogueRuntime: string | null };
      const project = {
        contentInputs: () => [
          { path: "src/film.ts", bytes: Buffer.from("same"), render: true },
        ],
      };
      const timeline = { tracks: { audio: [] } };
      const sourceA = first.productionSoundSourceDigest({
        project,
        timeline,
        runtimeIdentity: { tier: "shared" },
        dialogueRuntime: dialogueA,
      });
      const sourceB = second.productionSoundSourceDigest({
        project,
        timeline,
        runtimeIdentity: { tier: "shared" },
        dialogueRuntime: dialogueB,
      });
      TestValidator.equals(
        "two generated roots preserve invocation-owned dialogue facts",
        {
          endpointA,
          endpointB,
          frameA: first.productionDialogueFrameForShotTime(dialogueA, {
            shot: "shot-A",
            time: 0.5,
          }),
          frameB: second.productionDialogueFrameForShotTime(dialogueB, {
            shot: "shot-B",
            time: 0.5,
          }),
          pageEmpty: pageEmpty.dialogueRuntime,
          pageA: pageA.dialogueRuntime,
          pageB: pageB.dialogueRuntime,
          expectedA: first.productionDialogueRuntimeIdentity(dialogueA),
          expectedB: second.productionDialogueRuntimeIdentity(dialogueB),
          sourceDistinct: sourceA !== sourceB,
        },
        {
          endpointA: dialogueA,
          endpointB: dialogueB,
          frameA: 12,
          frameB: 60,
          pageEmpty: null,
          pageA: first.productionDialogueRuntimeIdentity(dialogueA),
          pageB: second.productionDialogueRuntimeIdentity(dialogueB),
          expectedA: first.productionDialogueRuntimeIdentity(dialogueA),
          expectedB: second.productionDialogueRuntimeIdentity(dialogueB),
          sourceDistinct: true,
        },
      );

      const cacheRoot = path.join(fixtureRoot, "dialogue-cache");
      fs.mkdirSync(cacheRoot);
      const partialAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"] = [
        { path: "runtime/base.js", digest: "sha256:base" },
        { path: "models/partial.onnx", digest: "sha256:partial" },
      ];
      const completeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"] = [
        ...partialAssets,
        { path: "models/complete.data", digest: "sha256:complete" },
      ];
      const selection = dialogueSelection();
      const identify = (
        runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"],
      ) =>
        first.productionDialogueCacheIdentity({
          cacheRoot,
          selection,
          text: "Cafe\u0301",
          language: "en",
          speaker: "narrator",
          runtimeAssets,
        });
      const partialIdentity = identify(partialAssets);
      first.publishDialogueCache({
        base: cacheRoot,
        pcm: new Uint8Array([1, 2, 3, 4]),
        receipt: Buffer.from(
          `${JSON.stringify({ version: 3, cacheKey: partialIdentity.key, runtimeAssets: partialAssets })}\n`,
        ),
        target: partialIdentity.path,
      });
      type CacheRecord = {
        version: number;
        cacheKey: string;
        runtimeAssets: unknown;
      };
      const read = (
        identity: { key: AutoMovieContentDigest; path: string },
        assets: IAutoMovieProductionTtsReceipt["runtimeAssets"],
      ): CacheRecord | undefined => {
        const snapshot = first.captureExistingDialogueCache(
          cacheRoot,
          identity.path,
        );
        if (snapshot === null) return undefined;
        const record = JSON.parse(
          Buffer.from(snapshot.receipt).toString("utf8"),
        ) as CacheRecord;
        return record.version === first.PRODUCTION_DIALOGUE_CACHE_VERSION &&
          record.cacheKey === identity.key &&
          JSON.stringify(record.runtimeAssets) === JSON.stringify(assets)
          ? record
          : undefined;
      };
      let loads = 0;
      const resolved = await first.resolveProductionDialogueCache({
        assets: partialAssets,
        identify,
        load: async () => {
          ++loads;
          return { runtimeAssets: completeAssets };
        },
        read,
        runtimeAssets: (loaded) => loaded.runtimeAssets,
      });
      TestValidator.equals(
        "the stale partial receipt misses and runtime loading re-keys completely",
        {
          cached: resolved.cached,
          keyChanged: resolved.identity.key !== partialIdentity.key,
          assets: resolved.assets,
          loads,
        },
        {
          cached: undefined,
          keyChanged: true,
          assets: completeAssets,
          loads: 1,
        },
      );
      const sealed = {
        version: first.PRODUCTION_DIALOGUE_CACHE_VERSION,
        cacheKey: resolved.identity.key,
        runtimeAssets: resolved.assets,
      };
      first.publishDialogueCache({
        base: cacheRoot,
        pcm: new Uint8Array([5, 6, 7, 8]),
        receipt: Buffer.from(`${JSON.stringify(sealed)}\n`),
        target: resolved.identity.path,
      });
      const secondHit = await first.resolveProductionDialogueCache<
        { runtimeAssets: IAutoMovieProductionTtsReceipt["runtimeAssets"] },
        CacheRecord
      >({
        assets: completeAssets,
        identify,
        load: async () => {
          ++loads;
          throw new Error("A complete v4 cache hit must not load Kokoro.");
        },
        read,
        runtimeAssets: (loaded) => loaded.runtimeAssets,
      });
      TestValidator.equals(
        "the complete v4 generation seals and hits without a second load",
        {
          cached: secondHit.cached,
          identity: secondHit.identity,
          runtime: secondHit.runtime,
          loads,
          sealedBytes: JSON.parse(
            Buffer.from(
              first.captureExistingDialogueCache(
                cacheRoot,
                resolved.identity.path,
              )!.receipt,
            ).toString("utf8"),
          ),
        },
        {
          cached: sealed,
          identity: resolved.identity,
          runtime: undefined,
          loads: 1,
          sealedBytes: sealed,
        },
      );
    } catch (error) {
      failure = { error };
      throw error;
    } finally {
      preserveCliHarnessCleanup(failure, [
        {
          resource: "dialogue runtime isolation fixture",
          cleanup: () =>
            fs.rmSync(fixtureRoot, { force: true, recursive: true }),
        },
      ]);
    }
  };

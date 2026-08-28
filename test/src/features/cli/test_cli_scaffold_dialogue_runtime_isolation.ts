import type {
  AutoMovieContentDigest,
  IAutoMovieDeliveryCrop,
  IAutoMovieProductionTtsReceipt,
} from "@automovie/interface";
import type { IAutoMovieProductionRenderJobPlan } from "@automovie/production";
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
  installDeliveryCrop(crop: IAutoMovieDeliveryCrop | null): Promise<void>;
  deliveryCrop(): IAutoMovieDeliveryCrop | null;
  pageIdentity(input: Record<string, unknown>): string;
  viewerRuntime(): {
    dialogue(): IDialogueRuntime | null;
    deliveryCrop(): IAutoMovieDeliveryCrop | null;
  };
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
    provider: {
      dialogue(): IDialogueRuntime | null;
      deliveryCrop(): IAutoMovieDeliveryCrop | null;
    },
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
  productionRenderFrameCaptureInput(props: {
    root: string;
    productionId: string;
    plan: IAutoMovieProductionRenderJobPlan;
    shot: string;
    sourceFrame: number;
    sourceFps: number;
    globalFrame: number;
    pass: "beauty";
  }): {
    crop?: IAutoMovieDeliveryCrop;
    globalFrame: number | null;
    height: number;
    pass: "beauty";
    productionId: string;
    projectRoot: string;
    target: { kind: "shot"; id: string };
    time: number;
    width: number;
  };
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
    ...(require(path.join(scripts, "renderFrameCaptureInput.ts")) as object),
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

const runtimeEndpoint = async (
  module: IRuntimeModules,
  root: string,
  productionId: string,
  provider: {
    dialogue(): IDialogueRuntime | null;
    deliveryCrop(): IAutoMovieDeliveryCrop | null;
  },
): Promise<{
  dialogue: IDialogueRuntime | null;
  deliveryCrop: IAutoMovieDeliveryCrop | null;
}> => {
  let middleware:
    | ((
        request: { url: string },
        response: {
          statusCode: number;
          setHeader(name: string, value: string): void;
          end(value: string | Uint8Array): void;
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
  if (middleware === undefined)
    throw new Error("The production runtime endpoint was not installed.");
  const handler = middleware;
  const body = await new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new Error("The production runtime endpoint emitted no body.")),
      10_000,
    );
    const finish = <Value>(
      settle: (value: Value) => void,
      value: Value,
    ): void => {
      clearTimeout(timer);
      settle(value);
    };
    try {
      handler(
        { url: "/__automovie/production-runtime.json" },
        {
          statusCode: 0,
          setHeader: () => undefined,
          end: (value) => finish(resolve, Buffer.from(value)),
        },
        () =>
          finish(
            reject,
            new Error("The production runtime endpoint fell through."),
          ),
      );
    } catch (error) {
      finish(reject, error);
    }
  });
  return JSON.parse(body.toString("utf8")) as {
    dialogue: IDialogueRuntime | null;
    deliveryCrop: IAutoMovieDeliveryCrop | null;
  };
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
 * 3. An internal v4 cache receipt under a partial asset key is not reused;
 *    loading discovers the complete inventory, re-keys and seals v5 bytes, and
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
      const cropA = { left: 0, top: 0.1, right: 0.8, bottom: 1 };
      const cropB = { left: 0.2, top: 0, right: 1, bottom: 0.9 };
      await captureA.installDialogue(dialogueA);
      await captureA.installDeliveryCrop(cropA);
      const renderPlan = {
        productionId: "dialogue-proxy",
        compileFingerprint: `sha256:${"c".repeat(64)}`,
        sourceFrameFormat: {
          width: 1_920,
          height: 1_080,
          fps: 24,
          colorSpace: "srgb",
          crop: cropA,
        },
        frameFormat: {
          width: 960,
          height: 540,
          fps: 12,
          colorSpace: "srgb",
          crop: cropA,
        },
      } as IAutoMovieProductionRenderJobPlan;
      const renderInputProps = {
        root: firstRoot,
        productionId: "dialogue-proxy",
        plan: renderPlan,
        shot: "shot-A",
        sourceFrame: 12,
        sourceFps: 24,
        globalFrame: 6,
        pass: "beauty" as const,
      };
      const hostileRenderCaptureInput =
        first.productionRenderFrameCaptureInput(renderInputProps);
      hostileRenderCaptureInput.crop!.left = 0.75;
      const renderCaptureInput =
        first.productionRenderFrameCaptureInput(renderInputProps);
      const renderNoCropInput = first.productionRenderFrameCaptureInput({
        root: firstRoot,
        productionId: "dialogue-proxy",
        plan: {
          ...renderPlan,
          frameFormat: { ...renderPlan.frameFormat, crop: undefined },
        },
        shot: "shot-A",
        sourceFrame: 12,
        sourceFps: 24,
        globalFrame: 6,
        pass: "beauty",
      });
      const openA = captureA.viewerRuntime();
      await captureB.installDialogue(dialogueB);
      await captureB.installDeliveryCrop(cropB);
      await captureA.installDialogue(dialogueB);
      await captureA.installDeliveryCrop(cropB);
      const endpointA = await runtimeEndpoint(
        first,
        firstRoot,
        "dialogue-proxy",
        openA,
      );
      const endpointB = await runtimeEndpoint(
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
          crop: cropA,
        }),
      ) as {
        dialogueRuntime: string | null;
        deliveryCrop: IAutoMovieDeliveryCrop | null;
      };
      const pageCropOnlyB = pageRuntimeA.pageIdentity({
        ...basePage,
        projectRoot: firstRoot,
        productionId: "dialogue-proxy",
        target: { kind: "shot", id: "shot-A" },
        crop: cropB,
      });
      const pageB = JSON.parse(
        captureB.pageIdentity({
          ...basePage,
          projectRoot: secondRoot,
          productionId: "dialogue-final",
          target: { kind: "shot", id: "shot-B" },
          crop: cropB,
        }),
      ) as {
        dialogueRuntime: string | null;
        deliveryCrop: IAutoMovieDeliveryCrop | null;
      };
      const pageEmpty = JSON.parse(
        emptyPage.pageIdentity({
          ...basePage,
          projectRoot: firstRoot,
          productionId: "dialogue-proxy",
          target: { kind: "shot", id: "shot-A" },
        }),
      ) as {
        dialogueRuntime: string | null;
        deliveryCrop: IAutoMovieDeliveryCrop | null;
      };
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
          endpointDialogueA: endpointA.dialogue,
          endpointDialogueB: endpointB.dialogue,
          endpointCropA: endpointA.deliveryCrop,
          endpointCropB: endpointB.deliveryCrop,
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
          pageCropEmpty: pageEmpty.deliveryCrop,
          pageCropA: pageA.deliveryCrop,
          pageCropB: pageB.deliveryCrop,
          cropOnlyPageInvalidated:
            pageRuntimeA.pageIdentity({
              ...basePage,
              projectRoot: firstRoot,
              productionId: "dialogue-proxy",
              target: { kind: "shot", id: "shot-A" },
              crop: cropA,
            }) !== pageCropOnlyB,
          hostileRenderCaptureCrop: hostileRenderCaptureInput.crop,
          planCropAfterHostileCapture: renderPlan.frameFormat.crop,
          renderNoCrop: renderNoCropInput.crop,
          renderCaptureInput: {
            root: renderCaptureInput.projectRoot,
            production: renderCaptureInput.productionId,
            target: renderCaptureInput.target,
            time: renderCaptureInput.time,
            frame: renderCaptureInput.globalFrame,
            pass: renderCaptureInput.pass,
            width: renderCaptureInput.width,
            height: renderCaptureInput.height,
            crop: renderCaptureInput.crop,
          },
          expectedA: first.productionDialogueRuntimeIdentity(dialogueA),
          expectedB: second.productionDialogueRuntimeIdentity(dialogueB),
          sourceDistinct: sourceA !== sourceB,
        },
        {
          endpointDialogueA: dialogueA,
          endpointDialogueB: dialogueB,
          endpointCropA: cropA,
          endpointCropB: cropB,
          frameA: 12,
          frameB: 60,
          pageEmpty: null,
          pageA: first.productionDialogueRuntimeIdentity(dialogueA),
          pageB: second.productionDialogueRuntimeIdentity(dialogueB),
          pageCropEmpty: null,
          pageCropA: cropA,
          pageCropB: cropB,
          cropOnlyPageInvalidated: true,
          hostileRenderCaptureCrop: { ...cropA, left: 0.75 },
          planCropAfterHostileCapture: cropA,
          renderNoCrop: undefined,
          renderCaptureInput: {
            root: firstRoot,
            production: "dialogue-proxy",
            target: { kind: "shot", id: "shot-A" },
            time: 0.5,
            frame: 6,
            pass: "beauty",
            width: 960,
            height: 540,
            crop: cropA,
          },
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
          `${JSON.stringify({ version: 4, cacheKey: partialIdentity.key, runtimeAssets: partialAssets })}\n`,
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
          throw new Error("A complete v5 cache hit must not load Kokoro.");
        },
        read,
        runtimeAssets: (loaded) => loaded.runtimeAssets,
      });
      TestValidator.equals(
        "the complete v5 generation seals and hits without a second load",
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

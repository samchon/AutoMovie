import type {
  AutoMovieContentDigest,
  IAutoMovieDeliveryCrop,
  IAutoMovieProductionTtsReceipt,
} from "@automovie/interface";
import type { IAutoMovieProductionRenderJobPlan } from "@automovie/production";
import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";
import { linkGeneratedWorkspacePackage } from "./GeneratedWorkspaceLink";

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
  inspectProductionSubject: (input: unknown) => Promise<unknown>;
  parseCaptureBrowserConfig: (value: unknown) => unknown;
  createNodeProductionRenderHostWithCapture: (capture: unknown) => unknown;
  runProductionRenderWithHost: (
    args: readonly string[],
    host: unknown,
  ) => Promise<void>;
  createProductionCaptureDialogueRuntime(props: {
    capture: unknown;
    productionId: string;
    root: string;
  }): { prepare: () => Promise<unknown> };
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

const linkWorkspacePackage = (project: string, name: string): void =>
  linkGeneratedWorkspacePackage({
    name,
    project,
    subject: "Dialogue runtime package root",
  });

const loadModules = (root: string): IRuntimeModules => {
  const scripts = path.join(root, "scripts");
  return {
    ...(require(path.join(scripts, "capture.ts")) as object),
    ...(require(path.join(scripts, "inspectSubject.ts")) as object),
    ...(require(path.join(scripts, "capture-browser.ts")) as object),
    ...(require(path.join(scripts, "renderHost.ts")) as object),
    ...(require(path.join(scripts, "renderRuntime.ts")) as object),
    ...(require(path.join(scripts, "captureDialogueRuntime.ts")) as object),
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
      // The production an author has before they have authored anything. The
      // capture dialogue owner reads its own design for three optional
      // decisions -- dialogue synthesis, live wearable soft bodies, speaker
      // bindings -- and falls back for each. Every fixture in this repository
      // supplies all three, so the fallbacks had never run, and the state that
      // exercises them is the first state a project is ever in.
      //
      // An unregistered id is the honest way to reach it: `productionDesign`
      // answers `null` for a production that has authored none, which is the
      // same `null` a brand-new project hands over. Constructing the owner is
      // the whole reading -- `prepare()` opens a compile and this production
      // has none, and it is the construction that consults the design.
      const undesigned = first.createProductionCaptureDialogueRuntime({
        capture: first.createProductionFrameCaptureRuntime(),
        productionId: "never-authored",
        root: firstRoot,
      });
      TestValidator.equals(
        "a production with no authored design still builds its dialogue owner",
        {
          built: typeof undesigned.prepare === "function",
        },
        { built: true },
      );
      // The instrument the product names, loaded from the project that ships
      // it. When a project supplies none, subject inspection refuses with a
      // message naming this file: "The scaffold ships one at
      // `scripts/inspectSubject.ts`; pass that, or another
      // AutoMovieProductionSubjectInspection, to the call that reached here."
      //
      // Nothing connected the two. The three cases that construct the
      // inspection service pass their own doubles, and a double stays true
      // wherever it is moved, so the sentence the product prints was an
      // instruction nobody had ever followed -- and the day the adapter
      // signature moved away from the shipped instrument, the only thing that
      // would notice is an author reading a refusal that no longer works.
      //
      // Loading it is the whole reading. Calling it opens a dev server and a
      // browser to answer, which is a capture host and a different question;
      // what is asked here is whether the file the message names still exports
      // the callable shape the seat takes.
      TestValidator.equals(
        "the scaffold ships the inspection instrument its own refusal names",
        {
          exported: typeof first.inspectProductionSubject === "function",
          // One argument, because an instrument taking none would satisfy a
          // structural check and answer nothing.
          arity: first.inspectProductionSubject.length,
        },
        { exported: true, arity: 1 },
      );

      // The host boundary's own refusal, which is pure reading and sits in
      // front of every seal the capture path carries. A host that asked for a
      // specific browser and silently got another one would be capturing
      // through an instrument nobody selected, so the parser enumerates what it
      // accepts and names what it will not take.
      const rejected = ((value: unknown): string => {
        try {
          first.parseCaptureBrowserConfig(value);
          return "accepted";
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      })({ source: "some-other-browser" });
      TestValidator.equals(
        "the capture browser selection refuses a source it does not ship",
        {
          named: rejected.includes("Invalid capture browser selection"),
          // And it says what it does take, so the author is not left guessing
          // which spelling was wanted.
          enumerated: rejected.includes("playwright-chromium"),
        },
        { named: true, enumerated: true },
      );

      // The generated viewer config, loaded rather than started. Its own
      // module level is ordinary imports; everything that touches a capture
      // host lives inside the function it hands to Vite, and that function is
      // not called until a server starts.
      //
      // That deferral is the contract worth holding: written as a literal the
      // closure check would run at import time, in every consumer that so much
      // as reads the config -- including this one.
      const viteConfig = require(path.join(firstRoot, "vite.config.ts")) as {
        default: unknown;
      };
      TestValidator.equals(
        "the generated viewer config defers everything that needs a capture host",
        { deferred: typeof viteConfig.default === "function" },
        { deferred: true },
      );

      // The artifact route, which is a second handler of this plugin and the
      // one that judges the production id. The runtime endpoint above resolves
      // a padded id because it never reaches this guard; here a padded id is
      // refused, and so is an artifact id that is not a trimmed name.
      //
      // Both refusals are pure reading in front of every capture seal, and
      // neither had been asked. An id that resolved into a neighbouring
      // directory is the fault they exist to stop.
      const artifact = async (
        productionId: string,
        url: string,
      ): Promise<string> => {
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
        first
          .generatedShotPlugin(firstRoot, productionId, {
            deliveryCrop: () => null,
            dialogue: () => null,
          })
          .configureServer({
            middlewares: {
              use: (candidate: typeof middleware) => {
                middleware = candidate;
              },
            },
          });
        if (middleware === undefined) throw new Error("no middleware");
        const handler = middleware;
        return new Promise<string>((resolve) => {
          const response = {
            statusCode: 0,
            setHeader: () => undefined,
            end: (value: unknown) =>
              resolve(String(response.statusCode) + " " + String(value)),
          };
          handler({ url }, response as never, () => resolve("next"));
        }).catch((error: unknown) =>
          error instanceof Error ? error.message : String(error),
        );
      };
      const paddedArtifact = await artifact(
        " dialogue-proxy ",
        "/__automovie/film.json",
      );
      const paddedArtifactId = await artifact(
        "dialogue-proxy",
        "/__automovie/shots/%20opening%20.json",
      );
      TestValidator.equals(
        "the artifact route refuses a padded production id and a padded artifact id",
        {
          // Both refusals print one sentence; the status code is what tells
          // them apart. A padded production id is a bad request, not a
          // missing file, and answering 404 would send an author looking for
          // an artifact that was never the problem.
          production: paddedArtifact.startsWith("400 "),
          productionNamed: paddedArtifact.includes(
            "invalid compiled viewer artifact request",
          ),
          artifact: paddedArtifactId.includes(
            "invalid compiled viewer artifact request",
          ),
        },
        { production: true, productionNamed: true, artifact: true },
      );

      // The third route, which serves compiled assets and authorizes each one
      // against the project asset manifest before handing over bytes. It walks
      // a path traversal check first: a segment that is empty, a dot, a double
      // dot, or carries a backslash never reaches the manifest at all.
      //
      // No fixture had asked either half. Both are pure reading in front of
      // every capture seal, and an asset route that resolved ".." would be
      // serving the machine rather than the production.
      const traversal = await artifact(
        "dialogue-proxy",
        "/__automovie/assets/../secrets.bin",
      );
      const unlisted = await artifact(
        "dialogue-proxy",
        "/__automovie/assets/never-registered.bin",
      );
      TestValidator.equals(
        "the asset route refuses a traversal and an asset its manifest never listed",
        {
          // Both answer 400 with one sentence. Neither is a missing file: a
          // traversal never becomes a filesystem read, and an unregistered
          // asset is refused before whatever sits at that path is opened.
          traversal,
          unlisted,
        },
        {
          traversal: "400 invalid registered asset request",
          unlisted: "400 invalid registered asset request",
        },
      );

      // And the route with nothing wrong with it. A valid production id and a
      // valid artifact id walk past both guards to the compiled root, and the
      // answer is 404 rather than 400: this project has compiled no such
      // artifact, which is a different fact from a request nobody could read.
      //
      // Telling those two apart is the whole of what the handler's catch
      // decides, and no fixture had ever taken the passing side of it.
      const absentArtifact = await artifact(
        "dialogue-proxy",
        "/__automovie/shots/opening.json",
      );
      TestValidator.equals(
        "an artifact this project never compiled is missing, not malformed",
        { answer: absentArtifact },
        { answer: "404 compiled viewer artifact not found" },
      );

      // The generated render CLI's own option check, which is pure reading
      // in front of every capture seal. An author who mistypes a flag gets the
      // flag they typed back, by name, rather than a default silently chosen
      // for them -- a render that quietly used a tier or a deliverable nobody
      // asked for is the fault this refusal exists to stop.
      const renderHost = first.createNodeProductionRenderHostWithCapture(
        first.createProductionFrameCaptureRuntime(),
      );
      const unknownOption = await first
        .runProductionRenderWithHost(
          ["status", "--production", "x"],
          renderHost,
        )
        .then(() => "resolved")
        .catch((error: unknown) =>
          error instanceof Error ? error.message : String(error),
        );
      TestValidator.equals(
        "the generated render command names the option it does not take",
        { answer: unknownOption },
        { answer: 'Unknown render option "--production".' },
      );

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
      // The same two readings the dialogue owner needed, in the plugin that
      // serves them. A production with no authored design falls back to an
      // empty soft-body list, and a production id carrying whitespace is
      // refused by name rather than resolved into a neighbouring directory.
      //
      // Both are states an author reaches without trying: the first is every
      // new project, and the second is a copied id with a stray space. Neither
      // had ever been asked of this endpoint.
      const undesignedEndpoint = await runtimeEndpoint(
        first,
        firstRoot,
        "never-authored",
        openA,
      );
      const paddedId = await runtimeEndpoint(
        first,
        firstRoot,
        " dialogue-proxy ",
        openA,
      )
        .then(() => "resolved")
        .catch((error: unknown) =>
          error instanceof Error ? error.message : String(error),
        );
      TestValidator.equals(
        "the runtime endpoint answers a production that authored no design",
        {
          // It answers rather than refusing, and what it answers is the
          // provider's own dialogue. The design decides only the live wearable
          // soft bodies, and having authored none is a fact about the
          // production rather than a failure of the endpoint -- which is what
          // the fallback beside that read exists to say, and what no fixture
          // had ever asked it.
          answered: undesignedEndpoint.dialogue !== null,
          fromProvider:
            undesignedEndpoint.dialogue?.inputFingerprint ===
            dialogueA.inputFingerprint,
          // A padded id resolves here rather than being refused: the guard
          // that rejects one lives in a different handler of this plugin, and
          // recording that keeps the next reader from aiming at this one.
          padded: paddedId,
        },
        { answered: true, fromProvider: true, padded: "resolved" },
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

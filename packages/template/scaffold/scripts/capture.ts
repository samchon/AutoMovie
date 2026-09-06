import type {
  AutoMovieProductionFrameCapture,
  IAutoMovieRenderSpec,
  IAutoMovieSemanticMask,
  IAutoMovieSemanticMaskEvidence,
} from "@automovie/interface";
import path from "node:path";
import type { Page } from "playwright";
import type { ViteDevServer } from "vite";

import {
  type IAutoMovieCaptureBrowserSession,
  inspectCaptureGraphics,
  inspectCurrentCaptureRuntimeClosure,
  launchCaptureBrowser,
} from "./capture-browser";
import {
  type IGeneratedShotRuntimeProvider,
  generatedShotPlugin,
} from "./generatedShotPlugin";
import {
  readAutoMovieHostCaptureBrowser,
  readAutoMovieHostViewerBasePath,
  readAutoMovieHostViewerHost,
} from "./hostBoundary";
import {
  type IAutoMovieProductionDialogueRuntime,
  cloneProductionDeliveryCrop,
  cloneProductionDialogueRuntime,
  productionDialogueFrameForShotTime,
  productionDialogueRuntimeIdentity,
} from "./productionRuntimeState";

interface CaptureSession {
  server: ViteDevServer;
  browser: IAutoMovieCaptureBrowserSession["browser"];
  runtime: IAutoMovieCaptureBrowserSession["runtime"];
  assertRuntimeCurrent: () => void;
  origin: string;
  pages: Map<string, Promise<CapturePage>>;
}

interface CapturePage {
  page: Page;
  diagnostics: string[];
  graphics: Awaited<ReturnType<typeof inspectCaptureGraphics>>;
  queue: Promise<void>;
}

interface ProductionCaptureFailure {
  error: unknown;
}

interface ProductionCaptureCleanup {
  cleanup: () => unknown;
  resource: string;
}

interface ProductionFrameCaptureState {
  dialogue: IAutoMovieProductionDialogueRuntime | null;
  deliveryCrop: NonNullable<
    Parameters<AutoMovieProductionFrameCapture>[0]["crop"]
  > | null;
  metrics: {
    pagesOpened: number;
    navigations: number;
    seeks: number;
    captures: number;
    captureMilliseconds: number;
  };
  sessionIdentity: string | null;
  sessionPromise: Promise<CaptureSession> | null;
}

/** One reusable capture/browser session owned by one command invocation. */
export interface IProductionFrameCaptureRuntime {
  capture: (
    input: IProductionFrameCaptureInput,
  ) => ReturnType<AutoMovieProductionFrameCapture>;
  close: (failure?: ProductionCaptureFailure) => Promise<void>;
  dialogue: () => IAutoMovieProductionDialogueRuntime | null;
  deliveryCrop: () => ProductionFrameCaptureState["deliveryCrop"];
  installDeliveryCrop: (
    crop: ProductionFrameCaptureState["deliveryCrop"],
  ) => Promise<void>;
  installDialogue: (
    runtime: IAutoMovieProductionDialogueRuntime | null,
  ) => Promise<void>;
  pageIdentity: (input: IProductionFrameCaptureInput) => string;
  viewerRuntime: () => IGeneratedShotRuntimeProvider;
  metrics: () => Readonly<
    ProductionFrameCaptureState["metrics"] & {
      avoidedPageReloads: number;
      capturesPerNavigation: number;
      capturesPerSecond: number;
    }
  >;
}

class ProductionCaptureCleanupError extends AggregateError {}

/**
 * Tone-mapping curve this production's render spec delivers under.
 *
 * The render spec owns the delivery default and a scene's own `environment`
 * overrides it, so this is the one value the capture has to hand the page: the
 * viewer cannot read a render spec, and a page opened without it leaves the
 * renderer on whatever curve it happened to have. Sending it explicitly is what
 * makes the headless frame and the live viewer the same photograph.
 *
 * It mirrors the curve the production oracle seals into every render bundle
 * manifest, and `assertCapturedDeliveryToneMapping` in `render.ts` re-reads a
 * committed manifest and refuses the render when the two have drifted, so the
 * mirror can never quietly outlive its original.
 */
export const PRODUCTION_DELIVERY_TONE_MAPPING: IAutoMovieRenderSpec["toneMapping"] =
  "none";

/** Preserve an operation failure while attempting every requested cleanup. */
const preserveProductionCaptureCleanup = async (
  failure: ProductionCaptureFailure | undefined,
  resources: readonly ProductionCaptureCleanup[],
): Promise<void> => {
  const results = await Promise.allSettled(
    resources.map((resource) => Promise.resolve().then(resource.cleanup)),
  );
  const cleanupFailures = results.flatMap((result, index) =>
    result.status === "fulfilled"
      ? []
      : [{ error: result.reason, resource: resources[index]!.resource }],
  );
  if (cleanupFailures.length === 0) return;
  if (failure === undefined && cleanupFailures.length === 1)
    throw cleanupFailures[0]!.error;
  throw new ProductionCaptureCleanupError(
    [
      ...(failure === undefined
        ? []
        : failure.error instanceof ProductionCaptureCleanupError
          ? failure.error.errors
          : [failure.error]),
      ...cleanupFailures.map((entry) => entry.error),
    ],
    `Production capture cleanup failed${
      failure === undefined ? "" : " after the operation failed"
    }: ${cleanupFailures.map((entry) => entry.resource).join(", ")}.`,
  );
};

const startSession = async (
  state: ProductionFrameCaptureState,
  projectRoot: string,
  productionId: string,
): Promise<CaptureSession> => {
  const runtimeProvider = productionFrameViewerRuntime(state);
  const browser = readAutoMovieHostCaptureBrowser(process.env);
  const viewerHost = readAutoMovieHostViewerHost(process.env);
  const closure = inspectCurrentCaptureRuntimeClosure({
    projectRoot,
    config: browser,
  });
  if (closure.status === "not-ready") throw new Error(closure.correction);
  closure.assertCurrent();
  const { createServer } = await import("vite");
  closure.assertCurrent();
  const server = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [generatedShotPlugin(projectRoot, productionId, runtimeProvider)],
    resolve: { dedupe: ["three"] },
    server: { host: viewerHost, port: 0, strictPort: false },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (
      address === null ||
      address === undefined ||
      typeof address === "string"
    )
      throw new Error("Vite did not expose a numeric local address.");
    const launched = await launchCaptureBrowser(projectRoot, browser, closure);
    launched.assertRuntimeCurrent();
    return {
      server,
      browser: launched.browser,
      runtime: launched.runtime,
      assertRuntimeCurrent: launched.assertRuntimeCurrent,
      origin: `http://${viewerHost}:${address.port}`,
      pages: new Map(),
    };
  } catch (error) {
    await preserveProductionCaptureCleanup({ error }, [
      { resource: "capture server", cleanup: () => server.close() },
    ]);
    throw error;
  }
};

const productionFrameViewerRuntime = (
  state: ProductionFrameCaptureState,
): IGeneratedShotRuntimeProvider => {
  const dialogue = cloneProductionDialogueRuntime(state.dialogue);
  const deliveryCrop = cloneProductionDeliveryCrop(state.deliveryCrop);
  return {
    dialogue: () => dialogue,
    deliveryCrop: () => deliveryCrop,
  };
};

const installProductionDeliveryCrop = async (
  state: ProductionFrameCaptureState,
  crop: ProductionFrameCaptureState["deliveryCrop"],
): Promise<void> => {
  const next = cloneProductionDeliveryCrop(crop);
  if (JSON.stringify(state.deliveryCrop) === JSON.stringify(next)) return;
  await closeProductionFrameCapture(state);
  state.deliveryCrop = next;
};

const captureSession = async (
  state: ProductionFrameCaptureState,
  projectRoot: string,
  productionId: string,
): Promise<CaptureSession> => {
  const root = path.resolve(projectRoot);
  const identity = `${root}\0${productionId}`;
  if (state.sessionPromise !== null && state.sessionIdentity === identity)
    return state.sessionPromise;
  await closeProductionFrameCapture(state);
  state.sessionIdentity = identity;
  state.metrics = {
    pagesOpened: 0,
    navigations: 0,
    seeks: 0,
    captures: 0,
    captureMilliseconds: 0,
  };
  state.sessionPromise = startSession(state, root, productionId);
  try {
    return await state.sessionPromise;
  } catch (error) {
    state.sessionPromise = null;
    state.sessionIdentity = null;
    throw error;
  }
};

/** Measured navigation/capture counts for the current reusable session. */
const productionFrameCaptureMetrics = (
  state: ProductionFrameCaptureState,
): Readonly<
  ProductionFrameCaptureState["metrics"] & {
    avoidedPageReloads: number;
    capturesPerNavigation: number;
    capturesPerSecond: number;
  }
> => ({
  ...state.metrics,
  avoidedPageReloads: Math.max(
    0,
    state.metrics.captures - state.metrics.navigations,
  ),
  capturesPerNavigation:
    state.metrics.navigations === 0
      ? 0
      : state.metrics.captures / state.metrics.navigations,
  capturesPerSecond:
    state.metrics.captureMilliseconds === 0
      ? 0
      : state.metrics.captures / (state.metrics.captureMilliseconds / 1_000),
});

const capturePage = (
  state: ProductionFrameCaptureState,
  session: CaptureSession,
  input: Parameters<AutoMovieProductionFrameCapture>[0],
): Promise<CapturePage> => {
  const subject = capturePageSubject(input);
  const key = capturePageKey(state, input);
  const existing = session.pages.get(key);
  if (existing !== undefined) return existing;
  const pending = (async (): Promise<CapturePage> => {
    session.assertRuntimeCurrent();
    for (const [candidateKey, candidate] of session.pages)
      if (candidateKey !== key) {
        const parsed = JSON.parse(candidateKey) as {
          subject: unknown;
          width: number;
          height: number;
        };
        if (
          JSON.stringify(parsed.subject) === JSON.stringify(subject) &&
          parsed.width === input.width &&
          parsed.height === input.height
        ) {
          session.pages.delete(candidateKey);
          const previous = await candidate;
          await previous.queue;
          await previous.page.close();
        }
      }
    const page = await session.browser.newPage({
      viewport: { width: input.width!, height: input.height! },
      deviceScaleFactor: session.runtime.mode.deviceScaleFactor,
    });
    ++state.metrics.pagesOpened;
    const diagnostics: string[] = [];
    page.on("console", (message) =>
      diagnostics.push(`console:${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) =>
      diagnostics.push(`pageerror: ${error.message}`),
    );
    const url = new URL(
      readAutoMovieHostViewerBasePath(process.env),
      session.origin,
    );
    if (input.target.kind === "shot") {
      url.searchParams.set("shot", input.target.id);
      // The shot page reads this and hands it to the compiled shot runtime,
      // which passes it to `applyRendererEnvironment` as the delivery curve for
      // a scene declaring no environment of its own. The turntable page draws
      // an isolated model for rig review and honors no delivery, so asking it
      // for one would name a parameter nothing reads.
      url.searchParams.set("tone", PRODUCTION_DELIVERY_TONE_MAPPING);
    } else {
      url.searchParams.set("asset", input.target.id);
      url.searchParams.set("elevation", String(input.target.elevationDeg));
      url.searchParams.set("pose", input.target.pose);
      if (input.target.part !== undefined)
        url.searchParams.set("part", input.target.part);
    }
    try {
      ++state.metrics.navigations;
      await page.goto(url.href, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () => window.__automovieCapture?.ready === true,
      );
      await page.locator("#status").evaluate((element) => {
        element.style.display = "none";
      });
      session.assertRuntimeCurrent();
      return {
        page,
        diagnostics,
        graphics: await inspectCaptureGraphics(page),
        queue: Promise.resolve(),
      };
    } catch (error) {
      const failure = new Error(
        `${
          error instanceof Error ? error.message : String(error)
        } Browser diagnostics: ${diagnostics.join(" | ") || "none reported"}`,
      );
      await preserveProductionCaptureCleanup({ error: failure }, [
        { resource: "capture page", cleanup: () => page.close() },
      ]);
      throw failure;
    }
  })();
  session.pages.set(key, pending);
  void pending.catch(() => {
    if (session.pages.get(key) === pending) session.pages.delete(key);
  });
  return pending;
};

/**
 * Close the reusable viewer/browser session owned by one-shot CLI commands.
 *
 * The capture process deliberately keeps it open and reuses it until it
 * exits; preview and render call this in `finally` so they never hang.
 */
const closeProductionFrameCapture = async (
  state: ProductionFrameCaptureState,
  failure?: ProductionCaptureFailure,
): Promise<void> => {
  const pending = state.sessionPromise;
  state.sessionPromise = null;
  state.sessionIdentity = null;
  if (pending === null) return;
  let session: CaptureSession;
  try {
    session = await pending;
  } catch (error) {
    await preserveProductionCaptureCleanup(failure, [
      {
        resource: "capture session startup",
        cleanup: () => {
          throw error;
        },
      },
    ]);
    return;
  }
  await preserveProductionCaptureCleanup(failure, [
    { resource: "capture browser", cleanup: () => session.browser.close() },
    { resource: "capture server", cleanup: () => session.server.close() },
  ]);
};

/** Capture only the project-owned viewer and its fixed canvas. */
type IProductionFrameCaptureInput =
  Parameters<AutoMovieProductionFrameCapture>[0] & {
    /** Exact film-global frame when the render scheduler already owns it. */
    globalFrame?: number;
  };

const captureProductionFrame = async (
  state: ProductionFrameCaptureState,
  input: IProductionFrameCaptureInput,
): ReturnType<AutoMovieProductionFrameCapture> => {
  await installProductionDeliveryCrop(
    state,
    input.target.kind === "shot" ? (input.crop ?? null) : null,
  );
  const session = await captureSession(
    state,
    input.projectRoot,
    input.productionId,
  );
  const resident = await capturePage(state, session, input);
  const previous = resident.queue;
  let release = (): void => undefined;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  resident.queue = previous.then(() => turn);
  await previous;
  const captureStarted = process.hrtime.bigint();
  try {
    session.assertRuntimeCurrent();
    let renderEvidence: Pick<
      Awaited<ReturnType<AutoMovieProductionFrameCapture>>,
      "semanticMask" | "observation"
    >;
    try {
      ++state.metrics.seeks;
      await resident.page.evaluate(
        ({ time, pass, globalFrame }) =>
          window.__automovieCapture!.seek(time, pass, globalFrame),
        {
          time: input.time,
          pass: input.pass ?? "beauty",
          globalFrame:
            input.globalFrame ??
            (input.target.kind === "shot"
              ? productionDialogueFrameForShotTime(state.dialogue, {
                  shot: input.target.id,
                  time: input.time,
                })
              : null),
        },
      );
      renderEvidence = await resident.page.evaluate(() => {
        const hook = window.__automovieCapture!;
        const observation = hook.observe();
        const maskSidecar = hook.sidecar();
        const reason =
          "the selected capture page stages no compiled shot, so it has no shot render observation or semantic mask palette";
        const semanticMask =
          observation === null || maskSidecar === null
            ? { status: "not-run" as const, reason }
            : {
                status: "available" as const,
                value: {
                  version: 1 as const,
                  shot: observation.shot,
                  mask: JSON.parse(maskSidecar) as IAutoMovieSemanticMask,
                  coverage: observation.coverage,
                } satisfies IAutoMovieSemanticMaskEvidence,
              };
        return {
          observation:
            observation === null
              ? { status: "not-run" as const, reason }
              : { status: "available" as const, value: observation.observed },
          semanticMask,
        };
      });
    } catch (error) {
      throw new Error(
        `${
          error instanceof Error ? error.message : String(error)
        } Browser diagnostics: ${
          resident.diagnostics.join(" | ") || "none reported"
        }`,
      );
    }
    const bytes = await resident.page
      .locator("#view")
      .screenshot({ type: "png" });
    session.assertRuntimeCurrent();
    ++state.metrics.captures;
    return {
      bytes,
      dialogueRuntimeIdentity:
        input.target.kind === "shot"
          ? productionDialogueRuntimeIdentity(state.dialogue)
          : null,
      runtimeIdentity: { ...session.runtime, graphics: resident.graphics },
      width: input.width!,
      height: input.height!,
      ...renderEvidence,
    };
  } catch (error) {
    const key = capturePageKey(state, input);
    session.pages.delete(key);
    await preserveProductionCaptureCleanup({ error }, [
      { resource: "capture page", cleanup: () => resident.page.close() },
    ]);
    throw error;
  } finally {
    state.metrics.captureMilliseconds +=
      Number(process.hrtime.bigint() - captureStarted) / 1_000_000;
    release();
  }
};

const capturePageSubject = (
  input: Parameters<AutoMovieProductionFrameCapture>[0],
): unknown =>
  input.target.kind === "shot"
    ? input.target
    : {
        kind: input.target.kind,
        id: input.target.id,
        elevationDeg: input.target.elevationDeg,
        pose: input.target.pose,
        // A page framed on one part cannot serve the whole model, so the part
        // belongs in the identity that decides page reuse.
        part: input.target.part,
      };

const capturePageKey = (
  state: ProductionFrameCaptureState,
  input: Parameters<AutoMovieProductionFrameCapture>[0],
): string =>
  JSON.stringify({
    subject: capturePageSubject(input),
    productionId: input.productionId,
    compileFingerprint: input.compileFingerprint,
    // A page drawn under one delivery curve is not a page that can serve
    // another, so the curve belongs in the identity that decides page reuse.
    toneMapping: PRODUCTION_DELIVERY_TONE_MAPPING,
    dialogueRuntime: productionDialogueRuntimeIdentity(state.dialogue),
    deliveryCrop: input.target.kind === "shot" ? (input.crop ?? null) : null,
    width: input.width,
    height: input.height,
  });

/** Create an isolated capture session, viewer runtime, and metrics owner. */
export const createProductionFrameCaptureRuntime =
  (): IProductionFrameCaptureRuntime => {
    const state: ProductionFrameCaptureState = {
      dialogue: null,
      deliveryCrop: null,
      metrics: {
        pagesOpened: 0,
        navigations: 0,
        seeks: 0,
        captures: 0,
        captureMilliseconds: 0,
      },
      sessionIdentity: null,
      sessionPromise: null,
    };
    return {
      capture: (input) => captureProductionFrame(state, input),
      close: (failure) => closeProductionFrameCapture(state, failure),
      dialogue: () => cloneProductionDialogueRuntime(state.dialogue),
      deliveryCrop: () => cloneProductionDeliveryCrop(state.deliveryCrop),
      installDeliveryCrop: (crop) => installProductionDeliveryCrop(state, crop),
      installDialogue: async (runtime) => {
        const next = cloneProductionDialogueRuntime(runtime);
        if (
          productionDialogueRuntimeIdentity(state.dialogue) ===
          productionDialogueRuntimeIdentity(next)
        )
          return;
        await closeProductionFrameCapture(state);
        state.dialogue = next;
      },
      pageIdentity: (input) => capturePageKey(state, input),
      viewerRuntime: () => productionFrameViewerRuntime(state),
      metrics: () => productionFrameCaptureMetrics(state),
    };
  };

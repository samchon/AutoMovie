import type {
  AutoMovieProductionFrameCapture,
  IAutoMovieRenderSpec,
} from "@automovie/interface";
import path from "node:path";
import type { Page } from "playwright";
import { createServer } from "vite";

import config from "../automovie.config";
import {
  type IAutoMovieCaptureBrowserSession,
  inspectCaptureGraphics,
  launchCaptureBrowser,
} from "./capture-browser";
import { generatedShotPlugin } from "./generatedShotPlugin";

interface CaptureSession {
  server: Awaited<ReturnType<typeof createServer>>;
  browser: IAutoMovieCaptureBrowserSession["browser"];
  runtime: IAutoMovieCaptureBrowserSession["runtime"];
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
 * manifest, and `assertProductionDeliveryToneMapping` in `render.ts` re-reads a
 * committed manifest and refuses the render when the two have drifted, so the
 * mirror can never quietly outlive its original.
 */
export const PRODUCTION_DELIVERY_TONE_MAPPING: IAutoMovieRenderSpec["toneMapping"] =
  "none";

let sessionPromise: Promise<CaptureSession> | null = null;
let sessionIdentity: string | null = null;
let captureMetrics = {
  pagesOpened: 0,
  navigations: 0,
  seeks: 0,
  captures: 0,
  captureMilliseconds: 0,
};

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
  projectRoot: string,
  productionId: string,
): Promise<CaptureSession> => {
  const server = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [generatedShotPlugin(projectRoot, productionId)],
    resolve: { dedupe: ["three"] },
    server: { host: config.viewer.host, port: 0, strictPort: false },
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
    const launched = await launchCaptureBrowser(
      projectRoot,
      config.capture.browser,
    );
    return {
      server,
      browser: launched.browser,
      runtime: launched.runtime,
      origin: `http://${config.viewer.host}:${address.port}`,
      pages: new Map(),
    };
  } catch (error) {
    await preserveProductionCaptureCleanup({ error }, [
      { resource: "capture server", cleanup: () => server.close() },
    ]);
    throw error;
  }
};

const captureSession = async (
  projectRoot: string,
  productionId: string,
): Promise<CaptureSession> => {
  const root = path.resolve(projectRoot);
  const identity = `${root}\0${productionId}`;
  if (sessionPromise !== null && sessionIdentity === identity)
    return sessionPromise;
  await closeProductionFrameCapture();
  sessionIdentity = identity;
  captureMetrics = {
    pagesOpened: 0,
    navigations: 0,
    seeks: 0,
    captures: 0,
    captureMilliseconds: 0,
  };
  sessionPromise = startSession(root, productionId);
  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    sessionIdentity = null;
    throw error;
  }
};

/** Measured navigation/capture counts for the current reusable session. */
export const productionFrameCaptureMetrics = (): Readonly<
  typeof captureMetrics & {
    avoidedPageReloads: number;
    capturesPerNavigation: number;
    capturesPerSecond: number;
  }
> => ({
  ...captureMetrics,
  avoidedPageReloads: Math.max(
    0,
    captureMetrics.captures - captureMetrics.navigations,
  ),
  capturesPerNavigation:
    captureMetrics.navigations === 0
      ? 0
      : captureMetrics.captures / captureMetrics.navigations,
  capturesPerSecond:
    captureMetrics.captureMilliseconds === 0
      ? 0
      : captureMetrics.captures / (captureMetrics.captureMilliseconds / 1_000),
});

const capturePage = (
  session: CaptureSession,
  input: Parameters<AutoMovieProductionFrameCapture>[0],
): Promise<CapturePage> => {
  const subject = capturePageSubject(input);
  const key = capturePageKey(input);
  const existing = session.pages.get(key);
  if (existing !== undefined) return existing;
  const pending = (async (): Promise<CapturePage> => {
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
    ++captureMetrics.pagesOpened;
    const diagnostics: string[] = [];
    page.on("console", (message) =>
      diagnostics.push(`console:${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) =>
      diagnostics.push(`pageerror: ${error.message}`),
    );
    const url = new URL(config.viewer.basePath, session.origin);
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
    }
    try {
      ++captureMetrics.navigations;
      await page.goto(url.href, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () => window.__automovieCapture?.ready === true,
      );
      await page.locator("#status").evaluate((element) => {
        element.style.display = "none";
      });
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
 * The MCP host deliberately keeps it open and reuses it until its process
 * exits; preview and render call this in `finally` so they never hang.
 */
export const closeProductionFrameCapture = async (
  failure?: ProductionCaptureFailure,
): Promise<void> => {
  const pending = sessionPromise;
  sessionPromise = null;
  sessionIdentity = null;
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
export const captureProductionFrame: AutoMovieProductionFrameCapture = async (
  input,
) => {
  const session = await captureSession(input.projectRoot, input.productionId);
  const resident = await capturePage(session, input);
  const previous = resident.queue;
  let release = (): void => undefined;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  resident.queue = previous.then(() => turn);
  await previous;
  const captureStarted = process.hrtime.bigint();
  try {
    try {
      ++captureMetrics.seeks;
      await resident.page.evaluate(
        ({ time, pass }) => window.__automovieCapture!.seek(time, pass),
        { time: input.time, pass: input.pass ?? "beauty" },
      );
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
    ++captureMetrics.captures;
    return {
      bytes,
      runtimeIdentity: { ...session.runtime, graphics: resident.graphics },
      width: input.width!,
      height: input.height!,
    };
  } catch (error) {
    const key = capturePageKey(input);
    session.pages.delete(key);
    await preserveProductionCaptureCleanup({ error }, [
      { resource: "capture page", cleanup: () => resident.page.close() },
    ]);
    throw error;
  } finally {
    captureMetrics.captureMilliseconds +=
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
      };

const capturePageKey = (
  input: Parameters<AutoMovieProductionFrameCapture>[0],
): string =>
  JSON.stringify({
    subject: capturePageSubject(input),
    productionId: input.productionId,
    compileFingerprint: input.compileFingerprint,
    // A page drawn under one delivery curve is not a page that can serve
    // another, so the curve belongs in the identity that decides page reuse.
    toneMapping: PRODUCTION_DELIVERY_TONE_MAPPING,
    width: input.width,
    height: input.height,
  });

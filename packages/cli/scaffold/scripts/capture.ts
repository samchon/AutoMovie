import type { AutoMovieProductionFrameCapture } from "@automovie/interface";
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

let sessionPromise: Promise<CaptureSession> | null = null;
let sessionRoot: string | null = null;
let captureMetrics = {
  pagesOpened: 0,
  navigations: 0,
  seeks: 0,
  captures: 0,
};

const startSession = async (projectRoot: string): Promise<CaptureSession> => {
  const server = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [generatedShotPlugin(projectRoot, config.productionId)],
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
    await server.close();
    throw error;
  }
};

const captureSession = async (projectRoot: string): Promise<CaptureSession> => {
  const root = path.resolve(projectRoot);
  if (sessionPromise !== null && sessionRoot === root) return sessionPromise;
  await closeProductionFrameCapture();
  sessionRoot = root;
  captureMetrics = {
    pagesOpened: 0,
    navigations: 0,
    seeks: 0,
    captures: 0,
  };
  sessionPromise = startSession(root);
  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    sessionRoot = null;
    throw error;
  }
};

/** Measured navigation/capture counts for the current reusable session. */
export const productionFrameCaptureMetrics = (): Readonly<
  typeof captureMetrics & {
    avoidedPageReloads: number;
    capturesPerNavigation: number;
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
});

const capturePage = (
  session: CaptureSession,
  input: Parameters<AutoMovieProductionFrameCapture>[0],
): Promise<CapturePage> => {
  const key = JSON.stringify({
    target: input.target,
    width: input.width,
    height: input.height,
  });
  const existing = session.pages.get(key);
  if (existing !== undefined) return existing;
  const pending = (async (): Promise<CapturePage> => {
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
    url.searchParams.set("shot", input.target.id);
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
      await page.close();
      throw new Error(
        `${
          error instanceof Error ? error.message : String(error)
        } Browser diagnostics: ${diagnostics.join(" | ") || "none reported"}`,
      );
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
export const closeProductionFrameCapture = async (): Promise<void> => {
  const pending = sessionPromise;
  sessionPromise = null;
  sessionRoot = null;
  if (pending === null) return;
  try {
    const session = await pending;
    await Promise.allSettled([session.browser.close(), session.server.close()]);
  } catch {
    // A partially started session closes its Vite server inside startSession.
  }
};

/** Capture only the project-owned viewer and its fixed canvas. */
export const captureProductionFrame: AutoMovieProductionFrameCapture = async (
  input,
) => {
  const session = await captureSession(input.projectRoot);
  const resident = await capturePage(session, input);
  const previous = resident.queue;
  let release = (): void => undefined;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  resident.queue = previous.then(() => turn);
  await previous;
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
    const key = JSON.stringify({
      target: input.target,
      width: input.width,
      height: input.height,
    });
    session.pages.delete(key);
    await resident.page.close();
    throw error;
  } finally {
    release();
  }
};

import type { AutoMovieProductionFrameCapture } from "@automovie/interface";
import path from "node:path";
import { chromium } from "playwright-core";
import { createServer } from "vite";

import config from "../automovie.config";
import { generatedShotPlugin } from "./generatedShotPlugin";

interface CaptureSession {
  server: Awaited<ReturnType<typeof createServer>>;
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  origin: string;
}

let sessionPromise: Promise<CaptureSession> | null = null;
let sessionRoot: string | null = null;

const startSession = async (projectRoot: string): Promise<CaptureSession> => {
  const server = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [generatedShotPlugin(projectRoot)],
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
    const browser = await chromium
      .launch({
        channel: "chrome",
        headless: true,
        args: ["--use-angle=swiftshader"],
      })
      .catch((error: unknown) => {
        throw new Error(
          `AutoMovie capture currently requires a system Google Chrome installation because the scaffold uses playwright-core with channel "chrome". Install Chrome or configure a project-owned capture adapter. ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    return {
      server,
      browser,
      origin: `http://${config.viewer.host}:${address.port}`,
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
  sessionPromise = startSession(root);
  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    sessionRoot = null;
    throw error;
  }
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
  const page = await session.browser.newPage({
    viewport: { width: input.width!, height: input.height! },
    deviceScaleFactor: 1,
  });
  try {
    const browserDiagnostics: string[] = [];
    page.on("console", (message) =>
      browserDiagnostics.push(`console:${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) =>
      browserDiagnostics.push(`pageerror: ${error.message}`),
    );
    const url = new URL(config.viewer.basePath, session.origin);
    url.searchParams.set("shot", input.target.id);
    try {
      await page.goto(url.href, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () => window.__automovieCapture?.ready === true,
      );
      await page.evaluate(
        ({ time, pass }) => window.__automovieCapture!.seek(time, pass),
        { time: input.time, pass: input.pass ?? "beauty" },
      );
    } catch (error) {
      throw new Error(
        `${
          error instanceof Error ? error.message : String(error)
        } Browser diagnostics: ${
          browserDiagnostics.join(" | ") || "none reported"
        }`,
      );
    }
    await page.locator("#status").evaluate((element) => {
      element.style.display = "none";
    });
    const bytes = await page.locator("#view").screenshot({ type: "png" });
    const graphicsIdentity = await page.locator("#view").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (context === null)
        return {
          api: "unavailable",
          vendor: "unavailable",
          renderer: "unavailable",
        };
      const debug = context.getExtension("WEBGL_debug_renderer_info");
      return {
        api:
          typeof WebGL2RenderingContext !== "undefined" &&
          context instanceof WebGL2RenderingContext
            ? "webgl2"
            : "webgl",
        vendor: String(
          context.getParameter(debug?.UNMASKED_VENDOR_WEBGL ?? context.VENDOR),
        ),
        renderer: String(
          context.getParameter(
            debug?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER,
          ),
        ),
      };
    });
    return {
      bytes,
      rendererIdentity: JSON.stringify({
        browser: `chrome:${session.browser.version()}`,
        requestedBackend: "angle:swiftshader",
        graphics: graphicsIdentity,
        deviceScaleFactor: 1,
      }),
      width: input.width!,
      height: input.height!,
    };
  } finally {
    await page.close();
  }
};

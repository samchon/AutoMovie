import type { AutoMovieProductionFrameCapture } from "@automovie/interface";
import { chromium } from "playwright-core";
import { createServer } from "vite";

import { generatedShotPlugin } from "./generatedShotPlugin";

/** Capture only the project-owned viewer and its fixed canvas. */
export const captureProductionFrame: AutoMovieProductionFrameCapture = async (
  input,
) => {
  const server = await createServer({
    root: input.projectRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [generatedShotPlugin(input.projectRoot)],
    server: { host: "127.0.0.1", port: 0, strictPort: false },
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (
      address === null ||
      address === undefined ||
      typeof address === "string"
    )
      throw new Error("Vite did not expose a numeric local address.");
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({
      viewport: { width: input.width!, height: input.height! },
      deviceScaleFactor: 1,
    });
    const browserDiagnostics: string[] = [];
    page.on("console", (message) =>
      browserDiagnostics.push(`console:${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) =>
      browserDiagnostics.push(`pageerror: ${error.message}`),
    );
    const url = new URL("/viewer/", `http://127.0.0.1:${address.port}`);
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
    const bytes = await page.locator("#view").screenshot({ type: "png" });
    return {
      bytes,
      width: input.width!,
      height: input.height!,
    };
  } finally {
    await browser?.close();
    await server.close();
  }
};

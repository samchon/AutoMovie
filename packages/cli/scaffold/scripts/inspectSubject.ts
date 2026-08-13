import type { AutoMovieProductionSubjectInspection } from "@automovie/mcp";
import path from "node:path";
import type { Page } from "playwright";
import { createServer } from "vite";

import config from "../automovie.config";
import type { IAutoMovieInspectionImage } from "../viewer/src/inspection";
import {
  type IAutoMovieCaptureBrowserSession,
  inspectCaptureGraphics,
  launchCaptureBrowser,
  preserveCaptureBrowserCleanup,
} from "./capture-browser";
import { generatedShotPlugin } from "./generatedShotPlugin";

interface InspectionSession {
  server: Awaited<ReturnType<typeof createServer>>;
  browser: IAutoMovieCaptureBrowserSession["browser"];
  origin: string;
  pages: Map<string, Promise<InspectionPage>>;
}

interface InspectionPage {
  page: Page;
  diagnostics: string[];
}

let sessionPromise: Promise<InspectionSession> | null = null;
let sessionIdentity: string | null = null;

/**
 * Stand up the inspection viewer and its browser.
 *
 * It is a second server and a second browser beside the delivery capture
 * session on purpose, and not because sharing one would be hard. A delivery
 * capture page carries a renderer identity and a tone-mapping curve in its own
 * reuse key, and an inspection page carries neither; folding the two caches
 * together is how an inspection frame would eventually be served from a page a
 * delivery asked for, or the reverse. The session is built on first use, so a
 * host nobody asks for a subject never pays for it.
 */
const startSession = async (
  projectRoot: string,
  productionId: string,
): Promise<InspectionSession> => {
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
      origin: `http://${config.viewer.host}:${address.port}`,
      pages: new Map(),
    };
  } catch (error) {
    // Same discipline the delivery capture session keeps: a cleanup that fails
    // is reported beside the failure that caused it and never in place of it.
    await preserveCaptureBrowserCleanup({ error }, [
      { resource: "inspection server", cleanup: () => server.close() },
    ]);
    throw error;
  }
};

const inspectionSession = async (
  projectRoot: string,
  productionId: string,
): Promise<InspectionSession> => {
  const root = path.resolve(projectRoot);
  const identity = `${root}\0${productionId}`;
  if (sessionPromise !== null && sessionIdentity === identity)
    return sessionPromise;
  const previous = sessionPromise;
  sessionPromise = null;
  sessionIdentity = null;
  if (previous !== null) {
    const stale = await previous.catch(() => null);
    if (stale !== null)
      await preserveCaptureBrowserCleanup(undefined, [
        {
          resource: "inspection browser",
          cleanup: () => stale.browser.close(),
        },
        { resource: "inspection server", cleanup: () => stale.server.close() },
      ]);
  }
  sessionIdentity = identity;
  sessionPromise = startSession(root, productionId);
  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    sessionIdentity = null;
    throw error;
  }
};

/**
 * Everything that decides whether one open page can answer the next viewpoint.
 *
 * The compile fingerprint and the artifact revision are both in it. A sweep
 * whose source moved underneath it is a set of pictures of two different models
 * with nothing in the individual images saying so, and the MCP surface refuses
 * that sweep after the fact; keeping both in the key means the page never
 * serves the mixed frame in the first place.
 */
const pageKey = (
  input: Parameters<AutoMovieProductionSubjectInspection>[0],
): string =>
  JSON.stringify({
    productionId: input.productionId,
    compileFingerprint: input.compileFingerprint,
    revision: input.revision,
    shot: input.target.shot,
    subject: input.target.subject,
    width: input.width,
    height: input.height,
  });

const inspectionPage = (
  session: InspectionSession,
  input: Parameters<AutoMovieProductionSubjectInspection>[0],
): Promise<InspectionPage> => {
  const key = pageKey(input);
  const existing = session.pages.get(key);
  if (existing !== undefined) return existing;
  const pending = (async (): Promise<InspectionPage> => {
    const page = await session.browser.newPage({
      viewport: { width: input.width, height: input.height },
      deviceScaleFactor: 1,
    });
    const diagnostics: string[] = [];
    page.on("console", (message) =>
      diagnostics.push(`console:${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) =>
      diagnostics.push(`pageerror: ${error.message}`),
    );
    const url = new URL(
      "inspection.html",
      new URL(config.viewer.basePath, session.origin),
    );
    url.searchParams.set("shot", input.target.shot);
    url.searchParams.set("subject", input.target.subject);
    url.searchParams.set("revision", input.revision);
    try {
      await page.goto(url.href, { waitUntil: "networkidle" });
      await page.waitForFunction(
        () => window.__automovieInspect?.ready === true,
      );
      // Named on the way in rather than inferred from the picture afterwards.
      // The capture browser asks for ANGLE's SwiftShader backend on purpose, so
      // two machines inspecting one subject agree pixel for pixel; printing the
      // renderer is what keeps that a stated choice instead of an unnoticed
      // fallback whoever reads the frames has to guess at.
      const graphics = await inspectCaptureGraphics(page);
      process.stderr.write(
        `automovie inspect: ${input.target.shot}/${input.target.subject} ` +
          `${graphics.api} requested=${graphics.requestedBackend} ` +
          `vendor=${graphics.vendor} RENDERER=${graphics.renderer}\n`,
      );
      return { page, diagnostics };
    } catch (error) {
      const failure = new Error(
        `${error instanceof Error ? error.message : String(error)} Browser diagnostics: ${
          diagnostics.join(" | ") || "none reported"
        }`,
      );
      await preserveCaptureBrowserCleanup({ error: failure }, [
        { resource: "inspection page", cleanup: () => page.close() },
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
 * Draw one named subject from one inspection-owned pose.
 *
 * This is the host half of `inspectSubject`: without it the tool refuses with
 * `capture-host-unavailable`, which is honest and blind. The MCP surface owns
 * the viewpoint plan, the projection and where the bytes are published; this
 * adapter owns nothing but "stage that subject, aim there, hand back the
 * canvas". Every framing decision arrives in `pose` and none is taken here, so
 * an agent naming a subject through the tool and a reviewer opening
 * `viewer/subject.html` on the same subject are looking through one eye.
 *
 * Nothing it returns is delivery evidence. It produces no renderer identity, no
 * target fingerprint and no render bundle, and it writes no file; the surface
 * publishes the bytes under `.automovie/inspections`, outside the render root a
 * delivery review reads.
 */
export const inspectProductionSubject: AutoMovieProductionSubjectInspection =
  async (input) => {
    const session = await inspectionSession(
      input.projectRoot,
      input.productionId,
    );
    const resident = await inspectionPage(session, input);
    let drawn: IAutoMovieInspectionImage;
    try {
      drawn = await resident.page.evaluate(
        ({ pose, viewpoint }) =>
          window.__automovieInspect!.view(pose, viewpoint),
        { pose: input.pose, viewpoint: input.viewpoint },
      );
    } catch (error) {
      const failure = new Error(
        `${error instanceof Error ? error.message : String(error)} Browser diagnostics: ${
          resident.diagnostics.join(" | ") || "none reported"
        }`,
      );
      // A page that refused one viewpoint is not trusted with the next, so it
      // leaves the cache before the failure travels.
      session.pages.delete(pageKey(input));
      await preserveCaptureBrowserCleanup({ error: failure }, [
        { resource: "inspection page", cleanup: () => resident.page.close() },
      ]);
      throw failure;
    }
    const prefix = "data:image/png;base64,";
    if (drawn.dataUrl.startsWith(prefix) === false)
      throw new Error(
        `The inspection page returned "${drawn.dataUrl.slice(0, 32)}…" rather than a base64 PNG data URL.`,
      );
    return {
      bytes: new Uint8Array(
        Buffer.from(drawn.dataUrl.slice(prefix.length), "base64"),
      ),
      width: drawn.width,
      height: drawn.height,
    };
  };

import {
  type AutoMovieProductionSubjectInspection,
  canonicalAutoMovieCaptureRuntimeIdentity,
} from "@automovie/production";
import path from "node:path";
import type { Page } from "playwright";
import { createServer } from "vite";

import type { IAutoMovieInspectionAnswer } from "../viewer/src/inspection";
import {
  type IAutoMovieCaptureBrowserSession,
  inspectCaptureGraphics,
  launchCaptureBrowser,
  preserveCaptureBrowserCleanup,
} from "./capture-browser";
import { generatedShotPlugin } from "./generatedShotPlugin";
import {
  readAutoMovieHostCaptureBrowser,
  readAutoMovieHostViewerBasePath,
  readAutoMovieHostViewerHost,
} from "./hostBoundary";
import { pageKey, pageSubject } from "./inspectionPageKey";

interface InspectionSession {
  server: Awaited<ReturnType<typeof createServer>>;
  browser: IAutoMovieCaptureBrowserSession["browser"];
  runtime: IAutoMovieCaptureBrowserSession["runtime"];
  assertRuntimeCurrent: IAutoMovieCaptureBrowserSession["assertRuntimeCurrent"];
  origin: string;
  pages: Map<string, IInspectionPageEntry>;
}

/** One cached page, beside the shot identity that supersedes it. */
interface IInspectionPageEntry {
  shot: string;
  opening: Promise<InspectionPage>;
}

interface InspectionPage {
  page: Page;
  diagnostics: string[];
  graphics: Awaited<ReturnType<typeof inspectCaptureGraphics>>;
}

let sessionPromise: Promise<InspectionSession> | null = null;
let sessionIdentity: string | null = null;

/**
 * Stand up the inspection viewer and its browser.
 *
 * It is a second server and a second browser beside the delivery capture
 * session on purpose, and not because sharing one would be hard. A delivery
 * capture page carries a delivery target and tone-mapping curve in its reuse
 * key, while an inspection page carries a subject target and compile identity;
 * folding the two caches together is how an inspection frame would eventually
 * be served from a page a delivery asked for, or the reverse. Both report the
 * actual renderer identity of their separate session. The inspection session
 * is built on first use, so a host nobody asks for a subject never pays for it.
 */
const startSession = async (
  projectRoot: string,
  productionId: string,
): Promise<InspectionSession> => {
  const viewerHost = readAutoMovieHostViewerHost(process.env);
  const server = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [generatedShotPlugin(projectRoot, productionId)],
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
    const launched = await launchCaptureBrowser(
      projectRoot,
      readAutoMovieHostCaptureBrowser(process.env),
    );
    return {
      server,
      browser: launched.browser,
      runtime: launched.runtime,
      assertRuntimeCurrent: launched.assertRuntimeCurrent,
      origin: `http://${viewerHost}:${address.port}`,
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

const inspectionPage = (
  session: InspectionSession,
  input: Parameters<AutoMovieProductionSubjectInspection>[0],
): Promise<InspectionPage> => {
  const key = pageKey(input);
  const existing = session.pages.get(key);
  if (existing !== undefined) return existing.opening;
  const shot = pageSubject(input);
  const pending = (async (): Promise<InspectionPage> => {
    // A recompile gives one shot a second key, and the page opened under the
    // first can never be asked for a frame again: the fingerprint moved, so
    // every later request misses it. Left in the map it would hold a whole
    // staged scene open for the lifetime of the host, once per compile. The
    // delivery capture retires its superseded pages the same way, though it
    // recovers the subject by re-parsing its own key; carrying it beside the
    // entry keeps that identity from depending on how the key was spelled.
    for (const [candidateKey, candidate] of session.pages)
      if (candidateKey !== key && candidate.shot === shot) {
        session.pages.delete(candidateKey);
        const previous = await candidate.opening.catch(() => null);
        if (previous !== null) await previous.page.close();
      }
    session.assertRuntimeCurrent();
    const page = await session.browser.newPage({
      viewport: { width: input.width, height: input.height },
      deviceScaleFactor: 1,
    });
    session.assertRuntimeCurrent();
    const diagnostics: string[] = [];
    page.on("console", (message) =>
      diagnostics.push(`console:${message.type()}: ${message.text()}`),
    );
    page.on("pageerror", (error) =>
      diagnostics.push(`pageerror: ${error.message}`),
    );
    const url = new URL(
      "inspection.html",
      // The host boundary hands back a directory path, trailing slash and all,
      // which is what makes this join safe. The delivery capture navigates to
      // the base directly, so `/viewer` and `/viewer/` behave identically
      // there; this page is a SIBLING of that base, and URL resolution drops
      // the last segment of a base that does not end in one. Measured:
      // `/viewer` resolves to `/inspection.html`, which 404s and surfaces as
      // "the page never became ready" rather than as a host-input fault.
      new URL(readAutoMovieHostViewerBasePath(process.env), session.origin),
    );
    url.searchParams.set("shot", input.target.shot);
    url.searchParams.set("revision", input.revision);
    try {
      session.assertRuntimeCurrent();
      await page.goto(url.href, { waitUntil: "networkidle" });
      session.assertRuntimeCurrent();
      await page.waitForFunction(
        () => window.__automovieInspect?.ready === true,
      );
      session.assertRuntimeCurrent();
      // Named on the way in rather than inferred from the picture afterwards.
      // The capture browser asks for ANGLE's SwiftShader backend on purpose, so
      // two machines inspecting one subject agree pixel for pixel; printing the
      // renderer is what keeps that a stated choice instead of an unnoticed
      // fallback whoever reads the frames has to guess at.
      const graphics = await inspectCaptureGraphics(page);
      canonicalAutoMovieCaptureRuntimeIdentity({
        ...session.runtime,
        graphics,
      });
      session.assertRuntimeCurrent();
      process.stderr.write(
        `automovie inspect: ${input.target.shot}/${input.target.subject} ` +
          `${graphics.api} requested=${graphics.requestedBackend} ` +
          `vendor=${graphics.vendor} RENDERER=${graphics.renderer}\n`,
      );
      return { page, diagnostics, graphics };
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
  const entry = { shot, opening: pending };
  session.pages.set(key, entry);
  void pending.catch(() => {
    if (session.pages.get(key) === entry) session.pages.delete(key);
  });
  return pending;
};

/**
 * Draw one named subject from one inspection-owned pose.
 *
 * This is the host half of subject inspection: without it the inspection
 * service refuses with `capture-host-unavailable`, which is honest and blind.
 * The service owns the viewpoint plan, the projection and where the bytes are
 * published; this adapter owns nothing but "stage that subject, aim there, hand
 * back the canvas". Every framing decision arrives in `pose` and none is taken
 * here, so an author who passes this adapter to the inspection service and a
 * reviewer opening `viewer/subject.html` on the same subject are looking
 * through one eye.
 *
 * Nothing it returns is delivery evidence. It reports the exact browser and
 * graphics identity that made the pixels, but produces no target fingerprint
 * or render bundle and writes no file; the inspection service publishes the
 * bytes under `automovie/inspections`, outside the render root a delivery
 * review reads.
 */
export const inspectProductionSubject: AutoMovieProductionSubjectInspection =
  async (input) => {
    const session = await inspectionSession(
      input.projectRoot,
      input.productionId,
    );
    const resident = await inspectionPage(session, input);
    let answer: IAutoMovieInspectionAnswer;
    try {
      session.assertRuntimeCurrent();
      // Waited for on every viewpoint, not only when the page is opened. A
      // sweep is many draws through one resident page, and anything that
      // reloads it in between - an author saving a viewer source while the dev
      // server watches it - destroys the execution context and fails the next
      // draw with a navigation message that says nothing about subjects.
      // Measured: editing this page's module mid-sweep killed the third of
      // three viewpoints. Reopening the same URL rebuilds the same subject, and
      // a state that actually moved is still refused, because the surface
      // rechecks the compile fingerprint once the sweep ends.
      await resident.page.waitForFunction(
        () => window.__automovieInspect?.ready === true,
      );
      session.assertRuntimeCurrent();
      answer = await resident.page.evaluate(
        ({ pose, viewpoint, subject }) =>
          window.__automovieInspect!.view(pose, viewpoint, subject),
        {
          pose: input.pose,
          viewpoint: input.viewpoint,
          subject: input.target.subject,
        },
      );
      session.assertRuntimeCurrent();
    } catch (error) {
      const failure = new Error(
        `${error instanceof Error ? error.message : String(error)} Browser diagnostics: ${
          resident.diagnostics.join(" | ") || "none reported"
        }`,
      );
      // A page that FAILED one viewpoint is not trusted with the next, so it
      // leaves the cache before the failure travels. Reaching here means the
      // evaluate itself threw, which is the page losing its execution context
      // rather than the page having an opinion about the subject.
      session.pages.delete(pageKey(input));
      await preserveCaptureBrowserCleanup({ error: failure }, [
        { resource: "inspection page", cleanup: () => resident.page.close() },
      ]);
      throw failure;
    }
    // The page answered, so the page is working. A subject it cannot frame is a
    // fact about that subject and not about the staged scene behind it, and
    // discarding the page over one would rebuild the whole shot for the next
    // subject - the cost `#1956` was opened to remove. Measured on the
    // repository regression film: a sweep holding one page across 42 subjects and 252 draws
    // opened a second page as soon as one model-space subject was asked for,
    // and the prototype review obligation asks for a population that is
    // entirely model-space. So the page stays resident and the refusal travels
    // as the surface's unsupported-viewpoint answer instead.
    if (answer.refused !== null) return { refused: answer.refused };
    const drawn = answer.image;
    const prefix = "data:image/png;base64,";
    if (drawn.dataUrl.startsWith(prefix) === false)
      throw new Error(
        `The inspection page returned "${drawn.dataUrl.slice(0, 32)}…" rather than a base64 PNG data URL.`,
      );
    const graphics = await inspectCaptureGraphics(resident.page);
    const runtimeIdentity = { ...session.runtime, graphics };
    if (
      canonicalAutoMovieCaptureRuntimeIdentity(runtimeIdentity) !==
      canonicalAutoMovieCaptureRuntimeIdentity({
        ...session.runtime,
        graphics: resident.graphics,
      })
    )
      throw new Error(
        "The inspection page graphics identity changed during the subject draw. Reopen the inspection host and recapture the whole subject.",
      );
    session.assertRuntimeCurrent();
    return {
      bytes: new Uint8Array(
        Buffer.from(drawn.dataUrl.slice(prefix.length), "base64"),
      ),
      width: drawn.width,
      height: drawn.height,
      runtimeIdentity,
      assertRuntimeCurrent: session.assertRuntimeCurrent,
    };
  };

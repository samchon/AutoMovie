import { canonicalAutoMovieCaptureRuntimeIdentity } from "@automovie/production";
import { createHash } from "node:crypto";

import {
  inspectCaptureGraphics,
  inspectCurrentCaptureRuntimeClosure,
  launchCaptureBrowser,
} from "./capture-browser";
import { settleCaptureExecutableTouch } from "./captureExecutableSnapshot";
import { readAutoMovieHostCaptureBrowser } from "./hostBoundary";
import {
  loadResidentRuntimePackage,
  runRuntimePackageGeneration,
} from "./runtimePackageGeneration";

interface CaptureDoctorFailure {
  error: unknown;
}

/** Release one doctor resource without replacing an earlier failure. */
const preserveCleanupFailure = async (
  failure: CaptureDoctorFailure | undefined,
  resource: string,
  cleanup: () => unknown,
): Promise<void> => {
  try {
    await cleanup();
  } catch (cleanupError) {
    if (failure === undefined) throw cleanupError;
    throw new AggregateError(
      [failure.error, cleanupError],
      `${resource} cleanup failed after the capture doctor failed.`,
    );
  }
};

/**
 * How long the doctor lets ambient filesystem activity finish.
 *
 * Four acquisitions two seconds apart is six seconds of waiting at worst. The
 * activity being waited out is a scanner reading a browser that finished
 * extracting seconds ago, which ends on that order; anything still moving the
 * stamps after six seconds is not that, and the refusal says so and names a
 * different remedy. The bound stays small on purpose, because a diagnostic that
 * hangs is worse than one that refuses.
 */
const SETTLE_ATTEMPTS = 4;
const SETTLE_WAIT_MS = 2_000;

const pngGeneration = loadResidentRuntimePackage<typeof import("pngjs")>({
  packageName: "pngjs",
});

const browser = readAutoMovieHostCaptureBrowser(process.env);
const closure = inspectCurrentCaptureRuntimeClosure({
  projectRoot: process.cwd(),
  config: browser,
});
if (closure.status === "not-ready") throw new Error(closure.correction);
closure.assertCurrent();
const settled = await settleCaptureExecutableTouch({
  acquire: () => launchCaptureBrowser(process.cwd(), browser, closure),
  attempts: SETTLE_ATTEMPTS,
  waitMs: SETTLE_WAIT_MS,
});
const session = settled.value;
let browserFailure: CaptureDoctorFailure | undefined;
try {
  session.assertRuntimeCurrent();
  const page = await session.browser.newPage({
    viewport: { width: 16, height: 16 },
    deviceScaleFactor: session.runtime.mode.deviceScaleFactor,
  });
  let pageFailure: CaptureDoctorFailure | undefined;
  try {
    await page.setContent(
      '<canvas id="view" width="16" height="16"></canvas><script>const gl=document.querySelector("#view").getContext("webgl2")??document.querySelector("#view").getContext("webgl");if(gl){gl.clearColor(0.1,0.3,0.7,1);gl.clear(gl.COLOR_BUFFER_BIT)}</script>',
    );
    const graphics = await inspectCaptureGraphics(page);
    const bytes = await page.locator("#view").screenshot({ type: "png" });
    session.assertRuntimeCurrent();
    const png = await runRuntimePackageGeneration(pngGeneration, ({ PNG }) =>
      PNG.sync.read(bytes),
    );
    if (png.width !== 16 || png.height !== 16)
      throw new Error(
        `Capture doctor decoded ${png.width}x${png.height}; expected 16x16.`,
      );
    let visiblePixel = false;
    for (let index = 0; index < png.data.length; index += 4)
      if (
        png.data[index + 3]! > 0 &&
        (png.data[index]! > 0 ||
          png.data[index + 1]! > 0 ||
          png.data[index + 2]! > 0)
      ) {
        visiblePixel = true;
        break;
      }
    if (visiblePixel === false)
      throw new Error(
        "Capture doctor decoded only blank pixels. Inspect the WebGL backend/driver diagnostic before previewing.",
      );
    const runtimeIdentity = { ...session.runtime, graphics };
    const rendererIdentity =
      canonicalAutoMovieCaptureRuntimeIdentity(runtimeIdentity);
    session.assertRuntimeCurrent();
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "ready",
          // Reported on every run rather than only when it mattered, because a
          // uniform shape is what a reader can parse, and an acquisition that
          // had to wait is something the reader wants to know about their own
          // machine even though capture is ready.
          settled: { attempts: settled.attempts, waitedMs: settled.waitedMs },
          runtimeIdentity,
          rendererIdentity,
          screenshot: {
            width: png.width,
            height: png.height,
            digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
          },
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    pageFailure = { error };
    throw error;
  } finally {
    await preserveCleanupFailure(pageFailure, "capture doctor page", () =>
      page.close(),
    );
  }
} catch (error) {
  browserFailure = { error };
  throw error;
} finally {
  await preserveCleanupFailure(browserFailure, "capture doctor browser", () =>
    session.browser.close(),
  );
}

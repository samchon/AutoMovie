import { canonicalAutoMovieCaptureRuntimeIdentity } from "@automovie/mcp";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

import config from "../automovie.config";
import type { AutoMovieCaptureBrowserConfig } from "./capture-browser";
import {
  inspectCaptureGraphics,
  launchCaptureBrowser,
} from "./capture-browser";

const session = await launchCaptureBrowser(
  process.cwd(),
  config.capture.browser as AutoMovieCaptureBrowserConfig,
);
try {
  const page = await session.browser.newPage({
    viewport: { width: 16, height: 16 },
    deviceScaleFactor: session.runtime.mode.deviceScaleFactor,
  });
  try {
    await page.setContent(
      '<canvas id="view" width="16" height="16"></canvas><script>const gl=document.querySelector("#view").getContext("webgl2")??document.querySelector("#view").getContext("webgl");if(gl){gl.clearColor(0.1,0.3,0.7,1);gl.clear(gl.COLOR_BUFFER_BIT)}</script>',
    );
    const graphics = await inspectCaptureGraphics(page);
    const bytes = await page.locator("#view").screenshot({ type: "png" });
    const png = PNG.sync.read(bytes);
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
    process.stdout.write(
      `${JSON.stringify(
        {
          status: "ready",
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
  } finally {
    await page.close();
  }
} finally {
  await session.browser.close();
}

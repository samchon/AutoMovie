import type {
  AutoMovieGuidePass,
  IAutoMovieCompiledShotSource,
} from "@automovie/interface";
import { mountViewer } from "@automovie/viewer";

import { createCompiledShotRuntime } from "./shotRuntime";
import { viewerDocument } from "./viewerDocument";

const { canvas, status } = viewerDocument();
const parameters = new URLSearchParams(window.location.search);
// The delivery's own tone mapping, carried on the page URL so the capture and
// this viewer read one value rather than each deciding a curve.
const requestedTone = parameters.get("tone");
const deliveryTone =
  requestedTone === "acesFilmic" || requestedTone === "none"
    ? requestedTone
    : undefined;
const shotId = parameters.get("shot") ?? "opening";
const response = await fetch(
  `/__automovie/shots/${encodeURIComponent(shotId)}.json`,
);
if (response.ok === false)
  throw new Error(
    `Compiled shot "${shotId}" is unavailable (${response.status}). Run npm run compile.`,
  );
const runtime = await createCompiledShotRuntime(
  (await response.json()) as IAutoMovieCompiledShotSource,
  deliveryTone,
);
const mounted = mountViewer(canvas, runtime.scene, runtime.camera, () => true, {
  antialias: false,
  pixelRatio: 1,
  preserveDrawingBuffer: true,
});
mounted.renderer.setClearColor(0x11151b, 1);

const seek = (time: number, pass: AutoMovieGuidePass): void => {
  status.textContent = runtime.render(mounted.renderer, time, pass);
};
window.__automovieCapture = { ready: true, seek };
seek(0, "beauty");

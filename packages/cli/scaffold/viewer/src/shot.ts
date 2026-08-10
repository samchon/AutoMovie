import {
  autoMovieRenderSubjectOfCompiledShot,
  deriveAutoMovieSemanticMask,
  renderAutoMovieSemanticMaskSidecar,
} from "@automovie/engine";
import type {
  AutoMovieGuidePass,
  IAutoMovieCompiledShotSource,
} from "@automovie/interface";
import {
  attachAutoMovieSemanticMask,
  auditAutoMovieSemanticMaskScene,
  mountViewer,
  observeAutoMovieSceneRender,
} from "@automovie/viewer";

import { createCompiledShotRuntime } from "./shotRuntime";
import {
  type IAutoMovieShotObservation,
  viewerDocument,
} from "./viewerDocument";

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
const compiled = (await response.json()) as IAutoMovieCompiledShotSource;
const runtime = await createCompiledShotRuntime(compiled, deliveryTone);
// The palette is a pure function of the compiled artifact, so the page derives
// the same one the compiler's own evidence path derives, and the mask pass
// paints stable per-entity colours instead of a ramp keyed by scene order.
const mask = deriveAutoMovieSemanticMask(
  autoMovieRenderSubjectOfCompiledShot({ compiled }),
);
attachAutoMovieSemanticMask(runtime.scene, { design: compiled.scene, mask });
// Declared against drawn, once, because scene membership is structural: a
// water body, cloth panel or planting cluster the shot declared and the viewer
// never built is named here rather than discovered by whoever opens the pixels.
const unresolved = auditAutoMovieSemanticMaskScene({
  scene: runtime.scene,
  design: compiled.scene,
  mask,
});
const mounted = mountViewer(canvas, runtime.scene, runtime.camera, () => true, {
  antialias: false,
  pixelRatio: 1,
  preserveDrawingBuffer: true,
});
mounted.renderer.setClearColor(0x11151b, 1);

/** What the scene submitted for the frame the last seek drew. */
const observe = (): IAutoMovieShotObservation => ({
  shot: compiled.shot.id,
  observed: observeAutoMovieSceneRender(runtime.scene),
  unresolved,
});

const seek = (time: number, pass: AutoMovieGuidePass): void => {
  const drawn = runtime.render(mounted.renderer, time, pass);
  // The live viewer reads the frame through the SAME call the capture hook
  // answers with, so an operator watching this line and a render job reading
  // the hook are looking at one measurement of one scene.
  const { observed } = observe();
  status.textContent =
    `${drawn}  D${observed.drawCalls}/T${observed.triangles}/M${observed.materials}` +
    (unresolved.length === 0 ? "" : `  UNDRAWN ${unresolved.join(",")}`);
};
window.__automovieCapture = {
  ready: true,
  seek,
  observe,
  sidecar: () => renderAutoMovieSemanticMaskSidecar(mask),
};
seek(0, "beauty");

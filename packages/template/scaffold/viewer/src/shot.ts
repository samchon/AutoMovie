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
  observeAutoMovieRendererFrame,
} from "@automovie/viewer";

import type { IAutoMovieProductionViewerRuntime } from "../../scripts/productionRuntimeState";
import { createCompiledShotRuntime } from "./shotRuntime";
import {
  type IAutoMovieShotObservation,
  VIEWER_BACKGROUND,
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
const shotId = parameters.get("shot")?.trim();
if (shotId === undefined || shotId === "")
  throw new Error(
    "No shot was selected. Open this page with ?shot=<authored-shot-id>.",
  );
const response = await fetch(
  `/__automovie/shots/${encodeURIComponent(shotId)}.json`,
);
if (response.ok === false)
  throw new Error(
    `Compiled shot "${shotId}" is unavailable (${response.status}). Run npm run compile.`,
  );
const compiled = (await response.json()) as IAutoMovieCompiledShotSource;
const productionRuntimeResponse = await fetch(
  "/__automovie/production-runtime.json",
);
if (productionRuntimeResponse.ok === false)
  throw new Error(
    `Production runtime is unavailable (${productionRuntimeResponse.status}).`,
  );
const productionRuntime =
  (await productionRuntimeResponse.json()) as IAutoMovieProductionViewerRuntime;
const runtime = await createCompiledShotRuntime(compiled, deliveryTone, {
  dialogue: productionRuntime.dialogue,
  deliveryCrop: productionRuntime.deliveryCrop ?? undefined,
  liveWearableSoftBodies: productionRuntime.liveWearableSoftBodies,
  filmEffects: productionRuntime.filmEffects,
});
// The palette is a pure function of the compiled artifact, so the page derives
// the same one the compiler's own evidence path derives, and the mask pass
// paints stable per-entity colours instead of a ramp keyed by scene order.
const mask = deriveAutoMovieSemanticMask(
  autoMovieRenderSubjectOfCompiledShot({ compiled }),
);
attachAutoMovieSemanticMask(runtime.scene, { design: compiled.scene, mask });
// Declared against drawn, once, because scene membership is structural: a
// water body, cloth panel or planting cluster the shot declared and the viewer
// never built is named here rather than discovered by whoever opens the pixels,
// and the geometry the palette cannot name is counted rather than left to
// vanish into the mask's reserved background.
const coverage = auditAutoMovieSemanticMaskScene({
  scene: runtime.scene,
  design: compiled.scene,
  mask,
});
const mounted = mountViewer(canvas, runtime.scene, runtime.camera, () => true, {
  antialias: false,
  pixelRatio: 1,
  preserveDrawingBuffer: true,
});
mounted.renderer.setClearColor(VIEWER_BACKGROUND, 1);

let lastObservation: IAutoMovieShotObservation;

/** What the renderer submitted for the frame the last seek drew. */
const observe = (): IAutoMovieShotObservation => ({
  shot: compiled.shot.id,
  observed: lastObservation.observed,
  coverage,
});

const seek = (
  time: number,
  pass: AutoMovieGuidePass,
  globalFrame?: number | null,
): void => {
  const frame = observeAutoMovieRendererFrame(mounted.renderer, () =>
    runtime.render(
      mounted.renderer,
      time,
      pass,
      globalFrame ??
        uniqueFilmFrameForShotTime(productionRuntime.dialogue, shotId, time),
    ),
  );
  lastObservation = {
    shot: compiled.shot.id,
    observed: frame.observed,
    coverage,
  };
  // The live viewer reads the frame through the SAME call the capture hook
  // answers with, so an operator watching this line and a render job reading
  // the hook are looking at one measurement of one scene.
  const { observed } = lastObservation;
  status.textContent =
    `${frame.output}  D${observed.drawCalls}/T${observed.triangles}` +
    (coverage.unresolved.length === 0
      ? ""
      : `  UNDRAWN ${coverage.unresolved.join(",")}`) +
    (coverage.unaddressed === 0 ? "" : `  UNNAMED ${coverage.unaddressed}`);
};
window.__automovieCapture = {
  ready: true,
  seek,
  observe,
  sidecar: () => renderAutoMovieSemanticMaskSidecar(mask),
};
const requestedGlobalFrame = parameters.get("frame");
const initialGlobalFrame =
  requestedGlobalFrame === null ? null : Number(requestedGlobalFrame);
if (
  initialGlobalFrame !== null &&
  (Number.isSafeInteger(initialGlobalFrame) === false || initialGlobalFrame < 0)
)
  throw new Error(
    'Viewer query parameter "frame" must be a non-negative integer.',
  );
seek(0, "beauty", initialGlobalFrame);

/** Resolve a local review seek only when the edit contains one occurrence. */
function uniqueFilmFrameForShotTime(
  dialogue: IAutoMovieProductionViewerRuntime["dialogue"],
  shot: string,
  time: number,
): number | null {
  if (dialogue === null || Number.isFinite(time) === false || time < 0)
    return null;
  const sourceFrame = Math.floor(time * dialogue.fps);
  const candidates = dialogue.segments.filter(
    (segment) =>
      segment.shot === shot &&
      sourceFrame >= segment.sourceInFrame &&
      sourceFrame < segment.sourceOutFrame,
  );
  if (candidates.length !== 1) return null;
  const segment = candidates[0]!;
  return segment.startFrame + sourceFrame - segment.sourceInFrame;
}

import {
  autoMovieRenderSubjectOfCompiledShot,
  deriveAutoMovieSemanticMask,
  renderAutoMovieSemanticMaskSidecar,
} from "@automovie/engine";
import type {
  AutoMovieGuidePass,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
  IAutoMovieSemanticMask,
  IAutoMovieSemanticMaskCoverage,
} from "@automovie/interface";
import {
  type IAutoMovieProductionRenderLayer,
  productionRenderLayersForPass,
  sampleProductionRenderFrame,
} from "@automovie/production";
import {
  attachAutoMovieSemanticMask,
  auditAutoMovieSemanticMaskScene,
  mountViewer,
  observeAutoMovieRendererFrame,
  renderCrossDissolveFrames,
  renderFadeToBlackFrame,
  resolveAutoMovieFilmBeautyComposition,
} from "@automovie/viewer";
import type { WebGLRenderer } from "three";

import type { IAutoMovieProductionViewerRuntime } from "../../scripts/productionRuntimeState";
import {
  type IAutoMovieCompiledShotRuntime,
  createCompiledShotRuntime,
} from "./shotRuntime";
import {
  type IAutoMovieShotObservation,
  VIEWER_BACKGROUND,
  viewerDocument,
} from "./viewerDocument";

/** One film shot's runtime beside the palette and coverage derived with it. */
interface IFilmShot {
  runtime: IAutoMovieCompiledShotRuntime;
  mask: IAutoMovieSemanticMask;
  coverage: IAutoMovieSemanticMaskCoverage;
}

const { canvas, status } = viewerDocument();
// The delivery's own tone mapping, carried on the page URL so the capture and
// this viewer read one value instead of each deciding a curve.
const requestedTone = new URLSearchParams(window.location.search).get("tone");
const deliveryTone =
  requestedTone === "acesFilmic" || requestedTone === "none"
    ? requestedTone
    : undefined;
const timelineResponse = await fetch("/__automovie/film.json");
if (timelineResponse.ok === false)
  throw new Error(
    `Compiled film is unavailable (${timelineResponse.status}). Run npm run compile.`,
  );
const timeline = (await timelineResponse.json()) as IAutoMovieFilmTimeline;
const productionRuntimeResponse = await fetch(
  "/__automovie/production-runtime.json",
);
if (productionRuntimeResponse.ok === false)
  throw new Error(
    `Production runtime is unavailable (${productionRuntimeResponse.status}).`,
  );
const productionRuntime =
  (await productionRuntimeResponse.json()) as IAutoMovieProductionViewerRuntime;
const runtimes = new Map<string, IFilmShot>();
for (const shot of new Set(timeline.segments.map((segment) => segment.shot))) {
  const response = await fetch(
    `/__automovie/shots/${encodeURIComponent(shot)}.json`,
  );
  if (response.ok === false)
    throw new Error(
      `Compiled film shot "${shot}" is unavailable (${response.status}).`,
    );
  const compiled = (await response.json()) as IAutoMovieCompiledShotSource;
  const runtime = await createCompiledShotRuntime(compiled, deliveryTone, {
    dialogue: productionRuntime.dialogue,
    deliveryCrop: productionRuntime.deliveryCrop ?? undefined,
    liveWearableSoftBodies: productionRuntime.liveWearableSoftBodies,
    filmEffects: productionRuntime.filmEffects,
    filmEffectIdentity: productionRuntime.filmEffectIdentity,
  });
  // Each cut carries its own palette, because a colour is derived from the
  // entities of the shot that draws it; one film-wide palette would have to
  // repaint every shot whenever any other shot gained an entity.
  const mask = deriveAutoMovieSemanticMask(
    autoMovieRenderSubjectOfCompiledShot({ compiled }),
  );
  attachAutoMovieSemanticMask(runtime.scene, { design: compiled.scene, mask });
  runtimes.set(shot, {
    runtime,
    mask,
    coverage: auditAutoMovieSemanticMaskScene({
      scene: runtime.scene,
      design: compiled.scene,
      mask,
    }),
  });
}
const first = runtimes.values().next().value;
if (first === undefined) throw new Error("Compiled film has no playable shot.");
// The shot whose scene the last layer of the last frame was drawn from.
// `observe` and `sidecar` answer about that one: a film holds one scene per
// cut, and evidence read off a scene this frame never drew would be evidence
// about a different frame.
let drawnShot = first;
let lastObservation: IAutoMovieShotObservation;
let frozen = false;
const viewerRendererRef = {
  current: undefined as WebGLRenderer | undefined,
};
const mounted = mountViewer(
  canvas,
  first.runtime.scene,
  first.runtime.camera,
  (elapsed) => {
    if (frozen || viewerRendererRef.current === undefined) return true;
    renderFilm(elapsed % (timeline.totalFrames / timeline.fps), "beauty");
    return true;
  },
  {
    antialias: false,
    pixelRatio: 1,
    preserveDrawingBuffer: true,
  },
);
viewerRendererRef.current = mounted.renderer;
viewerRendererRef.current.setClearColor(VIEWER_BACKGROUND, 1);

const renderLayer = (
  layer: IAutoMovieProductionRenderLayer,
  pass: AutoMovieGuidePass,
  globalFrame: number,
): string => {
  const shot = runtimes.get(layer.shot);
  if (shot === undefined)
    throw new Error(`Film layer references unavailable shot "${layer.shot}".`);
  const renderer = viewerRendererRef.current;
  if (renderer === undefined) throw new Error("Film renderer is not mounted.");
  drawnShot = shot;
  shot.runtime.camera.aspect = canvas.width / canvas.height;
  shot.runtime.camera.updateProjectionMatrix();
  return shot.runtime.render(
    renderer,
    layer.sourceFrame / timeline.fps,
    pass,
    globalFrame,
  );
};

function renderFilm(time: number, pass: AutoMovieGuidePass): void {
  if (Number.isFinite(time) === false || time < 0)
    throw new Error("Film seek time must be finite and non-negative.");
  const frame = Math.floor(time * timeline.fps);
  if (frame >= timeline.totalFrames)
    throw new Error(
      `Film seek time ${time} resolves outside the ${timeline.totalFrames}-frame timeline.`,
    );
  const sample = sampleProductionRenderFrame(timeline, frame);
  const layers = productionRenderLayersForPass(sample, pass);
  const renderer = viewerRendererRef.current;
  if (renderer === undefined) throw new Error("Film renderer is not mounted.");
  const measured = observeAutoMovieRendererFrame(renderer, () => {
    if (pass !== "beauty") {
      if (layers.length !== 1)
        throw new Error(
          `Structural film pass "${pass}" requires one dominant layer, but received ${layers.length}.`,
        );
      renderLayer(layers[0]!, pass, sample.timelineFrame);
      return;
    }
    const composition = resolveAutoMovieFilmBeautyComposition(layers);
    if (composition.kind === "direct")
      renderLayer(composition.layer, pass, sample.timelineFrame);
    else if (composition.kind === "fade")
      renderFadeToBlackFrame(
        renderer,
        () => void renderLayer(composition.layer, pass, sample.timelineFrame),
        composition.weight,
      );
    else
      renderCrossDissolveFrames(
        renderer,
        () =>
          void renderLayer(composition.outgoing, pass, sample.timelineFrame),
        () =>
          void renderLayer(composition.incoming, pass, sample.timelineFrame),
        composition.alpha,
      );
  });
  lastObservation = {
    shot: drawnShot.runtime.id,
    observed: measured.observed,
    coverage: drawnShot.coverage,
  };
  status.textContent =
    `${timeline.id}  frame=${frame}/${timeline.totalFrames - 1}  ${pass}` +
    (drawnShot.coverage.unresolved.length === 0
      ? ""
      : `  UNDRAWN ${drawnShot.coverage.unresolved.join(",")}`) +
    (drawnShot.coverage.unaddressed === 0
      ? ""
      : `  UNNAMED ${drawnShot.coverage.unaddressed}`);
}

window.__automovieCapture = {
  ready: true,
  seek: (time, pass) => {
    frozen = true;
    renderFilm(time, pass);
  },
  observe: () => lastObservation,
  sidecar: () => renderAutoMovieSemanticMaskSidecar(drawnShot.mask),
};

// Last statement in the module, and that placement is load-bearing.
//
// Keep initial drawing after every callback and compositor declaration so the
// module cannot enter the capture-ready state before its first frame exists.
renderFilm(0, "beauty");

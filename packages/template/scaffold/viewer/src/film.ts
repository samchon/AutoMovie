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
  attachAutoMovieSemanticMask,
  auditAutoMovieSemanticMaskScene,
  mountViewer,
  observeAutoMovieRendererFrame,
  renderCrossDissolveFrames,
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

interface IFilmLayer {
  shot: string;
  sourceFrame: number;
  weight: number;
}

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
  layer: IFilmLayer,
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
  const frame = Math.min(
    timeline.totalFrames - 1,
    Math.floor(time * timeline.fps),
  );
  const layers = sampleFilmFrame(timeline, frame);
  const renderer = viewerRendererRef.current;
  if (renderer === undefined) throw new Error("Film renderer is not mounted.");
  const measured = observeAutoMovieRendererFrame(renderer, () => {
    if (pass !== "beauty" || layers.length === 1) {
      const dominant = layers.reduce((selected, candidate) =>
        candidate.weight >= selected.weight ? candidate : selected,
      );
      renderLayer(dominant, pass, frame);
    } else {
      const [outgoing, incoming] = layers as [IFilmLayer, IFilmLayer];
      renderCrossDissolveFrames(
        renderer,
        () => void renderLayer(outgoing, pass, frame),
        () => void renderLayer(incoming, pass, frame),
        incoming.weight,
      );
    }
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

const sampleFilmFrame = (
  source: IAutoMovieFilmTimeline,
  frame: number,
): IFilmLayer[] => {
  const active = source.segments
    .map((segment, index) => ({ segment, index }))
    .filter(
      ({ segment }) => segment.startFrame <= frame && frame < segment.endFrame,
    )
    .at(-1);
  if (active === undefined)
    throw new Error(`Film frame ${frame} has no compiler-owned segment.`);
  const offset = frame - active.segment.startFrame;
  const incoming: IFilmLayer = {
    shot: active.segment.shot,
    sourceFrame: active.segment.sourceInFrame + offset,
    weight: 1,
  };
  if (
    active.segment.transitionIn.kind === "dissolve" &&
    offset < active.segment.transitionIn.durationFrames
  ) {
    const outgoing = source.segments[active.index - 1];
    if (outgoing === undefined)
      throw new Error(
        `Film segment "${active.segment.shot}" dissolves without an outgoing shot.`,
      );
    const alpha = offset / active.segment.transitionIn.durationFrames;
    return [
      {
        shot: outgoing.shot,
        sourceFrame:
          outgoing.sourceOutFrame -
          active.segment.transitionIn.durationFrames +
          offset,
        weight: 1 - alpha,
      },
      { ...incoming, weight: alpha },
    ];
  }
  return [incoming];
};

// Last statement in the module, and that placement is load-bearing.
//
// `renderFilm` reaches `sampleFilmFrame`, which is a `const` and therefore in
// its temporal dead zone until its own declaration is evaluated. Drawing the
// first frame from anywhere above that line throws
// `ReferenceError: Cannot access 'sampleFilmFrame' before initialization`, and
// the page renders nothing at all; in every generated project, since each one
// inherits this file verbatim. The capture harness above only registers
// callbacks, so it is unaffected by where it sits; this call runs immediately,
// so it is not.
renderFilm(0, "beauty");

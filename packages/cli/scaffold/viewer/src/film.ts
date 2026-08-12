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
} from "@automovie/interface";
import {
  type IAutoMovieSemanticMaskCoverage,
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
  type IAutoMovieCaptureHook,
  type IAutoMovieShotObservation,
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

/** Build one cut's runtime and register it under its shot id. */
const loadShot = async (shot: string): Promise<IFilmShot> => {
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
    liveWearableSoftBodies: productionRuntime.liveWearableSoftBodies,
  });
  // Each cut carries its own palette, because a colour is derived from the
  // entities of the shot that draws it; one film-wide palette would have to
  // repaint every shot whenever any other shot gained an entity.
  const mask = deriveAutoMovieSemanticMask(
    autoMovieRenderSubjectOfCompiledShot({ compiled }),
  );
  attachAutoMovieSemanticMask(runtime.scene, { design: compiled.scene, mask });
  const value: IFilmShot = {
    runtime,
    mask,
    coverage: auditAutoMovieSemanticMaskScene({
      scene: runtime.scene,
      design: compiled.scene,
      mask,
    }),
  };
  runtimes.set(shot, value);
  return value;
};

// Cuts load in playback order, and only the first is awaited before the film
// starts. Building all of them up front costs a minute or more on a feature's
// worth of cuts, during which the page shows nothing and reads as hung; the
// opening cut alone appears in seconds. The rest stream in behind playback
// with an entire shot's duration of headroom each, so the loader stays far
// ahead of the playhead. `__automovieCapture.ready` still waits for all of
// them, because a capture that seeks into a cut this loop has not reached yet
// would photograph a held frame and file it as that cut's evidence.
const shotIds = [...new Set(timeline.segments.map((segment) => segment.shot))];
const firstShotId = shotIds[0];
if (firstShotId === undefined)
  throw new Error("Compiled film has no playable shot.");
const first = await loadShot(firstShotId);
// The shot whose scene the last layer of the last frame was drawn from.
// `observe` and `sidecar` answer about that one: a film holds one scene per
// cut, and evidence read off a scene this frame never drew would be evidence
// about a different frame.
let drawnShot = first;
let lastObservation: IAutoMovieShotObservation;
let frozen = false;
// The cut the playhead wants that has not streamed in yet, or null when the
// loader is ahead of playback. Reported in the status line so a held frame
// reads as buffering rather than as a film that stopped.
let buffering: string | null = null;
let loaded = false;
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
viewerRendererRef.current.setClearColor(0x11151b, 1);

const renderLayer = (
  layer: IFilmLayer,
  pass: AutoMovieGuidePass,
  globalFrame: number,
): string => {
  const shot = runtimes.get(layer.shot);
  // A cut the streaming loader has not reached yet leaves the last drawn frame
  // standing rather than throwing: the alternative kills the animation loop and
  // stops the film outright over a cut that is seconds away. Drawing nothing is
  // the honest hold — re-running the previous cut at this layer's source time
  // would advance a clock that belongs to a different shot. Capture never takes
  // this path, because `seek` refuses until every cut is loaded.
  if (shot === undefined) {
    buffering = layer.shot;
    return drawnShot.runtime.id;
  }
  buffering = null;
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
    (buffering === null ? "" : `  BUFFERING ${buffering}`) +
    (loaded ? "" : `  loading ${runtimes.size}/${shotIds.length} cuts`) +
    (drawnShot.coverage.unresolved.length === 0
      ? ""
      : `  UNDRAWN ${drawnShot.coverage.unresolved.join(",")}`) +
    (drawnShot.coverage.unaddressed === 0
      ? ""
      : `  UNNAMED ${drawnShot.coverage.unaddressed}`);
}

const capture: IAutoMovieCaptureHook = {
  ready: false,
  seek: (time, pass) => {
    // Refused rather than served from whatever has streamed in: a seek into an
    // unloaded cut would hold the previous frame, and a capture harness would
    // file that image as this cut's evidence. Harnesses already wait on
    // `ready`; this makes ignoring it loud instead of silently wrong.
    if (loaded === false)
      throw new Error(
        `Film seek requested before every cut loaded (${runtimes.size}/${shotIds.length}).`,
      );
    frozen = true;
    renderFilm(time, pass);
  },
  observe: () => lastObservation,
  sidecar: () => renderAutoMovieSemanticMaskSidecar(drawnShot.mask),
};
window.__automovieCapture = capture;
renderFilm(0, "beauty");

// Playback is already running on the opening cut; the rest arrive behind it.
for (const shot of shotIds.slice(1)) await loadShot(shot);
loaded = true;
capture.ready = true;

/**
 * Which compiled segments cover one film frame, and how much each weighs.
 *
 * A hoisted declaration rather than a `const` arrow, because `renderFilm(0,
 * "beauty")` above draws the opening frame during module evaluation and reaches
 * this from inside itself. `renderFilm` is hoisted and so it runs; a `const`
 * declared further down is still in its temporal dead zone when it does, and
 * the viewer died on "Cannot access 'sampleFilmFrame' before initialization"
 * with its status stuck on "loading current compiler output…". Nothing in the
 * page said which line, so the film simply never played.
 */
function sampleFilmFrame(
  source: IAutoMovieFilmTimeline,
  frame: number,
): IFilmLayer[] {
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
}

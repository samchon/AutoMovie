import type {
  AutoMovieGuidePass,
  IAutoMovieCompiledShotSource,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import { mountViewer, renderCrossDissolveFrames } from "@automovie/viewer";
import type { WebGLRenderer } from "three";

import {
  type IAutoMovieCompiledShotRuntime,
  createCompiledShotRuntime,
} from "./shotRuntime";
import { viewerDocument } from "./viewerDocument";

interface IFilmLayer {
  shot: string;
  sourceFrame: number;
  weight: number;
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
const runtimes = new Map<string, IAutoMovieCompiledShotRuntime>();
for (const shot of new Set(timeline.segments.map((segment) => segment.shot))) {
  const response = await fetch(
    `/__automovie/shots/${encodeURIComponent(shot)}.json`,
  );
  if (response.ok === false)
    throw new Error(
      `Compiled film shot "${shot}" is unavailable (${response.status}).`,
    );
  runtimes.set(
    shot,
    await createCompiledShotRuntime(
      (await response.json()) as IAutoMovieCompiledShotSource,
      deliveryTone,
    ),
  );
}
const first = runtimes.values().next().value;
if (first === undefined) throw new Error("Compiled film has no playable shot.");
let frozen = false;
const viewerRendererRef = {
  current: undefined as WebGLRenderer | undefined,
};
const mounted = mountViewer(
  canvas,
  first.scene,
  first.camera,
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

const renderLayer = (layer: IFilmLayer, pass: AutoMovieGuidePass): string => {
  const runtime = runtimes.get(layer.shot);
  if (runtime === undefined)
    throw new Error(`Film layer references unavailable shot "${layer.shot}".`);
  const renderer = viewerRendererRef.current;
  if (renderer === undefined) throw new Error("Film renderer is not mounted.");
  runtime.camera.aspect = canvas.width / canvas.height;
  runtime.camera.updateProjectionMatrix();
  return runtime.render(renderer, layer.sourceFrame / timeline.fps, pass);
};

function renderFilm(time: number, pass: AutoMovieGuidePass): void {
  if (Number.isFinite(time) === false || time < 0)
    throw new Error("Film seek time must be finite and non-negative.");
  const frame = Math.min(
    timeline.totalFrames - 1,
    Math.floor(time * timeline.fps),
  );
  const layers = sampleFilmFrame(timeline, frame);
  if (pass !== "beauty" || layers.length === 1) {
    const dominant = layers.reduce((selected, candidate) =>
      candidate.weight >= selected.weight ? candidate : selected,
    );
    renderLayer(dominant, pass);
  } else {
    const [outgoing, incoming] = layers as [IFilmLayer, IFilmLayer];
    const renderer = viewerRendererRef.current;
    if (renderer === undefined)
      throw new Error("Film renderer is not mounted.");
    renderCrossDissolveFrames(
      renderer,
      () => void renderLayer(outgoing, pass),
      () => void renderLayer(incoming, pass),
      incoming.weight,
    );
  }
  status.textContent = `${timeline.id}  frame=${frame}/${timeline.totalFrames - 1}  ${pass}`;
}

window.__automovieCapture = {
  ready: true,
  seek: (time, pass) => {
    frozen = true;
    renderFilm(time, pass);
  },
};
renderFilm(0, "beauty");

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

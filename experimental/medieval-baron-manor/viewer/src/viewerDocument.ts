import type {
  AutoMovieGuidePass,
  IAutoMovieRenderObservation,
  IAutoMovieSemanticMaskCoverage,
} from "@automovie/interface";

/** Neutral viewer chrome, not a production-owned lighting or art decision. */
export const VIEWER_BACKGROUND = 0x202020;

export interface IAutoMovieCaptureHook {
  ready: boolean;
  seek: (
    time: number,
    pass: AutoMovieGuidePass,
    globalFrame?: number | null,
  ) => void;

  /**
   * What the page has drawn, read from the renderer counters accumulated
   * across the last complete seek.
   *
   * The live viewer and the headless capture drive the SAME page through the
   * same hook, so "the viewer and the capture agree about the frame" stops
   * being an assurance and becomes one function reading one scene. `null` on a
   * page that stages no compiled shot, such as an asset turntable.
   */
  observe: () => IAutoMovieShotObservation | null;

  /**
   * The semantic-mask sidecar for the shot the page is drawing, exactly as it
   * must be written beside the pixels, or `null` when the page stages no
   * compiled shot.
   *
   * A `mask` frame is unreadable without it: the pass paints stable per-entity
   * colours, and this document is the only thing that says which entity each
   * colour was.
   */
  sidecar: () => string | null;
}

/** One page's live render evidence for the shot it currently draws. */
export interface IAutoMovieShotObservation {
  /** Compiled shot the numbers belong to. */
  shot: string;

  /** Renderer-confirmed submissions for the complete frame. */
  observed: IAutoMovieRenderObservation;

  /**
   * How completely the shot's palette and its built scene account for each
   * other.
   *
   * An empty `unresolved` is the only proof that what the production declared
   * is what it drew; a non-empty one names a pond, a curtain or a fern bed that
   * exists in the design and in no pixel. `unaddressed` is the other direction:
   * geometry the mask frame paints its reserved background because the palette
   * has no name for it.
   */
  coverage: IAutoMovieSemanticMaskCoverage;
}

declare global {
  interface Window {
    __automovieCapture?: IAutoMovieCaptureHook;
  }
}

export const viewerDocument = (): {
  canvas: HTMLCanvasElement;
  status: HTMLDivElement;
} => {
  const canvas = document.querySelector<HTMLCanvasElement>("#view");
  const status = document.querySelector<HTMLDivElement>("#status");
  if (canvas === null || status === null)
    throw new Error("The viewer document is missing #view or #status.");
  return { canvas, status };
};

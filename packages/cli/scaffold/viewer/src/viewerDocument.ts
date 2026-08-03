import type { AutoMovieGuidePass } from "@automovie/interface";

export interface IAutoMovieCaptureHook {
  ready: boolean;
  seek: (time: number, pass: AutoMovieGuidePass) => void;
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

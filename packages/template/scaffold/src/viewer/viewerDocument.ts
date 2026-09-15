/** Neutral viewer chrome, not a production-owned lighting or art decision. */
export const VIEWER_BACKGROUND = 0x202020;
/** Resolve the canvas and diagnostic text owned by the preview document. */
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

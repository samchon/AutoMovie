/** Hide stale frames while the source compiler refuses or replaces them. */
const notice = document.createElement("div");
notice.id = "live-compiler";
Object.assign(notice.style, {
  position: "fixed",
  inset: "12px 12px auto auto",
  maxWidth: "min(52em, 90vw)",
  maxHeight: "60vh",
  overflow: "auto",
  padding: "10px 14px",
  background: "#151a20",
  color: "#ffd479",
  font: "12px/1.45 monospace",
  whiteSpace: "pre-wrap",
  zIndex: "10000",
});
document.body.append(notice);
let initialGeneration: number | undefined;
let unavailable = false;

const observe = async (): Promise<void> => {
  const canvas = document.querySelector<HTMLCanvasElement>("#view");
  try {
    const response = await fetch("/__automovie/live-builder.json", {
      cache: "no-store",
    });
    if (response.ok === false)
      throw new Error("Viewer compiler is unavailable.");
    const state = (await response.json()) as {
      generation: number;
      phase: "compiling" | "ready" | "error";
      message: string;
    };
    initialGeneration ??= state.generation;
    if (state.phase === "ready") {
      if (unavailable || initialGeneration !== state.generation) {
        window.location.reload();
        return;
      }
      notice.textContent = state.message;
      if (canvas !== null) canvas.style.visibility = "visible";
    } else {
      unavailable = true;
      notice.textContent = state.message;
      if (canvas !== null) canvas.style.visibility = "hidden";
      if (window.__automovieCapture !== undefined)
        window.__automovieCapture.ready = false;
    }
  } catch (error) {
    unavailable = true;
    notice.textContent = error instanceof Error ? error.message : String(error);
    if (canvas !== null) canvas.style.visibility = "hidden";
    if (window.__automovieCapture !== undefined)
      window.__automovieCapture.ready = false;
  }
  window.setTimeout(() => void observe(), 500);
};
void observe();

export {};

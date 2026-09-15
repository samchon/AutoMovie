// The diagnostic shell remains available when authored source cannot compile.
// Every scene module is imported from the compiler's current emitted generation.
type SourcePreviewCompilerState = {
  generation: string;
  phase: "compiling" | "ready" | "error";
  message: string;
};
const canvas = document.querySelector("#view");
const status = document.querySelector("#status");
if (!(canvas instanceof HTMLCanvasElement) || status === null)
  throw new Error(
    "The source preview document is missing its canvas or status.",
  );

let loaded: string | undefined;
let disconnected = false;
const unavailable = (message: string): void => {
  canvas.style.visibility = "hidden";
  status.textContent = message;
  window.dispatchEvent(
    new CustomEvent("automovie:source-unavailable", { detail: message }),
  );
};
const observe = async (): Promise<void> => {
  try {
    const response = await fetch("/__automovie/source-preview.json", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Source compiler is unavailable.");
    const state: SourcePreviewCompilerState = await response.json();
    if (state.phase !== "ready") unavailable(state.message);
    else if (
      loaded !== undefined &&
      (loaded !== state.generation || disconnected)
    ) {
      window.location.reload();
      return;
    } else if (loaded === undefined) {
      loaded = state.generation;
      disconnected = false;
      const entry =
        "/src/viewer/preview.ts?automovie-source-generation=" +
        encodeURIComponent(loaded);
      void import(/* @vite-ignore */ entry).catch((error) =>
        unavailable(error instanceof Error ? error.message : String(error)),
      );
    }
  } catch (error) {
    disconnected = true;
    unavailable(error instanceof Error ? error.message : String(error));
  }
  window.setTimeout(() => void observe(), 500);
};
void observe();

export {};

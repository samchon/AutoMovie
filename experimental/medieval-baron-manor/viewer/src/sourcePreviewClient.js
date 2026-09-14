// The diagnostic shell remains available when authored source cannot compile.
// Every scene module is imported from the compiler's current emitted generation.
/**
 * @typedef {object} SourcePreviewCompilerState
 * @property {string} generation
 * @property {"compiling" | "ready" | "error"} phase
 * @property {string} message
 */
const canvas = document.querySelector("#view");
const status = document.querySelector("#status");
if (!(canvas instanceof HTMLCanvasElement) || status === null)
  throw new Error("The source preview document is missing its canvas or status.");

/** @type {string | undefined} */
let loaded;
let disconnected = false;
/** @param {string} message */
const unavailable = (message) => {
  canvas.style.visibility = "hidden";
  status.textContent = message;
  window.dispatchEvent(
    new CustomEvent("automovie:source-unavailable", { detail: message }),
  );
};
const observe = async () => {
  try {
    const response = await fetch("/__automovie/source-preview.json", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Source compiler is unavailable.");
    /** @type {SourcePreviewCompilerState} */
    const state = await response.json();
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
        "/viewer/src/preview.ts?automovie-source-generation=" +
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

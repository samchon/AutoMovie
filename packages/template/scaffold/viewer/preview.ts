import type { IAutoMovieSourcePreview } from "./src/sourcePreview";

/**
 * Import this production's source and build its scene through @automovie/viewer.
 * Return optional navigation items and apply(id) for the shared view selector.
 */
export const createPreview = (): IAutoMovieSourcePreview => {
  throw new Error(
    "Author viewer/preview.ts: export createPreview() returning { scene, camera, target? } built from your actual source modules.",
  );
};

import type { IAutoMovieSourcePreview } from "./src/sourcePreview";

/** Import this production's source and build its scene through @automovie/viewer. */
export const createPreview = (): IAutoMovieSourcePreview => {
  throw new Error(
    "Author viewer/preview.ts: export createPreview() returning { scene, camera, target? } built from your actual source modules.",
  );
};

import { createRequire } from "node:module";
import type { PNG } from "pngjs";

/** The subset of `pngjs` the picture probe reaches. */
interface IPngModule {
  PNG: typeof PNG;
}

const load = createRequire(__filename);
let png: IPngModule | undefined;

/**
 * The `pngjs` module, loaded on first use and kept.
 *
 * Deferring the load keeps a generated project's resident codec generation
 * meaningful: binding it has to happen before the decoder enters
 * `require.cache`, and importing this entry for another helper must not put it
 * there.
 */
export const residentPngJs = (): IPngModule =>
  (png ??= load("pngjs") as IPngModule);

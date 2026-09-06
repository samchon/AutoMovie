import type { BoxParser, DataStream, MP4BoxBuffer, createFile } from "mp4box";
import { createRequire } from "node:module";
import type { PNG } from "pngjs";

/**
 * The media codecs, loaded on first use instead of on import.
 *
 * A generated project seals each codec under a resident generation: it binds
 * the package's on-disk identity, then refuses a later transitive replacement
 * of any module in that closure. The seal has nothing to hold if the codec is
 * already in `require.cache` when the generation is bound, and importing this
 * package used to put it there -- five modules reached `pngjs` or `mp4box`
 * through a static top-level import, so `import "@automovie/production"` alone
 * loaded both.
 *
 * The fixture that guards this could not see it. It resolved `pngjs` from the
 * generated project while a source-linked `@automovie/production` resolved its
 * own from the repository, so the two named different files and the cache
 * lookup the assertion made could never be populated by the load it was
 * watching for. The check reported success and measured nothing until the
 * fixture started handing over the published shape a real user installs.
 *
 * Types stay statically imported: a type reference emits nothing, so it costs
 * no load and keeps every signature exactly where it was.
 */
const load = createRequire(__filename);

interface IMp4BoxModule {
  BoxParser: typeof BoxParser;
  DataStream: typeof DataStream;
  MP4BoxBuffer: typeof MP4BoxBuffer;
  createFile: typeof createFile;
}

interface IPngModule {
  PNG: typeof PNG;
}

let mp4: IMp4BoxModule | undefined;
let png: IPngModule | undefined;

/** The `mp4box` module, loaded once and kept. */
export const residentMp4Box = (): IMp4BoxModule =>
  (mp4 ??= load("mp4box") as IMp4BoxModule);

/** The `pngjs` module, loaded once and kept.
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-font-decoder-closure Fixes the resident decoder the media probes depend on so a host codec cannot silently change what a probe reads.
 */
export const residentPngJs = (): IPngModule =>
  (png ??= load("pngjs") as IPngModule);

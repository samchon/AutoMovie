import type { BoxParser, DataStream, MP4BoxBuffer, createFile } from "mp4box";
import { createRequire } from "node:module";

/** The subset of `mp4box` this entry's writers and parsers reach. */
interface IMp4BoxModule {
  BoxParser: typeof BoxParser;
  DataStream: typeof DataStream;
  MP4BoxBuffer: typeof MP4BoxBuffer;
  createFile: typeof createFile;
}

const load = createRequire(__filename);
let mp4: IMp4BoxModule | undefined;

/**
 * The `mp4box` module, loaded on first use and kept.
 *
 * A generated project seals each codec under a resident generation: it binds the
 * package's on-disk identity and then refuses a later transitive replacement of
 * any module in that closure. The seal has nothing to hold if the codec is
 * already in `require.cache` when the generation is bound, so importing this
 * entry must not load it. Types stay statically imported, because a type
 * reference emits nothing.
 */
export const residentMp4Box = (): IMp4BoxModule =>
  (mp4 ??= load("mp4box") as IMp4BoxModule);

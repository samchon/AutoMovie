import type { Movie, createFile } from "mp4box";

import { residentMp4Box } from "./residentMp4Box";

/**
 * Parse delivered MP4 bytes under the strict output gate.
 *
 * Admission requires a leading ISO file-type box whose declared size fits the
 * stream, a parsed movie header, and no parser error, and both delivered-media
 * probes run it before reading a track.
 *
 * This is deliberately not merged with `parseMp4`, which looks like the same
 * wrapper and is not: that one admits bytes whose fields its callers verify
 * afterwards, sample by sample, while this one refuses a stream that does not
 * announce itself as ISO base media before anything reads a track from it.
 */
export const parseProductionMp4Output = (
  bytes: Uint8Array,
): { file: ReturnType<typeof createFile>; movie: Movie } => {
  if (bytes.byteLength < 16)
    throw new Error("MP4 output is too short to contain a media track.");
  const header = Buffer.from(bytes);
  const ftypSize = header.readUInt32BE(0);
  if (
    header.toString("ascii", 4, 8) !== "ftyp" ||
    ftypSize < 16 ||
    ftypSize > bytes.byteLength ||
    header.toString("ascii", 8, 12).trim().length === 0
  )
    throw new Error(
      "MP4 output has no leading ISO base-media compatible brand box.",
    );
  const file = residentMp4Box().createFile();
  const errors: string[] = [];
  let ready: Movie | null = null;
  file.onError = (module, message) => {
    errors.push(`${module}: ${message}`);
  };
  file.onReady = (info) => {
    ready = info;
  };
  try {
    const copy = Uint8Array.from(bytes).buffer;
    file.appendBuffer(
      residentMp4Box().MP4BoxBuffer.fromArrayBuffer(copy, 0),
      true,
    );
    file.flush();
  } catch (error) {
    throw new Error(`MP4 parser rejected output: ${String(error)}`);
  }
  const movie = ready ?? file.getInfo();
  if (errors.length !== 0 || movie.hasMoov === false)
    throw new Error(
      errors.length === 0
        ? "MP4 output has no parsed movie metadata."
        : `MP4 parser rejected output: ${errors.join("; ")}`,
    );
  return { file, movie };
};

import type { Movie, createFile } from "mp4box";

import { residentMp4Box } from "./residentMp4Box";

/**
 * Parse MP4 bytes, collecting parser errors, and answer with the file and movie.
 *
 * Callers either probed the bytes already or verify the parsed fields themselves
 * afterwards, which is why this admits a stream the delivered-output gate would
 * refuse.
 *
 * This is deliberately not merged with `parseProductionMp4Output`: that one is
 * the strict delivery gate, and requiring its leading file-type box and parsed
 * movie header here would refuse inputs these writers legitimately compare
 * sample by sample before trusting anything about them.
 */
export const parseMp4 = (
  bytes: Uint8Array,
): { file: ReturnType<typeof createFile>; movie: Movie } => {
  const file = residentMp4Box().createFile();
  let movie: Movie | null = null;
  const errors: string[] = [];
  file.onReady = (value) => {
    movie = value;
  };
  file.onError = (module, message) => {
    errors.push(`${module}: ${message}`);
  };
  file.appendBuffer(
    residentMp4Box().MP4BoxBuffer.fromArrayBuffer(
      Uint8Array.from(bytes).buffer,
      0,
    ),
    true,
  );
  file.flush();
  if (errors.length !== 0)
    throw new Error(`MP4 parser rejected mux input: ${errors.join("; ")}`);
  return { file, movie: movie ?? file.getInfo() };
};

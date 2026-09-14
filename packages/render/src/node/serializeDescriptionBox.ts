import type { Box } from "mp4box";

import { residentMp4Box } from "./residentMp4Box";

/** Canonicalize a parsed sample-description box without parser object identity. */
export const serializeDescriptionBox = (box: Box): Uint8Array => {
  const stream = new (residentMp4Box().DataStream)();
  box.write(stream);
  return new Uint8Array(stream.buffer);
};

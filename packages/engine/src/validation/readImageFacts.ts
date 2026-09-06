import { IAutoMovieTextureImageFacts } from "./validateTextureAssets";

/**
 * What an image asset's own bytes say it is and how big it is.
 *
 * Container headers rather than a decoder: the gate needs the media type and
 * the two edge lengths, and paying a full decode for a 4k HDR to learn its
 * width would make compiling a building slower than rendering one. Every reader
 * here refuses on the first byte that contradicts the format instead of
 * guessing, because the whole point is to catch a `.png` that is really
 * something else.
 *
 * `null` means "these bytes are not one of the image containers automovie
 * samples", which is a finding, not an error to swallow: the caller reports it
 * against the material or scene that bound them.
 *
 * @evidence requirements/asset-authoring/validation.md#asset-surface-validation `readAutoMovieImageFacts` derives media type, width, and height from image bytes rather than a claimed filename.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-model-output-failures `readAutoMovieImageFacts` leaves unsupported or malformed containers unresolved so resource closure validation can reject the exact asset use.
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-image-video `readAutoMovieImageFacts` inspects PNG, JPEG, WebP, and Radiance headers to return the byte-proven image container and raster dimensions; video and richer color or timing facts remain outside this reader.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-image-video-inspection The bounded header inspection implements the Engine's image-format and extent subset and returns no fact for malformed or unsupported bytes.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-content-facts `readAutoMovieImageFacts` derives its observed format and dimensions from signatures and format headers rather than trusting a path suffix or manifest claim.
 * @evidence specifications/interchange-and-adoption/validation-and-quarantine.md#interchange-declared-observed-comparison The reader supplies the independent byte-observed facts consumed by the declaration comparison; it does not itself manage quarantine or response metadata.
 * @evidence requirements/asset-authoring/external-assets.md#asset-bounded-decoder `readAutoMovieImageFacts` performs bounded header inspection for four supported image containers and returns no fact for truncated, malformed, or unsupported bytes instead of fully decoding them.
 * @evidence specifications/asset-and-representation/model-geometry-and-surface-facts.md#asset-spec-surface-resource-closure The reader contributes the bounded byte-signature and raster-extent inspection used to close supported image resources without claiming archive or network acquisition.
 * @author Samchon
 */
export const readAutoMovieImageFacts = (
  bytes: Uint8Array | null | undefined,
): IAutoMovieTextureImageFacts | null => {
  if (bytes === null || bytes === undefined) return null;
  return readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes) ?? readHdr(bytes);
};

/** `\x89PNG\r\n\x1a\n`, then a 25-byte IHDR whose first two fields are the size. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const readPng = (bytes: Uint8Array): IAutoMovieTextureImageFacts | null => {
  if (bytes.length < 24) return null;
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null;
  if (ascii(bytes, 12, 4) !== "IHDR") return null;
  return {
    mediaType: "image/png",
    width: beUint32(bytes, 16),
    height: beUint32(bytes, 20),
  };
};

/**
 * The frame-header markers that carry a JPEG's dimensions.
 *
 * `0xC0`–`0xCF` are start-of-frame EXCEPT `0xC4` (Huffman tables), `0xC8` (a
 * reserved JPEG extension) and `0xCC` (arithmetic coding conditioning), which
 * are ordinary segments that happen to sit in the same range. Reading a size
 * out of one of those would report a table length as a pixel count.
 */
const SOF_MARKERS: ReadonlySet<number> = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const readJpeg = (bytes: Uint8Array): IAutoMovieTextureImageFacts | null => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let cursor = 2;
  let restartInterval = 0;
  while (cursor + 1 < bytes.length) {
    if (bytes[cursor] !== 0xff) return null;
    // A marker may be preceded by any number of 0xFF fill bytes.
    let marker = bytes[cursor + 1]!;
    while (marker === 0xff) {
      cursor += 1;
      if (cursor + 1 >= bytes.length) return null;
      marker = bytes[cursor + 1]!;
    }
    cursor += 2;
    // Standalone markers carry no length word: restart, TEM, and a second SOI.
    if (marker >= 0xd0 && marker <= 0xd7) {
      if (restartInterval === 0) return null;
      continue;
    }
    if (marker === 0x01 || marker === 0xd8) continue;
    if (cursor + 1 >= bytes.length) return null;
    const length = beUint16(bytes, cursor);
    if (length < 2) return null;
    if (marker === 0xdd) {
      if (length !== 4 || cursor + length > bytes.length) return null;
      restartInterval = beUint16(bytes, cursor + 2);
    }
    if (SOF_MARKERS.has(marker)) {
      if (cursor + 6 >= bytes.length) return null;
      return {
        mediaType: "image/jpeg",
        height: beUint16(bytes, cursor + 3),
        width: beUint16(bytes, cursor + 5),
      };
    }
    cursor += length;
  }
  return null;
};

/**
 * RIFF/WEBP, in its three body forms.
 *
 * `VP8 ` is the lossy bitstream (14-bit dimensions after the keyframe start
 * code), `VP8L` the lossless one (two packed 14-bit fields, stored one less
 * than the true size), and `VP8X` the extended header an animated or
 * alpha-carrying file leads with (two 24-bit canvas fields, also one less).
 */
const readWebp = (bytes: Uint8Array): IAutoMovieTextureImageFacts | null => {
  if (bytes.length < 30) return null;
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP")
    return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8 ") {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a)
      return null;
    return {
      mediaType: "image/webp",
      width: leUint16(bytes, 26) & 0x3fff,
      height: leUint16(bytes, 28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const packed =
      bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    return {
      mediaType: "image/webp",
      width: (packed & 0x3fff) + 1,
      height: ((packed >>> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8X")
    return {
      mediaType: "image/webp",
      width: leUint24(bytes, 24) + 1,
      height: leUint24(bytes, 27) + 1,
    };
  return null;
};

/**
 * Radiance RGBE, the HDR container an environment map arrives in.
 *
 * The header is ASCII lines terminated by an empty one, followed by a single
 * resolution line. Only the standard `-Y rows +X columns` orientation is
 * accepted: the other seven flip or transpose the scanline order, and an
 * environment sampled with its rows reversed is a lighting bug that would show
 * up as an inexplicably mirrored reflection rather than as a load failure.
 */
const readHdr = (bytes: Uint8Array): IAutoMovieTextureImageFacts | null => {
  const head = ascii(bytes, 0, Math.min(bytes.length, 512));
  if (!head.startsWith("#?RADIANCE\n") && !head.startsWith("#?RGBE\n"))
    return null;
  const lines = head.split("\n");
  const blank = lines.indexOf("", 1);
  if (blank < 0) return null;
  const resolution = lines[blank + 1];
  if (resolution === undefined) return null;
  const parsed = /^-Y (\d+) \+X (\d+)$/.exec(resolution);
  if (parsed === null) return null;
  return {
    mediaType: "image/vnd.radiance",
    width: Number.parseInt(parsed[2]!, 10),
    height: Number.parseInt(parsed[1]!, 10),
  };
};

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

const beUint32 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! * 0x1000000 +
  (bytes[offset + 1]! << 16) +
  (bytes[offset + 2]! << 8) +
  bytes[offset + 3]!;

const beUint16 = (bytes: Uint8Array, offset: number): number =>
  (bytes[offset]! << 8) | bytes[offset + 1]!;

const leUint16 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! | (bytes[offset + 1]! << 8);

const leUint24 = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);

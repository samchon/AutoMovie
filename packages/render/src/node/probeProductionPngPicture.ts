import type {
  AutoMovieProductionPngColor,
  IAutoMovieProductionPngPicture,
} from "@automovie/interface";

import { residentPngJs } from "./residentPngJs";

/**
 * Decode one PNG and preserve its IHDR, color, alpha, aspect, and orientation facts.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Reads color meaning from published bytes instead of a filename or browser default.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Carries parser-observed picture facts into the fieldwise delivery comparison.
 */
export const probeProductionPngPicture = (
  bytes: Uint8Array,
): IAutoMovieProductionPngPicture => {
  // The chunk walk names every PNG datastream refusal before the decoder can
  // answer a foreign byte stream with its own unnamed signature error. The
  // decoder then owns the IHDR facts: it refuses a datastream whose first chunk
  // is not the 13-byte IHDR, an interlace method other than none or Adam7, and
  // a color type outside the five the format defines.
  const chunks = parsePngChunks(bytes);
  residentPngJs().PNG.sync.read(Buffer.from(bytes));
  const header = chunks[0]!.data;
  const width = readUint32(header, 0);
  const height = readUint32(header, 4);
  const bitDepth = header[8]!;
  const colorType = header[9]!;
  const interlace = header[12]!;
  const color = PNG_COLOR_MODELS[colorType]!;
  const srgb = uniquePngChunk(chunks, "sRGB");
  const gamma = uniquePngChunk(chunks, "gAMA");
  const icc = uniquePngChunk(chunks, "iCCP");
  const physical = uniquePngChunk(chunks, "pHYs");
  const exif = uniquePngChunk(chunks, "eXIf");
  if (srgb !== undefined && srgb.data.length !== 1)
    throw new Error("PNG sRGB chunk must contain one rendering-intent byte.");
  if (srgb !== undefined && srgb.data[0]! > 3)
    throw new Error(
      "PNG sRGB rendering intent must be between zero and three.",
    );
  if (gamma !== undefined && gamma.data.length !== 4)
    throw new Error("PNG gAMA chunk must contain one unsigned gamma integer.");
  const gammaValue = gamma === undefined ? null : readUint32(gamma.data, 0);
  if (srgb !== undefined && gammaValue !== null && gammaValue !== 45_455)
    throw new Error(
      `PNG sRGB and gAMA chunks conflict: sRGB requires gAMA 45455, not ${gammaValue}.`,
    );
  if (srgb !== undefined && icc !== undefined)
    throw new Error(
      "PNG sRGB and iCCP color declarations are mutually exclusive.",
    );
  const colorSpace: IAutoMovieProductionPngPicture["colorSpace"] =
    srgb !== undefined
      ? "srgb"
      : icc !== undefined
        ? (pngProfileName(icc.data), "icc")
        : gammaValue === 45_455
          ? "srgb"
          : gammaValue !== null
            ? "gamma"
            : "unidentified";
  return {
    width,
    height,
    bitDepth,
    color,
    alpha: colorType === 4 || colorType === 6 ? "straight" : "none",
    interlace: interlace === 0 ? "none" : "adam7",
    colorSpace,
    pixelAspect: pngPixelAspect(physical?.data),
    orientation: exif === undefined ? "upright" : "metadata-present",
  };
};

interface IPngChunk {
  type: string;
  data: Uint8Array;
}

const parsePngChunks = (bytes: Uint8Array): IPngChunk[] => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < signature.length ||
    signature.some((value, index) => bytes[index] !== value)
  )
    throw new Error("PNG datastream lacks the required signature.");
  const chunks: IPngChunk[] = [];
  let cursor = 8;
  while (cursor < bytes.length) {
    if (cursor + 12 > bytes.length)
      throw new Error("PNG datastream ends inside a chunk header.");
    const length = readUint32(bytes, cursor);
    const end = cursor + 12 + length;
    if (end > bytes.length)
      throw new Error("PNG datastream ends inside a declared chunk payload.");
    const type = Buffer.from(bytes.subarray(cursor + 4, cursor + 8)).toString(
      "ascii",
    );
    if (/^[A-Za-z]{4}$/.test(type) === false)
      throw new Error(`PNG chunk type "${type}" is not four ASCII letters.`);
    chunks.push({
      type,
      data: bytes.subarray(cursor + 8, cursor + 8 + length),
    });
    cursor = end;
    if (type === "IEND") break;
  }
  if (chunks.at(-1)?.type !== "IEND" || cursor !== bytes.length)
    throw new Error("PNG datastream does not end at one terminal IEND chunk.");
  return chunks;
};

const uniquePngChunk = (
  chunks: readonly IPngChunk[],
  type: string,
): IPngChunk | undefined => {
  const selected = chunks.filter((chunk) => chunk.type === type);
  if (selected.length > 1)
    throw new Error(
      `PNG datastream contains ${selected.length} ${type} chunks.`,
    );
  return selected[0];
};

/** The five IHDR color types the format defines; the decoder admits no other. */
const PNG_COLOR_MODELS: Readonly<Record<number, AutoMovieProductionPngColor>> =
  {
    0: "gray",
    2: "rgb",
    3: "palette",
    4: "gray-alpha",
    6: "rgba",
  };

const pngPixelAspect = (
  data: Uint8Array | undefined,
): IAutoMovieProductionPngPicture["pixelAspect"] => {
  if (data === undefined) return { kind: "square" };
  if (data.length !== 9)
    throw new Error("PNG pHYs chunk must contain nine bytes.");
  const x = readUint32(data, 0);
  const y = readUint32(data, 4);
  if (x === 0 || y === 0)
    throw new Error("PNG pHYs density terms must both be positive.");
  const unit = data[8]!;
  if (unit !== 0 && unit !== 1)
    throw new Error("PNG pHYs unit specifier must be zero or one.");
  return { kind: "explicit", x, y, unit };
};

const pngProfileName = (data: Uint8Array): string => {
  const separator = data.indexOf(0);
  if (
    separator <= 0 ||
    separator > 79 ||
    separator + 2 > data.length ||
    data[separator + 1] !== 0
  )
    throw new Error(
      "PNG iCCP chunk has an invalid profile name or compression method.",
    );
  return Buffer.from(data.subarray(0, separator)).toString("latin1");
};

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    offset,
    false,
  );

import type {
  AutoMovieProductionPngColor,
  IAutoMovieProductionPngPicture,
} from "@automovie/interface";

import { residentPngJs } from "./residentCodecs";

/** Stable role that gives a renderer-owned PNG its planned picture profile. */
export type AutoMovieProductionPngRole =
  | "preview"
  | "guide-frame"
  | "waveform"
  | "spectrogram";

/** Exact role profile that the current deterministic PNG writers support. */
export interface IAutoMovieProductionPngProfile {
  /** Profile schema version. */
  version: 1;
  /** Renderer-owned role the PNG is written for. */
  role: AutoMovieProductionPngRole;
  /** Stored pixel width. */
  width: number;
  /** Stored pixel height. */
  height: number;
  /** Bits per channel every writer emits. */
  bitDepth: 8;
  /** Channel layout every writer emits. */
  color: "rgba";
  /** Alpha convention of the stored pixels. */
  alpha: "straight";
  /** Interlace method; the writers never interlace. */
  interlace: "none";
  /** Color space the pixels are display-referred in. */
  colorSpace: "srgb";
  /** Pixel aspect; the writers emit square pixels only. */
  pixelAspect: "square";
  /** Stored orientation; the writers never rotate. */
  orientation: "upright";
}

/**
 * Resolve one output role to the exact PNG profile its writer must emit.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-alpha-channels Keeps channel population and alpha relation explicit for every delivered PNG role.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Implements the versioned planned picture profile compared with decoded bytes.
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-dimensions-window Declares stored dimensions, pixel aspect and orientation for each PNG role so a reader never has to guess a window.
 */
export const resolveProductionPngProfile = (props: {
  role: AutoMovieProductionPngRole;
  width?: number;
  height?: number;
}): IAutoMovieProductionPngProfile => {
  const fixed =
    props.role === "waveform"
      ? { width: 960, height: 240 }
      : props.role === "spectrogram"
        ? { width: 512, height: 192 }
        : { width: props.width, height: props.height };
  if (
    Number.isSafeInteger(fixed.width) === false ||
    fixed.width! <= 0 ||
    Number.isSafeInteger(fixed.height) === false ||
    fixed.height! <= 0
  )
    throw new Error(
      `PNG role "${props.role}" requires a positive safe-integer raster.`,
    );
  return {
    version: 1,
    role: props.role,
    width: fixed.width!,
    height: fixed.height!,
    bitDepth: 8,
    color: "rgba",
    alpha: "straight",
    interlace: "none",
    colorSpace: "srgb",
    pixelAspect: "square",
    orientation: "upright",
  };
};

/**
 * Decode one PNG and preserve its IHDR, color, alpha, aspect, and orientation facts.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-color-sequences Reads color meaning from published bytes instead of a filename or browser default.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Carries parser-observed picture facts into the fieldwise delivery comparison.
 */
export const probeProductionPngPicture = (
  bytes: Uint8Array,
): IAutoMovieProductionPngPicture => {
  residentPngJs().PNG.sync.read(Buffer.from(bytes));
  const chunks = parsePngChunks(bytes);
  if (chunks[0]?.type !== "IHDR" || chunks[0].data.length !== 13)
    throw new Error("PNG datastream lacks one leading 13-byte IHDR chunk.");
  const header = chunks[0].data;
  const width = readUint32(header, 0);
  const height = readUint32(header, 4);
  const bitDepth = header[8]!;
  const colorType = header[9]!;
  const interlace = header[12]!;
  const color = pngColorModel(colorType);
  if (interlace !== 0 && interlace !== 1)
    throw new Error(
      `PNG IHDR carries unsupported interlace method ${interlace}.`,
    );
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

/**
 * Refuse every difference between a role profile and parser-observed PNG facts.
 *
 * @evidence requirements/delivery-and-accessibility/picture-color-and-image-sequences.md#delivery-picture-refusal Rejects unknown, contradictory, or role-incompatible picture facts even when the byte digest is current.
 * @evidence specifications/editorial-render-and-delivery/delivery-profiles-time-and-picture.md#spec-delivery-picture-products Implements the shared fieldwise PNG profile verdict used by publication and reopen paths.
 */
export const assertProductionPngPicture = (props: {
  profile: IAutoMovieProductionPngProfile;
  actual: IAutoMovieProductionPngPicture;
}): void => {
  const expected = props.profile;
  const actual = props.actual;
  const entries: Array<[string, unknown, unknown]> = [
    ["width", expected.width, actual.width],
    ["height", expected.height, actual.height],
    ["bitDepth", expected.bitDepth, actual.bitDepth],
    ["color", expected.color, actual.color],
    ["alpha", expected.alpha, actual.alpha],
    ["interlace", expected.interlace, actual.interlace],
    ["colorSpace", expected.colorSpace, actual.colorSpace],
    ["orientation", expected.orientation, actual.orientation],
  ];
  if (
    actual.pixelAspect.kind === "explicit" &&
    actual.pixelAspect.x !== actual.pixelAspect.y
  )
    entries.push([
      "pixelAspect",
      expected.pixelAspect,
      `${actual.pixelAspect.x}:${actual.pixelAspect.y}`,
    ]);
  const mismatch = entries.find(([, wanted, observed]) => wanted !== observed);
  if (mismatch !== undefined)
    throw new Error(
      `PNG ${expected.role} profile mismatch at ${mismatch[0]}: expected ${String(mismatch[1])}, observed ${String(mismatch[2])}.`,
    );
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

const pngColorModel = (colorType: number): AutoMovieProductionPngColor => {
  if (colorType === 0) return "gray";
  if (colorType === 2) return "rgb";
  if (colorType === 3) return "palette";
  if (colorType === 4) return "gray-alpha";
  if (colorType === 6) return "rgba";
  throw new Error(`PNG IHDR carries unsupported color type ${colorType}.`);
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

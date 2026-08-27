import {
  AutoMovieContentDigest,
  AutoMovieDesignReferenceMedia,
} from "@automovie/interface";

import { digestAutoMovieBytes } from "./contentIdentity";

/**
 * Every container this inspector recognizes, named in each refusal so a
 * rejected reference says what to register instead of only what it is not.
 */
const SUPPORTED_DESIGN_REFERENCES =
  'Supported design references are PNG ("image/png"), JPEG ("image/jpeg"), SVG ("image/svg+xml"), PDF ("application/pdf") and DXF ("image/vnd.dxf") bytes.';

/** The eight bytes every PNG datastream begins with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * JPEG frame headers whose payload carries the image extent. `0xC4`, `0xC8` and
 * `0xCC` share the `0xCn` range but are Huffman, reserved and arithmetic tables
 * rather than frames, so reading extents from them would return the table's
 * first two words as a picture size.
 */
const JPEG_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * The source-space extent of one design reference, or an honest statement that
 * this host cannot measure it.
 *
 * A PDF page box needs a PDF parser and a DXF extent needs an entity sweep;
 * this host ships neither. Reporting `unsupported` keeps the frame the author
 * declared unverified rather than silently blessed, which is the opposite of
 * returning a plausible-looking guess.
 */
export type IAutoMovieDesignReferenceBounds =
  | {
      /** The container states its own extent and this host read it. */
      status: "measured";
      /** Extent along the source x axis, in the container's own units. */
      width: number;
      /** Extent along the source y axis, in the container's own units. */
      height: number;
    }
  | {
      /** This host cannot derive the extent from these bytes. */
      status: "unsupported";
      /** What is missing, stated rather than approximated. */
      reason: string;
    };

/**
 * What one design-reference asset's bytes actually are.
 */
export interface IAutoMovieInspectedDesignReference {
  /**
   * Container family sniffed from the bytes themselves, never from a name.
   */
  media: AutoMovieDesignReferenceMedia;
  /**
   * SHA-256 of the exact inspected bytes.
   */
  digest: AutoMovieContentDigest;
  /**
   * Source-space extent, or the reason this host cannot measure it.
   */
  bounds: IAutoMovieDesignReferenceBounds;
}

/**
 * Read one registered design-reference asset's own container facts.
 *
 * ## Why the bytes decide
 *
 * A design reference is evidence, and evidence that is trusted by filename is
 * not evidence. The media family, the digest and the source extent all come out
 * of the bytes, so a manifest that calls a JPEG a plan SVG, or a frame that
 * declares 4096 pixels of a 1024-pixel image, is contradicted by the file
 * itself rather than by nobody.
 *
 * ## Why it refuses instead of guessing
 *
 * An unrecognized container throws, naming {@link SUPPORTED_DESIGN_REFERENCES},
 * because a reference nobody can open cannot be the basis of a building. A
 * recognized container whose extent this host cannot derive — a PDF page, a DXF
 * drawing, an SVG sized only in millimetres with no `viewBox` — returns
 * `unsupported` with the reason. Both outcomes are deliberate: the one thing
 * this function will never do is invent a number that a downstream frame then
 * treats as measured.
 *
 * The whole function is a pure function of `bytes`: no filesystem, no clock, no
 * locale, so the same asset inspects identically on every machine.
 */
export const inspectDesignReferenceAsset = (props: {
  /** Project-relative declared asset path, named in every refusal. */
  path: string;
  /** Exact current bytes of that asset. */
  bytes: Uint8Array;
}): IAutoMovieInspectedDesignReference => {
  const bytes = props.bytes;
  const digest = digestAutoMovieBytes(bytes);
  if (startsWith(bytes, PNG_SIGNATURE))
    return { media: "image/png", digest, bounds: pngBounds(props.path, bytes) };
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8)
    return {
      media: "image/jpeg",
      digest,
      bounds: jpegBounds(props.path, bytes),
    };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return {
      media: "application/pdf",
      digest,
      bounds: {
        status: "unsupported",
        reason: `Design reference "${props.path}" is a PDF; this host ships no PDF page parser, so its page box is not measured here. Declare the frame bounds from the drawing itself.`,
      },
    };
  const text = Buffer.from(bytes).toString("utf8");
  if (text.includes("<svg"))
    return {
      media: "image/svg+xml",
      digest,
      bounds: svgBounds(props.path, text),
    };
  if (text.includes("$ACADVER") || /(^|\n)\s*0\r?\nSECTION\r?\n/.test(text))
    return {
      media: "image/vnd.dxf",
      digest,
      bounds: {
        status: "unsupported",
        reason: `Design reference "${props.path}" is a DXF drawing; this host ships no entity sweep, so its drawing extent is not measured here. Declare the frame bounds from the drawing itself.`,
      },
    };
  throw new Error(
    `Design reference "${props.path}" is not a container this host recognizes (${leadingHex(bytes)}). ${SUPPORTED_DESIGN_REFERENCES}`,
  );
};

/** Read the extent out of a PNG's mandatory leading `IHDR` chunk. */
const pngBounds = (
  path: string,
  bytes: Uint8Array,
): IAutoMovieDesignReferenceBounds => {
  if (bytes.length < 24 || asciiTag(bytes, 12) !== "IHDR")
    throw new Error(
      `Design reference "${path}" begins with a PNG signature but carries no leading IHDR chunk, so it is not a readable PNG.`,
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (width === 0 || height === 0)
    throw new Error(
      `Design reference "${path}" declares a PNG extent of ${width}x${height}; a readable plan image has a positive extent.`,
    );
  return { status: "measured", width, height };
};

/** Walk JPEG segments to the frame header that states the extent. */
const jpegBounds = (
  path: string,
  bytes: Uint8Array,
): IAutoMovieDesignReferenceBounds => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 2;
  while (cursor + 4 <= bytes.length) {
    if (bytes[cursor] !== 0xff)
      throw new Error(
        `Design reference "${path}" is a malformed JPEG: byte ${cursor} should begin a marker segment but was 0x${hex2(bytes[cursor]!)}.`,
      );
    const marker = bytes[cursor + 1]!;
    // 0xFF is a legal fill byte between markers, so a run of them is skipped
    // one byte at a time rather than read as a segment length.
    if (marker === 0xff) {
      cursor += 1;
      continue;
    }
    const size = view.getUint16(cursor + 2, false);
    if (size < 2 || cursor + 2 + size > bytes.length)
      throw new Error(
        `Design reference "${path}" is a truncated JPEG: the segment at byte ${cursor} declares ${size} bytes but only ${bytes.length - cursor - 2} remain.`,
      );
    if (JPEG_FRAME_MARKERS.has(marker)) {
      if (size < 7)
        throw new Error(
          `Design reference "${path}" carries a JPEG frame header of ${size} bytes, which is too small to state an extent.`,
        );
      const height = view.getUint16(cursor + 5, false);
      const width = view.getUint16(cursor + 7, false);
      if (width === 0 || height === 0)
        throw new Error(
          `Design reference "${path}" declares a JPEG extent of ${width}x${height}; a readable plan image has a positive extent.`,
        );
      return { status: "measured", width, height };
    }
    cursor += 2 + size;
  }
  throw new Error(
    `Design reference "${path}" begins with a JPEG signature but carries no frame header, so its extent is unreadable.`,
  );
};

/**
 * Read an SVG's user-unit extent.
 *
 * `viewBox` wins because it is the only attribute that states the user-unit
 * space observations are recorded in. `width`/`height` are a rendered size, so
 * they are accepted only when they are plain numbers or `px`; a sheet sized in
 * millimetres with no `viewBox` is reported `unsupported` rather than silently
 * read as millimetre-numbered pixels.
 */
const svgBounds = (
  path: string,
  text: string,
): IAutoMovieDesignReferenceBounds => {
  const box = /viewBox\s*=\s*"([^"]*)"/.exec(text);
  if (box !== null) {
    const parts = box[1]!
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      parts.length === 4 &&
      parts.every((value) => Number.isFinite(value)) &&
      parts[2]! > 0 &&
      parts[3]! > 0
    )
      return { status: "measured", width: parts[2]!, height: parts[3]! };
    return {
      status: "unsupported",
      reason: `Design reference "${path}" declares viewBox "${box[1]!}", which is not four finite numbers with a positive extent.`,
    };
  }
  const width = svgLength(text, "width");
  const height = svgLength(text, "height");
  if (width !== null && height !== null)
    return { status: "measured", width, height };
  return {
    status: "unsupported",
    reason: `Design reference "${path}" states no viewBox and no unitless or "px" width/height, so its user-unit extent is undetermined. Add a viewBox before recording observations against it.`,
  };
};

/** One SVG length in user units, or null when it is not stated in them. */
const svgLength = (text: string, name: string): number | null => {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(text);
  if (match === null) return null;
  const raw = match[1]!.trim().replace(/px$/, "");
  const value = Number(raw);
  if (raw.length === 0 || !Number.isFinite(value) || value <= 0) return null;
  return value;
};

/** Whether `bytes` opens with exactly `signature`. */
const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length &&
  signature.every((byte, index) => bytes[index] === byte);

/** Four bytes as a printable chunk tag; an unprintable byte reads as ".". */
const asciiTag = (bytes: Uint8Array, offset: number): string => {
  let text = "";
  for (let index = offset; index < offset + 4; ++index) {
    const byte = bytes[index]!;
    text += byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
  }
  return text;
};

/** The leading bytes as hex, for a file whose family is not recognizable. */
const leadingHex = (bytes: Uint8Array): string => {
  let text = "0x";
  for (let index = 0; index < Math.min(4, bytes.length); ++index)
    text += hex2(bytes[index]!);
  return bytes.length === 0 ? "empty" : text;
};

/** One byte as the two-digit hex a container specification writes. */
const hex2 = (value: number): string => value.toString(16).padStart(2, "0");

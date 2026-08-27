import {
  digestAutoMovieBytes,
  inspectDesignReferenceAsset,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";

/** A PNG datastream carrying only the header a plan's extent lives in. */
const png = (width: number, height: number, tag = "IHDR"): Uint8Array => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set(Buffer.from(tag, "ascii"), 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
};

/** One JPEG marker segment: `0xFF`, the marker, its big-endian size, payload. */
const segment = (marker: number, payload: readonly number[]): number[] => [
  0xff,
  marker,
  ((payload.length + 2) >> 8) & 0xff,
  (payload.length + 2) & 0xff,
  ...payload,
];

/** A JPEG frame header payload: precision, height, width, component count. */
const frame = (width: number, height: number): number[] => [
  8,
  (height >> 8) & 0xff,
  height & 0xff,
  (width >> 8) & 0xff,
  width & 0xff,
  3,
];

const jpeg = (...parts: readonly number[][]): Uint8Array =>
  new Uint8Array([0xff, 0xd8, ...parts.flat()]);

const utf8 = (text: string): Uint8Array =>
  new Uint8Array(Buffer.from(text, "utf8"));

/** The `bounds` verdict as a comparable tuple. */
const extent = (bytes: Uint8Array): unknown => {
  const bounds = inspectDesignReferenceAsset({ path: "sheet", bytes }).bounds;
  return bounds.status === "measured"
    ? [bounds.status, bounds.width, bounds.height]
    : bounds.status;
};

/**
 * A design reference is only evidence if the bytes decide what it is, so this
 * pins that the container family, the digest and the source extent are all read
 * out of the file rather than taken from a name or a declaration. It equally
 * pins the refusals: an unopenable file throws, and a container whose extent
 * this host genuinely cannot derive returns `unsupported` instead of a
 * plausible number a frame would then treat as measured.
 *
 * Scenarios:
 *
 * 1. A PNG's extent comes from its mandatory IHDR chunk, and the digest is the
 *    digest of exactly the inspected bytes.
 * 2. A PNG signature with no IHDR, one truncated before it, or one declaring a
 *    zero extent are each refused rather than read as a zero-sized sheet.
 * 3. A JPEG's extent comes from its frame header, found by walking the segment
 *    list past metadata and past legal `0xFF` fill bytes rather than by
 *    assuming an offset.
 * 4. A JPEG whose segment does not begin with `0xFF`, declares an impossible size,
 *    runs past the end of the file, carries a frame header too small to state
 *    an extent, declares a zero extent, or contains no frame header at all is
 *    refused, each with its own reason.
 * 5. A Huffman table is not mistaken for a frame despite sharing the `0xCn` marker
 *    range.
 * 6. SVG extents come from `viewBox`, because that is the user-unit space
 *    observations are recorded in; a malformed or non-positive box is reported
 *    unsupported rather than partially read.
 * 7. Without a `viewBox`, unitless and `px` sizes are read while a millimetre
 *    sheet is reported unsupported: a rendered size in physical units is not a
 *    user-unit extent.
 * 8. PDF and DXF are recognized as registrable references whose extent this host
 *    does not derive, and say so.
 * 9. Bytes belonging to no recognized container are refused, naming the supported
 *    set, and an empty file says it is empty rather than reading past its end.
 */
export const test_production_design_reference_asset = (): void => {
  // 1-2. PNG.
  const plan = png(1000, 800);
  const inspected = inspectDesignReferenceAsset({
    path: "plan.png",
    bytes: plan,
  });
  TestValidator.equals(
    "a PNG plan reports its media, digest and IHDR extent",
    [inspected.media, inspected.digest, extent(plan)],
    ["image/png", digestAutoMovieBytes(plan), ["measured", 1000, 800]],
  );
  TestValidator.predicate(
    "a PNG signature with no IHDR chunk is refused",
    throwsError(
      () =>
        inspectDesignReferenceAsset({
          path: "plan.png",
          bytes: png(4, 4, "iTXt"),
        }),
      ["no leading IHDR chunk"],
    ),
  );
  TestValidator.predicate(
    "a PNG whose chunk tag is not printable text is refused",
    throwsError(
      () =>
        inspectDesignReferenceAsset({ path: "plan.png", bytes: png(4, 4, "") }),
      ["no leading IHDR chunk"],
    ),
  );
  TestValidator.predicate(
    "a PNG truncated before its header is refused",
    throwsError(
      () =>
        inspectDesignReferenceAsset({
          path: "plan.png",
          bytes: png(4, 4).slice(0, 20),
        }),
      ["no leading IHDR chunk"],
    ),
  );
  TestValidator.predicate(
    "a PNG declaring a zero extent is refused rather than measured as empty",
    throwsError(
      () =>
        inspectDesignReferenceAsset({ path: "plan.png", bytes: png(0, 800) }),
      ["0x800"],
    ),
  );

  // 3-5. JPEG.
  const scan = jpeg(
    segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]),
    segment(0xc4, [0, 1, 2, 3, 4, 5, 6, 7]),
    [0xff, 0xff],
    segment(0xc2, frame(1600, 1200)),
  );
  TestValidator.equals(
    "a progressive JPEG's extent is found past metadata, a Huffman table and fill",
    [
      inspectDesignReferenceAsset({ path: "sheet.jpg", bytes: scan }).media,
      extent(scan),
    ],
    ["image/jpeg", ["measured", 1600, 1200]],
  );
  const jpegRefusals: ReadonlyArray<readonly [string, Uint8Array, string]> = [
    [
      "a segment that does not begin with 0xFF",
      new Uint8Array([0xff, 0xd8, 0x00, 0xc0, 0x00, 0x08]),
      "should begin a marker segment",
    ],
    [
      "a segment declaring an impossible size",
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x00, 0x00]),
      "truncated JPEG",
    ],
    [
      "a segment running past the end of the file",
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40, 0x00, 0x00]),
      "truncated JPEG",
    ],
    [
      "a frame header too small to state an extent",
      jpeg(segment(0xc0, [8, 0, 4])),
      "too small to state an extent",
    ],
    [
      "a frame header declaring a zero extent",
      jpeg(segment(0xc0, frame(640, 0))),
      "640x0",
    ],
    [
      "a JPEG carrying no frame header at all",
      jpeg(segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00])),
      "no frame header",
    ],
  ];
  jpegRefusals.forEach(([name, bytes, fragment]) =>
    TestValidator.predicate(
      `${name} is refused`,
      throwsError(
        () => inspectDesignReferenceAsset({ path: "sheet.jpg", bytes }),
        [fragment],
      ),
    ),
  );

  // 6-7. SVG.
  const vector = utf8(
    '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 297"><path d="M0 0"/></svg>',
  );
  TestValidator.equals(
    "an SVG plan reports its user-unit extent from viewBox",
    [
      inspectDesignReferenceAsset({ path: "plan.svg", bytes: vector }).media,
      extent(vector),
    ],
    ["image/svg+xml", ["measured", 420, 297]],
  );
  const svgVerdicts: ReadonlyArray<readonly [string, string, unknown]> = [
    ["a three-number viewBox", '<svg viewBox="0 0 420"/>', "unsupported"],
    [
      "a viewBox carrying a word",
      '<svg viewBox="0 0 wide 297"/>',
      "unsupported",
    ],
    ["a zero-width viewBox", '<svg viewBox="0 0 0 297"/>', "unsupported"],
    ["a zero-height viewBox", '<svg viewBox="0 0 420 0"/>', "unsupported"],
    [
      "a comma-separated viewBox",
      '<svg viewBox="0,0,420,297"/>',
      ["measured", 420, 297],
    ],
    [
      "unitless width and height",
      '<svg width="800" height="600"/>',
      ["measured", 800, 600],
    ],
    [
      "pixel width and height",
      '<svg width="800px" height="600px"/>',
      ["measured", 800, 600],
    ],
    [
      "a millimetre sheet",
      '<svg width="210mm" height="297mm"/>',
      "unsupported",
    ],
    ["a width with no height", '<svg width="800"/>', "unsupported"],
    ["an empty width", '<svg width="" height="600"/>', "unsupported"],
    ["a negative width", '<svg width="-800" height="600"/>', "unsupported"],
  ];
  svgVerdicts.forEach(([name, markup, expected]) =>
    TestValidator.equals(
      `${name} reads as ${JSON.stringify(expected)}`,
      extent(utf8(markup)),
      expected,
    ),
  );

  // 8. Recognized but unmeasurable.
  const pdf = utf8("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
  const dxf = utf8("  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1027\n");
  const dxfWithoutHeader = utf8("  0\nSECTION\n  2\nENTITIES\n  0\nENDSEC\n");
  TestValidator.equals(
    "PDF and DXF are recognized references whose extent is reported unsupported",
    [
      inspectDesignReferenceAsset({ path: "sheet.pdf", bytes: pdf }).media,
      extent(pdf),
      inspectDesignReferenceAsset({ path: "sheet.dxf", bytes: dxf }).media,
      extent(dxf),
      inspectDesignReferenceAsset({ path: "e.dxf", bytes: dxfWithoutHeader })
        .media,
    ],
    [
      "application/pdf",
      "unsupported",
      "image/vnd.dxf",
      "unsupported",
      "image/vnd.dxf",
    ],
  );

  // 9. Nothing this host can open.
  TestValidator.predicate(
    "bytes belonging to no recognized container name the supported set",
    throwsError(
      () =>
        inspectDesignReferenceAsset({
          path: "notes.txt",
          bytes: utf8("just a note about the pavilion"),
        }),
      ["Supported design references", "0x6a757374"],
    ),
  );
  TestValidator.predicate(
    "an empty file says it is empty rather than reading past its end",
    throwsError(
      () =>
        inspectDesignReferenceAsset({
          path: "empty.png",
          bytes: new Uint8Array(),
        }),
      ["empty"],
    ),
  );
};

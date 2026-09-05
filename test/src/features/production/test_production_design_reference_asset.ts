import {
  AutoMovieDesignReferenceContainerError,
  AutoMovieUtf8Error,
  digestAutoMovieBytes,
  inspectDesignReferenceAsset,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import { PNG } from "pngjs";

import { throwsError } from "../internal/predicates";

/** A complete PNG datastream that the resident decoder can read back. */
const png = (width: number, height: number): Uint8Array => {
  const image = new PNG({ width, height });
  image.data.fill(0x7f);
  return PNG.sync.write(image);
};

/** One JPEG marker segment: `0xFF`, the marker, its big-endian size, payload. */
const segment = (marker: number, payload: readonly number[]): number[] => [
  0xff,
  marker,
  ((payload.length + 2) >> 8) & 0xff,
  (payload.length + 2) & 0xff,
  ...payload,
];

/** A one-component JPEG with a frame header, one entropy scan and an EOI. */
const jpeg = (width: number, height: number, frameMarker = 0xc0): Uint8Array =>
  new Uint8Array([
    0xff,
    0xd8,
    ...segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0x00]),
    ...segment(frameMarker, [
      8,
      (height >> 8) & 0xff,
      height & 0xff,
      (width >> 8) & 0xff,
      width & 0xff,
      1,
      1,
      0x11,
      0,
    ]),
    ...segment(0xda, [1, 1, 0, 0, 63, 0]),
    0x11,
    0xff,
    0x00,
    0x22,
    0xff,
    0xd9,
  ]);

/** A classic-xref PDF whose catalog owns one closed, empty page tree. */
const pdf = (): Uint8Array => {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [] /Count 0 >>",
  ];
  let text = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, body] of objects.entries()) {
    offsets.push(Buffer.byteLength(text, "latin1"));
    text += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const xref = Buffer.byteLength(text, "latin1");
  text += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  text += offsets
    .map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`)
    .join("");
  text += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(text, "latin1");
};

const utf8 = (text: string): Uint8Array =>
  new Uint8Array(Buffer.from(text, "utf8"));

const svg = (attributes: string): Uint8Array =>
  utf8(`<svg xmlns="http://www.w3.org/2000/svg" ${attributes}/>`);

/** The media and `bounds` verdict as one comparable tuple. */
const verdict = (bytes: Uint8Array): unknown => {
  const inspected = inspectDesignReferenceAsset({ path: "sheet", bytes });
  return inspected.bounds.status === "measured"
    ? [
        inspected.media,
        inspected.bounds.status,
        inspected.bounds.width,
        inspected.bounds.height,
      ]
    : [inspected.media, inspected.bounds.status];
};

/** The typed refusal an inspection raises, as its class name and stage. */
const refusal = (bytes: Uint8Array): unknown => {
  try {
    inspectDesignReferenceAsset({ path: "sheet", bytes });
    return "accepted";
  } catch (error) {
    if (error instanceof AutoMovieDesignReferenceContainerError)
      return [error.name, error.family, error.stage];
    if (error instanceof AutoMovieUtf8Error)
      return [error.name, error.offset, error.category];
    return error instanceof Error ? error.name : error;
  }
};

/**
 * A design reference is only evidence if the bytes decide what it is, so this
 * pins that the container family, the digest and the source extent are all read
 * out of the file rather than taken from a name or a declaration, and that a
 * family is confirmed by its complete parser rather than by a signature or a
 * token. It equally pins the refusals: a candidate that fails its parser raises
 * that parser's typed error, an unrecognized file names the supported set, and
 * a confirmed container whose extent this host genuinely cannot derive returns
 * `unsupported` instead of a plausible number a frame would then treat as
 * measured.
 *
 * Scenarios:
 *
 * 1. A complete PNG, a baseline JPEG and a progressive JPEG report their family,
 *    the digest of exactly the inspected bytes, and their parsed extent.
 * 2. A PNG that stops after its header, a JPEG that stops after its frame
 *    header and a bare `%PDF-` prefix are refused as the family's own parser
 *    error, never measured, which is the signature-versus-container distinction.
 * 3. SVG extents come from `viewBox` in the SVG number grammar: comma or
 *    whitespace separators and exponents read, while a three-number box, a
 *    word, a hexadecimal spelling, an overflowing exponent and a zero edge are
 *    reported unsupported rather than partially read.
 * 4. Without a `viewBox`, unitless and `px` sizes are read while a millimetre
 *    sheet, a width with no height, an empty width and a negative width are
 *    reported unsupported: a rendered size in physical units is not a user-unit
 *    extent.
 * 5. A closed PDF and a closed DXF are confirmed families whose extent is
 *    reported unsupported with a reason naming the family.
 * 6. An `svg` root outside the SVG namespace, plain text and an empty file are
 *    not candidates of any family, so they are refused naming the supported set
 *    and the leading bytes, and malformed UTF-8 is refused by the strict decoder
 *    before any grammar runs.
 */
export const test_production_design_reference_asset = (): void => {
  const plan = png(1000, 800);
  const inspected = inspectDesignReferenceAsset({
    path: "plan.png",
    bytes: plan,
  });
  TestValidator.equals(
    "complete raster containers report family, exact digest and parsed extent",
    [
      inspected.media,
      inspected.digest,
      verdict(plan),
      verdict(jpeg(1600, 1200)),
      verdict(jpeg(640, 480, 0xc2)),
    ],
    [
      "image/png",
      digestAutoMovieBytes(plan),
      ["image/png", "measured", 1000, 800],
      ["image/jpeg", "measured", 1600, 1200],
      ["image/jpeg", "measured", 640, 480],
    ],
  );
  TestValidator.equals(
    "a signature or header is a candidate, not a measured container",
    [
      refusal(plan.subarray(0, 24)),
      refusal(jpeg(640, 480).subarray(0, 24)),
      refusal(utf8("%PDF-1.7\n")),
    ],
    [
      ["AutoMovieDesignReferenceContainerError", "PNG", "closure"],
      ["AutoMovieDesignReferenceContainerError", "JPEG", "closure"],
      ["AutoMovieDesignReferenceContainerError", "PDF", "object"],
    ],
  );

  const viewBoxes: ReadonlyArray<readonly [string, string, unknown]> = [
    ["a whitespace viewBox", 'viewBox="0 0 420 297"', ["measured", 420, 297]],
    ["a comma viewBox", 'viewBox="0,0,420,297"', ["measured", 420, 297]],
    [
      "an exponent and fraction viewBox",
      'viewBox="0 .5 4.2e2 2.97E+2"',
      ["measured", 420, 297],
    ],
    ["a three-number viewBox", 'viewBox="0 0 420"', ["unsupported"]],
    ["a viewBox carrying a word", 'viewBox="0 0 wide 297"', ["unsupported"]],
    ["a hexadecimal viewBox", 'viewBox="0 0 0x1a4 297"', ["unsupported"]],
    ["an overflowing viewBox", 'viewBox="0 0 1e400 297"', ["unsupported"]],
    ["a zero-width viewBox", 'viewBox="0 0 0 297"', ["unsupported"]],
    ["a zero-height viewBox", 'viewBox="0 0 420 0"', ["unsupported"]],
    ["unitless width and height", 'width="800" height="600"', ["measured", 800, 600]],
    ["pixel width and height", 'width="800px" height="600px"', ["measured", 800, 600]],
    ["a millimetre sheet", 'width="210mm" height="297mm"', ["unsupported"]],
    ["a width with no height", 'width="800"', ["unsupported"]],
    ["an empty width", 'width="" height="600"', ["unsupported"]],
    ["a negative width", 'width="-800" height="600"', ["unsupported"]],
  ];
  TestValidator.equals(
    "SVG extents follow the SVG number grammar of the root attributes",
    viewBoxes.map(([, attributes]) => verdict(svg(attributes))),
    viewBoxes.map(([, , expected]) => ["image/svg+xml", ...(expected as unknown[])]),
  );

  const drawing = utf8("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n");
  TestValidator.equals(
    "closed PDF and DXF are confirmed families whose extent stays unsupported",
    [
      verdict(pdf()),
      verdict(drawing),
      inspectDesignReferenceAsset({ path: "sheet.pdf", bytes: pdf() }).bounds,
    ],
    [
      ["application/pdf", "unsupported"],
      ["image/vnd.dxf", "unsupported"],
      {
        status: "unsupported",
        reason:
          'Design reference "sheet.pdf" is a parser-confirmed "application/pdf" container whose source extent this host does not derive. Declare the frame bounds from the drawing itself.',
      },
    ],
  );

  TestValidator.equals(
    "bytes of no family are refused naming the supported set, before any grammar",
    [
      throwsError(
        () =>
          inspectDesignReferenceAsset({
            path: "plan.svg",
            bytes: utf8('<svg viewBox="0 0 420 297"/>'),
          }),
        ["Supported design references", "0x3c737667"],
      ),
      throwsError(
        () =>
          inspectDesignReferenceAsset({
            path: "notes.txt",
            bytes: utf8("just a note about the pavilion"),
          }),
        ["Supported design references", "0x6a757374"],
      ),
      throwsError(
        () =>
          inspectDesignReferenceAsset({
            path: "empty.png",
            bytes: new Uint8Array(),
          }),
        ["(empty)"],
      ),
      refusal(
        new Uint8Array([
          ...utf8('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">'),
          0x80,
          ...utf8("</svg>"),
        ]),
      ),
    ],
    [true, true, true, ["AutoMovieUtf8Error", 59, "isolated-continuation"]],
  );
};

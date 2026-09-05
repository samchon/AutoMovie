import {
  AutoMovieDesignReferenceContainerError,
  AutoMovieUtf8Error,
  inspectAutoMovieDesignReferenceContainer,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import zlib from "node:zlib";
import { PNG } from "pngjs";

const utf8 = (text: string): Uint8Array => Buffer.from(text, "utf8");
const segment = (marker: number, payload: readonly number[]): number[] => [
  0xff,
  marker,
  ((payload.length + 2) >>> 8) & 0xff,
  (payload.length + 2) & 0xff,
  ...payload,
];
const jpeg = (
  frameMarker = 0xc0,
  restartInterval?: number | null,
): Uint8Array =>
  new Uint8Array([
    0xff,
    0xd8,
    ...segment(frameMarker, [8, 0, 3, 0, 4, 1, 1, 0x11, 0]),
    ...(typeof restartInterval === "number"
      ? segment(0xdd, [restartInterval >>> 8, restartInterval & 0xff])
      : []),
    ...segment(0xda, [1, 1, 0, 0, 63, 0]),
    0x11,
    0xff,
    0x00,
    0x22,
    ...(restartInterval === undefined ? [] : [0xff, 0xd0]),
    0x33,
    0xff,
    0xd9,
  ]);
const pdf = (
  objects: readonly string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [] /Count 0 >>",
  ],
): Uint8Array => {
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
const dxf = (eol = "\n"): Uint8Array =>
  utf8(
    [
      "0",
      "SECTION",
      "2",
      "HEADER",
      "9",
      "$ACADVER",
      "1",
      "AC1027",
      "0",
      "ENDSEC",
      "0",
      "EOF",
    ].join(eol),
  );

const inspect = (path: string, bytes: Uint8Array): unknown =>
  inspectAutoMovieDesignReferenceContainer({ path, bytes });

/** The family and parser stage a refusal names, or the admitted result. */
const stage = (path: string, bytes: Uint8Array): string => {
  try {
    return JSON.stringify(inspect(path, bytes));
  } catch (error) {
    return error instanceof AutoMovieDesignReferenceContainerError
      ? `${error.family}:${error.stage}`
      : error instanceof AutoMovieUtf8Error
        ? "utf8"
        : "unknown";
  }
};

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const crc32 = (bytes: Uint8Array): number => {
  let value = 0xffffffff;
  for (const byte of bytes)
    value = CRC_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};
/** One CRC-carrying PNG chunk, so the decoder's CRC check is not the refusal. */
const pngChunk = (type: string, data: Uint8Array): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
/** Split a decoder-written PNG into its chunks for surgical rebuilding. */
const pngChunks = (
  bytes: Uint8Array,
): Array<{ type: string; data: Uint8Array }> => {
  const chunks: Array<{ type: string; data: Uint8Array }> = [];
  for (let cursor = 8; cursor < bytes.length; ) {
    const size = Buffer.from(bytes).readUInt32BE(cursor);
    chunks.push({
      type: Buffer.from(bytes.subarray(cursor + 4, cursor + 8)).toString(
        "ascii",
      ),
      data: bytes.subarray(cursor + 8, cursor + 8 + size),
    });
    cursor += 12 + size;
  }
  return chunks;
};
const rebuildPng = (
  bytes: Uint8Array,
  edit: (chunk: { type: string; data: Uint8Array }) => Buffer | null,
): Uint8Array =>
  Buffer.concat([
    bytes.subarray(0, 8),
    ...pngChunks(bytes).flatMap((chunk) => {
      const rebuilt = edit(chunk);
      return rebuilt === null ? [] : [rebuilt];
    }),
  ]);
/**
 * An RGBA datastream whose framing the decoder accepts, with the raster the
 * IHDR declares (possibly empty) and an optional IDAT chunk.
 */
const pngStream = (
  width: number,
  height: number,
  withIdat: boolean,
): Uint8Array => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    ...(withIdat
      ? [
          pngChunk(
            "IDAT",
            zlib.deflateSync(Buffer.alloc(height * (1 + width * 4))),
          ),
        ]
      : []),
    pngChunk("IEND", new Uint8Array()),
  ]);
};
const latin1 = (
  bytes: Uint8Array,
  edit: (text: string) => string,
): Uint8Array =>
  Buffer.from(edit(Buffer.from(bytes).toString("latin1")), "latin1");

const refuses = (
  path: string,
  bytes: Uint8Array,
  kind: "container" | "encoding" = "container",
): boolean => {
  try {
    inspect(path, bytes);
    return false;
  } catch (error) {
    return kind === "container"
      ? error instanceof AutoMovieDesignReferenceContainerError
      : error instanceof AutoMovieUtf8Error;
  }
};

/**
 * Design evidence is emitted only by parser-confirmed complete containers.
 *
 * Scenarios:
 *
 * 1. Complete PNG, baseline and progressive JPEG expose their parsed extent;
 *    closed PDF page trees and DXF drawings are valid but unmeasured.
 * 2. Truncated, corrupt, and structurally incomplete PNG, JPEG, PDF, and DXF
 *    candidates are refused, and SVG family, namespace scope, expanded
 *    attribute identity, and XML well-formedness are enforced.
 * 3. Every refusal names the family and the exact parser stage that stopped
 *    it: PNG facts the decoder leaves open, each JPEG marker, segment, frame,
 *    scan, restart, and closure rule, each PDF header, closure, trailer, and
 *    page-tree rule, each XML prolog, root, name, namespace, text, entity, and
 *    closure rule, and each DXF record, section, and closure rule.
 */
export const test_production_design_reference_container = (): void => {
  const image = new PNG({ width: 4, height: 3 });
  image.data.fill(0xff);
  const png = PNG.sync.write(image);
  TestValidator.equals(
    "complete PNG and baseline/progressive JPEG expose their parsed extent",
    [
      inspect("plan.png", png),
      inspect("scan.jpg", jpeg()),
      inspect("scan-progressive.jpg", jpeg(0xc2)),
      inspect("scan-restarted.jpg", jpeg(0xc0, 4)),
    ],
    [
      { media: "image/png", width: 4, height: 3 },
      { media: "image/jpeg", width: 4, height: 3 },
      { media: "image/jpeg", width: 4, height: 3 },
      { media: "image/jpeg", width: 4, height: 3 },
    ],
  );
  const badCrc = Buffer.from(png);
  badCrc[29] = badCrc[29]! ^ 0x01;
  TestValidator.equals(
    "PNG prefix, bad CRC, missing IDAT and missing IEND are refused",
    [
      refuses("prefix.png", png.subarray(0, 24)),
      refuses("crc.png", badCrc),
      refuses(
        "no-idat.png",
        Buffer.concat([png.subarray(0, 33), png.subarray(png.length - 12)]),
      ),
      refuses("no-iend.png", png.subarray(0, png.length - 12)),
    ],
    [true, true, true, true],
  );
  TestValidator.equals(
    "JPEG needs a complete frame, scan and terminal EOI",
    [
      refuses("sof.jpg", jpeg().subarray(0, 13)),
      refuses("no-eoi.jpg", jpeg().subarray(0, jpeg().length - 2)),
      refuses(
        "no-scan.jpg",
        new Uint8Array([...jpeg().subarray(0, 15), 0xff, 0xd9]),
      ),
      refuses(
        "double-frame.jpg",
        new Uint8Array([
          ...jpeg().subarray(0, 15),
          ...jpeg().subarray(2, 15),
          ...jpeg().subarray(15),
        ]),
      ),
      refuses(
        "scan-first.jpg",
        new Uint8Array([
          0xff,
          0xd8,
          ...segment(0xda, [1, 1, 0, 0, 63, 0]),
          0x11,
          0xff,
          0xd9,
        ]),
      ),
      refuses(
        "bad-scan.jpg",
        new Uint8Array([
          ...jpeg().subarray(0, 15),
          ...segment(0xda, [2, 1, 0, 0, 63, 0]),
          0x11,
          0xff,
          0xd9,
        ]),
      ),
      refuses(
        "empty-frame.jpg",
        new Uint8Array([
          0xff,
          0xd8,
          ...segment(0xc0, [8, 0, 3, 0, 4, 0]),
          0xff,
          0xd9,
        ]),
      ),
      refuses(
        "unknown-component.jpg",
        new Uint8Array([
          ...jpeg().subarray(0, 15),
          ...segment(0xda, [1, 2, 0, 0, 63, 0]),
          0x11,
          0xff,
          0xd9,
        ]),
      ),
      refuses("restart-without-dri.jpg", jpeg(0xc0, null)),
      refuses("restart-with-zero-dri.jpg", jpeg(0xc0, 0)),
      refuses(
        "malformed-dri.jpg",
        new Uint8Array([
          0xff,
          0xd8,
          ...segment(0xdd, [1]),
          ...jpeg().subarray(2),
        ]),
      ),
      refuses(
        "empty-restart-scan.jpg",
        new Uint8Array([
          0xff,
          0xd8,
          ...segment(0xc0, [8, 0, 3, 0, 4, 1, 1, 0x11, 0]),
          ...segment(0xdd, [0, 1]),
          ...segment(0xda, [1, 1, 0, 0, 63, 0]),
          0xff,
          0xd0,
          0xff,
          0xd9,
        ]),
      ),
    ],
    [true, true, true, true, true, true, true, true, true, true, true, true],
  );
  const svg = utf8(
    '<?xml version="1.0"?><!-- viewBox="0 0 999 999" --><svg xmlns="http://www.w3.org/2000/svg" viewBox=\'0 0 420 297\'><g><path d="M0 0"/></g></svg><!-- epilog -->',
  );
  const sizedSvg = utf8(
    '<s:svg xmlns:s="http://www.w3.org/2000/svg" width="800px" height="600"><s:g/></s:svg>',
  );
  TestValidator.equals(
    "the namespace root owns SVG family and bounds, not comments or children",
    [
      inspect("plan.svg", svg),
      inspect("sized.svg", sizedSvg),
      inspect(
        "foreign.xml",
        utf8('<root><!-- <svg viewBox="0 0 9 9"/> --></root>'),
      ),
    ],
    [
      { media: "image/svg+xml", width: 420, height: 297 },
      { media: "image/svg+xml", width: 800, height: 600 },
      null,
    ],
  );
  TestValidator.equals(
    "XML namespace scope and expanded attribute names are enforced",
    [
      inspect(
        "bound.svg",
        utf8(
          '<s:svg xmlns:s="http://www.w3.org/2000/svg" xmlns:a="urn:a" id="plain" a:id="qualified" xml:lang="en"><a:g/></s:svg>',
        ),
      ),
      refuses(
        "unbound-root.svg",
        utf8('<s:svg xmlns="http://www.w3.org/2000/svg"/>'),
      ),
      refuses(
        "unbound-child.svg",
        utf8('<svg xmlns="http://www.w3.org/2000/svg"><a:g/></svg>'),
      ),
      refuses(
        "scope.svg",
        utf8(
          '<svg xmlns="http://www.w3.org/2000/svg"><g xmlns:a="urn:a"><a:path/></g><a:path/></svg>',
        ),
      ),
      refuses(
        "expanded-duplicate.svg",
        utf8(
          '<svg xmlns="http://www.w3.org/2000/svg" xmlns:a="urn:same" xmlns:b="urn:same" a:id="one" b:id="two"/>',
        ),
      ),
      refuses(
        "reserved-binding.svg",
        utf8(
          '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xml="urn:not-xml"/>',
        ),
      ),
    ],
    [{ media: "image/svg+xml" }, true, true, true, true, true],
  );
  TestValidator.equals(
    "malformed SVG and raw malformed UTF-8 never become measured evidence",
    [
      refuses(
        "broken.svg",
        utf8('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>'),
      ),
      refuses(
        "comment.svg",
        utf8(
          '<svg xmlns="http://www.w3.org/2000/svg"><!-- bad--comment --></svg>',
        ),
      ),
      refuses(
        "space.svg",
        utf8('\u000b<svg xmlns="http://www.w3.org/2000/svg"/>'),
      ),
      refuses(
        "cdata.svg",
        utf8(
          '<svg xmlns="http://www.w3.org/2000/svg"><![CDATA[\u000b]]></svg>',
        ),
      ),
      refuses(
        "declaration.svg",
        utf8('<svg xmlns="http://www.w3.org/2000/svg"/><?xml version="1.0"?>'),
      ),
      refuses(
        "qualified-name.svg",
        utf8('<svg xmlns="http://www.w3.org/2000/svg"><a:b:c/></svg>'),
      ),
      refuses(
        "character-reference.svg",
        utf8('<svg xmlns="http://www.w3.org/2000/svg">&#11;</svg>'),
      ),
      refuses(
        "non-character.svg",
        utf8('<svg xmlns="http://www.w3.org/2000/svg">\uffff</svg>'),
      ),
      refuses(
        "late-declaration.svg",
        utf8(
          '<!-- first --><?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>',
        ),
      ),
      refuses(
        "encoding-declaration.svg",
        utf8(
          '<?xml version="1.0" encoding="UTF-16"?><svg xmlns="http://www.w3.org/2000/svg"/>',
        ),
      ),
      inspect(
        "nbsp-bounds.svg",
        utf8(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0\u00a00\u00a01\u00a01"/>',
        ),
      ),
      refuses(
        "encoding.svg",
        new Uint8Array([
          ...utf8('<svg xmlns="http://www.w3.org/2000/svg">'),
          0x80,
          ...utf8("</svg>"),
        ]),
        "encoding",
      ),
      inspect(
        "replacement.svg",
        utf8(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">�</svg>',
        ),
      ),
    ],
    [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      { media: "image/svg+xml" },
      true,
      { media: "image/svg+xml", width: 1, height: 1 },
    ],
  );
  TestValidator.equals(
    "closed PDF page trees and LF/CRLF DXF are valid but deliberately unmeasured",
    [
      inspect("sheet.pdf", pdf()),
      inspect(
        "page.pdf",
        pdf([
          "<< /Type /Catalog /Pages 2 0 R >>",
          "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
          "<< /Type /Page /Parent 2 0 R >>",
        ]),
      ),
      inspect("a.dxf", dxf()),
      inspect("b.dxf", dxf("\r\n")),
    ],
    [
      { media: "application/pdf" },
      { media: "application/pdf" },
      { media: "image/vnd.dxf" },
      { media: "image/vnd.dxf" },
    ],
  );
  const invalidPdf = Buffer.from(
    Buffer.from(pdf())
      .toString("latin1")
      .replace(/startxref\n\d+/, "startxref\n9999"),
    "latin1",
  );
  const missingPdfRoot = Buffer.from(
    Buffer.from(pdf()).toString("latin1").replace("/Root 1 0 R", "/Root 9 0 R"),
    "latin1",
  );
  const wrongPdfOffset = Buffer.from(
    Buffer.from(pdf()).toString("latin1").replace("0000000009", "0000000008"),
    "latin1",
  );
  const wrongPdfCount = Buffer.from(
    Buffer.from(pdf()).toString("latin1").replace("xref\n0 3", "xref\n0 4"),
    "latin1",
  );
  const wrongPdfRootType = Buffer.from(
    Buffer.from(pdf()).toString("latin1").replace("/Catalog", "/Pages"),
    "latin1",
  );
  const missingPdfSize = Buffer.from(
    Buffer.from(pdf()).toString("latin1").replace("/Size 3 ", ""),
    "latin1",
  );
  const shortPdfSize = Buffer.from(
    Buffer.from(pdf()).toString("latin1").replace("/Size 3", "/Size 2"),
    "latin1",
  );
  const missingPages = pdf([
    "<< /Type /Catalog >>",
    "<< /Type /Pages /Kids [] /Count 0 >>",
  ]);
  const missingPagesObject = pdf([
    "<< /Type /Catalog /Pages 9 0 R >>",
    "<< /Type /Pages /Kids [] /Count 0 >>",
  ]);
  const wrongPagesGeneration = pdf([
    "<< /Type /Catalog /Pages 2 1 R >>",
    "<< /Type /Pages /Kids [] /Count 0 >>",
  ]);
  const wrongPagesType = pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Page >>",
  ]);
  const missingKids = pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 0 >>",
  ]);
  const missingPageCount = pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [] >>",
  ]);
  const wrongPageCount = pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [] /Count 1 >>",
  ]);
  const wrongPageParent = pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 9 0 R >>",
  ]);
  const cyclicPages = pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [2 0 R] /Count 0 >>",
  ]);
  const repeatedPage = pdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 3 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R >>",
  ]);
  TestValidator.equals(
    "prefix PDF and token-only or unclosed DXF remain refusals",
    [
      refuses("prefix.pdf", utf8("%PDF-1.7\n")),
      refuses("xref.pdf", invalidPdf),
      refuses("root.pdf", missingPdfRoot),
      refuses("offset.pdf", wrongPdfOffset),
      refuses("count.pdf", wrongPdfCount),
      refuses("root-type.pdf", wrongPdfRootType),
      refuses("missing-size.pdf", missingPdfSize),
      refuses("short-size.pdf", shortPdfSize),
      refuses("missing-pages.pdf", missingPages),
      refuses("missing-pages-object.pdf", missingPagesObject),
      refuses("pages-generation.pdf", wrongPagesGeneration),
      refuses("pages-type.pdf", wrongPagesType),
      refuses("missing-kids.pdf", missingKids),
      refuses("missing-page-count.pdf", missingPageCount),
      refuses("wrong-page-count.pdf", wrongPageCount),
      refuses("wrong-page-parent.pdf", wrongPageParent),
      refuses("cyclic-pages.pdf", cyclicPages),
      refuses("repeated-page.pdf", repeatedPage),
      inspect("memo.dxf", utf8("memo: $ACADVER means version")) === null,
      refuses("open.dxf", utf8("0\nSECTION\n2\nHEADER\n0\nEOF")),
      refuses(
        "code.dxf",
        utf8("0\nSECTION\n2\nHEADER\n-1\nvalue\n0\nENDSEC\n0\nEOF"),
      ),
      refuses(
        "nested.dxf",
        utf8(
          "0\nSECTION\n2\nHEADER\n0\nSECTION\n2\nINNER\n0\nENDSEC\n0\nENDSEC\n0\nEOF",
        ),
      ),
    ],
    new Array(22).fill(true),
  );

  const frame = segment(0xc0, [8, 0, 3, 0, 4, 1, 1, 0x11, 0]);
  const scan = segment(0xda, [1, 1, 0, 0, 63, 0]);
  const svgRoot = '<svg xmlns="http://www.w3.org/2000/svg"';
  const svgOnly = JSON.stringify({ media: "image/svg+xml" });
  const pdfText = (edit: (text: string) => string): Uint8Array =>
    latin1(pdf(), edit);
  const pageTree = (
    kid: string,
    pages = "/Kids [3 0 R] /Count 1",
  ): Uint8Array =>
    pdf([
      "<< /Type /Catalog /Pages 2 0 R >>",
      `<< /Type /Pages ${pages} >>`,
      kid,
    ]);
  TestValidator.equals(
    "every refusal names the family and the parser stage that stopped it",
    {
      pngNonEmptyIend: stage(
        "iend.png",
        rebuildPng(png, (chunk) =>
          chunk.type === "IEND"
            ? pngChunk("IEND", new Uint8Array([1]))
            : pngChunk(chunk.type, chunk.data),
        ),
      ),
      pngZeroExtent: stage("extent.png", pngStream(0, 2, true)),
      pngNoIdat: stage("idat.png", pngStream(2, 2, false)),
      jpegNoMarker: stage(
        "marker.jpg",
        new Uint8Array([0xff, 0xd8, ...frame, 0x12]),
      ),
      jpegTruncatedMarker: stage("cut.jpg", new Uint8Array([0xff, 0xd8, 0xff])),
      jpegBytesAfterEoi: stage("tail.jpg", new Uint8Array([...jpeg(), 0x00])),
      jpegEoiWithoutFrame: stage(
        "frameless.jpg",
        new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      ),
      jpegStandaloneMarker: stage(
        "tem.jpg",
        new Uint8Array([0xff, 0xd8, 0xff, 0x01]),
      ),
      jpegReservedMarker: stage(
        "reserved.jpg",
        new Uint8Array([0xff, 0xd8, 0xff, 0x02]),
      ),
      jpegTruncatedSegmentLength: stage(
        "length.jpg",
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      ),
      jpegShortFrame: stage(
        "short-frame.jpg",
        new Uint8Array([0xff, 0xd8, ...segment(0xc0, [8, 0, 3, 0, 4])]),
      ),
      jpegDuplicateComponent: stage(
        "components.jpg",
        new Uint8Array([
          0xff,
          0xd8,
          ...segment(0xc0, [8, 0, 3, 0, 4, 2, 1, 0x11, 0, 1, 0x11, 0]),
        ]),
      ),
      jpegZeroExtent: stage(
        "zero.jpg",
        new Uint8Array([
          0xff,
          0xd8,
          ...segment(0xc0, [8, 0, 0, 0, 4, 1, 1, 0x11, 0]),
        ]),
      ),
      jpegFillBytes: stage(
        "fill.jpg",
        new Uint8Array([0xff, 0xd8, ...frame, ...scan, 0x11, 0xff, 0xff, 0xd9]),
      ),
      jpegRestartOrder: stage(
        "restart-order.jpg",
        new Uint8Array([
          0xff,
          0xd8,
          ...frame,
          ...segment(0xdd, [0, 1]),
          ...scan,
          0x11,
          0xff,
          0xd1,
          0x22,
          0xff,
          0xd9,
        ]),
      ),
      pdfHeader: stage(
        "header.pdf",
        pdfText((text) => text.replace("%PDF-1.4", "%PDF-2.0")),
      ),
      pdfNoClosure: stage(
        "closure.pdf",
        pdfText((text) => text.replace("%%EOF\n", "")),
      ),
      pdfNoTrailerKeyword: stage(
        "keyword.pdf",
        pdfText((text) => text.replace("trailer", "trailor")),
      ),
      pdfXrefLineSuffix: stage(
        "xref-line.pdf",
        pdfText((text) => text.replace("xref\n0 3", "xref extra\n0 3")),
      ),
      pdfXrefHeading: stage(
        "xref-heading.pdf",
        pdfText((text) => text.replace("xref\n0 3\n", "xref\nzero 3\n")),
      ),
      pdfXrefEmptySubsection: stage(
        "xref-count.pdf",
        pdfText((text) => text.replace("xref\n0 3\n", "xref\n0 0\n")),
      ),
      pdfPageKidType: stage(
        "kid-type.pdf",
        pageTree("<< /Type /Foo /Parent 2 0 R >>"),
      ),
      pdfKidsResidue: stage(
        "kids-residue.pdf",
        pageTree(
          "<< /Type /Page /Parent 2 0 R >>",
          "/Kids [3 0 R junk] /Count 1",
        ),
      ),
      xmlDoctype: stage("doctype.svg", utf8(`<!DOCTYPE svg>${svgRoot}/>`)),
      xmlUnstartableRoot: stage("digit.svg", utf8("<1abc/>")),
      svgMalformedAttribute: stage("attribute.svg", utf8(`${svgRoot} a=b/>`)),
      svgAttributeName: stage("name.svg", utf8(`${svgRoot} a:b:c="1"/>`)),
      svgDuplicateAttribute: stage(
        "duplicate.svg",
        utf8(`${svgRoot} id="1" id="2"/>`),
      ),
      svgUndeclaredDefaultNamespace: stage(
        "undeclared.svg",
        utf8('<svg xmlns=""/>'),
      ),
      xmlnsElementName: stage(
        "xmlns-element.svg",
        utf8('<xmlns:svg xmlns:svg="http://www.w3.org/2000/svg"/>'),
      ),
      svgTailAfterSelfClose: stage("tail-self.svg", utf8(`${svgRoot}/>tail`)),
      svgUnclosedWithText: stage("unclosed-text.svg", utf8(`${svgRoot}>text`)),
      svgUnterminatedComment: stage("comment.svg", utf8(`${svgRoot}><!-- x`)),
      svgUnterminatedCdata: stage("cdata.svg", utf8(`${svgRoot}><![CDATA[x`)),
      svgInstruction: stage(
        "instruction.svg",
        utf8(`${svgRoot}><?pi data?></svg>`),
      ),
      svgUnterminatedInstruction: stage("pi.svg", utf8(`${svgRoot}><?pi`)),
      svgCloseName: stage("close-name.svg", utf8(`${svgRoot}></a:b:c>`)),
      svgTailAfterRoot: stage("tail-root.svg", utf8(`${svgRoot}></svg>tail`)),
      svgMalformedChild: stage("child.svg", utf8(`${svgRoot}><1/></svg>`)),
      svgUnclosedRoot: stage("unclosed.svg", utf8(`${svgRoot}><g>`)),
      xmlDeclarationAfterSpace: stage(
        "spaced-declaration.svg",
        utf8(` <?xml version="1.0"?>${svgRoot}/>`),
      ),
      xmlUnterminatedProlog: stage("prolog.svg", utf8('<?xml version="1.0"')),
      xmlPrologCommentDashes: stage(
        "prolog-comment.svg",
        utf8(`<!-- a--b -->${svgRoot}/>`),
      ),
      svgCdataEndInText: stage("cdata-end.svg", utf8(`${svgRoot}>]]></svg>`)),
      svgAstralText: stage("astral.svg", utf8(`${svgRoot}>\u{1f600}</svg>`)),
      svgUnescapedAttribute: stage(
        "ampersand.svg",
        utf8(`${svgRoot} id="a&b"/>`),
      ),
      svgEntities: stage(
        "entities.svg",
        utf8(`${svgRoot} id="&amp;&#65;&#x42;"/>`),
      ),
      dxfOddRecords: stage(
        "odd.dxf",
        utf8("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF\n9"),
      ),
      dxfSectionName: stage(
        "section-name.dxf",
        utf8("0\nSECTION\n9\nX\n0\nENDSEC\n0\nEOF"),
      ),
      dxfNoEof: stage(
        "no-eof.dxf",
        utf8("0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEXTRA"),
      ),
      dxfNoSection: stage("no-section.dxf", utf8("9\n$ACADVER\n1\nAC1027")),
    },
    {
      pngNonEmptyIend: "PNG:IEND",
      pngZeroExtent: "PNG:IHDR",
      pngNoIdat: "PNG:IDAT",
      jpegNoMarker: "JPEG:marker",
      jpegTruncatedMarker: "JPEG:closure",
      jpegBytesAfterEoi: "JPEG:closure",
      jpegEoiWithoutFrame: "JPEG:frame",
      jpegStandaloneMarker: "JPEG:marker",
      jpegReservedMarker: "JPEG:marker",
      jpegTruncatedSegmentLength: "JPEG:segment",
      jpegShortFrame: "JPEG:frame",
      jpegDuplicateComponent: "JPEG:frame",
      jpegZeroExtent: "JPEG:frame",
      jpegFillBytes: JSON.stringify({
        media: "image/jpeg",
        width: 4,
        height: 3,
      }),
      jpegRestartOrder: "JPEG:restart",
      pdfHeader: "PDF:header",
      pdfNoClosure: "PDF:closure",
      pdfNoTrailerKeyword: "PDF:trailer",
      pdfXrefLineSuffix: "PDF:trailer",
      pdfXrefHeading: "PDF:trailer",
      pdfXrefEmptySubsection: "PDF:trailer",
      pdfPageKidType: "PDF:Pages",
      pdfKidsResidue: "PDF:Pages",
      xmlDoctype: "XML:prolog",
      xmlUnstartableRoot: "null",
      svgMalformedAttribute: "SVG:root",
      svgAttributeName: "SVG:name",
      svgDuplicateAttribute: "SVG:root",
      svgUndeclaredDefaultNamespace: "null",
      xmlnsElementName: "XML:namespace",
      svgTailAfterSelfClose: "SVG:closure",
      svgUnclosedWithText: "SVG:closure",
      svgUnterminatedComment: "SVG:closure",
      svgUnterminatedCdata: "SVG:closure",
      svgInstruction: svgOnly,
      svgUnterminatedInstruction: "SVG:closure",
      svgCloseName: "SVG:name",
      svgTailAfterRoot: "SVG:closure",
      svgMalformedChild: "SVG:closure",
      svgUnclosedRoot: "SVG:closure",
      xmlDeclarationAfterSpace: "XML:instruction",
      xmlUnterminatedProlog: "XML:misc",
      xmlPrologCommentDashes: "XML:comment",
      svgCdataEndInText: "SVG:text",
      svgAstralText: svgOnly,
      svgUnescapedAttribute: "SVG:attribute",
      svgEntities: svgOnly,
      dxfOddRecords: "DXF:records",
      dxfSectionName: "DXF:section",
      dxfNoEof: "DXF:closure",
      dxfNoSection: "DXF:closure",
    },
  );
};

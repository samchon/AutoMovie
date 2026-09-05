import {
  AutoMovieDesignReferenceContainerError,
  AutoMovieUtf8Error,
  inspectAutoMovieDesignReferenceContainer,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
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

/** Design evidence is emitted only by parser-confirmed complete containers. */
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
};

import { PNG } from "pngjs";

import { decodeAutoMovieUtf8 } from "./strictUtf8";

/** Parser-confirmed family and any extent carried by the admitted container. */
export type IAutoMovieDesignReferenceContainer =
  | { media: "image/png" | "image/jpeg"; width: number; height: number }
  | { media: "image/svg+xml"; width: number; height: number }
  | { media: "image/svg+xml" }
  | { media: "application/pdf" | "image/vnd.dxf" };

type IDesignReferenceExtent =
  | { width: number; height: number }
  | { width?: never; height?: never };

/** A controlled container refusal after a family candidate was observed. */
export class AutoMovieDesignReferenceContainerError extends Error {
  /** Stable machine-readable diagnostic code. */
  public readonly code =
    "automovie-design-reference-container-invalid" as const;

  public constructor(
    /** Logical design-reference path being inspected. */
    public readonly path: string,
    /** Container family selected by the observed signature or grammar. */
    public readonly family: string,
    /** Stable parser stage at which the candidate was refused. */
    public readonly stage: string,
    detail: string,
  ) {
    super(
      `Design reference "${path}" failed ${family} ${stage} validation: ${detail}`,
    );
    this.name = "AutoMovieDesignReferenceContainerError";
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * Admit one design reference only after its complete supported profile parses.
 *
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-structure-semantics Separates a signature candidate from parser-confirmed container facts.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-design-drawing-inspection Withholds reference evidence until the supported container profile closes.
 */
export const inspectAutoMovieDesignReferenceContainer = (props: {
  path: string;
  bytes: Uint8Array;
}): IAutoMovieDesignReferenceContainer | null => {
  if (startsWith(props.bytes, PNG_SIGNATURE)) return inspectPng(props);
  if (startsWith(props.bytes, [0xff, 0xd8])) return inspectJpeg(props);
  if (startsWith(props.bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return inspectPdf(props);
  const text = decodeAutoMovieUtf8({
    record: props.path,
    bytes: props.bytes,
    leadingBom: "strip",
  });
  const xml = inspectXmlRoot(props.path, text);
  if (xml !== null) {
    if (
      xml.localName !== "svg" ||
      xml.namespace !== "http://www.w3.org/2000/svg"
    )
      return null;
    return { media: "image/svg+xml", ...svgExtent(xml.attributes) };
  }
  const dxf = inspectDxf(props.path, text);
  return dxf ? { media: "image/vnd.dxf" } : null;
};

const inspectPng = (props: {
  path: string;
  bytes: Uint8Array;
}): IAutoMovieDesignReferenceContainer => {
  let decoded: PNG;
  try {
    decoded = PNG.sync.read(Buffer.from(props.bytes), { checkCRC: true });
  } catch (error) {
    throw invalid(props.path, "PNG", "closure", error);
  }
  if (decoded.width <= 0 || decoded.height <= 0)
    throw invalid(props.path, "PNG", "IHDR", "extent must be positive");
  let cursor = 8;
  let first = true;
  let idat = false;
  let ended = false;
  while (cursor + 12 <= props.bytes.length) {
    const size = readU32(props.bytes, cursor);
    const end = cursor + 12 + size;
    if (end > props.bytes.length)
      throw invalid(
        props.path,
        "PNG",
        "chunk",
        `chunk at byte ${cursor} is truncated`,
      );
    const tag = ascii(props.bytes, cursor + 4, 4);
    if (first && (tag !== "IHDR" || size !== 13))
      throw invalid(
        props.path,
        "PNG",
        "IHDR",
        "the first chunk must be a 13-byte IHDR",
      );
    if (tag === "IDAT") idat = true;
    if (tag === "IEND") {
      if (size !== 0)
        throw invalid(props.path, "PNG", "IEND", "IEND must be empty");
      ended = true;
      cursor = end;
      break;
    }
    cursor = end;
    first = false;
  }
  if (!idat)
    throw invalid(props.path, "PNG", "IDAT", "no IDAT chunk was found");
  if (!ended || cursor !== props.bytes.length)
    throw invalid(
      props.path,
      "PNG",
      "IEND",
      "the datastream is not closed exactly by IEND",
    );
  return { media: "image/png", width: decoded.width, height: decoded.height };
};

const inspectJpeg = (props: {
  path: string;
  bytes: Uint8Array;
}): IAutoMovieDesignReferenceContainer => {
  const bytes = props.bytes;
  let cursor = 2;
  let width: number | undefined;
  let height: number | undefined;
  let frameComponents: Set<number> | undefined;
  let scans = 0;
  let entropyBytes = 0;
  while (cursor < bytes.length) {
    if (bytes[cursor] !== 0xff)
      throw invalid(
        props.path,
        "JPEG",
        "marker",
        `expected a marker at byte ${cursor}`,
      );
    while (bytes[cursor] === 0xff) cursor += 1;
    const marker = bytes[cursor++];
    if (marker === undefined)
      throw invalid(
        props.path,
        "JPEG",
        "closure",
        "truncated marker at end of input",
      );
    if (marker === 0xd9) {
      if (cursor !== bytes.length)
        throw invalid(
          props.path,
          "JPEG",
          "closure",
          "bytes follow terminal EOI",
        );
      if (width === undefined || height === undefined)
        throw invalid(
          props.path,
          "JPEG",
          "frame",
          "no supported frame was found",
        );
      if (scans === 0 || entropyBytes === 0)
        throw invalid(
          props.path,
          "JPEG",
          "scan",
          "no complete entropy scan was found",
        );
      return { media: "image/jpeg", width, height };
    }
    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    )
      throw invalid(
        props.path,
        "JPEG",
        "marker",
        `unexpected standalone marker 0x${hex(marker)}`,
      );
    if (cursor + 2 > bytes.length)
      throw invalid(props.path, "JPEG", "segment", "truncated segment length");
    const size = readU16(bytes, cursor);
    if (size < 2 || cursor + size > bytes.length)
      throw invalid(
        props.path,
        "JPEG",
        "segment",
        `invalid segment length ${size}`,
      );
    const payload = cursor + 2;
    if (JPEG_FRAME_MARKERS.has(marker)) {
      if (width !== undefined || height !== undefined)
        throw invalid(
          props.path,
          "JPEG",
          "frame",
          "multiple frame headers are not in the admitted profile",
        );
      if (size < 8)
        throw invalid(props.path, "JPEG", "frame", "frame header is too small");
      const components = bytes[payload + 5]!;
      if (components === 0 || size !== 8 + 3 * components)
        throw invalid(
          props.path,
          "JPEG",
          "frame",
          "frame component table is truncated",
        );
      frameComponents = new Set<number>();
      for (let index = 0; index < components; ++index) {
        const identifier = bytes[payload + 6 + 3 * index]!;
        if (frameComponents.has(identifier))
          throw invalid(
            props.path,
            "JPEG",
            "frame",
            "frame component identifiers must be unique",
          );
        frameComponents.add(identifier);
      }
      height = readU16(bytes, payload + 1);
      width = readU16(bytes, payload + 3);
      if (width === 0 || height === 0)
        throw invalid(props.path, "JPEG", "frame", "extent must be positive");
    }
    cursor += size;
    if (marker === 0xda) {
      if (width === undefined || height === undefined)
        throw invalid(
          props.path,
          "JPEG",
          "scan",
          "scan precedes the supported frame header",
        );
      const components = bytes[payload]!;
      if (components === 0 || size !== 6 + 2 * components)
        throw invalid(
          props.path,
          "JPEG",
          "scan",
          "scan component table is truncated",
        );
      for (let index = 0; index < components; ++index)
        if (!frameComponents!.has(bytes[payload + 1 + 2 * index]!))
          throw invalid(
            props.path,
            "JPEG",
            "scan",
            "scan references a component absent from the frame",
          );
      scans += 1;
      const start = cursor;
      while (cursor < bytes.length) {
        if (bytes[cursor] !== 0xff) {
          cursor += 1;
          continue;
        }
        const next = bytes[cursor + 1];
        if (next === 0x00) {
          cursor += 2;
          continue;
        }
        if (next === 0xff) {
          cursor += 1;
          continue;
        }
        if (next !== undefined && next >= 0xd0 && next <= 0xd7) {
          cursor += 2;
          continue;
        }
        break;
      }
      entropyBytes += cursor - start;
    }
  }
  throw invalid(props.path, "JPEG", "closure", "missing terminal EOI");
};

const inspectPdf = (props: {
  path: string;
  bytes: Uint8Array;
}): IAutoMovieDesignReferenceContainer => {
  const text = Buffer.from(props.bytes).toString("latin1");
  if (!/^%PDF-1\.[0-7](?:\r\n|\r|\n)/.test(text))
    throw invalid(
      props.path,
      "PDF",
      "header",
      "unsupported or incomplete header",
    );
  if (!/\d+\s+\d+\s+obj\b[\s\S]*?\bendobj\b/.test(text))
    throw invalid(
      props.path,
      "PDF",
      "object",
      "no closed indirect object was found",
    );
  const closure = /startxref\s+(\d+)\s+%%EOF(?:\r\n|\r|\n)?$/.exec(text);
  if (closure === null)
    throw invalid(
      props.path,
      "PDF",
      "closure",
      "missing startxref or terminal %%EOF",
    );
  const offset = Number(closure[1]);
  if (!Number.isSafeInteger(offset) || !text.startsWith("xref", offset))
    throw invalid(
      props.path,
      "PDF",
      "xref",
      "startxref does not identify an xref table",
    );
  const trailer = text.slice(offset, closure.index);
  const xref = inspectClassicPdfXref(trailer);
  if (xref === null)
    throw invalid(
      props.path,
      "PDF",
      "trailer",
      "xref and Root trailer are incomplete",
    );
  const root = xref.entries.get(xref.root.object);
  const rootObject =
    root === undefined
      ? null
      : new RegExp(
          `^${xref.root.object}[ \\t]+${xref.root.generation}[ \\t]+obj\\b([\\s\\S]*?)\\bendobj\\b`,
        ).exec(text.slice(root.offset));
  if (
    root === undefined ||
    root.inUse === false ||
    root.generation !== xref.root.generation ||
    rootObject === null ||
    !/\/Type[ \t\r\n]+\/Catalog\b/.test(rootObject[1]!)
  )
    throw invalid(
      props.path,
      "PDF",
      "Root",
      "the Root reference has no matching in-use xref object",
    );
  return { media: "application/pdf" };
};

interface IPdfXrefEntry {
  offset: number;
  generation: number;
  inUse: boolean;
}

const inspectClassicPdfXref = (
  text: string,
): {
  entries: Map<number, IPdfXrefEntry>;
  root: { object: number; generation: number };
} | null => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const trailer = /\ntrailer[ \t\n]*<<([\s\S]*)>>[ \t\n]*$/.exec(normalized);
  if (trailer === null) return null;
  const lines = normalized.slice(0, trailer.index).split("\n");
  if (lines.shift() !== "xref") return null;
  const entries = new Map<number, IPdfXrefEntry>();
  while (lines.length !== 0) {
    const heading = /^(\d+)[ \t]+(\d+)$/.exec(lines.shift()!);
    if (heading === null) return null;
    const first = Number(heading[1]);
    const count = Number(heading[2]);
    if (
      !Number.isSafeInteger(first) ||
      !Number.isSafeInteger(count) ||
      count < 1
    )
      return null;
    for (let index = 0; index < count; ++index) {
      const entry = /^(\d{10})[ \t]+(\d{5})[ \t]+([nf])[ \t]*$/.exec(
        lines.shift() ?? "",
      );
      if (entry === null || entries.has(first + index)) return null;
      entries.set(first + index, {
        offset: Number(entry[1]),
        generation: Number(entry[2]),
        inUse: entry[3] === "n",
      });
    }
  }
  const root = /\/Root[ \t\r\n]+(\d+)[ \t\r\n]+(\d+)[ \t\r\n]+R\b/.exec(
    trailer[1]!,
  );
  return root === null
    ? null
    : {
        entries,
        root: { object: Number(root[1]), generation: Number(root[2]) },
      };
};

interface IXmlRoot {
  localName: string;
  namespace: string | undefined;
  attributes: ReadonlyMap<string, string>;
}

const inspectXmlRoot = (path: string, text: string): IXmlRoot | null => {
  const cursor = skipXmlMisc(path, text, 0, true);
  if (text[cursor] !== "<") return null;
  if (text.startsWith("<!", cursor))
    throw invalid(
      path,
      "XML",
      "prolog",
      "declarations and external entities are not admitted",
    );
  const root = readStartTag(path, text, cursor);
  if (root === null) return null;
  const prefix = root.name.includes(":") ? root.name.split(":", 1)[0]! : "";
  const localName = root.name.includes(":")
    ? root.name.slice(root.name.indexOf(":") + 1)
    : root.name;
  const namespace = root.attributes.get(prefix ? `xmlns:${prefix}` : "xmlns");
  validateXmlClosure(path, text, root);
  return { localName, namespace, attributes: root.attributes };
};

interface IStartTag {
  name: string;
  attributes: Map<string, string>;
  end: number;
  selfClosing: boolean;
}

const readStartTag = (
  path: string,
  text: string,
  offset: number,
): IStartTag | null => {
  const name = /^<([A-Za-z_][\w.:-]*)/.exec(text.slice(offset));
  if (name === null) return null;
  if (!isXmlQualifiedName(name[1]!))
    throw invalid(path, "SVG", "name", `invalid qualified name ${name[1]}`);
  let cursor = offset + name[0].length;
  const attributes = new Map<string, string>();
  while (true) {
    cursor = skipXmlSpace(text, cursor);
    if (text.startsWith("/>", cursor))
      return { name: name[1]!, attributes, end: cursor + 2, selfClosing: true };
    if (text[cursor] === ">")
      return {
        name: name[1]!,
        attributes,
        end: cursor + 1,
        selfClosing: false,
      };
    const attribute =
      /^([A-Za-z_][\w.:-]*)[ \t\r\n]*=[ \t\r\n]*(["'])([\s\S]*?)\2/.exec(
        text.slice(cursor),
      );
    if (attribute === null)
      throw invalid(
        path,
        "SVG",
        "root",
        `malformed root attribute at character ${cursor}`,
      );
    if (!isXmlQualifiedName(attribute[1]!))
      throw invalid(
        path,
        "SVG",
        "name",
        `invalid qualified name ${attribute[1]}`,
      );
    if (attributes.has(attribute[1]!))
      throw invalid(
        path,
        "SVG",
        "root",
        `duplicate root attribute ${attribute[1]}`,
      );
    attributes.set(attribute[1]!, decodeXmlAttribute(path, attribute[3]!));
    cursor += attribute[0].length;
  }
};

const validateXmlClosure = (
  path: string,
  text: string,
  root: IStartTag,
): void => {
  if (root.selfClosing) {
    if (skipXmlMisc(path, text, root.end) !== text.length)
      throw invalid(
        path,
        "SVG",
        "closure",
        "content follows the self-closed root",
      );
    return;
  }
  const stack = [root.name];
  let cursor = root.end;
  while (cursor < text.length) {
    const open = text.indexOf("<", cursor);
    if (open < 0) {
      validateXmlCharacterData(path, text.slice(cursor));
      break;
    }
    validateXmlCharacterData(path, text.slice(cursor, open));
    if (text.startsWith("<!--", open)) {
      const end = text.indexOf("-->", open + 4);
      if (end < 0)
        throw invalid(path, "SVG", "closure", "unterminated comment");
      if (text.slice(open + 4, end).includes("--"))
        throw invalid(path, "SVG", "comment", "comment body contains --");
      cursor = end + 3;
      continue;
    }
    if (text.startsWith("<![CDATA[", open)) {
      const end = text.indexOf("]]>", open + 9);
      if (end < 0) throw invalid(path, "SVG", "closure", "unterminated CDATA");
      validateXmlCharacters(path, text.slice(open + 9, end));
      cursor = end + 3;
      continue;
    }
    if (text.startsWith("<?", open)) {
      const end = text.indexOf("?>", open + 2);
      if (end < 0)
        throw invalid(path, "SVG", "closure", "unterminated instruction");
      validateXmlInstruction(path, text.slice(open + 2, end), false);
      cursor = end + 2;
      continue;
    }
    const close = /^<\/([A-Za-z_][\w.:-]*)[ \t\r\n]*>/.exec(text.slice(open));
    if (close !== null) {
      if (!isXmlQualifiedName(close[1]!))
        throw invalid(
          path,
          "SVG",
          "name",
          `invalid qualified name ${close[1]}`,
        );
      if (stack.pop() !== close[1])
        throw invalid(
          path,
          "SVG",
          "closure",
          `mismatched closing tag ${close[1]}`,
        );
      cursor = open + close[0].length;
      if (stack.length === 0) {
        if (skipXmlMisc(path, text, cursor) !== text.length)
          throw invalid(
            path,
            "SVG",
            "closure",
            "content follows the root element",
          );
        return;
      }
      continue;
    }
    const child = readStartTag(path, text, open);
    if (child === null)
      throw invalid(
        path,
        "SVG",
        "closure",
        `malformed markup at character ${open}`,
      );
    if (!child.selfClosing) stack.push(child.name);
    cursor = child.end;
  }
  throw invalid(path, "SVG", "closure", "root element is not closed");
};

const skipXmlMisc = (
  path: string,
  text: string,
  offset: number,
  allowDeclaration = false,
): number => {
  let cursor = skipXmlSpace(text, offset);
  while (text.startsWith("<?", cursor) || text.startsWith("<!--", cursor)) {
    const comment = text.startsWith("<!--", cursor);
    const closing = comment ? "-->" : "?>";
    const end = text.indexOf(closing, cursor + 2);
    if (end < 0) throw invalid(path, "XML", "misc", `unterminated ${closing}`);
    if (comment && text.slice(cursor + 4, end).includes("--"))
      throw invalid(path, "XML", "comment", "comment body contains --");
    if (comment) validateXmlCharacters(path, text.slice(cursor + 4, end));
    else {
      validateXmlInstruction(
        path,
        text.slice(cursor + 2, end),
        allowDeclaration,
      );
      allowDeclaration = false;
    }
    cursor = skipXmlSpace(text, end + closing.length);
  }
  return cursor;
};

const validateXmlCharacterData = (path: string, value: string): void => {
  if (value.includes("]]>"))
    throw invalid(path, "SVG", "text", "invalid XML character data");
  validateXmlCharacters(path, value);
  decodeXmlAttribute(path, value);
};

const validateXmlCharacters = (path: string, value: string): void => {
  for (const character of value)
    if (!isXmlCharacter(character.codePointAt(0)!))
      throw invalid(path, "XML", "character", "invalid XML character");
};

const isXmlCharacter = (scalar: number): boolean =>
  scalar === 0x09 ||
  scalar === 0x0a ||
  scalar === 0x0d ||
  (scalar >= 0x20 && scalar <= 0xd7ff) ||
  (scalar >= 0xe000 && scalar <= 0xfffd) ||
  (scalar >= 0x10000 && scalar <= 0x10ffff);

const isXmlQualifiedName = (value: string): boolean =>
  value.split(":").length <= 2 &&
  value.split(":").every((part) => /^[A-Za-z_][\w.-]*$/.test(part));

const validateXmlInstruction = (
  path: string,
  body: string,
  allowDeclaration: boolean,
): void => {
  validateXmlCharacters(path, body);
  const target = /^([A-Za-z_][\w.:-]*)(?:[ \t\r\n]|$)/.exec(body)?.[1];
  if (
    target === undefined ||
    (target.toLowerCase() === "xml" &&
      (target !== "xml" ||
        !allowDeclaration ||
        !/^xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(["'])1\.0\1(?:[ \t\r\n]+(?:encoding|standalone)[ \t\r\n]*=[\s\S]*)?$/.test(
          body,
        )))
  )
    throw invalid(path, "XML", "instruction", "invalid processing instruction");
};

const svgExtent = (
  attributes: ReadonlyMap<string, string>,
): IDesignReferenceExtent => {
  const viewBox = attributes.get("viewBox");
  if (viewBox !== undefined) {
    const fields = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      fields.length === 4 &&
      fields.every(Number.isFinite) &&
      fields[2]! > 0 &&
      fields[3]! > 0
    )
      return { width: fields[2]!, height: fields[3]! };
    return {};
  }
  const width = svgLength(attributes.get("width"));
  const height = svgLength(attributes.get("height"));
  if (width !== null && height !== null) return { width, height };
  return {};
};

const svgLength = (raw: string | undefined): number | null => {
  if (raw === undefined) return null;
  const spelling = raw.trim().replace(/px$/, "");
  const value = Number(spelling);
  return spelling !== "" && Number.isFinite(value) && value > 0 ? value : null;
};

const inspectDxf = (path: string, text: string): boolean => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const candidate = lines.some(
    (line) => line.trim() === "SECTION" || line.trim() === "$ACADVER",
  );
  if (!candidate) return false;
  if (lines.length % 2 !== 0)
    throw invalid(path, "DXF", "records", "a group code has no value");
  const records: Array<readonly [number, string]> = [];
  for (let index = 0; index < lines.length; index += 2) {
    const spelling = lines[index]!.trim();
    const code = Number(spelling);
    if (!/^\d+$/.test(spelling) || !Number.isInteger(code) || code > 1071)
      throw invalid(
        path,
        "DXF",
        "records",
        `invalid group code at line ${index + 1}`,
      );
    records.push([code, lines[index + 1]!.trim()]);
  }
  let cursor = 0;
  let sections = 0;
  while (
    cursor < records.length &&
    records[cursor]![0] === 0 &&
    records[cursor]![1] === "SECTION"
  ) {
    if (records[cursor + 1]?.[0] !== 2 || records[cursor + 1]![1] === "")
      throw invalid(
        path,
        "DXF",
        "section",
        "SECTION is missing its name record",
      );
    sections += 1;
    cursor += 2;
    while (
      cursor < records.length &&
      !(records[cursor]![0] === 0 && records[cursor]![1] === "ENDSEC")
    ) {
      if (records[cursor]![0] === 0 && records[cursor]![1] === "SECTION")
        throw invalid(path, "DXF", "section", "SECTION records cannot nest");
      cursor += 1;
    }
    if (cursor >= records.length)
      throw invalid(path, "DXF", "closure", "SECTION is missing ENDSEC");
    cursor += 1;
  }
  if (
    sections === 0 ||
    records[cursor]?.[0] !== 0 ||
    records[cursor]?.[1] !== "EOF" ||
    cursor + 1 !== records.length
  )
    throw invalid(
      path,
      "DXF",
      "closure",
      "drawing must end with one terminal EOF record",
    );
  return true;
};

const decodeXmlAttribute = (path: string, value: string): string => {
  validateXmlCharacters(path, value);
  const entity = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;
  if (/[<&]/.test(value.replace(entity, "")))
    throw invalid(path, "SVG", "attribute", "unescaped markup in attribute");
  return value.replace(entity, (reference) => {
    const decoded: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&apos;": "'",
    };
    const named = decoded[reference];
    if (named !== undefined) return named;
    const scalar = Number.parseInt(
      reference.slice(reference.startsWith("&#x") ? 3 : 2, -1),
      reference.startsWith("&#x") ? 16 : 10,
    );
    if (!Number.isInteger(scalar) || !isXmlCharacter(scalar))
      throw invalid(
        path,
        "SVG",
        "entity",
        `invalid character reference ${reference}`,
      );
    return String.fromCodePoint(scalar);
  });
};

const invalid = (
  path: string,
  family: string,
  stage: string,
  detail: unknown,
): AutoMovieDesignReferenceContainerError =>
  new AutoMovieDesignReferenceContainerError(
    path,
    family,
    stage,
    detail instanceof Error ? detail.message : String(detail),
  );

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  bytes.length >= signature.length &&
  signature.every((byte, index) => bytes[index] === byte);
const readU16 = (bytes: Uint8Array, offset: number): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(
    offset,
    false,
  );
const readU32 = (bytes: Uint8Array, offset: number): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    offset,
    false,
  );
const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  Buffer.from(bytes.subarray(offset, offset + length)).toString("ascii");
const skipXmlSpace = (text: string, offset: number): number => {
  while (
    text[offset] === " " ||
    text[offset] === "\t" ||
    text[offset] === "\r" ||
    text[offset] === "\n"
  )
    offset += 1;
  return offset;
};
const hex = (value: number): string => value.toString(16).padStart(2, "0");

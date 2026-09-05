import type { PNG } from "pngjs";

import { residentPngJs } from "./residentCodecs";
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
/** PDF white-space characters (ISO 32000-1 table 1) as a regex class source. */
const PDF_SPACE = "[\\0\\t\\n\\f\\r ]";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
const XML_BASE_NAMESPACES = new Map<string, string>([["xml", XML_NAMESPACE]]);

/**
 * Admit one design reference only after its complete supported profile parses.
 *
 * A signature or a token selects the family and nothing more; the family's
 * parser then has to close the container before any fact leaves this function.
 * The admitted profiles are deliberately narrow and are stated here so a
 * refusal is a decision rather than a limitation nobody wrote down:
 *
 * - PNG: the resident decoder reads the whole datastream with CRC checking,
 *   the first chunk is a 13-byte `IHDR` with a positive extent, at least one
 *   `IDAT` follows, and an empty `IEND` closes the bytes exactly.
 * - JPEG: every byte outside entropy-coded data is a marker segment of the
 *   interchange format, exactly one frame header states the extent, every scan
 *   references frame components, restart markers appear only under a positive
 *   `DRI` interval and in `RST0..RST7` order, and a terminal `EOI` closes the
 *   bytes exactly.
 * - PDF: a `%PDF-1.x` header, at least one closed indirect object, a classic
 *   cross-reference table reachable from `startxref`, a trailer naming `/Size`
 *   and `/Root`, a `Catalog` whose single `/Pages` tree is acyclic, parent-
 *   consistent and whose `/Count` equals its leaves, and a terminal `%%EOF`.
 *   The page box is not read, so the extent stays unsupported.
 * - SVG: strictly decoded UTF-8 that is a well-formed XML document without
 *   DTD or external entities, whose namespace-resolved root is `svg` in the
 *   SVG namespace; the extent is the root `viewBox`, else unitless or `px`
 *   `width` and `height`, and is omitted when neither states user units.
 * - DXF: group-code and value pairs forming `SECTION` / `ENDSEC` records that
 *   end with one `EOF`; the drawing extent is never derived.
 *
 * `null` means no family candidate was observed. A candidate that fails its
 * parser throws {@link AutoMovieDesignReferenceContainerError} naming the
 * family and stage, and malformed text throws the strict UTF-8 refusal before
 * any grammar runs.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-content-facts Selects a family from the signature, then requires that family's parser to close the whole container before any fact leaves, so a contradictory or polyglot input is refused rather than decoded by convenience.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-active-content Reads SVG, PDF and raster containers as data under a narrow admitted profile and executes nothing embedded in them.
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
    decoded = residentPngJs().PNG.sync.read(Buffer.from(props.bytes), {
      checkCRC: true,
    });
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
  let restartInterval = 0;
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
    // 0x00 is byte stuffing that exists only inside entropy-coded data, and
    // 0x02..0xBF are reserved codes with no defined segment structure.
    if (marker <= 0xbf)
      throw invalid(
        props.path,
        "JPEG",
        "marker",
        `reserved marker 0x${hex(marker)} has no segment structure`,
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
    if (marker === 0xdd) {
      if (size !== 4)
        throw invalid(
          props.path,
          "JPEG",
          "restart",
          "DRI must carry one two-byte restart interval",
        );
      restartInterval = readU16(bytes, payload);
    }
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
      let nextRestart = 0;
      while (cursor < bytes.length) {
        if (bytes[cursor] !== 0xff) {
          entropyBytes += 1;
          cursor += 1;
          continue;
        }
        const next = bytes[cursor + 1];
        if (next === 0x00) {
          entropyBytes += 1;
          cursor += 2;
          continue;
        }
        if (next === 0xff) {
          cursor += 1;
          continue;
        }
        if (next !== undefined && next >= 0xd0 && next <= 0xd7) {
          if (restartInterval === 0)
            throw invalid(
              props.path,
              "JPEG",
              "restart",
              "restart markers require a positive DRI interval",
            );
          if (next - 0xd0 !== nextRestart)
            throw invalid(
              props.path,
              "JPEG",
              "restart",
              `expected RST${nextRestart} but found RST${next - 0xd0}`,
            );
          nextRestart = (nextRestart + 1) % 8;
          cursor += 2;
          continue;
        }
        break;
      }
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
  if (!/\d+[\0\t\n\f\r ]+\d+[\0\t\n\f\r ]+obj\b[\s\S]*?\bendobj\b/.test(text))
    throw invalid(
      props.path,
      "PDF",
      "object",
      "no closed indirect object was found",
    );
  const closure =
    /startxref[\0\t\n\f\r ]+(\d+)[\0\t\n\f\r ]+%%EOF(?:\r\n|\r|\n)?$/.exec(
      text,
    );
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
  const rootObject = readClassicPdfObject(text, xref.entries, xref.root);
  if (rootObject === null || pdfTypes(rootObject).join() !== "Catalog")
    throw invalid(
      props.path,
      "PDF",
      "Root",
      "the Root reference has no matching in-use xref object",
    );
  const pages = pdfReferences(rootObject, "Pages");
  if (pages.length !== 1)
    throw invalid(
      props.path,
      "PDF",
      "Pages",
      "the Catalog must carry one Pages tree reference",
    );
  inspectClassicPdfPageTree({
    path: props.path,
    text,
    entries: xref.entries,
    root: pages[0]!,
  });
  return { media: "application/pdf" };
};

interface IPdfXrefEntry {
  offset: number;
  generation: number;
  inUse: boolean;
}

interface IPdfReference {
  object: number;
  generation: number;
}

const inspectClassicPdfXref = (
  text: string,
): {
  entries: Map<number, IPdfXrefEntry>;
  root: IPdfReference;
} | null => {
  const normalized = text.replace(/\r\n?/g, "\n");
  const trailer = /\ntrailer[\0\t\n\f ]*<<([\s\S]*)>>[\0\t\n\f ]*$/.exec(
    normalized,
  );
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
  const dictionary = trailer[1]!;
  const roots = [
    ...dictionary.matchAll(
      /\/Root[\0\t\n\f\r ]+(\d+)[\0\t\n\f\r ]+(\d+)[\0\t\n\f\r ]+R\b/g,
    ),
  ];
  const sizes = [...dictionary.matchAll(/\/Size[\0\t\n\f\r ]+(\d+)\b/g)];
  if (roots.length !== 1 || sizes.length !== 1) return null;
  const root = {
    object: Number(roots[0]![1]),
    generation: Number(roots[0]![2]),
  };
  const size = Number(sizes[0]![1]);
  if (
    !Number.isSafeInteger(root.object) ||
    !Number.isSafeInteger(root.generation) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    root.object >= size ||
    [...entries.keys()].some((object) => object >= size)
  )
    return null;
  return { entries, root };
};

const readClassicPdfObject = (
  text: string,
  entries: ReadonlyMap<number, IPdfXrefEntry>,
  reference: IPdfReference,
): string | null => {
  const entry = entries.get(reference.object);
  if (
    entry === undefined ||
    entry.inUse === false ||
    entry.generation !== reference.generation
  )
    return null;
  return (
    new RegExp(
      `^${reference.object}${PDF_SPACE}+${reference.generation}${PDF_SPACE}+obj\\b([\\s\\S]*?)\\bendobj\\b`,
    ).exec(text.slice(entry.offset))?.[1] ?? null
  );
};

const pdfTypes = (body: string): string[] =>
  [...body.matchAll(/\/Type[\0\t\n\f\r ]+\/([A-Za-z]+)\b/g)].map(
    (match) => match[1]!,
  );

const pdfReferences = (body: string, key: string): IPdfReference[] =>
  [
    ...body.matchAll(
      new RegExp(
        `/${key}${PDF_SPACE}+(\\d+)${PDF_SPACE}+(\\d+)${PDF_SPACE}+R\\b`,
        "g",
      ),
    ),
  ].map((match) => ({
    object: Number(match[1]),
    generation: Number(match[2]),
  }));

const inspectClassicPdfPageTree = (props: {
  path: string;
  text: string;
  entries: ReadonlyMap<number, IPdfXrefEntry>;
  root: IPdfReference;
}): void => {
  const visited = new Set<string>();
  const visit = (
    reference: IPdfReference,
    parent: IPdfReference | null,
  ): number => {
    const identity = `${reference.object}:${reference.generation}`;
    if (visited.has(identity))
      throw invalid(
        props.path,
        "PDF",
        "Pages",
        "the Pages tree contains a cycle or repeated child",
      );
    visited.add(identity);
    const body = readClassicPdfObject(props.text, props.entries, reference);
    if (body === null)
      throw invalid(
        props.path,
        "PDF",
        "Pages",
        "a Pages tree reference has no matching in-use xref object",
      );
    const types = pdfTypes(body);
    if (types.length !== 1 || (types[0] !== "Pages" && types[0] !== "Page"))
      throw invalid(
        props.path,
        "PDF",
        "Pages",
        "every Pages tree object must declare one Page or Pages type",
      );
    const parents = pdfReferences(body, "Parent");
    if (
      parent === null
        ? parents.length !== 0 || types[0] !== "Pages"
        : parents.length !== 1 ||
          parents[0]!.object !== parent.object ||
          parents[0]!.generation !== parent.generation
    )
      throw invalid(
        props.path,
        "PDF",
        "Pages",
        "each non-root page-tree object must point to its exact parent",
      );
    if (types[0] === "Page") return 1;
    const kids = [...body.matchAll(/\/Kids[\0\t\n\f\r ]*\[([^\]]*)\]/g)];
    const counts = [...body.matchAll(/\/Count[\0\t\n\f\r ]+(\d+)\b/g)];
    if (kids.length !== 1 || counts.length !== 1)
      throw invalid(
        props.path,
        "PDF",
        "Pages",
        "each Pages node must carry one Kids array and Count",
      );
    const children = [
      ...kids[0]![1]!.matchAll(/(\d+)[\0\t\n\f\r ]+(\d+)[\0\t\n\f\r ]+R\b/g),
    ].map((match) => ({
      object: Number(match[1]),
      generation: Number(match[2]),
    }));
    const residue = kids[0]![1]!
      .replace(/\d+[\0\t\n\f\r ]+\d+[\0\t\n\f\r ]+R\b/g, "")
      .trim();
    const declared = Number(counts[0]![1]);
    if (!Number.isSafeInteger(declared) || residue !== "")
      throw invalid(
        props.path,
        "PDF",
        "Pages",
        "the Kids array and Count must use bounded indirect identities",
      );
    const measured = children.reduce(
      (sum, child) => sum + visit(child, reference),
      0,
    );
    if (measured !== declared)
      throw invalid(
        props.path,
        "PDF",
        "Pages",
        `page-tree Count ${declared} does not match ${measured} leaves`,
      );
    return measured;
  };
  visit(props.root, null);
};

interface IXmlRoot {
  localName: string;
  namespace: string | undefined;
  attributes: ReadonlyMap<string, string>;
}

const inspectXmlRoot = (path: string, text: string): IXmlRoot | null => {
  const cursor = skipXmlMisc(path, text, 0, true);
  const leading = text.codePointAt(cursor);
  if (leading !== undefined && !isXmlCharacter(leading))
    throw invalid(path, "XML", "character", "invalid leading XML character");
  if (text[cursor] !== "<") return null;
  if (text.startsWith("<!", cursor))
    throw invalid(
      path,
      "XML",
      "prolog",
      "declarations and external entities are not admitted",
    );
  const root = readStartTag(path, text, cursor, XML_BASE_NAMESPACES);
  if (root === null) return null;
  validateXmlClosure(path, text, root);
  return {
    localName: root.localName,
    namespace: root.namespace,
    attributes: root.attributes,
  };
};

interface IStartTag {
  name: string;
  localName: string;
  namespace: string | undefined;
  namespaces: ReadonlyMap<string, string>;
  attributes: Map<string, string>;
  end: number;
  selfClosing: boolean;
}

const readStartTag = (
  path: string,
  text: string,
  offset: number,
  inheritedNamespaces: ReadonlyMap<string, string>,
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
      return finishStartTag({
        path,
        name: name[1]!,
        attributes,
        end: cursor + 2,
        selfClosing: true,
        inheritedNamespaces,
      });
    if (text[cursor] === ">")
      return finishStartTag({
        path,
        name: name[1]!,
        attributes,
        end: cursor + 1,
        selfClosing: false,
        inheritedNamespaces,
      });
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

const finishStartTag = (props: {
  path: string;
  name: string;
  attributes: Map<string, string>;
  end: number;
  selfClosing: boolean;
  inheritedNamespaces: ReadonlyMap<string, string>;
}): IStartTag => {
  const namespaces = new Map(props.inheritedNamespaces);
  for (const [name, namespace] of props.attributes) {
    const prefix =
      name === "xmlns"
        ? ""
        : name.startsWith("xmlns:")
          ? name.slice("xmlns:".length)
          : null;
    if (prefix === null) continue;
    if (
      prefix === "xmlns" ||
      namespace === XMLNS_NAMESPACE ||
      (prefix === "xml" && namespace !== XML_NAMESPACE) ||
      (prefix !== "xml" && namespace === XML_NAMESPACE) ||
      (prefix !== "" && namespace === "")
    )
      throw invalid(
        props.path,
        "XML",
        "namespace",
        `invalid namespace binding ${name}`,
      );
    if (namespace === "") namespaces.delete(prefix);
    else namespaces.set(prefix, namespace);
  }
  const element = resolveXmlName(props.path, props.name, namespaces, true);
  const expandedAttributes = new Set<string>();
  for (const name of props.attributes.keys()) {
    if (name === "xmlns" || name.startsWith("xmlns:")) continue;
    const expanded = resolveXmlName(props.path, name, namespaces, false);
    const identity = `${expanded.namespace ?? ""}\u0000${expanded.localName}`;
    if (expandedAttributes.has(identity))
      throw invalid(
        props.path,
        "XML",
        "namespace",
        `duplicate expanded attribute name ${name}`,
      );
    expandedAttributes.add(identity);
  }
  return {
    name: props.name,
    localName: element.localName,
    namespace: element.namespace,
    namespaces,
    attributes: props.attributes,
    end: props.end,
    selfClosing: props.selfClosing,
  };
};

const resolveXmlName = (
  path: string,
  name: string,
  namespaces: ReadonlyMap<string, string>,
  defaultNamespace: boolean,
): { localName: string; namespace: string | undefined } => {
  const separator = name.indexOf(":");
  const prefix = separator === -1 ? "" : name.slice(0, separator);
  const localName = separator === -1 ? name : name.slice(separator + 1);
  if (prefix === "xmlns")
    throw invalid(
      path,
      "XML",
      "namespace",
      "the xmlns prefix cannot name an element or ordinary attribute",
    );
  const namespace =
    prefix === ""
      ? defaultNamespace
        ? namespaces.get("")
        : undefined
      : namespaces.get(prefix);
  if (prefix !== "" && namespace === undefined)
    throw invalid(
      path,
      "XML",
      "namespace",
      `unbound namespace prefix ${prefix}`,
    );
  return { localName, namespace };
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
  const stack = [root];
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
      if (stack.pop()?.name !== close[1])
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
    const child = readStartTag(path, text, open, stack.at(-1)!.namespaces);
    if (child === null)
      throw invalid(
        path,
        "SVG",
        "closure",
        `malformed markup at character ${open}`,
      );
    if (!child.selfClosing) stack.push(child);
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
  if (cursor !== offset) allowDeclaration = false;
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
    }
    allowDeclaration = false;
    cursor = skipXmlSpace(text, end + closing.length);
  }
  return cursor;
};

const validateXmlCharacterData = (path: string, value: string): void => {
  if (value.includes("]]>"))
    throw invalid(path, "SVG", "text", "invalid XML character data");
  decodeXmlText(path, value, "text");
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
  // XML 1.0 XMLDecl: the pseudo-attribute names, the version and the
  // standalone values are case-sensitive; only the encoding name is not.
  const declaration =
    /^xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(["'])1\.0\1(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(["'])[Uu][Tt][Ff]-8\2)?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(["'])(?:yes|no)\3)?[ \t\r\n]*$/.test(
      body,
    );
  if (
    target === undefined ||
    (target.toLowerCase() === "xml" &&
      (target !== "xml" || !allowDeclaration || !declaration))
  )
    throw invalid(path, "XML", "instruction", "invalid processing instruction");
};

const svgExtent = (
  attributes: ReadonlyMap<string, string>,
): IDesignReferenceExtent => {
  const viewBox = attributes.get("viewBox");
  if (viewBox !== undefined) {
    const fields = trimXmlSpace(viewBox)
      .split(/[ \t\r\n,]+/)
      .map(svgNumber);
    if (
      fields.length === 4 &&
      fields.every((field) => field !== null) &&
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
  const value = svgNumber(trimXmlSpace(raw).replace(/px$/, ""));
  return value !== null && value > 0 ? value : null;
};

/**
 * One SVG `<number>`: an optional sign, an integer or a fraction with digits
 * after the point, and an optional exponent. `Number()` would also read hex,
 * binary, octal and `Infinity` spellings the SVG grammar does not contain.
 */
const svgNumber = (spelling: string): number | null => {
  if (!/^[+-]?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(spelling)) return null;
  const value = Number(spelling);
  return Number.isFinite(value) ? value : null;
};

const inspectDxf = (path: string, text: string): boolean => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  const candidate = lines.some(
    (line) =>
      trimDxfField(line) === "SECTION" || trimDxfField(line) === "$ACADVER",
  );
  if (!candidate) return false;
  if (lines.length % 2 !== 0)
    throw invalid(path, "DXF", "records", "a group code has no value");
  const records: Array<readonly [number, string]> = [];
  for (let index = 0; index < lines.length; index += 2) {
    const spelling = trimDxfField(lines[index]!);
    const code = Number(spelling);
    if (!/^\d+$/.test(spelling) || !Number.isInteger(code) || code > 1071)
      throw invalid(
        path,
        "DXF",
        "records",
        `invalid group code at line ${index + 1}`,
      );
    records.push([code, trimDxfField(lines[index + 1]!)]);
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

const decodeXmlAttribute = (path: string, value: string): string =>
  decodeXmlText(path, value, "attribute");

/** Resolve the predefined entities and character references of one text run. */
const decodeXmlText = (
  path: string,
  value: string,
  role: "attribute" | "text",
): string => {
  validateXmlCharacters(path, value);
  const entity = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;
  if (/[<&]/.test(value.replace(entity, "")))
    throw invalid(path, "SVG", role, `unescaped markup in ${role}`);
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
const trimXmlSpace = (value: string): string =>
  value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
const trimDxfField = (value: string): string =>
  value.replace(/^[ \t]+|[ \t]+$/g, "");
const hex = (value: number): string => value.toString(16).padStart(2, "0");

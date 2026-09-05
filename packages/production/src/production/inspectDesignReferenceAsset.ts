import {
  AutoMovieContentDigest,
  AutoMovieDesignReferenceMedia,
} from "@automovie/interface";

import { digestAutoMovieBytes } from "./contentIdentity";
import { inspectAutoMovieDesignReferenceContainer } from "./designReferenceContainer";

/**
 * Every container this inspector recognizes, named in each refusal so a
 * rejected reference says what to register instead of only what it is not.
 */
const SUPPORTED_DESIGN_REFERENCES =
  'Supported design references are PNG ("image/png"), JPEG ("image/jpeg"), SVG ("image/svg+xml"), PDF ("application/pdf") and DXF ("image/vnd.dxf") bytes.';

/**
 * The source-space extent of one design reference, or an honest statement that
 * this host cannot measure it.
 *
 * A PDF page box needs a page-content parser and a DXF extent needs an entity
 * sweep; this host ships neither. Reporting `unsupported` keeps the frame the
 * author declared unverified rather than silently blessed, which is the
 * opposite of returning a plausible-looking guess.
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
   * Container family confirmed by its own parser, never by a name.
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
 * ## Why a signature is not a family
 *
 * The family is whatever {@link inspectAutoMovieDesignReferenceContainer}
 * confirms after the complete admitted profile parses, so a PNG that stops
 * after its header, a JPEG with no scan, a `%PDF-` prefix, or an SVG root
 * hidden in a comment never becomes a measured reference. A candidate that
 * fails its parser throws that parser's typed refusal, and malformed UTF-8
 * text throws the strict decoding refusal, so a caller can name the exact
 * stage rather than fold every failure into "unsupported".
 *
 * ## Why it refuses instead of guessing
 *
 * Bytes in which no family candidate is observed throw, naming
 * {@link SUPPORTED_DESIGN_REFERENCES}, because a reference nobody can open
 * cannot be the basis of a building. A confirmed container whose extent this
 * host cannot derive — a PDF page, a DXF drawing, an SVG sized only in
 * millimetres with no `viewBox` — returns `unsupported` with the reason. The
 * one thing this function will never do is invent a number that a downstream
 * frame then treats as measured.
 *
 * The whole function is a pure function of `bytes`: no filesystem, no clock, no
 * locale, so the same asset inspects identically on every machine.
 * @evidence requirements/external-inputs/media-families-and-declared-facts.md#external-media-image-video Reads the family, extent and digest of a design reference image out of its bytes, never out of its filename extension.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-image-video-inspection Produces the decoded extent and container facts of a design reference image from its parsed bytes.
 * @evidence specifications/interchange-and-adoption/media-inspection-boundaries.md#interchange-design-drawing-inspection Identifies the registered drawing family from the bytes and measures its source-space extent without claiming map adoption or placement.
 */
export const inspectDesignReferenceAsset = (props: {
  /** Project-relative declared asset path, named in every refusal. */
  path: string;
  /** Exact current bytes of that asset. */
  bytes: Uint8Array;
}): IAutoMovieInspectedDesignReference => {
  const digest = digestAutoMovieBytes(props.bytes);
  const container = inspectAutoMovieDesignReferenceContainer(props);
  if (container === null)
    throw new Error(
      `Design reference "${props.path}" is not a container this host recognizes (${leadingHex(props.bytes)}). ${SUPPORTED_DESIGN_REFERENCES}`,
    );
  if ("width" in container)
    return {
      media: container.media,
      digest,
      bounds: {
        status: "measured",
        width: container.width,
        height: container.height,
      },
    };
  return {
    media: container.media,
    digest,
    bounds: {
      status: "unsupported",
      reason: `Design reference "${props.path}" is a parser-confirmed "${container.media}" container whose source extent this host does not derive. Declare the frame bounds from the drawing itself.`,
    },
  };
};

/** The leading bytes as hex, for a file whose family is not recognizable. */
const leadingHex = (bytes: Uint8Array): string => {
  let text = "0x";
  for (let index = 0; index < Math.min(4, bytes.length); ++index)
    text += bytes[index]!.toString(16).padStart(2, "0");
  return bytes.length === 0 ? "empty" : text;
};

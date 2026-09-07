import type { AutoMovieAuthoredDocumentLayer } from "@automovie/evidence";

/**
 * A position in the decoded source, retaining UTF-16 offsets and one-based coordinates.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Gives each projection a precise source address that survives Unicode and newline conventions.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Carries inclusive or exclusive coordinates in the original UTF-16 source.
 * @author Samchon
 */
export interface IAutoMovieReferencePosition {
  /** Zero-based UTF-16 code-unit offset into the decoded original source. */
  offset: number;
  /** One-based source line, treating CRLF as one line break. */
  line: number;
  /** One-based UTF-16 column within the original source line. */
  column: number;
}

/**
 * One inclusive-start, exclusive-end interval of the original source.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Identifies original characters without rebasing the reference view.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Defines the interval whose source slice participates in lossless projection.
 * @author Samchon
 */
export interface IAutoMovieReferenceRange {
  /** First included source position; equal endpoints describe an empty span. */
  start: IAutoMovieReferencePosition;
  /** First excluded source position, including the position immediately at EOF. */
  end: IAutoMovieReferencePosition;
}

/**
 * A compact navigable heading; ordinal parents also identify unanchored drafts.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-selection Exposes actual hierarchy and refuses to fabricate an address for a draft heading.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-selection Carries source order, parent ordinal, explicit anchor and addressability for one heading.
 * @author Samchon
 */
export interface IAutoMovieReferenceHeading {
  /** Zero-based ordinal among all original top-level document headings. */
  ordinal: number;
  /** Original Markdown heading depth, without reader-edition rebasing. */
  depth: number;
  /** Original heading title after omitting comments and its explicit anchor marker. */
  title: string;
  /** Authored trailing anchor, or null when the draft provides no explicit address. */
  anchor: string | null;
  /** Exact project-relative file#anchor when authored, even if ambiguity prevents reading. */
  location: string | null;
  /** Whether that explicit address uniquely selects a supported H2/H3/H4 section. */
  addressability:
    | "addressable"
    | "unaddressable"
    | "ambiguous"
    | "unsupported_depth";
  /** Nearest preceding shallower heading ordinal, including H1, or null at the root. */
  parent: number | null;
  /** Original heading syntax span; its following newline and subtree body are separate. */
  range: IAutoMovieReferenceRange;
}

/**
 * One file's compact current-source navigation result.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-selection Makes a titleless document or heading-free group index discoverable without inventing units.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-selection Lists only H2/H3/H4 while retaining the original H1 title when present.
 * @author Samchon
 */
export interface IAutoMovieReferenceFileIndex {
  /** Canonical docs/<authored-layer>/...md identity relative to the bound production. */
  file: string;
  /** SHA-256 of the exact UTF-8 source bytes represented by this index. */
  revision: string;
  /** Original byte count, including annotations and an optional UTF-8 BOM. */
  sourceBytes: number;
  /** First actual H1 title, or null; a filename is never promoted to a title. */
  title: string | null;
  /** Entire original decoded file span, including comments hidden from projections. */
  range: IAutoMovieReferenceRange;
  /** Compact H2/H3/H4 entries in original source order, without body text. */
  headings: IAutoMovieReferenceHeading[];
  /** Location-only notices; annotation contents are never diagnostic messages. */
  diagnostics: {
    /** The recognized block comment remains open through EOF. */
    code: "UNTERMINATED_ANNOTATION";
    /** Full original unterminated comment interval. */
    range: IAutoMovieReferenceRange;
  }[];
}

/**
 * An exact comment-free file or subtree view, optionally retaining its piece map.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Preserves original content and revision while making source reconstruction explicitly opt-in.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Separates the selected heading from its body and exposes ordered original source ranges on request.
 * @author Samchon
 */
export interface IAutoMovieReferenceContent {
  /** Canonical project-relative identity of the source read for this projection. */
  file: string;
  /** SHA-256 of the same source snapshot that supplies the content and ranges. */
  revision: string;
  /** Original file byte count before annotation removal or section selection. */
  sourceBytes: number;
  /** UTF-8 byte count of content alone, distinct from the serialized response budget. */
  contentBytes: number;
  /** Selected original file or subtree body interval, before comment omission. */
  range: IAutoMovieReferenceRange;
  /** Selected section heading metadata; null for a whole-file read. */
  heading: IAutoMovieReferenceHeading | null;
  /** Ordered original source slices with only recognized HTML comments omitted. */
  content: string;
  /** Unterminated-comment notices intersecting the selected original interval. */
  diagnostics: IAutoMovieReferenceFileIndex["diagnostics"];
  /** Present only for detail=true, so ordinary reference responses stay compact. */
  projection?: {
    /** Ordered retained source spans whose concatenation exactly reconstructs content. */
    contentRanges: IAutoMovieReferenceRange[];
    /** Omitted comment spans clipped to the selected source interval. */
    annotationRanges: IAutoMovieReferenceRange[];
  };
}

/**
 * A bounded layer page tied to a digest of its ordered file snapshots.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Distinguishes partial navigation from a complete inventory and prevents cross-revision page assembly.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Exposes an explicit revision-and-offset continuation with no claim of repository atomicity.
 * @author Samchon
 */
export interface IAutoMovieReferenceLayerIndex {
  /** The single authored Markdown family requested from the shared layer inventory. */
  layer: AutoMovieAuthoredDocumentLayer;
  /** Digest of ordered file paths and per-file source revisions observed by this request. */
  revision: string;
  /** Always false: separately read files do not form an atomic repository snapshot. */
  atomic: false;
  /** Complete admitted layer file count, not merely this page's length. */
  total: number;
  /** Whole compact file indices on this page in UTF-16 path order. */
  files: IAutoMovieReferenceFileIndex[];
  /** Next unread file offset on this same layer revision, or null at the end. */
  continuation: {
    /** Layer revision that must still match when the next page is requested. */
    revision: string;
    /** Zero-based ordinal of the next unread file in the complete sorted inventory. */
    offset: number;
  } | null;
}

/**
 * Four transport-independent reference requests; none can supply a new root.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Gives MCP and the local command one request grammar for the same providers.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Limits dispatch to layer/file indices and file/section projection.
 */
export type AutoMovieReferenceRequest =
  | {
      /** Select bounded layer navigation without returning source body text. */
      operation: "get_index_of_layer";
      /** One family from the shared thirteen-layer authored population. */
      layer: AutoMovieAuthoredDocumentLayer;
      /** Requested maximum whole file indices, 1 through 100; defaults to 20. */
      limit?: number;
      /** Resume the exact previously observed layer revision rather than mixing pages. */
      continuation?: {
        /** Sixty-four lowercase hex digits identifying the previous layer snapshot. */
        revision: string;
        /** Next file ordinal returned by the preceding page, between 1 and 10,000. */
        offset: number;
      };
      /** Complete success-envelope UTF-8 byte limit, 256 through 1 MiB; defaults to 64 KiB. */
      budgetBytes?: number;
    }
  | {
      /** Select compact current-file navigation without source body text. */
      operation: "get_index_of_file";
      /** Exact canonical authored Markdown path relative to the bound root. */
      file: string;
      /** Complete success-envelope byte limit; an oversized index is refused, not cut. */
      budgetBytes?: number;
    }
  | {
      /** Select all original file content except recognized HTML annotations. */
      operation: "read_file_without_annotations";
      /** Exact canonical authored Markdown path relative to the bound root. */
      file: string;
      /** Optional SHA-256 navigation revision; a mismatch refuses the current read as stale. */
      expectedDigest?: string;
      /** Opt into retained and omitted original source spans; false or absent stays compact. */
      detail?: boolean;
      /** Complete success-envelope byte limit; content is never silently truncated. */
      budgetBytes?: number;
    }
  | {
      /** Select one explicitly anchored H2/H3/H4 subtree with separate heading metadata. */
      operation: "read_section_without_annotations";
      /** Exact canonical file#anchor; no inferred slug or nearest-section fallback exists. */
      location: string;
      /** Optional SHA-256 navigation revision; a mismatch requires fresh discovery. */
      expectedDigest?: string;
      /** Opt into the exact source spans used to assemble this subtree projection. */
      detail?: boolean;
      /** Complete success-envelope byte limit; an oversized subtree is refused in full. */
      budgetBytes?: number;
    };

/**
 * A success or a sanitized, classified refusal shared by both transports.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-bounds Keeps failure distinguishable from an empty successful layer and never exposes annotation text in diagnostics.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-bounds Carries a specific error code and recovery message instead of silently truncating or swallowing failure.
 */
export type AutoMovieReferenceResult =
  | {
      /** True only when the complete admitted response fits its requested budget. */
      ok: true;
      /** Current source navigation or projection selected by the request operation. */
      data:
        | IAutoMovieReferenceFileIndex
        | IAutoMovieReferenceLayerIndex
        | IAutoMovieReferenceContent;
    }
  | {
      /** False distinguishes a refusal from an empty successful result. */
      ok: false;
      /** Sanitized classified failure, never external exception text or source annotations. */
      error: {
        /** Stable refusal category used to choose recovery or fresh navigation. */
        code: string;
        /** Source-free explanation and recovery guidance authored by the provider. */
        message: string;
      };
    };

/**
 * The entire read capability available to the provider, already bound to one root.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-isolation Makes source writes and runtime execution absent from the provider's dependency surface.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-isolation Supplies only bounded file bytes and authored-layer identities from the bound production.
 * @author Samchon
 */
export interface IAutoMovieReferenceReader {
  /** Read one canonical authored file's current bounded bytes without mutating the production. */
  read(file: string): Promise<Uint8Array>;
  /** Enumerate canonical authored Markdown identities; a missing layer yields an empty list. */
  list(layer: AutoMovieAuthoredDocumentLayer): Promise<readonly string[]>;
}

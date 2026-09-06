import type { AutoMovieAuthoredDocumentLayer } from "@automovie/evidence";

/**
 * A position in the decoded source, retaining UTF-16 offsets and one-based coordinates.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-source Gives each projection a precise source address that survives Unicode and newline conventions.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-source Carries inclusive or exclusive coordinates in the original UTF-16 source.
 * @author Samchon
 */
export interface IAutoMovieReferencePosition {
  offset: number;
  line: number;
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
  start: IAutoMovieReferencePosition;
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
  ordinal: number;
  depth: number;
  title: string;
  anchor: string | null;
  location: string | null;
  addressability:
    | "addressable"
    | "unaddressable"
    | "ambiguous"
    | "unsupported_depth";
  parent: number | null;
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
  file: string;
  revision: string;
  sourceBytes: number;
  title: string | null;
  range: IAutoMovieReferenceRange;
  headings: IAutoMovieReferenceHeading[];
  diagnostics: {
    code: "UNTERMINATED_ANNOTATION";
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
  file: string;
  revision: string;
  sourceBytes: number;
  contentBytes: number;
  range: IAutoMovieReferenceRange;
  heading: IAutoMovieReferenceHeading | null;
  content: string;
  diagnostics: IAutoMovieReferenceFileIndex["diagnostics"];
  projection?: {
    contentRanges: IAutoMovieReferenceRange[];
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
  layer: AutoMovieAuthoredDocumentLayer;
  revision: string;
  atomic: false;
  total: number;
  files: IAutoMovieReferenceFileIndex[];
  continuation: { revision: string; offset: number } | null;
}

/**
 * Four transport-independent reference requests; none can supply a new root.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-transports Gives MCP and the local command one request grammar for the same providers.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-transports Limits dispatch to layer/file indices and file/section projection.
 */
export type AutoMovieReferenceRequest =
  | {
      operation: "get_index_of_layer";
      layer: AutoMovieAuthoredDocumentLayer;
      limit?: number;
      continuation?: { revision: string; offset: number };
      budgetBytes?: number;
    }
  | { operation: "get_index_of_file"; file: string; budgetBytes?: number }
  | {
      operation: "read_file_without_annotations";
      file: string;
      expectedDigest?: string;
      detail?: boolean;
      budgetBytes?: number;
    }
  | {
      operation: "read_section_without_annotations";
      location: string;
      expectedDigest?: string;
      detail?: boolean;
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
      ok: true;
      data:
        | IAutoMovieReferenceFileIndex
        | IAutoMovieReferenceLayerIndex
        | IAutoMovieReferenceContent;
    }
  | { ok: false; error: { code: string; message: string } };

/**
 * The entire read capability available to the provider, already bound to one root.
 *
 * @evidence requirements/agent-authoring/reference-navigation.md#agent-reference-isolation Makes source writes and runtime execution absent from the provider's dependency surface.
 * @evidence specifications/authoring-and-authority/reference-navigation.md#spec-reference-isolation Supplies only bounded file bytes and authored-layer identities from the bound production.
 * @author Samchon
 */
export interface IAutoMovieReferenceReader {
  read(file: string): Promise<Uint8Array>;
  list(layer: AutoMovieAuthoredDocumentLayer): Promise<readonly string[]>;
}

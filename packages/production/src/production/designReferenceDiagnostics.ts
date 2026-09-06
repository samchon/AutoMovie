import {
  validateDesignEvidence,
  validateDesignReference,
} from "@automovie/engine";
import {
  AutoMovieDiagnosticCode,
  IAutoMovieDesignEvidence,
  IAutoMovieDesignReference,
  IAutoMovieDiagnostic,
} from "@automovie/interface";

import { digestAutoMovieBytes } from "./contentIdentity";
import { AutoMovieDesignReferenceContainerError } from "./designReferenceContainer";
import {
  IAutoMovieInspectedDesignReference,
  inspectDesignReferenceAsset,
} from "./inspectDesignReferenceAsset";
import { AutoMovieUtf8Error } from "./strictUtf8";

/** Containers that carry exactly one page, so no frame may cite a second. */
const SINGLE_PAGE_MEDIA = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

/**
 * Compile-time gate over the design references one production declares.
 *
 * ## What it is for
 *
 * A design reference is the only place in the graph where bytes somebody else
 * produced — a scanned plan, a vector sheet, a generated study — are allowed to
 * influence a building. It is therefore the one place where the design source
 * of truth could be replaced without anybody noticing: an image swapped under a
 * stable path, a frame that claims more sheet than the file holds, a citation
 * pointing at a reading that was deleted. Every check here exists to make one
 * of those substitutions loud.
 *
 * ## What it refuses
 *
 * The document must be internally consistent ({@link validateDesignReference}),
 * its bytes must exist, its declared digest must still be the digest of those
 * bytes, its declared container family must be the family the bytes actually
 * are, its frames must fit inside the extent the container itself states, and
 * every authored citation must resolve ({@link validateDesignEvidence}). The
 * asset must additionally carry a typed `design-reference` use naming this
 * document, so a reference that no ledger authorizes cannot ride along on bytes
 * registered for something else.
 *
 * ## What it deliberately does not do
 *
 * It never reads a plan. It produces no walls, no openings, no levels, and no
 * scale. An unmeasurable container (a PDF page, a DXF drawing) simply leaves
 * the frame unverified instead of being approximated into agreement, because a
 * gate that invents the number it is checking is not a gate.
 * @evidence requirements/external-inputs/validation-and-quarantine.md#external-validation-result-states Names the member, rule and consequence of each design-reference finding as distinct diagnostics instead of one accepted or rejected verdict.
 */
export const designReferenceDiagnostics = (props: {
  /** Project-relative ledger path reported as each diagnostic's file. */
  path: string;
  /** Design-reference documents this production declares, in source order. */
  references: readonly IAutoMovieDesignReference[];
  /** Citations the building source makes against those documents. */
  evidence: readonly IAutoMovieDesignEvidence[];
  /** Current project bytes by canonical asset path; `null` when absent. */
  assets: ReadonlyMap<string, Uint8Array | null>;
  /**
   * Design-reference document ids authorized on each asset path by an active
   * `design-reference` use in the production's asset manifest.
   */
  uses: ReadonlyMap<string, ReadonlySet<string>>;
}): IAutoMovieDiagnostic[] => {
  const diagnostics: IAutoMovieDiagnostic[] = [];
  const diagnostic = (
    code: AutoMovieDiagnosticCode,
    target: string,
    message: string,
  ): void => {
    diagnostics.push({
      code,
      category: "error",
      phase: "design",
      target,
      path: props.path,
      message,
    });
  };

  const seen = new Set<string>();
  for (const reference of props.references) {
    if (seen.has(reference.id))
      diagnostic(
        "design-reference-duplicate",
        reference.id,
        `Design reference "${reference.id}" is declared more than once. Keep one observation document per stable identity so a citation resolves to exactly one reading.`,
      );
    seen.add(reference.id);

    const validated = validateDesignReference({ reference });
    if (validated.success === false) {
      diagnostic(
        "design-reference-invalid",
        reference.id,
        `Design reference "${reference.id}" is not a consistent observation: ${validated.violations
          .map((item) => `${item.path}: ${item.expected}`)
          .join(
            "; ",
          )}. Correct the observation; do not resolve it by promoting a reading into the building source.`,
      );
      continue;
    }

    const authorized = props.uses.get(reference.asset);
    if (authorized === undefined || !authorized.has(reference.id))
      diagnostic(
        "design-reference-use-unbound",
        reference.id,
        `Design reference "${reference.id}" reads "${reference.asset}", but that asset declares no active design-reference use naming this document. Register the typed use before citing the bytes as design evidence.`,
      );

    const bytes = props.assets.get(reference.asset) ?? null;
    if (bytes === null) {
      diagnostic(
        "design-reference-asset-missing",
        reference.id,
        `Design reference "${reference.id}" declares "${reference.asset}", but those bytes are absent from the project content. Restore the observed file before compiling the design that cites it.`,
      );
      continue;
    }

    const current = digestAutoMovieBytes(bytes);
    if (current !== reference.digest) {
      diagnostic(
        "design-reference-stale",
        reference.id,
        `Design reference "${reference.id}" was observed at ${reference.digest}, but "${reference.asset}" now hashes to ${current}. Re-observe the new bytes; a design cannot keep citing readings taken from a file that no longer exists.`,
      );
      continue;
    }

    let inspected: IAutoMovieInspectedDesignReference;
    try {
      inspected = inspectDesignReferenceAsset({ path: reference.asset, bytes });
    } catch (error) {
      diagnostic(
        error instanceof AutoMovieUtf8Error
          ? "design-reference-encoding-invalid"
          : error instanceof AutoMovieDesignReferenceContainerError
            ? "design-reference-container-invalid"
            : "design-reference-media-unsupported",
        reference.id,
        // The asset inspector throws nothing but Error refusals.
        `${(error as Error).message} Convert the reference to a registrable container before citing it.`,
      );
      continue;
    }
    if (inspected.media !== reference.media) {
      diagnostic(
        "design-reference-media-mismatch",
        reference.id,
        `Design reference "${reference.id}" declares "${reference.media}", but "${reference.asset}" carries "${inspected.media}" bytes. Declare the container the file actually is.`,
      );
      continue;
    }

    const single = SINGLE_PAGE_MEDIA.has(inspected.media);
    for (const frame of reference.frames) {
      if (single && frame.page !== 1)
        diagnostic(
          "design-reference-frame-page-missing",
          `${reference.id}/${frame.id}`,
          `Frame "${frame.id}" reads page ${frame.page} of "${reference.asset}", but a "${inspected.media}" reference carries exactly one page. Split multi-sheet evidence into one document per file.`,
        );
      if (inspected.bounds.status !== "measured") continue;
      if (
        frame.bounds.width > inspected.bounds.width ||
        frame.bounds.height > inspected.bounds.height
      )
        diagnostic(
          "design-reference-frame-bounds-mismatch",
          `${reference.id}/${frame.id}`,
          `Frame "${frame.id}" declares a source extent of ${frame.bounds.width}x${frame.bounds.height}, but "${reference.asset}" measures ${inspected.bounds.width}x${inspected.bounds.height}. A frame reads part of its sheet, never more than the sheet holds.`,
        );
    }
  }

  const declared = new Map(
    props.references.map((reference) => [reference.id, reference.asset]),
  );
  for (const [asset, documents] of props.uses)
    for (const document of documents) {
      const owner = declared.get(document);
      if (owner === undefined)
        diagnostic(
          "design-reference-use-dangling",
          document,
          `Asset "${asset}" declares a design-reference use naming "${document}", but this production declares no such observation document. Remove the stale use or restore the observation.`,
        );
      else if (owner !== asset)
        diagnostic(
          "design-reference-use-dangling",
          document,
          `Asset "${asset}" declares a design-reference use naming "${document}", but that document observes "${owner}". A document reads exactly the bytes that authorize it.`,
        );
    }

  const evidence = validateDesignEvidence({
    references: props.references,
    evidence: props.evidence,
  });
  if (evidence.success === false)
    for (const item of evidence.violations)
      diagnostic(
        "design-reference-evidence-dangling",
        item.path,
        `Design evidence is not grounded at ${item.path}: ${item.expected}. Cite an observation that exists, or record the decision as an issue instead of a citation.`,
      );

  return diagnostics;
};

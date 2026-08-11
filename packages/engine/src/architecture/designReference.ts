import {
  AutoMovieDesignReferenceMedia,
  IAutoMovieDesignEvidence,
  IAutoMovieDesignPoint,
  IAutoMovieDesignPromotion,
  IAutoMovieDesignReference,
  IAutoMovieDesignSourceFrame,
  IAutoMovieDesignWithholding,
  IAutoMovieGeneratedAcquisition,
  IAutoMovieValidation,
  IAutoMovieVector3,
} from "@automovie/interface";

import { Quaternion } from "../math/Quaternion";
import { validateTransformScalars } from "../validation/validateTransformScalars";
import { ViolationCollector } from "../validation/violation";

/**
 * Every container family a design reference may declare.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review `AUTO_MOVIE_DESIGN_REFERENCE_MEDIA` fixes every container family a design reference may declare. This ensures reviewers can trace each adopted design reading back to its source and uncertainty.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review `AUTO_MOVIE_DESIGN_REFERENCE_MEDIA` bounds the auto movie design reference media policy while the engine closes a reviewed reference from source identity through downstream consumers.
 */
export const AUTO_MOVIE_DESIGN_REFERENCE_MEDIA = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "application/pdf",
  "image/vnd.dxf",
] as const;

/**
 * Every drawing family a source frame may declare.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review `AUTO_MOVIE_DESIGN_FRAME_VIEWS` fixes every drawing family a source frame may declare. This ensures reviewers can trace each adopted design reading back to its source and uncertainty.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review `AUTO_MOVIE_DESIGN_FRAME_VIEWS` bounds the auto movie design frame views policy while the engine closes a reviewed reference from source identity through downstream consumers.
 */
export const AUTO_MOVIE_DESIGN_FRAME_VIEWS = [
  "plan",
  "section",
  "elevation",
  "detail",
  "perspective",
] as const;

/**
 * Every reason family that keeps a reading unsettled.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review `AUTO_MOVIE_DESIGN_ISSUE_KINDS` fixes every reason family that keeps a reading unsettled. This ensures reviewers can trace each adopted design reading back to its source and uncertainty.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review `AUTO_MOVIE_DESIGN_ISSUE_KINDS` bounds the auto movie design issue kinds policy while the engine closes a reviewed reference from source identity through downstream consumers.
 */
export const AUTO_MOVIE_DESIGN_ISSUE_KINDS = [
  "unknown-scale",
  "ambiguous-geometry",
  "occluded",
  "illegible",
  "conflicting-dimension",
  "other",
] as const;

/**
 * Every raw mark family an observation may record, and the point count each one
 * carries. This table is the only list of the families: a second exported array
 * would be a copy that drifts the first time a family is added.
 */
const PRIMITIVE_POINTS: Record<string, { min: number; max: number }> = {
  line: { min: 2, max: 2 },
  arc: { min: 3, max: 3 },
  polyline: { min: 2, max: Infinity },
  region: { min: 3, max: Infinity },
  text: { min: 1, max: 1 },
  "level-marker": { min: 1, max: 1 },
};

/** Primitive families that carry promotable metric geometry. */
const GEOMETRIC_PRIMITIVES = new Set(["line", "polyline", "region"]);

/** A plain SHA-256 content digest as this project writes it. */
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

/** Direction vectors shorter than this are treated as having no direction. */
const AXIS_EPSILON = 1e-12;

/**
 * Test whether a value names a registrable design-reference container.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review `isAutoMovieDesignReferenceMedia` tests whether a value names a registrable design-reference container. This ensures reviewers can trace each adopted design reading back to its source and uncertainty.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review `isAutoMovieDesignReferenceMedia` accepts only the declared container families that may enter a reviewed reference manifest.
 */
export const isAutoMovieDesignReferenceMedia = (
  value: unknown,
): value is AutoMovieDesignReferenceMedia =>
  (AUTO_MOVIE_DESIGN_REFERENCE_MEDIA as readonly unknown[]).includes(value);

/**
 * Validate one observed design reference as evidence.
 *
 * The record is checked as a self-consistent observation, never as a design: a
 * frame states how its own units are read, a primitive states what was on the
 * sheet, a candidate states one proposed meaning, and an issue states what is
 * still undecided. The validator's whole job is to keep those four layers from
 * collapsing into each other, because the moment an observation is allowed to
 * carry a conclusion, the design source of truth has been silently replaced.
 *
 * So it refuses a candidate that cites a primitive nobody saw, an issue about
 * nothing, an analysis that claims `observed` while producing no reading, and
 * an analysis that claims `unsupported` or `not-run` while carrying one. It
 * also refuses a settled scale that names no recorded candidate: an unknown
 * scale is a fact about the drawing, and inventing one is how a plan image
 * turns into metres nobody measured.
 *
 * The same principle binds an analysis to the one frame it says it read: a
 * candidate built from marks on another sheet was not produced by this reading,
 * and filing it here would let a section's geometry inherit a plan's scale.
 * Correlating two sheets is the authored building's job, through evidence that
 * may cite any candidate of any document.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-manifest-closure `validateDesignReference` rejects a reference whose source asset, digest, frames, or observed readings do not form a self-consistent manifest.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-closure `validateDesignReference` checks the source identity, content digest, declared frames, and frame-local observations needed to reconstruct an adopted reference.
 * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-observation-conditions `validateDesignReference` binds each observed primitive and analysis to a declared source frame, its bounds, scale state, and exact candidate outputs.
 * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-observation-record-contract The design-reference validator enforces the Engine's frame-local observation inputs and observed, unsupported, or not-run outputs without turning them into design facts.
 * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-claim-basis `validateDesignReference` requires each candidate interpretation to cite observed primitives and retain confidence, alternatives, and unresolved issue identities.
 * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-claim-evaluation-contract The candidate record preserves the Engine's concrete observation basis and uncertainty fields; it does not claim human approval or a general claim ledger.
 */
export const validateDesignReference = (props: {
  reference: IAutoMovieDesignReference;
}): IAutoMovieValidation => {
  const { reference } = props;
  const out = new ViolationCollector();
  const root = "$input";

  nonEmpty(reference.id, `${root}.id`, "design reference id", out);
  if (reference.version !== 1)
    out.push(
      "type",
      `${root}.version`,
      `design reference schema version must be 1, but was ${reference.version}`,
      reference.version,
    );
  nonEmpty(reference.asset, `${root}.asset`, "design reference asset", out);
  if (!DIGEST_PATTERN.test(reference.digest))
    out.push(
      "type",
      `${root}.digest`,
      `design reference digest must be a lowercase "sha256:" hex digest, but was ${String(reference.digest)}`,
      reference.digest,
    );
  if (!isAutoMovieDesignReferenceMedia(reference.media))
    out.push(
      "type",
      `${root}.media`,
      `design reference media must be one of ${AUTO_MOVIE_DESIGN_REFERENCE_MEDIA.join(", ")}, but was ${String(reference.media)}`,
      reference.media,
    );

  if (reference.frames.length === 0)
    out.push(
      "range",
      `${root}.frames`,
      "a design reference must read at least one frame",
      reference.frames,
    );
  const frameIds = collectIds(
    reference.frames,
    `${root}.frames`,
    "source frame",
    out,
  );
  reference.frames.forEach((frame, index) =>
    validateFrame(frame, `${root}.frames[${index}]`, out),
  );

  const framesById = new Map(
    reference.frames.map((frame) => [frame.id, frame]),
  );
  const frameOfPrimitive = new Map(
    reference.primitives.map((primitive) => [primitive.id, primitive.frame]),
  );
  const primitiveIds = collectIds(
    reference.primitives,
    `${root}.primitives`,
    "observed primitive",
    out,
  );
  reference.primitives.forEach((primitive, index) => {
    const path = `${root}.primitives[${index}]`;
    const owner = framesById.get(primitive.frame);
    if (owner === undefined)
      out.push(
        "type",
        `${path}.frame`,
        `observed primitive frame "${primitive.frame}" does not resolve`,
        primitive.frame,
      );
    const shape = PRIMITIVE_POINTS[primitive.kind];
    if (shape === undefined)
      out.push(
        "type",
        `${path}.kind`,
        `unknown observed primitive kind "${String(primitive.kind)}"`,
        primitive.kind,
      );
    else if (
      primitive.points.length < shape.min ||
      primitive.points.length > shape.max
    )
      out.push(
        "range",
        `${path}.points`,
        `a "${primitive.kind}" primitive carries ${shape.min === shape.max ? `exactly ${shape.min}` : `at least ${shape.min}`} points, but had ${primitive.points.length}`,
        primitive.points.length,
      );
    primitive.points.forEach((point, pointIndex) => {
      for (const axis of ["x", "y"] as const) {
        if (!Number.isFinite(point[axis])) {
          out.push(
            "range",
            `${path}.points[${pointIndex}].${axis}`,
            `observed point ${axis} must be finite, but was ${point[axis]}`,
            point[axis],
          );
          continue;
        }
        // A mark outside the sheet it was read from was not on the sheet. The
        // check is here rather than in the frame because the frame states its
        // own extent honestly; it is the reading that has to stay inside it.
        if (owner === undefined) continue;
        const limit = axis === "x" ? owner.bounds.width : owner.bounds.height;
        if (point[axis] < 0 || point[axis] > limit)
          out.push(
            "range",
            `${path}.points[${pointIndex}].${axis}`,
            `observed point ${axis} must lie inside the ${owner.bounds.width}x${owner.bounds.height} extent of frame "${owner.id}", but was ${point[axis]}`,
            point[axis],
          );
      }
    });
    const literal =
      primitive.kind === "text" || primitive.kind === "level-marker";
    if (literal && (primitive.text === null || primitive.text.trim() === ""))
      out.push(
        "type",
        `${path}.text`,
        `a "${primitive.kind}" primitive must carry the literal text it read`,
        primitive.text,
      );
    if (!literal && primitive.text !== null)
      out.push(
        "type",
        `${path}.text`,
        `a "${String(primitive.kind)}" primitive carries no literal text`,
        primitive.text,
      );
  });

  const issueIds = collectIds(
    reference.issues,
    `${root}.issues`,
    "design issue",
    out,
  );
  const candidateIds = collectIds(
    reference.candidates,
    `${root}.candidates`,
    "observed candidate",
    out,
  );
  const candidatesById = new Map(
    reference.candidates.map((candidate) => [candidate.id, candidate]),
  );

  reference.candidates.forEach((candidate, index) => {
    const path = `${root}.candidates[${index}]`;
    nonEmpty(candidate.semantic, `${path}.semantic`, "candidate semantic", out);
    if (candidate.primitives.length === 0)
      out.push(
        "range",
        `${path}.primitives`,
        "an observed candidate must read at least one primitive",
        candidate.primitives,
      );
    validateReferences(
      candidate.primitives,
      primitiveIds,
      `${path}.primitives`,
      "observed primitive",
      out,
    );
    out.range(
      `${path}.confidence`,
      candidate.confidence,
      0,
      1,
      "candidate confidence",
    );
    const alternativesSeen = new Set<string>();
    candidate.alternatives.forEach((alternative, alternativeIndex) => {
      const alternativePath = `${path}.alternatives[${alternativeIndex}]`;
      if (!candidateIds.has(alternative))
        out.push(
          "type",
          alternativePath,
          `alternative candidate "${alternative}" does not resolve`,
          alternative,
        );
      if (alternative === candidate.id)
        out.push(
          "type",
          alternativePath,
          `candidate "${candidate.id}" cannot be its own alternative`,
          alternative,
        );
      // A rival listed twice turns one disagreement into two. The list is also
      // read back verbatim when a promotion explains what it withheld, so the
      // repeat resurfaces as a refusal naming the same candidate twice.
      if (alternativesSeen.has(alternative))
        out.push(
          "type",
          alternativePath,
          `alternative candidate "${alternative}" is duplicated`,
          alternative,
        );
      alternativesSeen.add(alternative);
    });
    validateReferences(
      candidate.issues,
      issueIds,
      `${path}.issues`,
      "design issue",
      out,
    );
  });

  reference.issues.forEach((issue, index) => {
    const path = `${root}.issues[${index}]`;
    if (
      !(AUTO_MOVIE_DESIGN_ISSUE_KINDS as readonly string[]).includes(issue.kind)
    )
      out.push(
        "type",
        `${path}.kind`,
        `unknown design issue kind "${String(issue.kind)}"`,
        issue.kind,
      );
    nonEmpty(issue.detail, `${path}.detail`, "design issue detail", out);
    if (issue.subjects.length === 0)
      out.push(
        "range",
        `${path}.subjects`,
        "a design issue must name at least one primitive or candidate",
        issue.subjects,
      );
    const subjectsSeen = new Set<string>();
    issue.subjects.forEach((subject, subjectIndex) => {
      const subjectPath = `${path}.subjects[${subjectIndex}]`;
      if (!primitiveIds.has(subject) && !candidateIds.has(subject))
        out.push(
          "type",
          subjectPath,
          `design issue subject "${subject}" resolves to no primitive or candidate`,
          subject,
        );
      if (subjectsSeen.has(subject))
        out.push(
          "type",
          subjectPath,
          `design issue subject "${subject}" is duplicated`,
          subject,
        );
      subjectsSeen.add(subject);
    });
  });

  collectIds(reference.analyses, `${root}.analyses`, "design analysis", out);
  const claimed = new Map<string, string>();
  reference.analyses.forEach((analysis, index) => {
    const path = `${root}.analyses[${index}]`;
    nonEmpty(analysis.subject, `${path}.subject`, "analysis subject", out);
    if (!frameIds.has(analysis.frame))
      out.push(
        "type",
        `${path}.frame`,
        `design analysis frame "${analysis.frame}" does not resolve`,
        analysis.frame,
      );
    const outcome = analysis.outcome;
    if (outcome.status === "observed") {
      if (outcome.candidates.length === 0)
        out.push(
          "range",
          `${path}.outcome.candidates`,
          'an "observed" analysis must carry at least one candidate; report an empty reading as "not-run" or "unsupported"',
          outcome.candidates,
        );
      outcome.candidates.forEach((candidate, candidateIndex) => {
        const candidatePath = `${path}.outcome.candidates[${candidateIndex}]`;
        if (!candidateIds.has(candidate))
          out.push(
            "type",
            candidatePath,
            `analysis candidate "${candidate}" does not resolve`,
            candidate,
          );
        // An analysis reads ONE frame, so a candidate it claims to have
        // produced cannot be built from marks on another sheet. Without this,
        // `frame` is decorative for an `observed` analysis, and a reading taken
        // off a section can be filed under the plan whose scale it never had.
        const read = candidatesById.get(candidate);
        if (read !== undefined && frameIds.has(analysis.frame)) {
          const foreign = [
            ...new Set(
              read.primitives
                .map((id) => frameOfPrimitive.get(id))
                .filter(
                  (frame): frame is string =>
                    frame !== undefined && frame !== analysis.frame,
                ),
            ),
          ];
          if (foreign.length > 0)
            out.push(
              "type",
              candidatePath,
              `analysis "${analysis.id}" read frame "${analysis.frame}", but candidate "${candidate}" is built from marks on ${foreign.join(", ")}; cite readings across sheets from the building source instead`,
              candidate,
            );
        }
        const prior = claimed.get(candidate);
        if (prior === analysis.id)
          out.push(
            "type",
            candidatePath,
            `analysis "${analysis.id}" names candidate "${candidate}" more than once`,
            candidate,
          );
        else if (prior !== undefined)
          out.push(
            "type",
            candidatePath,
            `candidate "${candidate}" is already produced by analysis "${prior}"`,
            candidate,
          );
        else claimed.set(candidate, analysis.id);
      });
    } else if (outcome.status === "unsupported" || outcome.status === "not-run")
      nonEmpty(
        outcome.reason,
        `${path}.outcome.reason`,
        `a "${outcome.status}" analysis reason`,
        out,
      );
    else
      out.push(
        "type",
        `${path}.outcome.status`,
        `unknown design analysis status "${String((outcome as { status: unknown }).status)}"`,
        (outcome as { status: unknown }).status,
      );
  });

  return out.toValidation();
};

/**
 * Validate the generation identity recorded for bytes nothing served.
 *
 * The rules that matter are all about honesty rather than shape. A record that
 * claims to be reproducible must carry the seed that reproduces it, or the
 * claim is unbacked; a record that admits it is not reproducible but still
 * carries a seed is warned about, because a seed that does not replay the bytes
 * is decoration a later reader will mistake for a replay handle.
 *
 * A recorded seed must also be a number a provider could have handed back. A
 * fractional, infinite, `NaN`, or beyond-2^53 value is not null and so passes
 * both rules above while naming no draw at all, which is the invented replay
 * handle they exist to prevent. It is therefore refused before either speaks.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review `validateGeneratedAcquisition` validates the generation identity recorded for bytes nothing served. This ensures reviewers can trace each adopted design reading back to its source and uncertainty.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review `validateGeneratedAcquisition` performs generated acquisition validation when the engine closes a reviewed reference from source identity through downstream consumers.
 * @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-generated-output-record `validateGeneratedAcquisition` checks provider, model, request, prompt digest, input identities, seed semantics, reproducibility claim, and adopted output digest for one generated asset.
 * @evidence specifications/evidence-and-provenance/generation-transformation-and-derivation.md#evp-generated-output-receipt The generated-acquisition record implements the Engine's adopted-output receipt subset while leaving terms and discarded-candidate retention to upstream provenance.
 * @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-nondeterministic-generation `validateGeneratedAcquisition` requires a seed for a reproducible claim and warns that a seed attached to an irreproducible generation is not a replay handle.
 * @evidence specifications/evidence-and-provenance/generation-transformation-and-derivation.md#evp-nondeterministic-attempt-model The validator preserves the stated reproducibility boundary of one adopted attempt without claiming retry or discarded-variant history.
 * @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-generated-source `validateGeneratedAcquisition` requires the external generator provider and model identity alongside the request and content digests for adopted bytes.
 * @evidence specifications/evidence-and-provenance/third-party-sources-rights-and-attribution.md#evp-generated-provider-provenance The Engine validates provider and model provenance for generated output but does not claim rights, terms, or attribution clearance.
 * @evidence requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-boundary-integrity-check `validateGeneratedAcquisition` compares the recorded generated-output digest with the bytes digest supplied at the current acquisition boundary.
 * @evidence specifications/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#evp-custody-boundary-receipt The direct digest comparison implements one Engine boundary integrity check without claiming a signed or multi-hop custody ledger.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reproduction-boundary `validateGeneratedAcquisition` distinguishes a seeded reproducibility claim from an explicitly irreproducible generation and retains the exact adopted output digest.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reproduction-verification-boundary The acquisition validator checks the recorded replay prerequisites and current byte identity; it does not claim that a provider rerun was performed.
 * @evidence requirements/external-inputs/conversion-receipts-and-determinism.md#external-generation-reproducibility-boundary `validateGeneratedAcquisition` treats the returned output digest as the durable replay boundary and refuses a reproducible claim that lacks its declared seed.
 * @evidence specifications/interchange-and-adoption/conversion-receipts-and-determinism.md#interchange-nondeterministic-generation-boundary The validator distinguishes recorded output identity from request replay and does not imply that provider execution is bit-deterministic.
 * @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-provenance-acquisition-activity `validateGeneratedAcquisition` checks the provider, model, request, prompt digest, input paths, seed boundary, and output digest captured for one acquisition.
 * @evidence specifications/interchange-and-adoption/provenance-rights-and-secrets.md#interchange-generated-acquisition-snapshot The Engine validates the generated-acquisition snapshot fields it consumes while leaving credentials, rights, and network execution outside this boundary.
 */
export const validateGeneratedAcquisition = (props: {
  acquisition: IAutoMovieGeneratedAcquisition;
  /**
   * Digest the returned bytes must still have, or null when a recorded local
   * transformation has since replaced them.
   */
  digest: string | null;
}): IAutoMovieValidation => {
  const { acquisition } = props;
  const out = new ViolationCollector();
  const root = "$input";
  nonEmpty(acquisition.provider, `${root}.provider`, "generator provider", out);
  nonEmpty(acquisition.model, `${root}.model`, "generator model", out);
  if (acquisition.request !== null && acquisition.request.trim() === "")
    out.push(
      "type",
      `${root}.request`,
      "generator request id must be null or non-blank",
      acquisition.request,
    );
  if (acquisition.prompt !== null && acquisition.prompt.trim() === "")
    out.push(
      "type",
      `${root}.prompt`,
      "generator prompt must be null or non-blank",
      acquisition.prompt,
    );
  for (const key of ["promptDigest", "outputDigest"] as const)
    if (!DIGEST_PATTERN.test(acquisition[key]))
      out.push(
        "type",
        `${root}.${key}`,
        `${key} must be a lowercase "sha256:" hex digest, but was ${String(acquisition[key])}`,
        acquisition[key],
      );
  acquisition.inputs.forEach((input, index) =>
    nonEmpty(
      input,
      `${root}.inputs[${index}]`,
      "generator input asset path",
      out,
    ),
  );
  if (props.digest !== null && acquisition.outputDigest !== props.digest)
    out.push(
      "type",
      `${root}.outputDigest`,
      `generated output digest ${acquisition.outputDigest} does not match the current bytes ${props.digest}`,
      acquisition.outputDigest,
    );
  if (acquisition.seed !== null && !Number.isSafeInteger(acquisition.seed))
    out.push(
      "range",
      `${root}.seed`,
      `a recorded seed must be a whole number a provider could have used, but was ${acquisition.seed}`,
      acquisition.seed,
    );
  else if (acquisition.reproducible && acquisition.seed === null)
    out.push(
      "type",
      `${root}.seed`,
      "a reproducible generation must record the seed that reproduces it",
      acquisition.seed,
    );
  else if (!acquisition.reproducible && acquisition.seed !== null)
    out.warn(
      "type",
      `${root}.seed`,
      "a seed recorded against an irreproducible generation is not a replay handle",
      acquisition.seed,
    );
  return out.toValidation();
};

/**
 * Validate authored citations from a normalized design to its evidence.
 *
 * A citation may point at an unsettled reading on purpose: recording that a
 * wall was drawn where two centreline candidates disagree is exactly the
 * accountability this graph exists for. What it may not do is point at nothing.
 * A dangling document, a dangling candidate, or a blank rationale each turn the
 * citation into a decoration that survives the evidence it claims to rest on.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-manifest-closure `validateDesignEvidence` rejects consumer citations whose reference document or observed candidates do not resolve in the adopted manifest.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-closure `validateDesignEvidence` closes each design consumer relation by resolving its document and candidate ids against the recorded references.
 */
export const validateDesignEvidence = (props: {
  references: readonly IAutoMovieDesignReference[];
  evidence: readonly IAutoMovieDesignEvidence[];
}): IAutoMovieValidation => {
  const out = new ViolationCollector();
  const root = "$input";
  const byDocument = new Map<string, Set<string>>();
  props.references.forEach((reference) => {
    const ids = byDocument.get(reference.id);
    const candidates = new Set(
      reference.candidates.map((candidate) => candidate.id),
    );
    if (ids === undefined) byDocument.set(reference.id, candidates);
    else for (const id of candidates) ids.add(id);
  });
  const seen = new Set<string>();
  props.evidence.forEach((evidence, index) => {
    const path = `${root}.evidence[${index}]`;
    nonEmpty(evidence.subject, `${path}.subject`, "evidence subject", out);
    nonEmpty(
      evidence.rationale,
      `${path}.rationale`,
      "evidence rationale",
      out,
    );
    const candidates = byDocument.get(evidence.document);
    if (candidates === undefined) {
      out.push(
        "type",
        `${path}.document`,
        `evidence document "${evidence.document}" does not resolve`,
        evidence.document,
      );
      return;
    }
    if (evidence.candidates.length === 0)
      out.push(
        "range",
        `${path}.candidates`,
        "an evidence citation must name at least one observed candidate",
        evidence.candidates,
      );
    evidence.candidates.forEach((candidate, candidateIndex) => {
      const candidatePath = `${path}.candidates[${candidateIndex}]`;
      if (!candidates.has(candidate))
        out.push(
          "type",
          candidatePath,
          `evidence candidate "${candidate}" does not resolve in document "${evidence.document}"`,
          candidate,
        );
      // Serialized as an array rather than joined with a separator: any
      // separator character an id could itself contain would let two distinct
      // citations collide on one key.
      const key = JSON.stringify([
        evidence.subject,
        evidence.document,
        candidate,
      ]);
      if (seen.has(key))
        out.push(
          "type",
          candidatePath,
          `evidence for "${evidence.subject}" repeats candidate "${candidate}"`,
          candidate,
        );
      seen.add(key);
    });
  });
  return out.toValidation();
};

/**
 * Ask one reference for metric geometry, and get back what it can honestly
 * give.
 *
 * This is the only path from an observation to metres, and it is deliberately
 * refusing by default. A candidate is promoted only when a settled frame scale
 * exists, an `observed` analysis actually produced it, no competing reading is
 * recorded, no issue about it is still open, its confidence clears the caller's
 * floor, and every primitive it reads carries geometry at all. Anything else
 * lands in `withheld` with the exact reason, and every analysis that produced
 * nothing lands in `skipped` carrying its own `unsupported` or `not-run` word.
 *
 * The result is therefore never a design. It is a proposal the authored
 * building source may accept, reject, or contradict; the source of truth stays
 * the TypeScript that a human and a coding agent wrote.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review `promoteDesignObservations` promotes only settled reference candidates into metric geometry and reports why unresolved readings remain withheld. This ensures reviewers can trace each adopted design reading back to its source and uncertainty.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review `promoteDesignObservations` converts settled frame readings to metres while preserving diagnostics for ambiguous or unscaled candidates.
 * @evidence requirements/evidence-and-provenance/observations-claims-and-human-judgments.md#evidence-disagreement-and-resolution `promoteDesignObservations` withholds candidates that retain competing interpretations or open issues and reports the exact unresolved identities instead of selecting one silently.
 * @evidence specifications/evidence-and-provenance/observations-claims-and-human-judgments.md#evp-disagreement-resolution The promotion boundary preserves unresolved disagreement as a refusal; authorized resolution history remains outside this Engine helper.
 */
export const promoteDesignObservations = (props: {
  reference: IAutoMovieDesignReference;
  /**
   * Inclusive confidence floor in `[0, 1]`. Defaults to `1`, so nothing but a
   * certain reading promotes unless the caller consciously lowers the bar.
   */
  minimumConfidence?: number;
}): IAutoMovieDesignPromotion => {
  const validated = validateDesignReference({ reference: props.reference });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `design reference "${props.reference.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }
  const floor = props.minimumConfidence ?? 1;
  if (!Number.isFinite(floor) || floor < 0 || floor > 1)
    throw new Error(
      `design reference "${props.reference.id}" cannot be promoted at confidence floor ${floor}: a floor is a finite number within [0, 1].`,
    );

  const reference = props.reference;
  const frames = new Map(reference.frames.map((frame) => [frame.id, frame]));
  const primitives = new Map(
    reference.primitives.map((primitive) => [primitive.id, primitive]),
  );
  const openIssues = new Set(
    reference.issues.filter((issue) => issue.open).map((issue) => issue.id),
  );
  const producedBy = new Map<string, string>();
  const promotion: IAutoMovieDesignPromotion = {
    promoted: [],
    withheld: [],
    skipped: [],
  };
  reference.analyses.forEach((analysis) => {
    if (analysis.outcome.status === "observed")
      analysis.outcome.candidates.forEach((candidate) =>
        producedBy.set(candidate, analysis.id),
      );
    else
      promotion.skipped.push({
        analysis: analysis.id,
        status: analysis.outcome.status,
        reason: analysis.outcome.reason,
      });
  });

  reference.candidates.forEach((candidate) => {
    const withhold = (
      reason: IAutoMovieDesignWithholding["reason"],
      detail: string,
    ): void => {
      promotion.withheld.push({ candidate: candidate.id, reason, detail });
    };
    if (!producedBy.has(candidate.id)) {
      withhold(
        "unobserved",
        `Candidate "${candidate.id}" is produced by no analysis whose outcome is "observed".`,
      );
      return;
    }
    if (candidate.alternatives.length > 0) {
      withhold(
        "ambiguous-candidate",
        `Candidate "${candidate.id}" competes with ${candidate.alternatives.join(", ")}; settle the reading in the building source instead of promoting one arbitrarily.`,
      );
      return;
    }
    const blocking = candidate.issues.filter((issue) => openIssues.has(issue));
    if (blocking.length > 0) {
      withhold(
        "open-issue",
        `Candidate "${candidate.id}" is blocked by open issue ${blocking.join(", ")}.`,
      );
      return;
    }
    if (candidate.confidence < floor) {
      withhold(
        "low-confidence",
        `Candidate "${candidate.id}" reads at confidence ${candidate.confidence}, below the required ${floor}.`,
      );
      return;
    }
    const marks = candidate.primitives.map((id) => primitives.get(id)!);
    const ungeometric = marks.find(
      (primitive) => !GEOMETRIC_PRIMITIVES.has(primitive.kind),
    );
    if (ungeometric !== undefined) {
      withhold(
        "unsupported-geometry",
        `Candidate "${candidate.id}" reads "${ungeometric.kind}" primitive "${ungeometric.id}", which carries no metric outline.`,
      );
      return;
    }
    const unscaled = marks.find(
      (primitive) => designFrameScale(frames.get(primitive.frame)!) === null,
    );
    if (unscaled !== undefined) {
      withhold(
        "unknown-scale",
        `Frame "${unscaled.frame}" has no settled scale, so candidate "${candidate.id}" cannot become metres.`,
      );
      return;
    }
    promotion.promoted.push({
      candidate: candidate.id,
      semantic: candidate.semantic,
      outlines: marks.map((primitive) =>
        primitive.points.map((point) =>
          designReferenceWorldPoint(frames.get(primitive.frame)!, point),
        ),
      ),
    });
  });
  return promotion;
};

/**
 * Map one source-space point onto world metres through its frame.
 *
 * The mapping is `origin + axisX * (x - anchor.x) * s + axisY * (y - anchor.y)
 *
 * - S`, with `s`the settled metres-per-unit, followed by the frame's optional
 *   placement transform. Axes are normalized here rather than demanded
 *   normalized from the author, so a hand-written`{ x: 0, y: 0, z: 2 }` means
 *   the direction it plainly means instead of doubling every measurement.
 *
 * Throws when the frame's scale is unsettled: producing a number there is the
 * exact failure this whole graph exists to prevent.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review `designReferenceWorldPoint` maps one source-space point onto world metres through its frame. This ensures reviewers can trace each adopted design reading back to its source and uncertainty.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review `designReferenceWorldPoint` maps one frame-local source point through its settled scale, axes, origin, and optional transform into world metres.
 * @evidence requirements/external-inputs/identity-coordinates-and-units.md#external-identity-spatial-coordinates-units `designReferenceWorldPoint` explicitly applies the settled source-unit scale, source axes, anchor, origin, and optional placement transform when producing world metres.
 * @evidence specifications/interchange-and-adoption/identity-coordinates-and-units.md#interchange-spatial-transform-chain The point conversion implements the design-reference subset of an ordered source-to-world transform chain and refuses an unsettled scale.
 */
export const designReferenceWorldPoint = (
  frame: IAutoMovieDesignSourceFrame,
  point: IAutoMovieDesignPoint,
): IAutoMovieVector3 => {
  const meters = designFrameScale(frame);
  if (meters === null)
    throw new Error(
      `design frame "${frame.id}" has no settled scale, so source point (${point.x}, ${point.y}) has no world position.`,
    );
  const x = unit(frame.axisX);
  const y = unit(frame.axisY);
  const dx = (point.x - frame.anchor.x) * meters;
  const dy = (point.y - frame.anchor.y) * meters;
  const mapped: IAutoMovieVector3 = {
    x: frame.origin.x + x.x * dx + y.x * dy,
    y: frame.origin.y + x.y * dx + y.y * dy,
    z: frame.origin.z + x.z * dx + y.z * dy,
  };
  const transform = frame.transform;
  if (transform === null) return mapped;
  const scaled: IAutoMovieVector3 = {
    x: mapped.x * transform.scale.x,
    y: mapped.y * transform.scale.y,
    z: mapped.z * transform.scale.z,
  };
  const rotated = Quaternion.rotateVector(
    Quaternion.normalize(transform.rotation),
    scaled,
  );
  return {
    x: rotated.x + transform.translation.x,
    y: rotated.y + transform.translation.y,
    z: rotated.z + transform.translation.z,
  };
};

/**
 * The metres-per-unit a frame has actually settled on, or null.
 *
 * @evidence requirements/production-design/references-and-provenance.md#production-design-reference-review `designFrameScale` produces the metres-per-unit a frame has actually settled on, or null. This ensures reviewers can trace each adopted design reading back to its source and uncertainty.
 * @evidence specifications/narrative-and-intent/fidelity-references-and-provenance.md#narrative-intent-reference-manifest-review `designFrameScale` resolves the selected scale candidate to metres per source unit, or returns `null` while scale is unsettled.
 */
export const designFrameScale = (
  frame: IAutoMovieDesignSourceFrame,
): number | null => {
  if (frame.scale === null) return null;
  const candidate = frame.scaleCandidates.find(
    (entry) => entry.id === frame.scale,
  );
  return candidate === undefined ? null : candidate.metersPerUnit;
};

const validateFrame = (
  frame: IAutoMovieDesignSourceFrame,
  path: string,
  out: ViolationCollector,
): void => {
  if (
    !(AUTO_MOVIE_DESIGN_FRAME_VIEWS as readonly string[]).includes(frame.view)
  )
    out.push(
      "type",
      `${path}.view`,
      `unknown source frame view "${String(frame.view)}"`,
      frame.view,
    );
  if (!Number.isSafeInteger(frame.page) || frame.page < 1)
    out.push(
      "range",
      `${path}.page`,
      `source frame page must be a whole number >= 1, but was ${frame.page}`,
      frame.page,
    );
  if (frame.level !== null && frame.level.trim() === "")
    out.push(
      "type",
      `${path}.level`,
      "source frame level must be null or non-blank",
      frame.level,
    );
  for (const axis of ["width", "height"] as const)
    if (!Number.isFinite(frame.bounds[axis]) || frame.bounds[axis] <= 0)
      out.push(
        "range",
        `${path}.bounds.${axis}`,
        `source frame ${axis} must be a finite number > 0, but was ${frame.bounds[axis]}`,
        frame.bounds[axis],
      );
  for (const axis of ["x", "y"] as const) {
    const limit = axis === "x" ? frame.bounds.width : frame.bounds.height;
    const value = frame.anchor[axis];
    if (
      !Number.isFinite(value) ||
      value < 0 ||
      (Number.isFinite(limit) && value > limit)
    )
      out.push(
        "range",
        `${path}.anchor.${axis}`,
        `source frame anchor ${axis} must lie inside the frame bounds, but was ${value}`,
        value,
      );
  }
  const scaleIds = collectIds(
    frame.scaleCandidates,
    `${path}.scaleCandidates`,
    "scale candidate",
    out,
  );
  frame.scaleCandidates.forEach((candidate, index) => {
    const candidatePath = `${path}.scaleCandidates[${index}]`;
    if (
      !Number.isFinite(candidate.metersPerUnit) ||
      candidate.metersPerUnit <= 0
    )
      out.push(
        "range",
        `${candidatePath}.metersPerUnit`,
        `scale candidate metersPerUnit must be a finite number > 0, but was ${candidate.metersPerUnit}`,
        candidate.metersPerUnit,
      );
    out.range(
      `${candidatePath}.confidence`,
      candidate.confidence,
      0,
      1,
      "scale candidate confidence",
    );
    nonEmpty(candidate.basis, `${candidatePath}.basis`, "scale basis", out);
  });
  if (frame.scale !== null && !scaleIds.has(frame.scale))
    out.push(
      "type",
      `${path}.scale`,
      `settled scale "${frame.scale}" names no recorded scale candidate; leave it null while the scale is unknown`,
      frame.scale,
    );
  direction(frame.axisX, `${path}.axisX`, "frame x axis", out);
  direction(frame.axisY, `${path}.axisY`, "frame y axis", out);
  direction(frame.up, `${path}.up`, "frame up", out);
  if (frame.north !== null)
    direction(frame.north, `${path}.north`, "frame north", out);
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(frame.origin[axis]))
      out.push(
        "range",
        `${path}.origin.${axis}`,
        `frame origin ${axis} must be finite, but was ${frame.origin[axis]}`,
        frame.origin[axis],
      );
  if (
    lengthOf(frame.axisX) > AXIS_EPSILON &&
    lengthOf(frame.axisY) > AXIS_EPSILON &&
    Math.abs(dot(unit(frame.axisX), unit(frame.axisY))) > 1 - AXIS_EPSILON
  )
    out.push(
      "type",
      `${path}.axisY`,
      "frame x and y axes must span a plane, but they are parallel",
      frame.axisY,
    );
  if (frame.transform !== null)
    validateTransformScalars({
      transform: frame.transform,
      path: `${path}.transform`,
      label: "source frame transform",
      collector: out,
    });
};

const lengthOf = (value: IAutoMovieVector3): number =>
  Math.hypot(value.x, value.y, value.z);

const dot = (a: IAutoMovieVector3, b: IAutoMovieVector3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;

const unit = (value: IAutoMovieVector3): IAutoMovieVector3 => {
  const length = lengthOf(value);
  if (length <= AXIS_EPSILON) return value;
  return { x: value.x / length, y: value.y / length, z: value.z / length };
};

const direction = (
  value: IAutoMovieVector3,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  for (const axis of ["x", "y", "z"] as const)
    if (!Number.isFinite(value[axis]))
      out.push(
        "range",
        `${path}.${axis}`,
        `${label} ${axis} must be finite, but was ${value[axis]}`,
        value[axis],
      );
  const length = lengthOf(value);
  if (Number.isFinite(length) && length <= AXIS_EPSILON)
    out.push("range", path, `${label} must be a non-zero direction`, value);
};

const collectIds = <T extends { id: string }>(
  records: readonly T[],
  path: string,
  label: string,
  out: ViolationCollector,
): Set<string> => {
  const ids = new Set<string>();
  records.forEach((record, index) => {
    nonEmpty(record.id, `${path}[${index}].id`, `${label} id`, out);
    if (ids.has(record.id))
      out.push(
        "type",
        `${path}[${index}].id`,
        `${label} id "${record.id}" must be unique`,
        record.id,
      );
    ids.add(record.id);
  });
  return ids;
};

const validateReferences = (
  references: readonly string[],
  targets: ReadonlySet<string>,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  const seen = new Set<string>();
  references.forEach((reference, index) => {
    if (!targets.has(reference))
      out.push(
        "type",
        `${path}[${index}]`,
        `${label} "${reference}" does not resolve`,
        reference,
      );
    if (seen.has(reference))
      out.push(
        "type",
        `${path}[${index}]`,
        `${label} "${reference}" is duplicated`,
        reference,
      );
    seen.add(reference);
  });
};

const nonEmpty = (
  value: string,
  path: string,
  label: string,
  out: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    out.push("type", path, `${label} must be non-empty`, value);
};

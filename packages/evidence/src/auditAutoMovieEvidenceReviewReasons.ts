import {
  type IAutoMovieEvidenceSyntaxDocument,
  parseAutoMovieEvidenceSyntax,
} from "./parseAutoMovieEvidenceSyntax";

/** One authored document inspected for mechanically invalid review reasons. */
type IAutoMovieEvidenceReviewDocument = IAutoMovieEvidenceSyntaxDocument;

/** A review-reason defect that can be decided without judging prose quality. */
interface IAutoMovieEvidenceReviewReasonDiagnostic {
  /** Stable machine-readable defect kind. */
  code:
    | "evidence-reason-shared"
    | "evidence-review-restatement"
    | "evidence-review-reused";
  /** Repository-relative document containing the review. */
  path: string;
  /** Markdown unit or TypeScript documentation block carrying the review. */
  host: string;
  /** One-based source line containing the rejected review. */
  line: number;
  /** Evidence target the rejected review addresses. */
  target: string;
  /** Actionable explanation of the mechanical defect. */
  message: string;
}

interface IAnnotation {
  exclusion: boolean;
  reason: string;
  review: boolean;
  target: string;
}

interface IPendingAcknowledgement extends IAnnotation {
  endLine: number;
  line: number;
}

interface IReviewOccurrence {
  line: number;
  target: string;
}

const REVIEW = /^@evidence(Exclude)?Review\s+(\S+)\s+#[^\s]+\s+(.+?)\s*$/u;
const ACKNOWLEDGEMENT = /^@evidence(Exclude)?\s+(\S+)\s+(.+?)\s*$/u;
const annotationOf = (line: string): IAnnotation | null => {
  const text = line.trim();
  const review = REVIEW.exec(text);
  if (review !== null)
    return {
      exclusion: review[1] !== undefined,
      reason: review[3]!,
      review: true,
      target: review[2]!,
    };
  const acknowledgement = ACKNOWLEDGEMENT.exec(text);
  return acknowledgement === null
    ? null
    : {
        exclusion: acknowledgement[1] !== undefined,
        reason: acknowledgement[3]!,
        review: false,
        target: acknowledgement[2]!,
      };
};

const withoutMechanicalReviewLead = (reason: string): string => {
  const compared = /^compared\s+/iu.test(reason);
  if (compared) {
    const marker = /(?:verified\s+relationship\s*:|confirmed\s+that\s+)/iu.exec(
      reason,
    );
    if (marker !== null) return reason.slice(marker.index + marker[0].length);
  }
  return reason.replace(
    /^(?:the\s+)?(?:review|check|comparison|inspection)\s+(?:found|confirmed|verified)(?:\s+that)?\s*[:;,.-]?\s*/iu,
    "",
  );
};

const normalizedReason = (reason: string): string =>
  reason
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[`*_]/gu, "")
    .replace(/\p{Punctuation}+/gu, " ")
    .replace(/\p{Symbol}+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const reviewKey = (annotation: IAnnotation): string =>
  normalizedReason(
    withoutMechanicalReviewLead(
      annotation.reason.replaceAll(annotation.target, "<target>"),
    ),
  );

/**
 * The identity a shared reason is keyed by: what is being said, about what.
 *
 * Exclusions and acknowledgements are kept apart because refusing a target and
 * answering it are different claims that may honestly read alike, and the
 * target is part of the key because one sentence answering two targets is a
 * different defect with its own diagnostic.
 */
const sharedKey = (annotation: IAnnotation): string =>
  [
    annotation.exclusion ? "exclude" : "answer",
    annotation.review ? "review" : "acknowledge",
    annotation.target,
    normalizedReason(withoutMechanicalReviewLead(annotation.reason)),
  ].join("\0");

/**
 * Find evidence reviews that merely repeat an adjacent acknowledgement, reuse
 * one observation for different targets on the same authored host, or answer
 * one target from two hosts with the same sentence.
 *
 * This audit is deliberately stateless. It does not validate fingerprints,
 * decide whether a review is insightful, or recreate the retired review
 * ledger. It rejects only relationships that current strings can disprove.
 *
 * The third form is the exchange test at its weakest and most mechanical.
 * That test asks whether a reason stays true when moved to another host, and
 * treats a reason that survives the move as no reason at all. A reason already
 * standing word for word on two hosts does not need to be moved to fail it.
 *
 * Measured before this refusal existed, `test/fixtures/completed-film` carried
 * 146 of 1,529 acknowledgements -- 9.5% -- on 71 sentences each shared by two
 * hosts answering one target, plus 10 reviews on 3. Every one of them read as
 * a restatement of the obligation rather than as anything about its own host:
 * "Blocking representation identifies its represented owner and central model
 * decision" is equally true of the soloist and of the gate, which is exactly
 * why it says nothing about either.
 *
 * This does not decide meaning and does not replace the exchange test, which a
 * reviewer still owes: change one word and this passes. What it closes is the
 * cheapest way the duty gets faked, and it closes it for every production that
 * inherits this package rather than for this repository alone.
 */
const auditAutoMovieEvidenceReviewReasons = (
  documents: readonly IAutoMovieEvidenceReviewDocument[],
): IAutoMovieEvidenceReviewReasonDiagnostic[] => {
  const diagnostics: IAutoMovieEvidenceReviewReasonDiagnostic[] = [];
  // Across documents, so two files answering one target identically are caught.
  // The per-host `observations` map below cannot see this: it is keyed by host
  // precisely to ask the different question of one host reusing a sentence.
  const shared = new Map<
    string,
    { host: string; line: number; path: string }
  >();
  for (const document of documents) {
    let pending: IPendingAcknowledgement | null = null;
    const observations = new Map<string, IReviewOccurrence>();
    for (const carrier of parseAutoMovieEvidenceSyntax(document)) {
      if (pending !== null && carrier.line !== pending.endLine + 1)
        pending = null;
      const host = carrier.host;
      const annotation = annotationOf(carrier.text);
      if (annotation === null) {
        pending = null;
        continue;
      }
      const sharing = shared.get(sharedKey(annotation));
      if (sharing === undefined)
        shared.set(sharedKey(annotation), {
          host,
          line: carrier.line,
          path: document.path,
        });
      else if (sharing.host !== host)
        diagnostics.push({
          code: "evidence-reason-shared",
          path: document.path,
          host,
          line: carrier.line,
          target: annotation.target,
          message: `Reason is word for word the one ${sharing.path}:${sharing.line} gives for the same target on host ${JSON.stringify(sharing.host)}; a sentence true of both hosts states nothing about either, so say what this host does.`,
        });
      if (annotation.review === false) {
        pending = {
          ...annotation,
          endLine: carrier.endLine,
          line: carrier.line,
        };
        continue;
      }

      const lineNumber = carrier.line;
      if (
        pending !== null &&
        pending.target === annotation.target &&
        pending.exclusion === annotation.exclusion &&
        normalizedReason(pending.reason) ===
          normalizedReason(withoutMechanicalReviewLead(annotation.reason))
      )
        diagnostics.push({
          code: "evidence-review-restatement",
          path: document.path,
          host,
          line: lineNumber,
          target: annotation.target,
          message: `Review repeats the acknowledgement on line ${pending.line}; record what the independent comparison found.`,
        });

      const key = reviewKey(annotation);
      const previous = observations.get(`${host}\0${key}`);
      if (
        key.length !== 0 &&
        previous !== undefined &&
        previous.target !== annotation.target
      ) {
        diagnostics.push({
          code: "evidence-review-reused",
          path: document.path,
          host,
          line: lineNumber,
          target: annotation.target,
          message: `Review reuses the observation from line ${previous.line} for target ${JSON.stringify(previous.target)}; record what this target independently established.`,
        });
      } else if (key.length !== 0)
        observations.set(`${host}\0${key}`, {
          line: lineNumber,
          target: annotation.target,
        });
      pending = null;
    }
  }
  return diagnostics;
};

/**
 * Refuse mechanically copied evidence-review reasons as one deterministic
 * preflight error.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Reports every copied reason deterministically instead of returning a partially accepted review surface.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Preserves substantive evidence review by refusing two mechanically disproven reason forms before graph construction.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Fails before graph publication and names each document, host, line, target, and mechanical defect.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Applies the shared stateless review-reason refusal to authored Markdown and TypeScript hosts without restoring a review ledger.
 */
export const assertAutoMovieEvidenceReviewReasons = (
  documents: readonly IAutoMovieEvidenceReviewDocument[],
): void => {
  const diagnostics = auditAutoMovieEvidenceReviewReasons(documents);
  if (diagnostics.length === 0) return;
  throw new Error(
    [
      "Evidence review reasons contain mechanically invalid copies:",
      ...diagnostics.map(
        (diagnostic) =>
          `${diagnostic.path}:${diagnostic.line} [${diagnostic.code}] ${diagnostic.target} (${diagnostic.host}): ${diagnostic.message}`,
      ),
    ].join("\n"),
  );
};

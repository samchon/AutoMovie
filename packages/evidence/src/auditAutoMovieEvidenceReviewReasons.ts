/** One authored document inspected for mechanically invalid review reasons. */
interface IAutoMovieEvidenceReviewDocument {
  /** Repository-relative path used to identify the review host. */
  path: string;
  /** Complete current UTF-8 source. */
  source: string;
}

/** A review-reason defect that can be decided without judging prose quality. */
interface IAutoMovieEvidenceReviewReasonDiagnostic {
  /** Stable machine-readable defect kind. */
  code: "evidence-review-restatement" | "evidence-review-reused";
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
  line: number;
}

interface IReviewOccurrence {
  line: number;
  target: string;
}

const REVIEW = /^@evidence(Exclude)?Review\s+(\S+)\s+#[^\s]+\s+(.+?)\s*$/u;
const ACKNOWLEDGEMENT = /^@evidence(Exclude)?\s+(\S+)\s+(.+?)\s*$/u;
const MARKDOWN_HEADING = /^(#{1,6})\s+(.+?)\s*$/u;
const EXPLICIT_ANCHOR = /\s+\{#([^}]+)\}\s*$/u;
const TYPESCRIPT_DOCUMENTATION_START = /^\s*\/\*\*/u;
const MARKDOWN_FENCE = /^\s*(```|~~~)/u;

const annotationText = (line: string): string =>
  line
    .trim()
    .replace(/^<!--\s*/u, "")
    .replace(/\s*-->$/u, "")
    .replace(/^\*\s?/u, "")
    .trim();

const annotationOf = (line: string): IAnnotation | null => {
  const text = annotationText(line);
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

const markdownHost = (path: string, heading: string): string => {
  const anchor = EXPLICIT_ANCHOR.exec(heading)?.[1];
  return anchor === undefined
    ? `${path}::${heading.replace(EXPLICIT_ANCHOR, "").trim()}`
    : `${path}#${anchor}`;
};

/**
 * Find evidence reviews that merely repeat an adjacent acknowledgement or
 * reuse one observation for different targets on the same authored host.
 *
 * This audit is deliberately stateless. It does not validate fingerprints,
 * decide whether a review is insightful, or recreate the retired review
 * ledger. It rejects only relationships that current strings can disprove.
 *
 */
const auditAutoMovieEvidenceReviewReasons = (
  documents: readonly IAutoMovieEvidenceReviewDocument[],
): IAutoMovieEvidenceReviewReasonDiagnostic[] => {
  const diagnostics: IAutoMovieEvidenceReviewReasonDiagnostic[] = [];
  for (const document of documents) {
    const markdown = /\.md$/iu.test(document.path);
    let fenced = false;
    let host = `${document.path}::file`;
    let pending: IPendingAcknowledgement | null = null;
    const observations = new Map<string, IReviewOccurrence>();
    const lines = document.source.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!;
      if (markdown && MARKDOWN_FENCE.test(line)) {
        fenced = !fenced;
        pending = null;
        continue;
      }
      if (fenced) continue;
      if (markdown) {
        const heading = MARKDOWN_HEADING.exec(line);
        if (heading !== null) {
          host = markdownHost(document.path, heading[2]!);
          pending = null;
          continue;
        }
      } else if (TYPESCRIPT_DOCUMENTATION_START.test(line)) {
        host = `${document.path}::docblock@${index + 1}`;
        pending = null;
      }
      const annotation = annotationOf(line);
      if (annotation === null) {
        pending = null;
        continue;
      }
      if (annotation.review === false) {
        pending = { ...annotation, line: index + 1 };
        continue;
      }

      const lineNumber = index + 1;
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

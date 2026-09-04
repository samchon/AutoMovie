import {
  type IAutoMovieEvidenceSyntaxDocument,
  parseAutoMovieEvidenceSyntax,
  projectAutoMovieMarkdownSyntax,
} from "./parseAutoMovieEvidenceSyntax";

/** One semantic-review pattern that requires literal human rereading. */
export interface IAutoMovieEvidenceReviewAlarm {
  /** Stable alarm class; neither class is an automatic evidence rejection. */
  code: "evidence-review-frame" | "evidence-review-question-paste";
  /** Authored document carrying the observation. */
  path: string;
  /** Exact evidence host. */
  host: string;
  /** One-based source line. */
  line: number;
  /** Evidence target under review. */
  target: string;
  /** Number of same-frame observations in the host layer. */
  occurrences: number;
  /** Concrete direction for the Self-Review round. */
  message: string;
}

/** Complete semantic-alarm observation for one immutable document set. */
export interface IAutoMovieEvidenceReviewAlarmReport {
  /** Every alarm in deterministic document order. */
  alarms: readonly IAutoMovieEvidenceReviewAlarm[];
  /** Whether target documents were supplied for question-paste inspection. */
  questionPasteChecked: boolean;
}

interface IReview {
  exclusion: boolean;
  host: string;
  layer: string;
  line: number;
  path: string;
  reason: string;
  target: string;
}

const REVIEW = /^@evidence(Exclude)?Review\s+(\S+)\s+#[^\s]+\s+(.+?)\s*$/u;

/**
 * Finds repeated review frames and copied target questions as semantic alarms.
 *
 * The report deliberately does not reject evidence. Counts are a reproducible
 * prompt to reread relationships, while only a literal target-question paste
 * has an exact textual discriminator. The authoring review procedure owns the
 * resulting judgment.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Makes semantic review repetition visible without turning a corpus-tuned count into a pass/fail gate.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Normalizes interchangeable slots and reports stable locations for fresh human review.
 */
export function inspectAutoMovieEvidenceReviewAlarms(props: {
  documents: readonly IAutoMovieEvidenceSyntaxDocument[];
  targets?: readonly IAutoMovieEvidenceSyntaxDocument[];
  frameThreshold?: number;
}): IAutoMovieEvidenceReviewAlarmReport {
  const threshold = props.frameThreshold ?? 5;
  if (!Number.isSafeInteger(threshold) || threshold < 2)
    throw new Error(
      "Evidence review frame threshold must be an integer of at least two.",
    );
  const reviews = props.documents.flatMap(reviewsOf);
  const frames = new Map<string, IReview[]>();
  for (const review of reviews) {
    const key = [
      review.layer,
      review.exclusion ? "exclude" : "answer",
      frameOf(review.reason),
    ].join("\0");
    const grouped = frames.get(key) ?? [];
    grouped.push(review);
    frames.set(key, grouped);
  }
  const alarms: IAutoMovieEvidenceReviewAlarm[] = [];
  for (const grouped of frames.values())
    if (grouped.length >= threshold)
      for (const review of grouped)
        alarms.push(
          alarm(
            "evidence-review-frame",
            review,
            grouped.length,
            "This review frame recurs across the layer; reread each host and state what it does that a sibling does not.",
          ),
        );

  const questions =
    props.targets === undefined
      ? new Map<string, string>()
      : targetQuestions(props.targets);
  if (props.targets !== undefined)
    for (const review of reviews) {
      const question = questions.get(review.target);
      if (
        question !== undefined &&
        normalized(review.reason).includes(question)
      )
        alarms.push(
          alarm(
            "evidence-review-question-paste",
            review,
            1,
            "The review copies its target's Review question; record the host-specific comparison result instead.",
          ),
        );
    }
  return {
    alarms: alarms.sort((left, right) =>
      compare(
        `${left.path}\0${left.line}\0${left.code}`,
        `${right.path}\0${right.line}\0${right.code}`,
      ),
    ),
    questionPasteChecked: props.targets !== undefined,
  };
}

const reviewsOf = (document: IAutoMovieEvidenceSyntaxDocument): IReview[] =>
  parseAutoMovieEvidenceSyntax(document).flatMap((carrier) => {
    const match = REVIEW.exec(carrier.text.trim());
    if (match === null) return [];
    return [
      {
        exclusion: match[1] !== undefined,
        host: carrier.host,
        layer:
          /^docs\/([^/]+)\//u.exec(document.path.replaceAll("\\", "/"))?.[1] ??
          "source",
        line: carrier.line,
        path: document.path,
        reason: match[3]!,
        target: match[2]!,
      },
    ];
  });

const targetQuestions = (
  documents: readonly IAutoMovieEvidenceSyntaxDocument[],
): Map<string, string> => {
  const output = new Map<string, string>();
  for (const document of documents) {
    const path = document.path.replaceAll("\\", "/").replace(/^docs\//u, "");
    const lines = projectAutoMovieMarkdownSyntax(document).visibleLines;
    let target: string | undefined;
    for (const line of lines) {
      const heading = /^##(?!#)\s+.+?\s+\{#([^{}\s]+)\}\s*$/u.exec(line);
      if (heading !== null) target = `${path}#${heading[1]!}`;
      else if (target !== undefined && /^Review question:\s*/iu.test(line))
        output.set(
          target,
          normalized(line.replace(/^Review question:\s*/iu, "")),
        );
    }
  }
  return output;
};

const frameOf = (reason: string): string =>
  normalized(reason)
    .replace(/(?:[^\s]+\.md|[^\s]+\.ts)(?:#[^\s]+)?/gu, "<host>")
    .replace(/\b\d+(?:\.\d+)?\b/gu, "<number>")
    .replace(/(?:`[^`]+`|"[^"]+"|'[^']+')/gu, "<quote>");

const normalized = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/\p{Punctuation}+/gu, " ")
    .replace(/\p{Symbol}+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
const alarm = (
  code: IAutoMovieEvidenceReviewAlarm["code"],
  review: IReview,
  occurrences: number,
  message: string,
): IAutoMovieEvidenceReviewAlarm => ({
  code,
  path: review.path,
  host: review.host,
  line: review.line,
  target: review.target,
  occurrences,
  message,
});
const compare = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

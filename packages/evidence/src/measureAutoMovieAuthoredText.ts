import crypto from "node:crypto";

import {
  projectAutoMovieAuthoredMarkdown,
  projectAutoMovieMarkdownSyntax,
} from "./parseAutoMovieEvidenceSyntax";

/**
 * Immutable authored-text measurement at one declared revision.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the revision, source identity, body identity, and observations visible together.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines one immutable authored-text observation.
 */
export interface IAutoMovieAuthoredTextMeasurement {
  /** Caller-owned immutable revision identity. */
  revision: string;
  /** Normalized project-relative Markdown path. */
  path: string;
  /** SHA-256 of the exact source supplied for this revision. */
  sourceSha256: string;
  /** SHA-256 of canonical authored body with evidence metadata removed. */
  bodySha256: string;
  /** UTF-8 byte count of the canonical authored body. */
  bytes: number;
  /** Unicode letter-or-number word count in the authored body. */
  words: number;
  /** Visible H2 section count in the authored body. */
  sections: number;
}

/**
 * Signed deltas between an immutable baseline and one candidate revision.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Preserves both exact revisions beside every reported delta.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines baseline-bound authored-text comparison output.
 */
export interface IAutoMovieAuthoredTextDelta {
  /** Revalidated immutable baseline. */
  baseline: IAutoMovieAuthoredTextMeasurement;
  /** Candidate measurement. */
  current: IAutoMovieAuthoredTextMeasurement;
  /** Candidate minus baseline authored UTF-8 bytes. */
  bytes: number;
  /** Candidate minus baseline authored words. */
  words: number;
  /** Candidate minus baseline visible H2 sections. */
  sections: number;
}

/**
 * Measures one authored Markdown revision without structural evidence metadata.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the exact measured revision, path, source, and authored-body digest visible to its consumer.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Produces reproducible byte, word, and section observations without converting them into a semantic verdict.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Carries one immutable revision identity beside its canonical authored-body projection.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Rejects ambiguous mixed line endings and measures one canonical LF projection.
 */
export function measureAutoMovieAuthoredText(props: {
  path: string;
  revision: string;
  source: string;
}): IAutoMovieAuthoredTextMeasurement {
  if (props.revision.trim() === "")
    throw new Error(
      "An authored-text measurement requires a revision identity.",
    );
  const path = normalizeMarkdownPath(props.path);
  const endings = new Set(props.source.match(/\r\n|\r|\n/gu) ?? []);
  if (endings.size > 1)
    throw new Error(`${path}: authored text mixes line-ending conventions.`);
  const sourceSha256 = digest(Buffer.from(props.source, "utf8"));
  const source = props.source.replace(/\r\n|\r/gu, "\n");
  const body = projectAutoMovieAuthoredMarkdown(source);
  const visible = projectAutoMovieMarkdownSyntax({
    path,
    source: body,
  }).visibleLines;
  return {
    revision: props.revision,
    path,
    sourceSha256,
    bodySha256: digest(Buffer.from(body, "utf8")),
    bytes: Buffer.byteLength(body, "utf8"),
    words: [...body.matchAll(/[\p{L}\p{N}]+/gu)].length,
    sections: visible.filter((line) => /^##(?!#)\s+\S/u.test(line)).length,
  };
}

/**
 * Revalidates an immutable baseline and reports candidate deltas.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Refuses a stale baseline record before publishing authored-text deltas.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Binds every delta to recomputed baseline bytes and a distinct current revision.
 */
export function compareAutoMovieAuthoredText(props: {
  baseline: IAutoMovieAuthoredTextMeasurement;
  baselineSource: string;
  currentRevision: string;
  currentSource: string;
}): IAutoMovieAuthoredTextDelta {
  const baseline = measureAutoMovieAuthoredText({
    path: props.baseline.path,
    revision: props.baseline.revision,
    source: props.baselineSource,
  });
  if (!sameMeasurement(baseline, props.baseline))
    throw new Error(
      `${props.baseline.path}: authored-text baseline is stale or does not match its recorded revision.`,
    );
  if (props.currentRevision === props.baseline.revision)
    throw new Error("Authored-text delta revisions must be distinct.");
  const current = measureAutoMovieAuthoredText({
    path: baseline.path,
    revision: props.currentRevision,
    source: props.currentSource,
  });
  return {
    baseline,
    current,
    bytes: current.bytes - baseline.bytes,
    words: current.words - baseline.words,
    sections: current.sections - baseline.sections,
  };
}

/** Normalize and confine one authored Markdown identity. */
function normalizeMarkdownPath(value: string): string {
  const path = value.replaceAll("\\", "/");
  if (
    path !== value ||
    path === "" ||
    path.startsWith("/") ||
    /^[A-Za-z]:/u.test(path) ||
    path
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    !path.endsWith(".md")
  )
    throw new Error(`${value}: expected a normalized relative Markdown path.`);
  return path;
}

/** Compare every persisted baseline field. */
function sameMeasurement(
  left: IAutoMovieAuthoredTextMeasurement,
  right: IAutoMovieAuthoredTextMeasurement,
): boolean {
  return (
    left.revision === right.revision &&
    left.path === right.path &&
    left.sourceSha256 === right.sourceSha256 &&
    left.bodySha256 === right.bodySha256 &&
    left.bytes === right.bytes &&
    left.words === right.words &&
    left.sections === right.sections
  );
}

/** Compute one lowercase SHA-256 identity. */
function digest(value: Uint8Array): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

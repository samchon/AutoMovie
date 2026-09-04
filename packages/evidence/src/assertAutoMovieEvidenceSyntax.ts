import {
  type IAutoMovieEvidenceSyntaxDocument,
  parseAutoMovieEvidenceSyntax,
} from "./parseAutoMovieEvidenceSyntax";

interface IParsedAnnotation {
  exclusion: boolean;
  fingerprint: string | null;
  kind: "acknowledgement" | "review";
  target: string;
}

const ACKNOWLEDGEMENT = /^@evidence(Exclude)?\s+(\S+)\s+(\S(?:.*\S)?)$/u;
const REVIEW =
  /^@evidence(Exclude)?Review\s+(\S+)\s+(#[0-9a-f]{7})\s+(\S(?:.*\S)?)$/u;
const FINGERPRINT_TOKEN = /(?:^|\s)#[0-9a-f]{7}(?=\s|$)/gu;

/**
 * Refuses deterministic contradictions in native evidence declarations.
 *
 * Graph resolution remains `@ttsc/evidence`'s authority. This preflight owns
 * only syntax facts that can otherwise produce a false carrier, a conflicting
 * acknowledgement, or a review with no declaration to review.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shared-contract Preserves one unambiguous acknowledgement and review pair per target and host.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Refuses malformed targets, duplicate rows, contradictions, and orphan reviews with stable addresses.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shared-contract Adds only deterministic carrier grammar checks before native graph evaluation.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Reports every syntax defect before returning a partial graph.
 */
export function assertAutoMovieEvidenceSyntax(
  documents: readonly IAutoMovieEvidenceSyntaxDocument[],
): void {
  const diagnostics: string[] = [];
  for (const document of documents) {
    const declarations = new Map<string, IParsedAnnotation>();
    for (const annotation of parseAutoMovieEvidenceSyntax(document)) {
      if (/^@evidencePart\b/u.test(annotation.text)) continue;
      const parsed = parseAnnotation(annotation.text);
      const address = `${document.path}:${annotation.line}`;
      if (parsed === null) {
        diagnostics.push(
          `${address} [evidence-syntax] malformed evidence declaration in ${annotation.host}.`,
        );
        continue;
      }
      if (!isCanonicalTarget(parsed.target))
        diagnostics.push(
          `${address} [evidence-target] ${JSON.stringify(parsed.target)} is not a normalized relative Markdown evidence address.`,
        );
      if (
        parsed.kind === "review" &&
        (annotation.text.match(FINGERPRINT_TOKEN)?.length ?? 0) > 1
      )
        diagnostics.push(
          `${address} [evidence-fingerprint-extra] a review carries more than one fingerprint token.`,
        );

      const polarity = parsed.exclusion ? "exclude" : "answer";
      const key = `${annotation.host}\0${parsed.target}\0${parsed.kind}\0${polarity}`;
      if (declarations.has(key))
        diagnostics.push(
          `${address} [evidence-duplicate] ${annotation.host} repeats its ${polarity} ${parsed.kind} for ${parsed.target}.`,
        );
      declarations.set(key, parsed);

      const opposite = `${annotation.host}\0${parsed.target}\0${parsed.kind}\0${parsed.exclusion ? "answer" : "exclude"}`;
      if (declarations.has(opposite))
        diagnostics.push(
          `${address} [evidence-contradiction] ${annotation.host} both answers and excludes ${parsed.target}.`,
        );

      if (parsed.kind === "review") {
        const acknowledgement = `${annotation.host}\0${parsed.target}\0acknowledgement\0${polarity}`;
        if (!declarations.has(acknowledgement))
          diagnostics.push(
            `${address} [evidence-review-orphan] ${annotation.host} reviews ${parsed.target} without a matching prior ${polarity} acknowledgement.`,
          );
      }
    }
  }
  if (diagnostics.length !== 0)
    throw new Error(
      `Evidence syntax is contradictory or malformed:\n${diagnostics
        .map((diagnostic) => `- ${diagnostic}`)
        .join("\n")}`,
    );
}

/** Parse one exact acknowledgement or review declaration. */
function parseAnnotation(text: string): IParsedAnnotation | null {
  const review = REVIEW.exec(text);
  if (review !== null)
    return {
      exclusion: review[1] !== undefined,
      fingerprint: review[3]!,
      kind: "review",
      target: review[2]!,
    };
  const acknowledgement = ACKNOWLEDGEMENT.exec(text);
  if (acknowledgement === null) return null;
  return {
    exclusion: acknowledgement[1] !== undefined,
    fingerprint: null,
    kind: "acknowledgement",
    target: acknowledgement[2]!,
  };
}

/** Validate the address form without resolving the target graph. */
function isCanonicalTarget(target: string): boolean {
  if (
    target.includes("\\") ||
    target.startsWith("/") ||
    target.includes("//") ||
    /[:*?]/u.test(target)
  )
    return false;
  const [file, anchor, ...rest] = target.split("#");
  if (rest.length !== 0 || !file.endsWith(".md")) return false;
  if (
    file
      .split("/")
      .some(
        (part) =>
          part.length === 0 ||
          part === "." ||
          part === ".." ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(part),
      )
  )
    return false;
  return anchor === undefined || /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(anchor);
}

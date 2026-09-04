import crypto from "node:crypto";
import path from "node:path";

import {
  parseAutoMovieEvidenceSyntax,
  projectAutoMovieAuthoredMarkdown,
} from "./parseAutoMovieEvidenceSyntax";

/**
 * Exact evidence metadata region an operation is allowed to rewrite.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes the caller-owned metadata region explicit.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the closed rewrite-ownership vocabulary.
 */
export type AutoMovieEvidenceMetadataOwnership =
  | "acknowledgements"
  | "comments"
  | "fingerprints"
  | "reviews";

/**
 * Inputs to one metadata-only rewrite comparison.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Makes both revisions and the owned metadata region explicit.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the complete metadata rewrite comparison input.
 */
export interface IVerifyAutoMovieEvidenceMetadataRewriteProps {
  /** Stable project-relative Markdown path. */
  path: string;
  /** Exact ancestor source. */
  before: string;
  /** Candidate source after the metadata operation. */
  after: string;
  /** Only metadata region the operation owns. */
  ownership: AutoMovieEvidenceMetadataOwnership;
}

/**
 * Reproducible result of one successful metadata-only rewrite check.
 *
 * @evidence requirements/production-evidence/input.md#agent-production-evidence-visible-selection Exposes the protected projection identity and compared declaration count.
 * @evidence specifications/production-evidence/input.md#spec-authoring-production-evidence-input-state Defines the successful comparison receipt.
 */
export interface IAutoMovieEvidenceMetadataRewriteReport {
  /** Compared project-relative path. */
  path: string;
  /** Mutable metadata region proved by the comparison. */
  ownership: AutoMovieEvidenceMetadataOwnership;
  /** Whether owned metadata changed. */
  metadataChanged: boolean;
  /** SHA-256 of the unchanged protected authored projection. */
  projectionSha256: string;
  /** Exact number of structural evidence declarations compared. */
  declarationCount: number;
}

const REVIEW_FINGERPRINT =
  /^(@evidence(?:Exclude)?Review\s+\S+\s+)#[0-9a-f]{7}(\s+\S[\s\S]*)$/u;
const DECLARATION_IDENTITY =
  /^(@evidence(?:Exclude(?:Review)?|Part|Review)?)\s+(\S+)/u;

/**
 * Proves that one evidence metadata rewrite preserves authored work.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-deterministic-result Refuses metadata repair that changes authored prose, headings, comments, declaration addresses, or an unowned metadata region.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-deterministic-result Compares canonical protected projections and exact native-carrier rows before reporting success.
 */
export function verifyAutoMovieEvidenceMetadataRewrite(
  props: IVerifyAutoMovieEvidenceMetadataRewriteProps,
): IAutoMovieEvidenceMetadataRewriteReport {
  const normalizedPath = props.path.replaceAll("\\", "/");
  if (
    normalizedPath !== props.path ||
    normalizedPath === "" ||
    path.posix.normalize(normalizedPath) !== normalizedPath ||
    path.posix.isAbsolute(normalizedPath) ||
    /^[A-Za-z]:/u.test(normalizedPath) ||
    normalizedPath.split("/").some((part) => part === "." || part === "..") ||
    !normalizedPath.endsWith(".md")
  )
    throw new Error(
      `${props.path}: expected a normalized relative Markdown path.`,
    );
  if (
    !["acknowledgements", "comments", "fingerprints", "reviews"].includes(
      props.ownership,
    )
  )
    throw new Error(
      "ownership: expected comments, acknowledgements, reviews, or fingerprints.",
    );

  const beforeProjection = projectAutoMovieAuthoredMarkdown(props.before);
  const afterProjection = projectAutoMovieAuthoredMarkdown(props.after);
  if (beforeProjection !== afterProjection)
    throw new Error(
      `${props.path}: protected authored bytes changed during a metadata-only rewrite.`,
    );

  const before = parseAutoMovieEvidenceSyntax({
    path: props.path,
    source: props.before,
  });
  const after = parseAutoMovieEvidenceSyntax({
    path: props.path,
    source: props.after,
  });
  if (
    before.length !== after.length ||
    before.some(
      (entry, index) =>
        entry.host !== after[index]?.host ||
        entry.line !== after[index]?.line ||
        entry.endLine !== after[index]?.endLine,
    )
  )
    throw new Error(
      `${props.path}: evidence declaration cardinality or source address changed during metadata repair.`,
    );

  let metadataChanged = false;
  for (let index = 0; index < before.length; index++) {
    const ancestor = before[index]!.text;
    const candidate = after[index]!.text;
    if (ancestor === candidate) continue;
    metadataChanged = true;
    if (!ownedChange(ancestor, candidate, props.ownership))
      throw new Error(
        `${props.path}:${before[index]!.line}: ${props.ownership} rewrite changed an unowned evidence field.`,
      );
  }
  return {
    path: props.path,
    ownership: props.ownership,
    metadataChanged,
    projectionSha256: crypto
      .createHash("sha256")
      .update(beforeProjection)
      .digest("hex"),
    declarationCount: before.length,
  };
}

/** Decide whether the declared ownership explains one changed row. */
function ownedChange(
  before: string,
  after: string,
  ownership: AutoMovieEvidenceMetadataOwnership,
): boolean {
  const beforeIdentity = DECLARATION_IDENTITY.exec(before);
  const afterIdentity = DECLARATION_IDENTITY.exec(after);
  if (
    beforeIdentity === null ||
    afterIdentity === null ||
    beforeIdentity[1] !== afterIdentity[1] ||
    beforeIdentity[2] !== afterIdentity[2]
  )
    return false;
  if (ownership === "comments") return true;
  const beforeReview = /^@evidence(?:Exclude)?Review\b/u.test(before);
  const afterReview = /^@evidence(?:Exclude)?Review\b/u.test(after);
  if (ownership === "reviews") return beforeReview && afterReview;
  if (ownership === "acknowledgements") return !beforeReview && !afterReview;
  if (!beforeReview || !afterReview) return false;
  return (
    before.replace(REVIEW_FINGERPRINT, "$1#<fingerprint>$2") ===
    after.replace(REVIEW_FINGERPRINT, "$1#<fingerprint>$2")
  );
}

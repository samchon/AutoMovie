import typia from "typia";

import type { IAutoMovieHumanFaceDocument } from "./IAutoMovieHumanFaceDocument";

/**
 * Read a version-one face document without fetching its provenance or guessing
 * unknown fields. Shape admission is distinct from constructing a valid model:
 * geometry-dependent topology and attachment admission run during build.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-document Loads the complete independent face document without a measurement runtime.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-document Refuses unsupported schema versions and unknown nested fields rather than silently dropping them.
 */
export function parseHumanFaceDocument(
  text: string,
): IAutoMovieHumanFaceDocument {
  if (text.length > 16 * 1024 * 1024)
    throw new Error(
      "Face documents must fit within 16,777,216 UTF-16 code units.",
    );
  const document = typia.assertEquals<IAutoMovieHumanFaceDocument>(
    JSON.parse(text),
  );
  assertFinite(document);
  if (
    [document.id, document.name, document.basis.id].some(
      (value) => value.trim().length === 0,
    )
  )
    throw new Error("Face and basis identities must be nonempty.");
  return document;
}

/**
 * Save only the replay document, not a mesh cache, screenshot or source image.
 * Parsing the serialized representation applies the same schema admission as
 * load, so optional values that JSON omits do not become new runtime settings.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-document Preserves portable independently replayable face settings for save/load.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-document Keeps version, source basis, controls and explicit overrides together.
 */
export function serializeHumanFaceDocument(
  document: IAutoMovieHumanFaceDocument,
): string {
  assertFinite(document);
  const text = JSON.stringify(document, null, 2);
  parseHumanFaceDocument(text);
  return text;
}

function assertFinite(value: unknown, ancestors = new Set<object>()): void {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Face document numbers must be finite.");
  if (value !== null && typeof value === "object") {
    if (ancestors.has(value))
      throw new Error("Face documents cannot contain cyclic references.");
    ancestors.add(value);
    for (const item of Object.values(value)) assertFinite(item, ancestors);
    ancestors.delete(value);
  }
}

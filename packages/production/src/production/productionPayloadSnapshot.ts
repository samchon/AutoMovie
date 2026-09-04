import { AutoMovieContentDigest } from "@automovie/interface";

import { digestAutoMovieBytes } from "./contentIdentity";

/** Exact byte identity captured for one publication payload member. */
export interface IProductionPayloadSnapshotEntry {
  path: string;
  digest: AutoMovieContentDigest;
  bytes: number;
}

/** Immutable ordered byte snapshot used by a publication transaction. */
export interface IProductionPayloadSnapshot {
  entries: IProductionPayloadSnapshotEntry[];
}

/**
 * Capture exact bytes through an injected reader before publication begins.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-artifact-invalidation Binds every retained or final payload member to the bytes verified for this commit attempt.
 * @evidence specifications/execution-and-recovery/artifacts-and-atomic-publication.md#execution-publication-preconditions Captures the complete candidate inventory before the guarded transition.
 */
export const captureProductionPayloadSnapshot = (props: {
  paths: readonly string[];
  read: (path: string) => Uint8Array | null;
}): IProductionPayloadSnapshot => {
  const seen = new Set<string>();
  return {
    entries: props.paths.map((path) => {
      const portable = path.replaceAll("\\", "/").toLowerCase();
      if (seen.has(portable))
        throw new Error(`Publication payload path "${path}" is duplicated.`);
      seen.add(portable);
      const value = props.read(path);
      if (value === null)
        throw new Error(`Publication payload "${path}" is absent.`);
      const bytes = Buffer.from(value);
      return {
        path,
        digest: digestAutoMovieBytes(bytes),
        bytes: bytes.length,
      };
    }),
  };
};

/**
 * Revalidate the exact snapshot without reducing absence or replacement to path existence.
 *
 * @evidence requirements/rendering/scope-and-artifact-identity.md#rendering-missing-artifact-refusal Refuses deletion, same-size replacement, and in-place mutation as stale payload.
 * @evidence specifications/validation-and-diagnostics/partial-artifacts-and-refusal.md#validation-resume-verified-artifacts Admits only byte-identical members from the captured generation.
 */
export const isProductionPayloadSnapshotCurrent = (props: {
  snapshot: IProductionPayloadSnapshot;
  read: (path: string) => Uint8Array | null;
}): boolean =>
  props.snapshot.entries.every((entry) => {
    try {
      const value = props.read(entry.path);
      return (
        value !== null &&
        value.length === entry.bytes &&
        digestAutoMovieBytes(value) === entry.digest
      );
    } catch {
      return false;
    }
  });

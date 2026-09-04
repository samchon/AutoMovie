import {
  captureProductionPayloadSnapshot,
  isProductionPayloadSnapshotCurrent,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

/**
 * Publication snapshots authenticate exact bytes across the guarded commit.
 *
 * Scenarios:
 *
 * 1. Unchanged retained members remain current.
 * 2. Same-size replacement, deletion, and read failure are stale.
 * 3. Missing and duplicate paths are refused while capturing the candidate.
 */
export const test_production_payload_snapshot = (): void => {
  const files = new Map<string, Uint8Array>([
    ["retained.png", Uint8Array.of(1, 2, 3)],
    ["manifest.json", Uint8Array.of(4, 5)],
  ]);
  const snapshot = captureProductionPayloadSnapshot({
    paths: ["retained.png", "manifest.json"],
    read: (path) => files.get(path) ?? null,
  });
  TestValidator.equals(
    "the exact unchanged candidate remains current",
    isProductionPayloadSnapshotCurrent({
      snapshot,
      read: (path) => files.get(path) ?? null,
    }),
    true,
  );

  files.set("retained.png", Uint8Array.of(1, 2, 4));
  const sameSizeReplacement = isProductionPayloadSnapshotCurrent({
    snapshot,
    read: (path) => files.get(path) ?? null,
  });
  files.delete("retained.png");
  const deletion = isProductionPayloadSnapshotCurrent({
    snapshot,
    read: (path) => files.get(path) ?? null,
  });
  const readFailure = isProductionPayloadSnapshotCurrent({
    snapshot,
    read: () => {
      throw new Error("injected observation failure");
    },
  });
  TestValidator.equals(
    "every byte-loss observation invalidates the snapshot",
    { sameSizeReplacement, deletion, readFailure },
    { sameSizeReplacement: false, deletion: false, readFailure: false },
  );

  TestValidator.equals(
    "candidate capture refuses absent and duplicate members",
    namedFacts([
      [
        "absent",
        () =>
          throwsError(
            () =>
              captureProductionPayloadSnapshot({
                paths: ["missing"],
                read: () => null,
              }),
            'payload "missing" is absent',
          ),
      ],
      [
        "duplicate",
        () =>
          throwsError(
            () =>
              captureProductionPayloadSnapshot({
                paths: ["Frame.png", "frame.png"],
                read: () => Uint8Array.of(1),
              }),
            'path "frame.png" is duplicated',
          ),
      ],
    ]),
    { absent: true, duplicate: true },
  );
};

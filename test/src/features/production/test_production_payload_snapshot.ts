import {
  captureProductionPayloadSnapshot,
  isProductionPayloadSnapshotCurrent,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";

interface IFakePublicationState {
  manifest: string;
  receipt: string;
  revision: number;
}

/** Exercise the production guard through the same pre/apply/post rollback shape. */
const guardedFakePublication = (props: {
  snapshot: ReturnType<typeof captureProductionPayloadSnapshot>;
  files: Map<string, Uint8Array>;
  state: IFakePublicationState;
  before?: () => void;
  during?: () => void;
  rollbackFailure?: Error;
}): { error: unknown; rolledBack: boolean } | null => {
  const current = (): boolean =>
    isProductionPayloadSnapshotCurrent({
      snapshot: props.snapshot,
      read: (file) => props.files.get(file) ?? null,
    });
  const previous = { ...props.state };
  let applied = false;
  try {
    props.before?.();
    if (current() === false) throw new Error("payload changed before apply");
    props.state.manifest = "candidate-manifest";
    props.state.receipt = "candidate-receipt";
    applied = true;
    props.during?.();
    if (current() === false) throw new Error("payload changed after apply");
    ++props.state.revision;
    return null;
  } catch (error) {
    if (applied === false) return { error, rolledBack: false };
    props.state.manifest = previous.manifest;
    props.state.receipt = previous.receipt;
    props.state.revision = previous.revision;
    if (props.rollbackFailure !== undefined)
      return {
        error: new AggregateError([error, props.rollbackFailure]),
        rolledBack: false,
      };
    return { error, rolledBack: true };
  }
};

/**
 * Publication snapshots authenticate exact bytes across the guarded commit.
 *
 * Scenarios:
 *
 * 1. Unchanged retained members remain current.
 * 2. Same-size replacement, deletion, and read failure are stale.
 * 3. Missing and duplicate paths are refused while capturing the candidate.
 * 4. Pre-apply and apply-time swaps, deletion, recreation, new-frame overwrite,
 *    and aggregate payload mutation refuse without publishing a new ledger.
 * 5. Rollback failure keeps both the currentness and rollback causes.
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

  const matrix = new Map<string, Uint8Array>([
    ["retained.png", Uint8Array.of(1, 2, 3)],
    ["new.png", Uint8Array.of(4, 5, 6)],
    ["feature.mp4", Uint8Array.of(7, 8, 9)],
  ]);
  const exact = captureProductionPayloadSnapshot({
    paths: [...matrix.keys()],
    read: (file) => matrix.get(file) ?? null,
  });
  const state: IFakePublicationState = {
    manifest: "previous-manifest",
    receipt: "previous-receipt",
    revision: 4,
  };
  const reset = (): void => {
    matrix.set("retained.png", Uint8Array.of(1, 2, 3));
    matrix.set("new.png", Uint8Array.of(4, 5, 6));
    matrix.set("feature.mp4", Uint8Array.of(7, 8, 9));
  };
  const scenario = (props: {
    before?: () => void;
    during?: () => void;
    rollbackFailure?: Error;
  }): { refused: boolean; previous: boolean; causes: number } => {
    reset();
    state.manifest = "previous-manifest";
    state.receipt = "previous-receipt";
    state.revision = 4;
    const failure = guardedFakePublication({
      snapshot: exact,
      files: matrix,
      state,
      ...props,
    });
    return {
      refused: failure !== null,
      previous:
        state.manifest === "previous-manifest" &&
        state.receipt === "previous-receipt" &&
        state.revision === 4,
      causes:
        failure?.error instanceof AggregateError
          ? failure.error.errors.length
          : failure === null
            ? 0
            : 1,
    };
  };
  const successful = guardedFakePublication({
    snapshot: exact,
    files: matrix,
    state,
  });
  TestValidator.equals(
    "the pure guard closes every publication phase and rollback outcome",
    {
      unchanged: {
        succeeded: successful === null,
        revision: state.revision,
      },
      verifyBeforeCommit: scenario({
        before: () => matrix.set("retained.png", Uint8Array.of(1, 2, 4)),
      }),
      applyDuringCommit: scenario({
        during: () => matrix.set("retained.png", Uint8Array.of(1, 2, 4)),
      }),
      deletion: scenario({
        during: () => matrix.delete("retained.png"),
      }),
      sameSizeReplacement: scenario({
        during: () => matrix.set("retained.png", Uint8Array.of(3, 2, 1)),
      }),
      sizeReplacement: scenario({
        during: () => matrix.set("retained.png", Uint8Array.of(1, 2)),
      }),
      recreation: scenario({
        during: () => {
          matrix.delete("retained.png");
          matrix.set("retained.png", Uint8Array.of(9, 9, 9));
        },
      }),
      newFrameOverwrite: scenario({
        during: () => matrix.set("new.png", Uint8Array.of(6, 5, 4)),
      }),
      aggregateManifestOnly: scenario({
        during: () => matrix.set("feature.mp4", Uint8Array.of(9, 8, 7)),
      }),
      rollbackFailure: scenario({
        during: () => matrix.delete("feature.mp4"),
        rollbackFailure: new Error("injected rollback failure"),
      }),
    },
    {
      unchanged: { succeeded: true, revision: 5 },
      verifyBeforeCommit: { refused: true, previous: true, causes: 1 },
      applyDuringCommit: { refused: true, previous: true, causes: 1 },
      deletion: { refused: true, previous: true, causes: 1 },
      sameSizeReplacement: { refused: true, previous: true, causes: 1 },
      sizeReplacement: { refused: true, previous: true, causes: 1 },
      recreation: { refused: true, previous: true, causes: 1 },
      newFrameOverwrite: { refused: true, previous: true, causes: 1 },
      aggregateManifestOnly: { refused: true, previous: true, causes: 1 },
      rollbackFailure: { refused: true, previous: true, causes: 2 },
    },
  );
};

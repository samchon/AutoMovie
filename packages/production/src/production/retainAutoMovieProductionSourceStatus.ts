import type { IAutoMovieBuildProjectOutput } from "@automovie/interface";

import type { IAutoMovieProductionSourceEvaluation } from "./IAutoMovieProductionSourceEvaluation";
import type { IAutoMovieProductionSourceSnapshot } from "./IAutoMovieProductionSourceSnapshot";
import { canonicalizeAutoMovieJson } from "./contentIdentity";

/**
 * Answer the read-only source gate, running it only when its inputs moved.
 *
 * Every call reads a fresh snapshot first. When a successful answer is
 * retained and that fresh snapshot equals the one the answer was retained with,
 * the answer is returned without executing any authored source. The builder is
 * deterministic, so the same observed inputs give the same answer, and the
 * observation itself is never skipped: a capture, a receipt reopen or a guarded
 * commit that asks again reads the project again.
 *
 * The revision names when a snapshot was read, and it is compared only for an
 * answer that read the revision number into what it judged. Every project write
 * that moves a gate input also moves another snapshot field, so a write that
 * moves none, such as the render commit a capture makes just before its receipt
 * is reopened, leaves an unbound answer standing, and the answer is returned
 * under the revision it was confirmed at.
 *
 * Any other case runs the gate and returns its output unchanged. A differing
 * snapshot, a snapshot that could not be read completely, and a read that throws
 * all end there, so no read failure can turn into a success and the gate's own
 * diagnostics or exception carry the original cause. A failed answer is never
 * retained, so an invalid project runs the gate and reports its diagnostics on
 * every call.
 *
 * A successful answer is retained only when it is provably the answer for one
 * snapshot. The snapshots read before and after the run must agree on every
 * input except documents. The answer's revision and input fingerprint must
 * equal the later snapshot's, and so must the fingerprint its resident generated
 * manifest records. Every document the run read must still read the same, and no
 * executed project module may sit outside the fingerprinted content. An input
 * that changed and changed back while the gate ran is the one race this cannot
 * see, which is the same limit as the builder's own before-and-after
 * publication guard.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Keeps a gate answer current only while every source, document and owned-output digest it depended on, and the revision when it read one, is unchanged, and runs the gate again when any of them moves.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Compares the stored observation with a freshly read one field by field, and never treats a prior success alone as current.
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Lets repeated capture, receipt and publication checks confirm unchanged inputs without executing authored source at every boundary.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Reuses a gate answer only while its referenced snapshot equals the current one and its own validation succeeded.
 * @evidence requirements/agent-authoring/partial-work.md#agent-atomic-compilation Never lets an earlier success answer for inputs that no longer pass, so a check never publishes over a structured failure.
 * @evidence specifications/authoring-and-authority/partial-targets-and-atomic-results.md#spec-authoring-partial-atomic-invariant Makes every guarded boundary compare a freshly read snapshot and re-derive the answer when it differs.
 */
export const retainAutoMovieProductionSourceStatus = (props: {
  /**
   * Read a fresh snapshot, including the given documents, or `null` when no
   * complete consistent observation is available.
   */
  acquire: (
    documents: readonly string[],
  ) => IAutoMovieProductionSourceSnapshot | null;

  /** Run the read-only source gate once. */
  evaluate: () => IAutoMovieProductionSourceEvaluation;
}): (() => IAutoMovieBuildProjectOutput) => {
  let retained: {
    snapshot: IAutoMovieProductionSourceSnapshot;
    output: IAutoMovieBuildProjectOutput;
    revisionBound: boolean;
  } | null = null;
  return () => {
    const previous = retained;
    retained = null;
    const before = observe(() =>
      props.acquire(
        previous === null
          ? []
          : previous.snapshot.documents.map((document) => document.path),
      ),
    );
    if (
      previous !== null &&
      before !== null &&
      sameInputs(before, previous.snapshot, previous.revisionBound)
    ) {
      retained = {
        snapshot: before,
        output: { ...previous.output, revision: before.revision },
        revisionBound: previous.revisionBound,
      };
      return structuredClone(retained.output);
    }
    const evaluation = props.evaluate();
    const after =
      before === null
        ? null
        : observe(() =>
            props.acquire(
              evaluation.documents.map((document) => document.path),
            ),
          );
    if (
      before !== null &&
      after !== null &&
      provesSnapshot(before, evaluation, after)
    )
      retained = {
        snapshot: after,
        output: structuredClone(evaluation.output),
        revisionBound: evaluation.revisionBound,
      };
    return evaluation.output;
  };
};

/** Read a snapshot, answering `null` for a read that throws. */
const observe = (
  read: () => IAutoMovieProductionSourceSnapshot | null,
): IAutoMovieProductionSourceSnapshot | null => {
  try {
    return read();
  } catch {
    return null;
  }
};

/** Whether two snapshots observed the same inputs, and the same revision when asked. */
const sameInputs = (
  left: IAutoMovieProductionSourceSnapshot,
  right: IAutoMovieProductionSourceSnapshot,
  compareRevision: boolean,
): boolean =>
  compareRevision
    ? canonicalizeAutoMovieJson(left) === canonicalizeAutoMovieJson(right)
    : canonicalizeAutoMovieJson({ ...left, revision: null }) ===
      canonicalizeAutoMovieJson({ ...right, revision: null });

/** Whether one successful run is the answer for the snapshot read after it. */
const provesSnapshot = (
  before: IAutoMovieProductionSourceSnapshot,
  evaluation: IAutoMovieProductionSourceEvaluation,
  after: IAutoMovieProductionSourceSnapshot,
): boolean => {
  const output = evaluation.output;
  if (
    output.success === false ||
    evaluation.undeclaredModules.length !== 0 ||
    output.revision !== after.revision ||
    output.builder.inputFingerprint !== after.inputFingerprint ||
    after.generated.inputFingerprint !== after.inputFingerprint ||
    sameInputs(
      { ...before, documents: [] },
      { ...after, documents: [] },
      false,
    ) === false
  )
    return false;
  const read = new Map(
    after.documents.map((document) => [document.path, document.digest]),
  );
  return evaluation.documents.every(
    (document) => read.get(document.path) === document.digest,
  );
};

import type { IAutoMovieCameraClearanceRuntime } from "@automovie/engine";

import type { IAutoMovieProductionSourceGateTrace } from "./IAutoMovieProductionSourceGateTrace";

/**
 * Hand a camera clearance evaluation its revisions and note when it reads them.
 *
 * A clearance report records the geometry revision it measured and the one
 * current at the gate, so a compiled take that keeps a report depends on the
 * revision number itself. The engine reads those two values only for a camera
 * that declares a clearance envelope, which makes a read exactly the case in
 * which a revision change alone can move the gate answer. The values are fixed
 * before the evaluation, every other runtime field is carried as it was, and
 * reading one of those records nothing. Without a trace the runtime is returned
 * as it was.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Marks exactly the gate answers whose current status depends on the revision they recorded.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Adds the revision to the freshness key of an answer only when that answer read it.
 */
export const recordAutoMovieProductionClearanceRevision = (props: {
  /** Trace of the running gate, or `undefined` when nothing records. */
  trace: IAutoMovieProductionSourceGateTrace | undefined;

  /** Revisions and fixed clock the builder computed for the evaluation. */
  runtime: IAutoMovieCameraClearanceRuntime;
}): IAutoMovieCameraClearanceRuntime => {
  const trace = props.trace;
  const runtime = props.runtime;
  if (trace === undefined) return runtime;
  return {
    ...runtime,
    get revision(): string {
      trace.revisionBound = true;
      return runtime.revision;
    },
    get currentRevision(): string {
      trace.revisionBound = true;
      return runtime.currentRevision;
    },
  };
};

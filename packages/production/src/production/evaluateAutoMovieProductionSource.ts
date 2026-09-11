import type { IAutoMovieBuildProjectOutput } from "@automovie/interface";
import path from "node:path";

import type { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import type { IAutoMovieProductionSourceEvaluation } from "./IAutoMovieProductionSourceEvaluation";
import type { IAutoMovieProductionSourceGateTrace } from "./IAutoMovieProductionSourceGateTrace";
import { compareCodeUnits, digestAutoMovieBytes } from "./contentIdentity";
import { listAutoMovieProjectModules } from "./listAutoMovieProjectModules";
import { normalizeSlash } from "./productionBuildDiagnostics";

/**
 * Run the read-only source gate once and record what its answer rests on.
 *
 * The builder reports every author-owned document its validation read, and
 * each is kept as the digest of the text it saw, in read order, so a document
 * that changed between two reads inside one run shows up as two different
 * digests for one path. The module cache is read immediately after the run:
 * the builder evicts every project module before it evaluates, so the project
 * modules loaded now are the closure this answer executed. Each of them is
 * compared with the fingerprinted content inventory, and one outside it is
 * named, because an edit to it would move the answer without moving any
 * identity a later check can recompute.
 *
 * The builder also reports whether the answer read the project revision into
 * what it judged, which only a camera clearance report does, so a later check
 * knows whether a revision change alone can move this answer.
 *
 * The gate's output is returned unchanged, including a failure and its
 * diagnostics, and an exception from the gate propagates with its own cause.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Binds one gate answer to the exact documents it read and the project modules it executed.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Records the snapshot a derived gate answer referenced, including inputs no fingerprint field carries.
 */
export const evaluateAutoMovieProductionSource = (props: {
  /** Project handle the gate reads. */
  project: AutoMovieProductionProject;

  /** Builder whose read-only source gate this run executes. */
  builder: {
    /**
     * Run the read-only gate at source scope and report the documents its
     * validation read and whether its answer read the project revision.
     */
    lintSource(): IAutoMovieProductionSourceGateTrace & {
      /** The gate's own answer. */
      output: IAutoMovieBuildProjectOutput;
    };
  };

  /** Process module cache, keyed by absolute module id. */
  moduleCache: Readonly<Record<string, unknown>>;
}): IAutoMovieProductionSourceEvaluation => {
  const gate = props.builder.lintSource();
  const root = props.project.root;
  const executed = listAutoMovieProjectModules({
    root,
    loaded: Object.keys(props.moduleCache),
  }).map((id) => normalizeSlash(path.relative(root, id)));
  let declared: ReadonlySet<string>;
  try {
    declared = new Set(
      props.project.contentInputs().map((input) => input.path),
    );
  } catch {
    declared = new Set();
  }
  return {
    output: gate.output,
    documents: gate.documents.map((document) => ({
      path: document.path,
      digest:
        document.content === null
          ? null
          : digestAutoMovieBytes(Buffer.from(document.content, "utf8")),
    })),
    undeclaredModules: executed
      .filter((module) => declared.has(module) === false)
      .sort(compareCodeUnits),
    revisionBound: gate.revisionBound,
  };
};

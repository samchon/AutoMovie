import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type { IAutoMovieBuildProjectOutput } from "@automovie/interface";
import { createRequire } from "node:module";
import path from "node:path";

import type { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { acquireAutoMovieProductionSourceSnapshot } from "./acquireAutoMovieProductionSourceSnapshot";
import { evaluateAutoMovieProductionSource } from "./evaluateAutoMovieProductionSource";
import { listFiles } from "./productionBuildDiagnostics";
import { retainAutoMovieProductionSourceStatus } from "./retainAutoMovieProductionSourceStatus";

/**
 * Open the read-only source gate status one project's checks share.
 *
 * Capture, receipt reopen, guarded commits, inspection and repaint all ask the
 * same question of the same project handle: does current source still pass the
 * read-only gate, and under which input identity. This composes the answer
 * from a fresh snapshot read through that handle, the builder's own gate run,
 * the builder's generated-root walk and the process module cache, and retains
 * a successful answer only while a fresh snapshot proves it unchanged.
 *
 * The snapshot is judged against the authoring evidence a compile would read
 * now: the live reader when one is supplied, otherwise the fixed declaration.
 * The builder carries its own evidence, so a caller that must compile with
 * freshly read evidence supplies a builder that reads it on every run.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-narrowest-valid-check Gives every capture, receipt and publication check of one project a gate status that executes authored source only when its inputs moved.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Serves a gate answer as current only while a freshly read snapshot equals the one it referenced.
 */
export const createAutoMovieProductionSourceStatus = (props: {
  /** Project handle every snapshot and gate run reads. */
  project: AutoMovieProductionProject;

  /** Builder whose read-only source gate answers the status. */
  builder: Parameters<typeof evaluateAutoMovieProductionSource>[0]["builder"];

  /** Fixed graph-derived authoring identity, used when no live reader exists. */
  authoringEvidence?: IAutoMovieProductionEvidence;

  /** Fresh graph reader a current compile would consult. */
  currentAuthoringEvidence?: () => IAutoMovieProductionEvidence;
}): (() => IAutoMovieBuildProjectOutput) =>
  retainAutoMovieProductionSourceStatus({
    acquire: (documents) =>
      acquireAutoMovieProductionSourceSnapshot({
        project: props.project,
        authoring:
          props.currentAuthoringEvidence?.() ?? props.authoringEvidence,
        documents,
        listFiles,
      }),
    evaluate: () =>
      evaluateAutoMovieProductionSource({
        project: props.project,
        builder: props.builder,
        moduleCache: createRequire(
          path.join(props.project.root, "package.json"),
        ).cache,
      }),
  });

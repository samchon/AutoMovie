import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import {
  AutoMovieContentDigest,
  IAutoMovieBuildProjectOutput,
} from "@automovie/interface";

import { AutoMovieProductionBuilder } from "./AutoMovieProductionBuilder";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";

/**
 * Fingerprint every current input to one terminal production publication.
 *
 * The builder pass binds source, design, declared content, generated ownership
 * and unowned-output diagnostics. The explicit state fields close the remaining
 * adapter boundary: cached manifest semantics, exact manifest and incarnation
 * bytes, and builder-owned bytes.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reapproval-after-change Recomputes the publication input fingerprint from the current inputs so a changed source or tool never inherits an earlier approval.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Reopens reviewed authoring bindings with the source builder before binding the terminal publication snapshot.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reapproval-after-change Makes terminal currentness depend on the newly compiled source and authoring identity after an input changes.
 */
export const productionPublicationInputFingerprint = (
  project: AutoMovieProductionProject,
  /** Supply the live reader whenever the generated compile used authoring evidence. */
  currentAuthoringEvidence?: () => IAutoMovieProductionEvidence,
): AutoMovieContentDigest => {
  const generated = project.generatedManifest();
  if (generated === null)
    throw new Error(
      "Terminal publication snapshot requires current builder-owned output.",
    );
  const projectState = project.projectStateRecords();
  const graph = project.graph();
  const snapshot = {
    protocol: "automovie.terminal-publication-snapshot.v1",
    revision: project.revision(),
    incarnationDigest: digestAutoMovieBytes(projectState.incarnation),
    manifest: {
      value: project.manifest(),
      digest: digestAutoMovieBytes(
        Buffer.from(JSON.stringify(project.manifest()), "utf8"),
      ),
    },
    design: {
      production: graph.production,
      world: graph.world,
      models: [...graph.models],
      formations: [...graph.formations],
      shots: [...graph.shots],
      acceptance: [...graph.acceptance],
    },
    generated: {
      manifest: generated,
      files: generated.files.map((file) => ({
        path: file.path,
        digest: digestAutoMovieBytes(project.readGeneratedFile(file.path)),
      })),
    },
  };
  return readProductionPublicationInputFingerprint({
    snapshot,
    currentAuthoringEvidence,
    compile: (authoring, current) =>
      new AutoMovieProductionBuilder(project, authoring, current).lint({
        scope: "source",
      }),
  });
};

/**
 * Bind terminal publication to a successful source check using live authoring.
 *
 * The injected compile boundary preserves the timed builder's optional reader
 * contract while allowing a host to reopen target reviews on every call.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reapproval-after-change Includes the fresh compile identity in the terminal snapshot and refuses failed source checks.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Recomputes source-owner freshness at the publication boundary rather than reusing an earlier reviewed flag.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-reapproval-after-change Refuses a failed current compile and includes a changed compile identity in the publication comparison.
 */
export const readProductionPublicationInputFingerprint = <Authoring>(props: {
  snapshot: Readonly<Record<string, unknown>>;
  currentAuthoringEvidence?: () => Authoring;
  compile: (
    authoring: Authoring | undefined,
    current: (() => Authoring) | undefined,
  ) => Pick<
    IAutoMovieBuildProjectOutput,
    "success" | "builder" | "diagnostics"
  >;
}): AutoMovieContentDigest => {
  const builder = props.compile(
    props.currentAuthoringEvidence?.(),
    props.currentAuthoringEvidence,
  );
  if (builder.success === false)
    throw new Error(
      `Terminal publication requires a successful current source compile: ${JSON.stringify(builder.diagnostics)}`,
    );
  return digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      ...props.snapshot,
      builder: {
        success: builder.success,
        inputFingerprint: builder.builder.inputFingerprint,
      },
    }),
  );
};

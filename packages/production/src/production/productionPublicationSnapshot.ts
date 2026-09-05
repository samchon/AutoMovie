import { AutoMovieContentDigest } from "@automovie/interface";

import { AutoMovieProductionCompiler } from "./AutoMovieProductionCompiler";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";

/**
 * Fingerprint every current input to one terminal production publication.
 *
 * The compiler pass binds source, design, declared content, generated ownership
 * and unowned-output diagnostics. The explicit state fields close the remaining
 * adapter boundary: cached manifest semantics, exact manifest and incarnation
 * bytes, and compiler-owned bytes.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reapproval-after-change Recomputes the publication input fingerprint from the current inputs so a changed source or tool never inherits an earlier approval.
 */
export const productionPublicationInputFingerprint = (
  project: AutoMovieProductionProject,
): AutoMovieContentDigest => {
  const generated = project.generatedManifest();
  if (generated === null)
    throw new Error(
      "Terminal publication snapshot requires current compiler-owned output.",
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
  const compiler = new AutoMovieProductionCompiler(project).lint({
    scope: "source",
  });
  return digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      ...snapshot,
      compiler: {
        success: compiler.success,
        inputFingerprint: compiler.compiler.inputFingerprint,
      },
    }),
  );
};

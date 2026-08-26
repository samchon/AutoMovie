import { AutoMovieContentDigest } from "@automovie/interface";

import { AutoMovieProductionCompiler } from "./AutoMovieProductionCompiler";
import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { AutoMovieProductionReviewService } from "./AutoMovieProductionReviewService";
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
 * bytes, compiler-owned bytes, and the live evidence-bound review queue.
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
  const reviews = new AutoMovieProductionReviewService(
    project,
    () => compiler,
  ).queue(compiler);
  return digestAutoMovieBytes(
    canonicalAutoMovieJsonBytes({
      ...snapshot,
      reviews: reviews.entries.map((entry) => ({
        ...entry,
        value: project.review(entry.target),
      })),
      compiler: {
        success: compiler.success,
        inputFingerprint: compiler.compiler.inputFingerprint,
      },
    }),
  );
};

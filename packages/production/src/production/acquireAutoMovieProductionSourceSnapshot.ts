import type { IAutoMovieProductionEvidence } from "@automovie/evidence";
import type { AutoMovieContentDigest } from "@automovie/interface";
import path from "node:path";

import type { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import type { IAutoMovieProductionSourceSnapshot } from "./IAutoMovieProductionSourceSnapshot";
import {
  canonicalAutoMovieJsonBytes,
  compareCodeUnits,
  digestAutoMovieBytes,
} from "./contentIdentity";
import { captureAutoMovieLibraryAuthoringSnapshot } from "./libraryAuthoringSnapshot";
import { libraryBuildInputFingerprint } from "./libraryBuildInputFingerprint";
import { normalizeSlash } from "./productionBuildDiagnostics";
import { currentAutoMovieProductionBuildInputFingerprintWithEvidence } from "./productionBuildIdentity";
import { readAutoMovieLibraryDerivedInputs } from "./readAutoMovieLibraryDerivedInputs";

/**
 * Read one fresh source snapshot without executing authored source.
 *
 * Nothing here runs a module. The input identity is recomputed from the bytes
 * the builder would hash: a timed production through the projection its own
 * publication guard compares, and a library through its resident authoring
 * snapshot, portable projection and derived closure, chosen by the same
 * declared kind the builder dispatches on. The screenplay index, the requested
 * documents and every entry under the builder-owned root are then read as they
 * stand, because a gate answer depends on them and no fingerprint field carries
 * them.
 *
 * The revision is read first and last. A write through the project between the
 * two leaves no consistent observation, so the answer is `null` rather than a
 * snapshot that mixes two states; so is an input identity that cannot be
 * derived completely. A read the project handle refuses, such as a replaced
 * root or namespace, is thrown with its own cause.
 *
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status Reads the revision, input identity, resident guard, screenplay index, documents and owned-output digests one gate answer depends on.
 * @evidence specifications/evidence-and-provenance/completeness-freshness-and-refusal.md#evp-dependency-based-freshness Produces the current freshness key a stored observation is compared against, and no key when the revision moves during the read.
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-source-result-link Reads the exact source revision and input bytes a retained gate answer traces back to.
 * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-derivation-state Supplies the current snapshot a derived gate answer must equal to stay current.
 */
export const acquireAutoMovieProductionSourceSnapshot = (props: {
  /** Project handle every read goes through. */
  project: AutoMovieProductionProject;

  /** Authoring evidence a current compile would be judged against. */
  authoring: IAutoMovieProductionEvidence | undefined;

  /** Author-owned documents to read, in any order and with repeats. */
  documents: readonly string[];

  /** Physical listing of one directory, the builder's own generated walk. */
  listFiles: (root: string) => string[];
}): IAutoMovieProductionSourceSnapshot | null => {
  const project = props.project;
  const revision = project.revision();
  let inputFingerprint: AutoMovieContentDigest | null;
  let resident: AutoMovieContentDigest | null = null;
  if (props.authoring?.manifest.kind === "library") {
    const snapshot = captureAutoMovieLibraryAuthoringSnapshot({
      root: project.root,
      evidence: props.authoring,
      readSource: (source) => project.readSource(source),
    });
    resident = snapshot.digest;
    inputFingerprint = libraryBuildInputFingerprint({
      production: project.productionId,
      snapshot,
      derivedFields: readAutoMovieLibraryDerivedInputs({
        project,
        enabled: true,
      }).fields,
    });
  } else
    inputFingerprint =
      currentAutoMovieProductionBuildInputFingerprintWithEvidence(
        project,
        "source",
        props.authoring,
      );
  if (inputFingerprint === null) return null;
  const screenplay = project.screenplayIndex();
  const documents = [...new Set(props.documents)]
    .sort(compareCodeUnits)
    .map((document) => {
      const text = project.readProseDocument(document);
      return {
        path: document,
        digest:
          text === null
            ? null
            : digestAutoMovieBytes(Buffer.from(text, "utf8")),
      };
    });
  const manifest = project.generatedManifest();
  const generatedRoot = project.generatedRoot();
  const files = props
    .listFiles(generatedRoot)
    .map((file) => normalizeSlash(path.relative(generatedRoot, file)))
    .sort(compareCodeUnits)
    .map((file) => {
      let digest: AutoMovieContentDigest | null;
      try {
        digest = digestAutoMovieBytes(project.readGeneratedFile(file));
      } catch {
        digest = null;
      }
      return { path: file, digest };
    });
  if (project.revision() !== revision) return null;
  return {
    revision,
    inputFingerprint,
    resident,
    screenplay:
      screenplay === null
        ? null
        : digestAutoMovieBytes(canonicalAutoMovieJsonBytes(screenplay)),
    documents,
    generated: {
      inputFingerprint: manifest?.inputFingerprint ?? null,
      manifest:
        manifest === null
          ? null
          : digestAutoMovieBytes(canonicalAutoMovieJsonBytes(manifest)),
      files,
    },
  };
};

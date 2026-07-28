import {
  AutoMovieContentDigest,
  IAutoMovieFilmTimeline,
  IAutoMovieGeneratedManifest,
} from "@automovie/interface";
import typia from "typia";

import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { digestAutoMovieBytes } from "./contentIdentity";

/** Inputs needed to validate one canonical generated film timeline. */
export interface IAutoMovieFilmTimelineArtifact {
  /** Current generated manifest. */
  manifest: IAutoMovieGeneratedManifest | null;
  /** Compile fingerprint the consumer already established as current. */
  fingerprint: AutoMovieContentDigest;
  /** Read one manifest-owned generated path from the same snapshot. */
  read(path: string): Uint8Array;
}

/** Validate manifest ownership, bytes, schema and compile identity together. */
export const parseAutoMovieFilmTimeline = (
  artifact: IAutoMovieFilmTimelineArtifact,
): IAutoMovieFilmTimeline => {
  const entry = artifact.manifest?.files.find(
    (file) => file.path === "film-timeline.json",
  );
  if (
    artifact.manifest?.inputFingerprint !== artifact.fingerprint ||
    entry === undefined
  )
    throw new Error(
      "Canonical film timeline is missing or changed after compilation. Run compileProject scope source.",
    );
  const bytes = artifact.read(entry.path);
  if (digestAutoMovieBytes(bytes) !== entry.digest)
    throw new Error(
      "Canonical film timeline bytes differ from the generated manifest. Run compileProject scope source.",
    );
  const validation = typia.validateEquals<IAutoMovieFilmTimeline>(
    JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown,
  );
  if (
    validation.success === false ||
    validation.data.inputFingerprint !== artifact.fingerprint
  )
    throw new Error(
      "Canonical film timeline is invalid or stale. Run compileProject scope source.",
    );
  return validation.data;
};

/** Read the canonical film timeline from one production project. */
export const readAutoMovieFilmTimeline = (
  project: AutoMovieProductionProject,
  fingerprint: AutoMovieContentDigest,
): IAutoMovieFilmTimeline =>
  parseAutoMovieFilmTimeline({
    manifest: project.generatedManifest(),
    fingerprint,
    read: (file) => project.readGeneratedFile(file),
  });

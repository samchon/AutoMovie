import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieFilmTimeline,
  IAutoMovieFilmTimelineSegment,
  IAutoMovieGeneratedManifest,
  IAutoMovieShotContract,
} from "@automovie/interface";
import typia from "typia";

import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { digestAutoMovieBytes } from "./contentIdentity";
import { parseAutoMovieStructuredJson } from "./duplicateAwareJson";
import { verifyProductionFilmEffectPopulation } from "./filmEffectRuntime";

/**
 * Inputs needed to validate one canonical generated film timeline.
 */
export interface IAutoMovieFilmTimelineArtifact {
  /**
   * Current generated manifest.
   */
  manifest: IAutoMovieGeneratedManifest | null;
  /**
   * Compile fingerprint the consumer already established as current.
   */
  fingerprint: AutoMovieContentDigest;
  /**
   * Read one manifest-owned generated path from the same snapshot.
   */
  read(path: string): Uint8Array;
}

/**
 * One shot-local frame the finished film requires as visual evidence.
 */
export interface IAutoMovieFilmReviewFrame {
  /**
   * Authored review id or deterministic segment fallback id.
   */
  id: string;
  /**
   * Shot-local frame-grid time.
   */
  time: number;
  /**
   * Shot-local frame index.
   */
  index: number;
  /**
   * Required render passes.
   */
  passes: AutoMovieGuidePass[];
}

/**
 * Select only review frames present in one edit segment.
 *
 * A segment whose trim excludes every authored frame receives one deterministic
 * beauty fallback at source-in, so render and film review cannot deadlock.
 */
export const selectAutoMovieFilmReviewFrames = (
  segment: IAutoMovieFilmTimelineSegment,
  shot: IAutoMovieShotContract,
  fps: number,
): IAutoMovieFilmReviewFrame[] => {
  const selected = shot.reviewFrames.flatMap((frame) => {
    const index = Math.round(frame.time * fps);
    return index < segment.sourceInFrame || index >= segment.sourceOutFrame
      ? []
      : [{ ...frame, index }];
  });
  return selected.length !== 0
    ? selected
    : [
        {
          id: "film-segment-entry",
          time: segment.sourceInFrame / fps,
          index: segment.sourceInFrame,
          passes: ["beauty"],
        },
      ];
};

/**
 * Validate manifest ownership, bytes, schema and compile identity together.
 */
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
      "Canonical film timeline is missing or changed after compilation. Run the scaffold source compile command.",
    );
  const bytes = artifact.read(entry.path);
  if (digestAutoMovieBytes(bytes) !== entry.digest)
    throw new Error(
      "Canonical film timeline bytes differ from the generated manifest. Run the scaffold source compile command.",
    );
  const validation = typia.validateEquals<IAutoMovieFilmTimeline>(
    parseAutoMovieStructuredJson({ record: "film-timeline", bytes }),
  );
  if (
    validation.success === false ||
    validation.data.inputFingerprint !== artifact.fingerprint
  )
    throw new Error(
      "Canonical film timeline is invalid or stale. Run the scaffold source compile command.",
    );
  return validation.data;
};

/**
 * Read the canonical film timeline from one production project.
 */
export const readAutoMovieFilmTimeline = (
  project: AutoMovieProductionProject,
  fingerprint: AutoMovieContentDigest,
): IAutoMovieFilmTimeline =>
  parseAutoMovieFilmTimeline({
    manifest: project.generatedManifest(),
    fingerprint,
    read: (file) => project.readGeneratedFile(file),
  });

/**
 * Read and validate the current compiler-owned film effect runtime artifact.
 *
 * The timeline and the effects are read from one manifest snapshot, so the
 * population check below compares the runtime against the edit it was
 * compiled with rather than against whichever timeline a caller holds.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Reopens executable film effects through the same generated-manifest ownership gate as the timeline.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Refuses missing, changed, malformed, or stale film-owner state at the consumer boundary.
 */
export const readAutoMovieFilmEffects = (
  project: AutoMovieProductionProject,
  fingerprint: AutoMovieContentDigest,
): IAutoMovieCompiledFilmEffect[] => {
  const artifact: IAutoMovieFilmTimelineArtifact = {
    manifest: project.generatedManifest(),
    fingerprint,
    read: (file) => project.readGeneratedFile(file),
  };
  return parseAutoMovieFilmEffects(
    artifact,
    parseAutoMovieFilmTimeline(artifact),
  );
};

/**
 * Validate manifest ownership, bytes, schema, compile identity, and the exact
 * timeline population together.
 *
 * A per-entry identity check cannot notice an entry that is missing, so the
 * parsed array is also proved to be the one-to-one projection of the given
 * timeline's effect track before any consumer samples it.
 *
 * @evidence requirements/effects-and-simulation/scope-and-simulation-tiers.md#effects-authoring-control Refuses a persisted runtime that would drop or alter an accepted film cue.
 * @evidence specifications/simulation-effects-and-sound/scope-tiers-and-identities.md#effect-tier-state-machine Admits only a runtime population that matches the current cue set one to one.
 */
export const parseAutoMovieFilmEffects = (
  artifact: IAutoMovieFilmTimelineArtifact,
  timeline: IAutoMovieFilmTimeline,
): IAutoMovieCompiledFilmEffect[] => {
  const entry = artifact.manifest?.files.find(
    (file) => file.path === "film-effects.json",
  );
  if (
    artifact.manifest?.inputFingerprint !== artifact.fingerprint ||
    entry === undefined
  )
    throw new Error(
      "Compiler-owned film effects are missing or changed after compilation. Run the scaffold source compile command.",
    );
  const bytes = artifact.read(entry.path);
  if (digestAutoMovieBytes(bytes) !== entry.digest)
    throw new Error(
      "Compiler-owned film effect bytes differ from the generated manifest. Run the scaffold source compile command.",
    );
  const validation = typia.validateEquals<IAutoMovieCompiledFilmEffect[]>(
    parseAutoMovieStructuredJson({ record: "film-effects", bytes }),
  );
  if (
    validation.success === false ||
    validation.data.some(
      (effect) => effect.compileFingerprint !== artifact.fingerprint,
    )
  )
    throw new Error(
      "Compiler-owned film effects are invalid or stale. Run the scaffold source compile command.",
    );
  verifyProductionFilmEffectPopulation({
    timeline,
    effects: validation.data,
  });
  return validation.data;
};

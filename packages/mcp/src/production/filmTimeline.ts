import {
  AutoMovieContentDigest,
  AutoMovieGuidePass,
  IAutoMovieFilmTimeline,
  IAutoMovieFilmTimelineSegment,
  IAutoMovieGeneratedManifest,
  IAutoMovieShotContract,
} from "@automovie/interface";
import typia from "typia";

import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { digestAutoMovieBytes } from "./contentIdentity";

/**
 * Inputs needed to validate one canonical generated film timeline.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives ordinary production code the typed snapshot inputs needed to validate its generated film timeline.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps timeline validation on deterministic manifest bytes rather than MCP session artifacts.
 */
export interface IAutoMovieFilmTimelineArtifact {
  /**
   * Current generated manifest.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets typed consumers provide the generated manifest that owns the film artifact paths.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Grounds timeline ownership in deterministic compiler output instead of MCP-maintained metadata.
   */
  manifest: IAutoMovieGeneratedManifest | null;
  /**
   * Compile fingerprint the consumer already established as current.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Carries the caller's established compile fingerprint through the typed timeline check.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Verifies deterministic compile identity directly, without relying on an MCP conversation's notion of currentness.
   */
  fingerprint: AutoMovieContentDigest;
  /**
   * Read one manifest-owned generated path from the same snapshot.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows ordinary host code to supply bytes from the same manifest-owned production snapshot.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Reads canonical artifact bytes through a deterministic callback rather than giving MCP arbitrary file access.
   */
  read(path: string): Uint8Array;
}

/**
 * One shot-local frame the finished film requires as visual evidence.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Defines a typed shot-local review-frame record that production code can author and inspect.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Carries deterministic review scheduling as film data, not as MCP-selected frame state.
 */
export interface IAutoMovieFilmReviewFrame {
  /**
   * Authored review id or deterministic segment fallback id.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Exposes the authored review identity or generated fallback identity to typed film consumers.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Fixes review-frame identity in deterministic timeline selection rather than assigning it through MCP.
   */
  id: string;
  /**
   * Shot-local frame-grid time.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Makes each selected frame's shot-local time available to ordinary typed render planning.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Derives review timing on the deterministic shot grid outside the MCP tool surface.
   */
  time: number;
  /**
   * Shot-local frame index.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Provides ordinary render code with the exact shot-local frame index to capture.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Records the grid index deterministically instead of letting MCP translate time independently.
   */
  index: number;
  /**
   * Required render passes.
   *
   * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets typed film planning declare the exact guide and beauty passes required at a review frame.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Seals pass selection in deterministic timeline data before any MCP capture request.
   */
  passes: AutoMovieGuidePass[];
}

/**
 * Select only review frames present in one edit segment.
 *
 * A segment whose trim excludes every authored frame receives one deterministic
 * beauty fallback at source-in, so render and film review cannot deadlock.
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Lets ordinary editorial code select authored review frames within a typed edit segment.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Applies trims and the empty-segment fallback deterministically before MCP serves review evidence.
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
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Gives typed production consumers one validator for manifest ownership, bytes, schema, and compile identity.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Parses only deterministically owned timeline artifacts instead of trusting MCP-supplied film state.
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
    JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown,
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
 *
 * @evidence requirements/agent-authoring/source-owned-loop.md#agent-ordinary-code-authoring Allows ordinary project code to read its canonical typed film timeline from a production snapshot.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Composes owned-file access and deterministic parsing behind the package API, outside MCP authoring tools.
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

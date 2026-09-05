import type {
  IAutoMovieCaptionGraphemeSegmentationIdentity,
  IAutoMovieCaptionReadabilityBoundary,
  IAutoMovieCaptionReadabilityMeasurement,
  IAutoMovieCaptionReadabilityOutcome,
  IAutoMovieCaptionReadabilityProfile,
  IAutoMovieCaptionReadabilityReport,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";

import { autoMovieCaptionLanguageComparisonKey } from "./captionLanguage";
import { canonicalizeAutoMovieCaptionText } from "./captionText";

/** Runtime-owned grapheme segmentation behavior and its complete identity. */
interface IAutoMovieCaptionGraphemeRuntime {
  /** Complete identity of the exact segmentation behavior below. */
  identity: IAutoMovieCaptionGraphemeSegmentationIdentity;
  /** Segment one canonical caption line into grapheme clusters. */
  segment(value: string): Iterable<unknown>;
}

/**
 * Measure caption readability through one injected, identity-bearing runtime.
 *
 * This package-private seam keeps runtime mismatch cases deterministic without
 * replacing the host's global `Intl` implementation in tests.
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-reading-overlap Measures reading rate, line count, line length, duration and same-language gap per cue against the declared profile boundaries.
 * @evidence requirements/delivery-and-accessibility/captions-subtitles-and-cues.md#delivery-caption-readability-profile Computes a verdict only when the profile's complete segmentation identity equals the runtime that measured the cue, and reports measure-only `not-run` otherwise.
 * @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-unsupported-and-not-run Reports `not-run` with its reason when no profile or an unsupported identity prevents a verdict, and never counts that as pass.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-profile Applies the language profile's complete identity, boundaries and canonical cue text exactly as this contract states them.
 * @evidence specifications/editorial-render-and-delivery/delivery-audio-text-and-localization.md#spec-delivery-caption-readability-measurement Implements the measure-always, verdict-only-on-exact-identity evaluator with the case-insensitive same-language gap lookup.
 */
export const inspectAutoMovieCaptionReadabilityWithRuntime = (
  timeline: IAutoMovieFilmTimeline,
  profiles: readonly IAutoMovieCaptionReadabilityProfile[],
  runtime: IAutoMovieCaptionGraphemeRuntime,
): IAutoMovieCaptionReadabilityReport => {
  const profilesByLanguage = new Map<
    string,
    IAutoMovieCaptionReadabilityProfile
  >();
  for (const profile of profiles) {
    const languageIdentity = autoMovieCaptionLanguageComparisonKey(
      profile.language,
    );
    if (languageIdentity !== null)
      profilesByLanguage.set(languageIdentity, profile);
  }
  const precedingEndByLanguage = new Map<string, number>();
  return {
    version: 2,
    cues: timeline.tracks.captions.map((cue) => {
      const canonicalText = canonicalizeAutoMovieCaptionText(cue.text);
      const lines = canonicalText.split("\n");
      const graphemesByLine = lines.map(
        (line) => [...runtime.segment(line)].length,
      );
      const graphemes = graphemesByLine.reduce(
        (total, count) => total + count,
        0,
      );
      const durationFrames = cue.endFrame - cue.startFrame;
      const languageIdentity = autoMovieCaptionLanguageComparisonKey(
        cue.language,
      );
      const precedingEnd =
        languageIdentity === null
          ? undefined
          : precedingEndByLanguage.get(languageIdentity);
      if (languageIdentity !== null)
        precedingEndByLanguage.set(languageIdentity, cue.endFrame);
      const measurement: IAutoMovieCaptionReadabilityMeasurement = {
        cue: cue.id,
        language: cue.language,
        segmentation: runtime.identity,
        graphemes,
        lines: lines.length,
        maxLineGraphemes: Math.max(...graphemesByLine),
        durationFrames,
        gapBeforeFrames:
          precedingEnd === undefined ? null : cue.startFrame - precedingEnd,
        graphemesPerSecond: (graphemes * timeline.fps) / durationFrames,
      };
      return {
        measurement,
        outcome: captionReadabilityOutcome(
          measurement,
          languageIdentity === null
            ? undefined
            : profilesByLanguage.get(languageIdentity),
          runtime.identity,
        ),
      };
    }),
  };
};

const captionReadabilityOutcome = (
  measurement: IAutoMovieCaptionReadabilityMeasurement,
  profile: IAutoMovieCaptionReadabilityProfile | undefined,
  actualSegmentation: IAutoMovieCaptionGraphemeSegmentationIdentity,
): IAutoMovieCaptionReadabilityOutcome => {
  if (profile === undefined)
    return {
      status: "not-run",
      segmentation: null,
      reason: "caption-readability-profile-not-declared",
    };
  if (
    sameCaptionGraphemeSegmentationIdentity(
      profile.segmentation,
      actualSegmentation,
    ) === false
  )
    return {
      status: "not-run",
      segmentation: profile.segmentation,
      reason: "caption-grapheme-segmentation-unsupported",
    };
  const breaches: Extract<
    IAutoMovieCaptionReadabilityOutcome,
    { status: "evaluated" }
  >["breaches"] = [];
  if (
    maximumBoundaryPassed(
      measurement.graphemesPerSecond,
      profile.maxGraphemesPerSecond,
    ) === false
  )
    breaches.push("graphemes-per-second");
  if (
    maximumBoundaryPassed(measurement.lines, profile.maxLinesPerCue) === false
  )
    breaches.push("lines-per-cue");
  if (
    maximumBoundaryPassed(
      measurement.maxLineGraphemes,
      profile.maxGraphemesPerLine,
    ) === false
  )
    breaches.push("graphemes-per-line");
  if (
    minimumBoundaryPassed(
      measurement.durationFrames,
      profile.minDurationFrames,
    ) === false
  )
    breaches.push("duration-frames");
  if (
    measurement.gapBeforeFrames !== null &&
    minimumBoundaryPassed(measurement.gapBeforeFrames, profile.minGapFrames) ===
      false
  )
    breaches.push("gap-frames");
  return {
    status: "evaluated",
    profile: profile.id,
    segmentation: profile.segmentation,
    passed: breaches.length === 0,
    breaches,
  };
};

const sameCaptionGraphemeSegmentationIdentity = (
  left: IAutoMovieCaptionGraphemeSegmentationIdentity,
  right: IAutoMovieCaptionGraphemeSegmentationIdentity,
): boolean =>
  left.algorithm === right.algorithm &&
  left.version === right.version &&
  left.granularity === right.granularity &&
  left.locale.kind === right.locale.kind &&
  (left.locale.kind === "locale-neutral" ||
    (right.locale.kind === "requested-resolved" &&
      left.locale.requested === right.locale.requested &&
      left.locale.resolved === right.locale.resolved));

const maximumBoundaryPassed = (
  value: number,
  boundary: IAutoMovieCaptionReadabilityBoundary,
): boolean =>
  boundary.inclusive ? value <= boundary.value : value < boundary.value;

const minimumBoundaryPassed = (
  value: number,
  boundary: IAutoMovieCaptionReadabilityBoundary,
): boolean =>
  boundary.inclusive ? value >= boundary.value : value > boundary.value;

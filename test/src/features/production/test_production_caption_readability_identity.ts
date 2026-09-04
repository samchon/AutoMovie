import type {
  IAutoMovieCaptionGraphemeSegmentationIdentity,
  IAutoMovieCaptionReadabilityProfile,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import {
  AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION,
  inspectAutoMovieCaptionReadability,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";

const readability = loadSourceModule<{
  inspectAutoMovieCaptionReadabilityWithRuntime: (
    timeline: IAutoMovieFilmTimeline,
    profiles: readonly IAutoMovieCaptionReadabilityProfile[],
    runtime: {
      identity: IAutoMovieCaptionGraphemeSegmentationIdentity;
      segment(value: string): Iterable<unknown>;
    },
  ) => ReturnType<typeof inspectAutoMovieCaptionReadability>;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/captionReadability.ts",
  ),
);

const identity: IAutoMovieCaptionGraphemeSegmentationIdentity = {
  algorithm: "fixture-segmenter",
  version: "1",
  granularity: "grapheme",
  locale: {
    kind: "requested-resolved",
    requested: "en",
    resolved: "en-US",
  },
};

const timeline = (
  captions: IAutoMovieFilmTimeline["tracks"]["captions"],
): IAutoMovieFilmTimeline => ({
  version: 1,
  compiler: "caption-identity-fixture",
  inputFingerprint: "sha256:caption-identity",
  sourceDigest: "sha256:caption-source",
  id: "caption-identity",
  fps: 4,
  totalFrames: 20,
  segments: [],
  omissions: [],
  tracks: { audio: [], effects: [], captions },
});

const profile = (
  segmentation: IAutoMovieCaptionGraphemeSegmentationIdentity,
  inclusive: boolean,
): IAutoMovieCaptionReadabilityProfile => ({
  id: "english-readability",
  version: 1,
  language: "en-US",
  segmentation,
  maxGraphemesPerSecond: { value: 5, inclusive },
  maxLinesPerCue: { value: 2, inclusive },
  maxGraphemesPerLine: { value: 4, inclusive },
  minDurationFrames: { value: 4, inclusive },
  minGapFrames: { value: 1, inclusive },
});

const runtime = (
  segmentation: IAutoMovieCaptionGraphemeSegmentationIdentity,
) => ({
  identity: segmentation,
  segment: (value: string): Iterable<unknown> => Array.from(value),
});

/**
 * A readability verdict identifies the exact grapheme runtime that earned it.
 *
 * Scenarios:
 *
 * 1. The public `Intl.Segmenter` adapter reports requested and resolved locale,
 *    granularity, and revision from the same instance that measures the cue.
 * 2. Profile language and segmenter locale remain separate roles, so a Thai
 *    profile may deliberately select the installed fixed-English identity.
 * 3. Missing profiles retain actual identity and measurements with `not-run`.
 * 4. Case-equivalent cue languages share profile and preceding-gap identity.
 * 5. Inclusive equality passes and exclusive equality reports all five breach
 *    kinds without changing the measurements.
 * 6. Algorithm, revision, granularity, requested locale, resolved locale, and
 *    locale-mode mismatches remain unsupported without runtime fallback.
 * 7. Exact requested-to-resolved and exact locale-neutral identities evaluate,
 *    while the old two-field identity never becomes a version-2 verdict.
 */
export const test_production_caption_readability_identity = (): void => {
  const publicTimeline = timeline([
    {
      id: "unicode",
      text: "e\u0301\ud83d\udc69\u200d\ud83d\ude80\r\n",
      language: "th",
      startFrame: 0,
      endFrame: 4,
    },
  ]);
  const measured = inspectAutoMovieCaptionReadability(publicTimeline, []);
  TestValidator.equals(
    "the public wrapper reports its complete actual runtime identity",
    {
      version: measured.version,
      measurement: measured.cues[0]!.measurement,
      outcome: measured.cues[0]!.outcome,
      requested: AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION.locale.requested,
      resolvedNonBlank:
        AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION.locale.resolved.length > 0,
    },
    {
      version: 2,
      measurement: {
        cue: "unicode",
        language: "th",
        segmentation: AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION,
        graphemes: 2,
        lines: 2,
        maxLineGraphemes: 2,
        durationFrames: 4,
        gapBeforeFrames: null,
        graphemesPerSecond: 2,
      },
      outcome: {
        status: "not-run",
        segmentation: null,
        reason: "caption-readability-profile-not-declared",
      },
      requested: "en",
      resolvedNonBlank: true,
    },
  );

  const thaiProfile = profile(AUTOMOVIE_CAPTION_GRAPHEME_SEGMENTATION, true);
  thaiProfile.id = "thai-readability";
  thaiProfile.language = "th";
  TestValidator.equals(
    "threshold language does not replace the selected segmentation locale",
    inspectAutoMovieCaptionReadability(publicTimeline, [thaiProfile]).cues[0]!
      .outcome.status,
    "evaluated",
  );

  const cues: IAutoMovieFilmTimeline["tracks"]["captions"] = [
    {
      id: "first",
      text: "abcd\r\nx",
      language: "EN-us",
      startFrame: 0,
      endFrame: 4,
    },
    {
      id: "second",
      text: "abcd\nx",
      language: "en-US",
      startFrame: 5,
      endFrame: 9,
    },
  ];
  const inclusive = readability.inspectAutoMovieCaptionReadabilityWithRuntime(
    timeline(cues),
    [profile(identity, true)],
    runtime(identity),
  );
  TestValidator.equals(
    "case-equivalent languages share profiles and same-language gap state",
    inclusive.cues.map((cue) => ({
      gap: cue.measurement.gapBeforeFrames,
      status: cue.outcome.status,
      passed: cue.outcome.status === "evaluated" ? cue.outcome.passed : null,
    })),
    [
      { gap: null, status: "evaluated", passed: true },
      { gap: 1, status: "evaluated", passed: true },
    ],
  );

  const malformedLanguage =
    readability.inspectAutoMovieCaptionReadabilityWithRuntime(
      timeline(
        cues.map((cue, index) => ({
          ...cue,
          id: `malformed-${index}`,
          language: "en-12",
        })),
      ),
      [{ ...profile(identity, true), language: "en-12" }],
      runtime(identity),
    );
  TestValidator.equals(
    "malformed languages never become a profile or gap identity",
    malformedLanguage.cues.map((cue) => ({
      gap: cue.measurement.gapBeforeFrames,
      outcome: cue.outcome,
    })),
    [
      {
        gap: null,
        outcome: {
          status: "not-run",
          segmentation: null,
          reason: "caption-readability-profile-not-declared",
        },
      },
      {
        gap: null,
        outcome: {
          status: "not-run",
          segmentation: null,
          reason: "caption-readability-profile-not-declared",
        },
      },
    ],
  );

  const exclusive = readability.inspectAutoMovieCaptionReadabilityWithRuntime(
    timeline(cues),
    [profile(identity, false)],
    runtime(identity),
  );
  TestValidator.equals(
    "exclusive equality reports every applicable boundary breach",
    exclusive.cues[1]!.outcome,
    {
      status: "evaluated",
      profile: "english-readability",
      segmentation: identity,
      passed: false,
      breaches: [
        "graphemes-per-second",
        "lines-per-cue",
        "graphemes-per-line",
        "duration-frames",
        "gap-frames",
      ],
    },
  );

  const mismatches: IAutoMovieCaptionGraphemeSegmentationIdentity[] = [
    { ...identity, algorithm: "other" },
    { ...identity, version: "2" },
    { ...identity, granularity: "word" as "grapheme" },
    {
      ...identity,
      locale: {
        kind: "requested-resolved",
        requested: "fr",
        resolved: "en-US",
      },
    },
    {
      ...identity,
      locale: {
        kind: "requested-resolved",
        requested: "en",
        resolved: "en-GB",
      },
    },
    { ...identity, locale: { kind: "locale-neutral" } },
  ];
  TestValidator.equals(
    "every complete identity mismatch is unsupported without fallback",
    mismatches.map(
      (requested) =>
        readability.inspectAutoMovieCaptionReadabilityWithRuntime(
          timeline(cues.slice(0, 1)),
          [profile(requested, true)],
          runtime(identity),
        ).cues[0]!.outcome,
    ),
    mismatches.map((requested) => ({
      status: "not-run" as const,
      segmentation: requested,
      reason: "caption-grapheme-segmentation-unsupported" as const,
    })),
  );

  const neutralIdentity: IAutoMovieCaptionGraphemeSegmentationIdentity = {
    algorithm: "neutral-fixture",
    version: "1",
    granularity: "grapheme",
    locale: { kind: "locale-neutral" },
  };
  const neutralOutcome =
    readability.inspectAutoMovieCaptionReadabilityWithRuntime(
      timeline(cues.slice(0, 1)),
      [profile(neutralIdentity, true)],
      runtime(neutralIdentity),
    ).cues[0]!.outcome;
  TestValidator.equals(
    "an exact locale-neutral runtime evaluates as its own identity",
    neutralOutcome.status,
    "evaluated",
  );

  const oldProfile = {
    ...profile(identity, true),
    segmentation: { algorithm: identity.algorithm, version: identity.version },
  } as unknown as IAutoMovieCaptionReadabilityProfile;
  TestValidator.equals(
    "a version-1 two-field identity is not reinterpreted as complete",
    readability.inspectAutoMovieCaptionReadabilityWithRuntime(
      timeline(cues.slice(0, 1)),
      [oldProfile],
      runtime(identity),
    ).cues[0]!.outcome,
    {
      status: "not-run",
      segmentation: oldProfile.segmentation,
      reason: "caption-grapheme-segmentation-unsupported",
    },
  );
};

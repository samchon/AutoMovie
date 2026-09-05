import {
  AutoMovieContentDigest,
  IAutoMovieCompiledFilmEffect,
  IAutoMovieFilmTimeline,
  IAutoMovieProductionDesign,
} from "@automovie/interface";
import {
  type IAutoMovieProductionAudioAssetIdentity,
  IAutoMovieProductionRenderJobPlan,
  IAutoMovieProductionRenderTier,
  planProductionRenderJob,
  resolveProductionRenderTierFrameFormat,
  verifyProductionRenderJobPlan,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, nclose, throwsError } from "../internal/predicates";
import {
  productionDesign,
  testCaptureRuntimeIdentity,
} from "./productionFixtures";

const digest = (fill: string): AutoMovieContentDigest =>
  `sha256:${fill.repeat(64).slice(0, 64)}`;

const RUNTIME_IDENTITY = {
  protocolVersion: "automovie.production-render-runtime.v3",
  dialogueRuntimeIdentity: null,
  sourceDigest: digest("a"),
  capture: testCaptureRuntimeIdentity(),
  encoder: {
    package: "h264-mp4-encoder",
    version: "1.0.12",
    closureDigest: digest("b"),
    codec: "h264",
    arguments: {
      quantizationParameter: 26,
      speed: 10,
      groupOfPictures: 24,
    },
  },
} as const;

const WAVE_AUDIO_ASSET = {
  path: "assets/audio/tone.wav",
  digest: digest("c"),
  durationSeconds: 0.5,
  sourceFrames: 24_000,
  sampleRate: 48_000,
  channels: 2,
  kind: "wave",
  sourceFormat: {
    kind: "wave",
    header: "wave-format-extensible",
    encoding: "pcm-s16le",
    containerBits: 16,
    validBits: 16,
    sampleRate: 48_000,
    channels: 2,
    layout: {
      kind: "stereo",
      speakers: ["front-left", "front-right"],
      source: "channel-mask",
      mask: 0x3,
    },
    subFormatGuid: "00000001-0000-0010-8000-00aa00389b71",
  },
  processing: {
    kind: "downmix",
    outputChannels: 1,
    outputSampleRate: 48_000,
    matrix: [[0.5, 0.5]],
  },
} as const satisfies IAutoMovieProductionAudioAssetIdentity;

const RESAMPLED_WAVE_AUDIO_ASSET = {
  ...WAVE_AUDIO_ASSET,
  sourceFrames: 12_000,
  sampleRate: 24_000,
  sourceFormat: {
    ...WAVE_AUDIO_ASSET.sourceFormat,
    sampleRate: 24_000,
  },
  processing: {
    ...WAVE_AUDIO_ASSET.processing,
    kind: "downmix-resample",
    outputSampleRate: 48_000,
  },
} as const satisfies IAutoMovieProductionAudioAssetIdentity;

const MONO_WAVE_AUDIO_ASSET = {
  ...WAVE_AUDIO_ASSET,
  channels: 1,
  sourceFormat: {
    ...WAVE_AUDIO_ASSET.sourceFormat,
    channels: 1,
    layout: {
      kind: "mono",
      speakers: ["front-center"],
      source: "channel-mask",
      mask: 0x4,
    },
  },
  processing: {
    kind: "copy",
    outputChannels: 1,
    outputSampleRate: 48_000,
    matrix: [[1]],
  },
} as const satisfies IAutoMovieProductionAudioAssetIdentity;

const MONO_FLOAT_WAVE_AUDIO_ASSET = {
  ...MONO_WAVE_AUDIO_ASSET,
  sourceFrames: 12_000,
  sampleRate: 24_000,
  sourceFormat: {
    ...MONO_WAVE_AUDIO_ASSET.sourceFormat,
    sampleRate: 24_000,
    encoding: "float-f32le",
    containerBits: 32,
    validBits: 32,
    subFormatGuid: "00000003-0000-0010-8000-00aa00389b71",
  },
  processing: {
    ...MONO_WAVE_AUDIO_ASSET.processing,
    kind: "resample",
  },
} as const satisfies IAutoMovieProductionAudioAssetIdentity;

const LEGACY_WAVE_AUDIO_ASSET = {
  ...WAVE_AUDIO_ASSET,
  sourceFormat: {
    ...WAVE_AUDIO_ASSET.sourceFormat,
    header: "wave-format-ex",
    layout: {
      kind: "stereo",
      speakers: ["front-left", "front-right"],
      source: "legacy-default",
      mask: null,
    },
    subFormatGuid: null,
  },
} as const satisfies IAutoMovieProductionAudioAssetIdentity;

const AUDIO_ASSET = {
  kind: "placeholder-audio-stem",
  path: "assets/audio/tone.wav",
  digest: digest("c"),
  durationSeconds: 0.5,
  sourceFrames: 24_000,
  sampleRate: 48_000,
  channels: 2,
} as const;

const LONG_AUDIO_ASSET = {
  ...AUDIO_ASSET,
  durationSeconds: 1,
  sourceFrames: 48_000,
} as const;

/**
 * Production design fixed to the hand-derivable clock this case computes from.
 *
 * A 24 fps, half-second production is exactly twelve frames, and 32x18 halves
 * to the even 16x8 raster the H.264 adapter demands, so every expected number
 * below stays a division rather than a reading of what the planner emitted.
 */
const PRODUCTION = (): IAutoMovieProductionDesign =>
  productionDesign({
    targetRuntimeSeconds: 0.5,
    frameFormat: { width: 32, height: 18, fps: 24, colorSpace: "srgb" },
    deliverables: [
      { id: "feature", kind: "feature", required: true },
      { id: "depth-guide", kind: "guide-pass", pass: "depth", required: true },
      { id: "preview", kind: "preview", required: false },
      { id: "captions", kind: "captions", required: false },
    ],
  });

/**
 * Two cut segments over the twelve-frame edit, plus one caption and one cue.
 *
 * Two shots rather than one is what makes a chunk boundary meaningful: the
 * middle chunk spans the cut, so a planner that resolved sources per chunk
 * instead of per frame would name only one of them.
 */
const TIMELINE = (
  overrides: Partial<IAutoMovieFilmTimeline> = {},
): IAutoMovieFilmTimeline => ({
  version: 1,
  compiler: "automovie.production-compiler.test",
  inputFingerprint: digest("d"),
  sourceDigest: digest("e"),
  id: "fixture-film",
  fps: 24,
  totalFrames: 12,
  segments: [
    {
      shot: "opening",
      sourceInFrame: 0,
      sourceOutFrame: 6,
      startFrame: 0,
      endFrame: 6,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
    {
      shot: "answer",
      sourceInFrame: 4,
      sourceOutFrame: 10,
      startFrame: 6,
      endFrame: 12,
      headHandleFrames: 0,
      tailHandleFrames: 0,
      transitionIn: { kind: "cut" },
      transitionOut: { kind: "cut" },
    },
  ],
  omissions: [],
  tracks: {
    audio: [
      {
        id: "tone",
        asset: AUDIO_ASSET.path,
        sourceDurationFrames: 12,
        sourceOffsetFrame: 0,
        startFrame: 0,
        durationFrames: 12,
        gain: 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        bus: "music",
      },
    ],
    captions: [
      {
        id: "cue-1",
        text: "Signal.",
        language: "en",
        startFrame: 0,
        endFrame: 12,
      },
    ],
    effects: [],
  },
  ...overrides,
});

const SOURCE_FINGERPRINTS: Readonly<Record<string, AutoMovieContentDigest>> = {
  opening: digest("1"),
  answer: digest("2"),
};

const plan = (props: {
  tier?: IAutoMovieProductionRenderTier;
  chunkFrames?: number;
  timeline?: IAutoMovieFilmTimeline;
  effects?: readonly IAutoMovieCompiledFilmEffect[];
  production?: IAutoMovieProductionDesign;
  audioAssets?: readonly IAutoMovieProductionAudioAssetIdentity[];
  guidePasses?: readonly ["pose" | "depth", ...("pose" | "depth")[]];
  sourceFingerprints?: Readonly<Record<string, AutoMovieContentDigest>>;
  runtimeIdentity?: IAutoMovieProductionRenderJobPlan["runtimeIdentity"];
}): IAutoMovieProductionRenderJobPlan =>
  planProductionRenderJob({
    timeline: props.timeline ?? TIMELINE(),
    effects: props.effects ?? [],
    production: props.production ?? PRODUCTION(),
    runtimeIdentity: props.runtimeIdentity ?? RUNTIME_IDENTITY,
    sourceFingerprints: props.sourceFingerprints ?? SOURCE_FINGERPRINTS,
    audioAssets: props.audioAssets ?? [AUDIO_ASSET],
    chunkFrames: props.chunkFrames ?? 5,
    guidePasses: props.guidePasses,
    tier: props.tier,
  });

const audioTimeline = (
  cue: Partial<IAutoMovieFilmTimeline["tracks"]["audio"][number]>,
): IAutoMovieFilmTimeline => {
  const timeline = TIMELINE();
  timeline.tracks.audio[0] = { ...timeline.tracks.audio[0]!, ...cue };
  return timeline;
};

const chunkShape = (
  built: IAutoMovieProductionRenderJobPlan,
): Array<{ slot: string; frameStart: number; frameEndExclusive: number }> =>
  built.chunks.map((chunk) => ({
    slot: chunk.slot,
    frameStart: chunk.frameStart,
    frameEndExclusive: chunk.frameEndExclusive,
  }));

/**
 * The render job plan is derived from the compiled edit, not from a clock the
 * planner keeps for itself.
 *
 * `planProductionRenderJob` had no test that called it at all, which is how
 * #1913's clock defect reached master through a source reading rather than a
 * failing run. Everything a worker needs -- which frame of which shot, at what
 * film second, in which resumable range, under which content identity -- comes
 * out of this one pure function, so a wrong division here is silently rendered
 * into every delivered byte.
 *
 * The expected numbers are divisions of the declared 24 fps, 0.5 s, 32x18
 * contract, never a reading of what the planner currently emits.
 *
 * Scenarios:
 *
 * 1. The final tier passes the authored raster and clock through unchanged,
 *    covers all twelve frames, and cuts them into 5/5/2 ranges for each of the
 *    two moving-image deliverables; the preview and captions deliverables carry
 *    no chunk at all, so a video parser can never be handed a caption range.
 * 2. Every final frame resolves to its own segment's source frame at weight 1,
 *    including the frame after the cut, and the chunk that spans the cut names
 *    both shots while the outer chunks name one each.
 * 3. The proxy tier halves the raster to the even 16x8 the H.264 adapter
 *    requires, halves the frame clock to 12 fps, keeps six of twelve frames,
 *    and -- this is #1913 -- gives each kept frame the film second of the
 *    full-rate frame it samples, so proxy and final agree on when a frame is.
 * 4. Both tiers publish the same edit fingerprint while their chunk identities
 *    differ, which is what lets a proxy pass be discarded without invalidating
 *    the authored edit, and `verifyProductionRenderJobPlan` accepts the plan it
 *    produced and refuses one whose frame range was widened by a single frame.
 * 5. Captions become canonical WebVTT addressed in film seconds, and the audio
 *    cue keeps its digest-, duration-, and format-verified asset. The cue's
 *    `sourceDurationFrames` is verified as the complete asset at the asset's
 *    own sample clock, so a trim that starts partway through a longer asset is
 *    carried through as authored.
 * 6. Refusals: a non-positive chunk size, a runtime digest that is not a
 *    SHA-256 identity, a frame step that does not divide the edit, a "final"
 *    tier that is not exactly full quality, a "proxy" tier that reduces
 *    nothing, an odd authored raster, a timeline whose clock disagrees with the
 *    production, a shot with no compiler-owned source fingerprint, an audio cue
 *    with no verified asset, and a guide-pass request naming two passes.
 * 7. A canonical voiced dialogue identity is preserved while malformed
 *    dialogue identities refuse rather than being treated as silence.
 * 8. Changing only the normalized crop invalidates every chunk identity while
 *    preserving the raster, clock, and exact crop in both frame formats.
 */
export const test_production_render_job_plan = (): void => {
  const final = plan({});
  const voicedDialogueIdentity = digest("f");
  const voiced = plan({
    runtimeIdentity: {
      ...RUNTIME_IDENTITY,
      dialogueRuntimeIdentity: voicedDialogueIdentity,
    },
  });
  TestValidator.equals(
    "the final tier renders the authored contract without economising it",
    {
      version: final.version,
      productionId: final.productionId,
      tier: final.tier,
      sourceFrameFormat: final.sourceFrameFormat,
      frameFormat: final.frameFormat,
      totalFrames: final.totalFrames,
      chunkFrames: final.chunkFrames,
      compileFingerprint: final.compileFingerprint,
      voicedDialogueIdentity: voiced.runtimeIdentity.dialogueRuntimeIdentity,
    },
    {
      version: 4,
      productionId: "fixture-film",
      tier: { kind: "final", resolutionScale: 1, frameStep: 1 },
      sourceFrameFormat: {
        width: 32,
        height: 18,
        fps: 24,
        colorSpace: "srgb",
      },
      frameFormat: { width: 32, height: 18, fps: 24, colorSpace: "srgb" },
      totalFrames: 12,
      chunkFrames: 5,
      compileFingerprint: digest("d"),
      voicedDialogueIdentity,
    },
  );
  const croppedProduction = PRODUCTION();
  croppedProduction.frameFormat.crop = {
    left: 0.1,
    top: 0.2,
    right: 0.9,
    bottom: 0.8,
  };
  const cropped = plan({ production: croppedProduction });
  TestValidator.equals(
    "a crop-only change invalidates chunks without changing raster or clock",
    {
      sourceFrameFormat: cropped.sourceFrameFormat,
      frameFormat: cropped.frameFormat,
      everyChunkChanged: cropped.chunks.every(
        (chunk, index) => chunk.id !== final.chunks[index]?.id,
      ),
    },
    {
      sourceFrameFormat: croppedProduction.frameFormat,
      frameFormat: croppedProduction.frameFormat,
      everyChunkChanged: true,
    },
  );
  TestValidator.equals(
    "only the two moving-image deliverables are cut into resumable ranges",
    chunkShape(final),
    [
      {
        slot: "fixture-film:final:feature:beauty:0",
        frameStart: 0,
        frameEndExclusive: 5,
      },
      {
        slot: "fixture-film:final:feature:beauty:1",
        frameStart: 5,
        frameEndExclusive: 10,
      },
      {
        slot: "fixture-film:final:feature:beauty:2",
        frameStart: 10,
        frameEndExclusive: 12,
      },
      {
        slot: "fixture-film:final:depth-guide:depth:0",
        frameStart: 0,
        frameEndExclusive: 5,
      },
      {
        slot: "fixture-film:final:depth-guide:depth:1",
        frameStart: 5,
        frameEndExclusive: 10,
      },
      {
        slot: "fixture-film:final:depth-guide:depth:2",
        frameStart: 10,
        frameEndExclusive: 12,
      },
    ],
  );

  TestValidator.equals(
    "every final frame reads its own segment at full weight across the cut",
    final.chunks
      .filter((chunk) => chunk.kind === "feature")
      .flatMap((chunk) => chunk.frames)
      .map((entry) => ({
        globalFrame: entry.globalFrame,
        timelineFrame: entry.timelineFrame,
        layers: entry.layers,
      })),
    Array.from({ length: 12 }, (_unused, globalFrame) => ({
      globalFrame,
      timelineFrame: globalFrame,
      layers: [
        globalFrame < 6
          ? { shot: "opening", sourceFrame: globalFrame, weight: 1 }
          : { shot: "answer", sourceFrame: globalFrame - 2, weight: 1 },
      ],
    })),
  );

  const proxy = plan({
    tier: { kind: "proxy", resolutionScale: 0.5, frameStep: 2 },
  });
  TestValidator.equals(
    "the proxy tier halves the raster and clock while keeping the same runtime",
    {
      frameFormat: proxy.frameFormat,
      sourceFrameFormat: proxy.sourceFrameFormat,
      totalFrames: proxy.totalFrames,
      chunks: chunkShape(proxy),
      timelineFrames: proxy.chunks
        .filter((chunk) => chunk.kind === "feature")
        .flatMap((chunk) => chunk.frames.map((entry) => entry.timelineFrame)),
      shots: proxy.chunks
        .filter((chunk) => chunk.kind === "feature")
        .flatMap((chunk) =>
          chunk.frames.flatMap((entry) =>
            entry.layers.map((layer) => layer.shot),
          ),
        ),
    },
    {
      frameFormat: {
        width: 16,
        height: 8,
        fps: 12,
        frameRate: { numerator: 12, denominator: 1 },
        colorSpace: "srgb",
      },
      sourceFrameFormat: {
        width: 32,
        height: 18,
        fps: 24,
        colorSpace: "srgb",
      },
      totalFrames: 6,
      chunks: [
        {
          slot: "fixture-film:proxy:feature:beauty:0",
          frameStart: 0,
          frameEndExclusive: 5,
        },
        {
          slot: "fixture-film:proxy:feature:beauty:1",
          frameStart: 5,
          frameEndExclusive: 6,
        },
        {
          slot: "fixture-film:proxy:depth-guide:depth:0",
          frameStart: 0,
          frameEndExclusive: 5,
        },
        {
          slot: "fixture-film:proxy:depth-guide:depth:1",
          frameStart: 5,
          frameEndExclusive: 6,
        },
      ],
      timelineFrames: [0, 2, 4, 6, 8, 10],
      shots: ["opening", "opening", "opening", "answer", "answer", "answer"],
    },
  );
  TestValidator.predicate(
    "a proxy frame carries the film second of the full-rate frame it samples",
    proxy.chunks
      .filter((chunk) => chunk.kind === "feature")
      .flatMap((chunk) => chunk.frames)
      .every((entry) => nclose(entry.timeSeconds, entry.timelineFrame / 24)),
  );
  TestValidator.predicate(
    "the tier raster derivation answers the plan it produced",
    (() => {
      const derived = resolveProductionRenderTierFrameFormat(
        { width: 32, height: 18, fps: 24, colorSpace: "srgb" },
        proxy.tier,
      );
      return (
        derived.width === proxy.frameFormat.width &&
        derived.height === proxy.frameFormat.height &&
        nclose(derived.fps, proxy.frameFormat.fps)
      );
    })(),
  );

  TestValidator.equals(
    "the edit survives a tier change while the work to redo does not",
    namedFacts([
      ["sameEdit", () => proxy.editFingerprint === final.editFingerprint],
      [
        "differentChunks",
        () =>
          proxy.chunks.every((chunk) =>
            final.chunks.every((other) => other.id !== chunk.id),
          ),
      ],
      [
        "finalVerifies",
        () =>
          throwsError(() =>
            verifyProductionRenderJobPlan({
              plan: final,
              timeline: TIMELINE(),
              effects: [],
              production: PRODUCTION(),
              runtimeIdentity: RUNTIME_IDENTITY,
              sourceFingerprints: SOURCE_FINGERPRINTS,
              audioAssets: [AUDIO_ASSET],
            }),
          ) === false,
      ],
      [
        "proxyVerifies",
        () =>
          throwsError(() =>
            verifyProductionRenderJobPlan({
              plan: proxy,
              timeline: TIMELINE(),
              effects: [],
              production: PRODUCTION(),
              runtimeIdentity: RUNTIME_IDENTITY,
              sourceFingerprints: SOURCE_FINGERPRINTS,
              audioAssets: [AUDIO_ASSET],
            }),
          ) === false,
      ],
      [
        "widenedRangeRefused",
        () =>
          throwsError(
            () =>
              verifyProductionRenderJobPlan({
                plan: {
                  ...final,
                  chunks: final.chunks.map((chunk, index) =>
                    index === 0
                      ? { ...chunk, frameEndExclusive: 6 }
                      : structuredClone(chunk),
                  ),
                },
                timeline: TIMELINE(),
                effects: [],
                production: PRODUCTION(),
                runtimeIdentity: RUNTIME_IDENTITY,
                sourceFingerprints: SOURCE_FINGERPRINTS,
                audioAssets: [AUDIO_ASSET],
              }),
            "Stored render plan differs",
          ),
      ],
    ]),
    {
      sameEdit: true,
      differentChunks: true,
      finalVerifies: true,
      proxyVerifies: true,
      widenedRangeRefused: true,
    },
  );

  TestValidator.equals(
    "the non-video tracks travel with the plan in film time",
    {
      captions: final.tracks.captions,
      audioAssets: final.tracks.audioAssets,
      audio: final.tracks.audio.map((cue) => cue.id),
    },
    {
      captions: [
        "WEBVTT fixture-film",
        "",
        "cue-1",
        "00:00:00.000 --> 00:00:00.500",
        "<lang en>Signal.</lang>",
        "",
      ].join("\n"),
      audioAssets: [{ ...AUDIO_ASSET }],
      audio: ["tone"],
    },
  );
  TestValidator.equals(
    "WAVE source facts and processing survive render planning",
    [
      plan({ audioAssets: [WAVE_AUDIO_ASSET] }).tracks.audioAssets[0],
      plan({ audioAssets: [RESAMPLED_WAVE_AUDIO_ASSET] }).tracks.audioAssets[0],
      plan({ audioAssets: [MONO_WAVE_AUDIO_ASSET] }).tracks.audioAssets[0],
      plan({ audioAssets: [MONO_FLOAT_WAVE_AUDIO_ASSET] }).tracks
        .audioAssets[0],
      plan({ audioAssets: [LEGACY_WAVE_AUDIO_ASSET] }).tracks.audioAssets[0],
    ],
    [
      WAVE_AUDIO_ASSET,
      RESAMPLED_WAVE_AUDIO_ASSET,
      MONO_WAVE_AUDIO_ASSET,
      MONO_FLOAT_WAVE_AUDIO_ASSET,
      LEGACY_WAVE_AUDIO_ASSET,
    ],
  );
  TestValidator.predicate(
    "a mono WAVE identity must carry the mono channel mask",
    throwsError(
      () =>
        plan({
          audioAssets: [
            {
              ...MONO_WAVE_AUDIO_ASSET,
              sourceFormat: {
                ...MONO_WAVE_AUDIO_ASSET.sourceFormat,
                layout: {
                  ...MONO_WAVE_AUDIO_ASSET.sourceFormat.layout,
                  mask: 0x3,
                },
              },
            },
          ],
        }),
      "invalid identity",
    ),
  );
  // The cue's `sourceDurationFrames` names the complete asset, so a one-second
  // asset is verified by a 24-frame declaration and the twelve-frame trim that
  // starts twelve frames in is the asset's second half, carried through as
  // authored rather than re-read as a span or a rate.
  const offsetCue = {
    ...TIMELINE().tracks.audio[0]!,
    sourceDurationFrames: 24,
    sourceOffsetFrame: 12,
  };
  const offsetAudio = plan({
    audioAssets: [LONG_AUDIO_ASSET],
    timeline: audioTimeline(offsetCue),
  });
  TestValidator.equals(
    "audio source duration identifies the complete asset while the offset trim is carried as authored",
    {
      asset: offsetAudio.tracks.audioAssets[0],
      cue: offsetAudio.tracks.audio[0],
    },
    {
      asset: LONG_AUDIO_ASSET,
      cue: offsetCue,
    },
  );

  TestValidator.equals(
    "every planning input a worker cannot recover from is refused by name",
    namedFacts([
      [
        "chunkFrames",
        () =>
          throwsError(
            () => plan({ chunkFrames: 0 }),
            "chunkFrames must be a positive safe integer",
          ),
      ],
      [
        "runtimeDigest",
        () =>
          throwsError(
            () =>
              plan({
                runtimeIdentity: {
                  ...RUNTIME_IDENTITY,
                  sourceDigest: "sha256:not-a-digest" as AutoMovieContentDigest,
                },
              }),
            "one current SHA-256 content identity",
          ),
      ],
      [
        "dialogueRuntimeDigest",
        () =>
          throwsError(
            () =>
              plan({
                runtimeIdentity: {
                  ...RUNTIME_IDENTITY,
                  dialogueRuntimeIdentity:
                    "sha256:not-a-digest" as AutoMovieContentDigest,
                },
              }),
            "dialogueRuntimeIdentity must be null or one current SHA-256 content identity",
          ),
      ],
      [
        "indivisibleStep",
        () =>
          throwsError(
            () =>
              plan({
                tier: { kind: "proxy", resolutionScale: 1, frameStep: 5 },
              }),
            "does not divide the 12-frame edit",
          ),
      ],
      [
        "economisedFinal",
        () =>
          throwsError(
            () =>
              plan({
                tier: { kind: "final", resolutionScale: 0.5, frameStep: 1 },
              }),
            "exact final (scale 1, step 1)",
          ),
      ],
      [
        "reductionlessProxy",
        () =>
          throwsError(
            () =>
              plan({
                tier: { kind: "proxy", resolutionScale: 1, frameStep: 1 },
              }),
            "at least one reduction",
          ),
      ],
      [
        "oddRaster",
        () =>
          throwsError(
            () =>
              plan({
                production: productionDesign({
                  targetRuntimeSeconds: 0.5,
                  frameFormat: {
                    width: 33,
                    height: 18,
                    fps: 24,
                    colorSpace: "srgb",
                  },
                  deliverables: [
                    { id: "feature", kind: "feature", required: true },
                  ],
                }),
              }),
            "requires even width and height",
          ),
      ],
      [
        "clockDisagreement",
        () =>
          throwsError(
            () => plan({ timeline: TIMELINE({ fps: 25 }) }),
            "differs from the production identity, frame clock, or runtime",
          ),
      ],
      [
        "unfingerprintedShot",
        () =>
          throwsError(
            () => plan({ sourceFingerprints: { opening: digest("1") } }),
            'shot "answer" without one current compiler-owned source fingerprint',
          ),
      ],
      [
        "unverifiedAudio",
        () =>
          throwsError(
            () => plan({ audioAssets: [] }),
            'Audio cue "tone" lacks one digest-, format-, and duration-verified source asset',
          ),
      ],
      [
        "sourceFrameMismatch",
        () =>
          throwsError(
            () =>
              plan({
                audioAssets: [
                  {
                    ...AUDIO_ASSET,
                    sourceFrames: AUDIO_ASSET.sourceFrames + 1,
                  },
                ],
              }),
            "invalid identity, duration, sample rate, channels, or duplicate ownership",
          ),
      ],
      [
        "durationFrameMismatch",
        () =>
          throwsError(
            () =>
              plan({
                audioAssets: [{ ...AUDIO_ASSET, durationSeconds: 0.25 }],
              }),
            "invalid identity, duration, sample rate, channels, or duplicate ownership",
          ),
      ],
      [
        "contradictoryWaveLayout",
        () =>
          throwsError(
            () =>
              plan({
                audioAssets: [
                  {
                    ...WAVE_AUDIO_ASSET,
                    sourceFormat: {
                      ...WAVE_AUDIO_ASSET.sourceFormat,
                      layout: {
                        ...WAVE_AUDIO_ASSET.sourceFormat.layout,
                        mask: 0x5,
                      },
                    },
                  },
                ],
              }),
            "invalid identity, duration, sample rate, channels, or duplicate ownership",
          ),
      ],
      [
        "unknownAudioKind",
        () =>
          throwsError(
            () =>
              plan({
                audioAssets: [
                  {
                    ...AUDIO_ASSET,
                    kind: "unknown-audio" as never,
                  },
                ],
              }),
            "invalid identity, duration, sample rate, channels, or duplicate ownership",
          ),
      ],
      [
        "unknownWaveEncoding",
        () =>
          throwsError(
            () =>
              plan({
                audioAssets: [
                  {
                    ...WAVE_AUDIO_ASSET,
                    sourceFormat: {
                      ...WAVE_AUDIO_ASSET.sourceFormat,
                      encoding: "unknown-encoding" as never,
                    },
                  },
                ],
              }),
            "invalid identity, duration, sample rate, channels, or duplicate ownership",
          ),
      ],
      [
        "unknownWaveLayoutSource",
        () =>
          throwsError(
            () =>
              plan({
                audioAssets: [
                  {
                    ...WAVE_AUDIO_ASSET,
                    sourceFormat: {
                      ...WAVE_AUDIO_ASSET.sourceFormat,
                      layout: {
                        ...WAVE_AUDIO_ASSET.sourceFormat.layout,
                        source: "unknown-layout-source" as never,
                      },
                    },
                  },
                ],
              }),
            "invalid identity, duration, sample rate, channels, or duplicate ownership",
          ),
      ],
      [
        "nonCanonicalWaveOutputRate",
        () =>
          throwsError(
            () =>
              plan({
                audioAssets: [
                  {
                    ...RESAMPLED_WAVE_AUDIO_ASSET,
                    processing: {
                      ...RESAMPLED_WAVE_AUDIO_ASSET.processing,
                      outputSampleRate: 24_000,
                    },
                  },
                ],
              }),
            "invalid identity, duration, sample rate, channels, or duplicate ownership",
          ),
      ],
      [
        "ambiguousGuidePass",
        () =>
          throwsError(
            () => plan({ guidePasses: ["pose", "depth"] }),
            "requires exactly one declared pass",
          ),
      ],
    ]),
    {
      chunkFrames: true,
      runtimeDigest: true,
      dialogueRuntimeDigest: true,
      indivisibleStep: true,
      economisedFinal: true,
      reductionlessProxy: true,
      oddRaster: true,
      clockDisagreement: true,
      unfingerprintedShot: true,
      unverifiedAudio: true,
      sourceFrameMismatch: true,
      durationFrameMismatch: true,
      contradictoryWaveLayout: true,
      unknownAudioKind: true,
      unknownWaveEncoding: true,
      unknownWaveLayoutSource: true,
      nonCanonicalWaveOutputRate: true,
      ambiguousGuidePass: true,
    },
  );
};

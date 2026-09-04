import {
  AutoMovieContentDigest,
  IAutoMovieFilmTimeline,
} from "@automovie/interface";
import {
  assembleProductionChunkVideoMp4,
  assertProductionFeatureUsesRenditionVideo,
  conformProductionRenditionVideoMp4,
  conformProductionVisualDeliveryVideoMp4,
  probeProductionVideoMp4,
  productionVisualDeliveryOccurrence,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

import { namedFacts, throwsError } from "../internal/predicates";
import {
  productionH264Mp4,
  productionMpeg4Part2Mp4,
} from "./productionMediaFixtures";

const WIDTH = 16;
const HEIGHT = 16;
const FPS = 2;

/** The chunk sizes one render job hands the final assembly, in play order. */
const CHUNK_FRAMES = [3, 2, 1];
const TOTAL_FRAMES = CHUNK_FRAMES.reduce((sum, count) => sum + count, 0);

const digest = (digit: string): AutoMovieContentDigest =>
  `sha256:${digit.repeat(64)}`;

/**
 * The same ranges expressed as a cut-only edit, so the expected assembly can be
 * derived through the independent repaint-conform path rather than restated.
 */
const rangeTimeline = (): IAutoMovieFilmTimeline => {
  let startFrame = 0;
  return {
    version: 1,
    compiler: "automovie.production.compiler.v5",
    inputFingerprint: digest("1"),
    sourceDigest: digest("2"),
    id: "assembly",
    fps: FPS,
    totalFrames: TOTAL_FRAMES,
    segments: CHUNK_FRAMES.map((count, index) => {
      const segment = {
        shot: `range-${index}`,
        sourceInFrame: 0,
        sourceOutFrame: count,
        startFrame,
        endFrame: startFrame + count,
        headHandleFrames: 0,
        tailHandleFrames: 0,
        transitionIn: { kind: "cut" as const },
        transitionOut: { kind: "cut" as const },
      };
      startFrame += count;
      return segment;
    }),
    omissions: [],
    tracks: { audio: [], captions: [], effects: [] },
  };
};

/**
 * A long film's final video is assembled from the chunk encodes it already
 * committed, never re-encoded from the frames a second time.
 *
 * Re-encoding every frame of the film through one encoder is what bounded a
 * production: the cost grows with the frame count and the whole output has to
 * be resident inside a single encoder before anything can be published, so no
 * amount of patience finishes a long film. Each chunk was already encoded once,
 * probed, and published under a receipt, so the whole film is exactly those
 * samples in order. Copying them costs the bytes and nothing else, and it
 * cannot alter a reviewed pixel.
 *
 * Scenarios:
 *
 * 1. An assembly spanning one chunk is byte-identical to encoding that chunk,
 *    which is the whole film for a production short enough to do both ways.
 * 2. An assembly of many chunks carries every source sample unaltered, in play
 *    order, on one continuous clock -- proven against the same ranges conformed
 *    through the independent repaint path.
 * 3. Assembling twice, and assembling again after an interrupted attempt, produce
 *    byte-identical films: the assembly is a pure function of the receipt-bound
 *    chunk bytes, so a resumed render publishes what an uninterrupted one would
 *    have.
 * 4. No chunks, a chunk that changes raster mid-film, a chunk that is not H.264, a
 *    frame total the chunks do not cover, and a runtime past the exact MP4
 *    clock are each refused rather than silently re-encoded.
 */
export const test_production_chunk_video_assembly = async (): Promise<void> => {
  const frameFormat = { fps: FPS, height: HEIGHT, width: WIDTH };
  const chunks: Uint8Array[] = [];
  for (const frameCount of CHUNK_FRAMES)
    chunks.push(
      await productionH264Mp4({
        width: WIDTH,
        height: HEIGHT,
        fps: FPS,
        frameCount,
      }),
    );
  const narrowChunk = await productionH264Mp4({
    width: WIDTH - 8,
    height: HEIGHT - 8,
    fps: FPS,
    frameCount: 2,
  });
  const whole = await productionH264Mp4({
    width: WIDTH,
    height: HEIGHT,
    fps: FPS,
    frameCount: TOTAL_FRAMES,
  });

  const single = assembleProductionChunkVideoMp4({
    chunks: [whole],
    frameFormat,
    totalFrames: TOTAL_FRAMES,
  });
  TestValidator.equals(
    "an assembly spanning one chunk is the monolithic encode of that chunk",
    namedFacts([
      [
        "theSingleChunkAssemblyIsByteIdentical",
        () => Buffer.from(single).equals(Buffer.from(whole)),
      ],
      [
        "theSingleChunkAssemblyCarriesTheWholeFilm",
        () => probeProductionVideoMp4(single).frameCount === TOTAL_FRAMES,
      ],
    ]),
    {
      theSingleChunkAssemblyIsByteIdentical: true,
      theSingleChunkAssemblyCarriesTheWholeFilm: true,
    },
  );

  const assembled = assembleProductionChunkVideoMp4({
    chunks,
    frameFormat,
    totalFrames: TOTAL_FRAMES,
  });
  const conformed = conformProductionRenditionVideoMp4({
    timeline: rangeTimeline(),
    clips: new Map(
      CHUNK_FRAMES.map((_count, index): [string, Uint8Array] => [
        `range-${index}`,
        chunks[index]!,
      ]),
    ),
  });
  const probe = probeProductionVideoMp4(assembled);
  const timeline = rangeTimeline();
  const mixed = conformProductionVisualDeliveryVideoMp4({
    timeline,
    sources: timeline.segments.map((segment, index) => ({
      occurrence: productionVisualDeliveryOccurrence(segment, index),
      lane: index === 1 ? ("repainted" as const) : ("deterministic" as const),
      bytes: index === 1 ? chunks[index]! : assembled,
    })),
  });
  TestValidator.equals(
    "a many-chunk assembly carries every source sample onto one continuous clock",
    namedFacts([
      ["theAssemblyCoversEveryFrame", () => probe.frameCount === TOTAL_FRAMES],
      ["theAssemblyKeepsTheRaster", () => probe.width === WIDTH],
      ["theAssemblyKeepsTheRasterHeight", () => probe.height === HEIGHT],
      ["theAssemblyKeepsTheFrameClock", () => Math.abs(probe.fps - FPS) < 1e-9],
      [
        "theAssemblyRunsTheWholeFilm",
        () => Math.abs(probe.runtimeSeconds - TOTAL_FRAMES / FPS) < 1e-9,
      ],
      [
        "theAssemblyIsSampleIdenticalToTheSameRangesConformed",
        () => {
          assertProductionFeatureUsesRenditionVideo({
            feature: assembled,
            renditionVideo: conformed,
          });
          return true;
        },
      ],
      [
        "theAssemblyIsNotOneChunkVerbatim",
        () => Buffer.from(assembled).equals(Buffer.from(chunks[0]!)) === false,
      ],
      [
        "explicitMixedLanesPreserveTheSameSamples",
        () => {
          assertProductionFeatureUsesRenditionVideo({
            feature: mixed,
            renditionVideo: assembled,
          });
          return true;
        },
      ],
    ]),
    {
      theAssemblyCoversEveryFrame: true,
      theAssemblyKeepsTheRaster: true,
      theAssemblyKeepsTheRasterHeight: true,
      theAssemblyKeepsTheFrameClock: true,
      theAssemblyRunsTheWholeFilm: true,
      theAssemblyIsSampleIdenticalToTheSameRangesConformed: true,
      theAssemblyIsNotOneChunkVerbatim: true,
      explicitMixedLanesPreserveTheSameSamples: true,
    },
  );

  const interrupted = throwsError(
    () =>
      assembleProductionChunkVideoMp4({
        chunks: (function* () {
          yield chunks[0]!;
          throw new Error("the render worker was interrupted");
        })(),
        frameFormat,
        totalFrames: TOTAL_FRAMES,
      }),
    "the render worker was interrupted",
  );
  const resumed = assembleProductionChunkVideoMp4({
    chunks,
    frameFormat,
    totalFrames: TOTAL_FRAMES,
  });
  TestValidator.equals(
    "a resumed assembly publishes exactly what an uninterrupted one would have",
    namedFacts([
      ["theInterruptedAttemptFailed", () => interrupted],
      [
        "theResumedAssemblyIsByteIdentical",
        () => Buffer.from(resumed).equals(Buffer.from(assembled)),
      ],
    ]),
    {
      theInterruptedAttemptFailed: true,
      theResumedAssemblyIsByteIdentical: true,
    },
  );

  const refuses = (
    props: Parameters<typeof assembleProductionChunkVideoMp4>[0],
    message: string,
  ): boolean =>
    throwsError(() => assembleProductionChunkVideoMp4(props), message);
  TestValidator.equals(
    "an assembly refuses chunks it cannot splice without re-encoding them",
    namedFacts([
      [
        "noChunksIsRefused",
        () =>
          refuses(
            { chunks: [], frameFormat, totalFrames: TOTAL_FRAMES },
            "at least one encoded render chunk",
          ),
      ],
      [
        "aChangedRasterIsRefusedByIndex",
        () =>
          refuses(
            {
              chunks: [chunks[0]!, narrowChunk],
              frameFormat,
              totalFrames: TOTAL_FRAMES,
            },
            "Render chunk 1 does not share the assembled raster",
          ),
      ],
      [
        "aNonH264ChunkIsRefused",
        () =>
          refuses(
            {
              chunks: [productionMpeg4Part2Mp4()],
              frameFormat,
              totalFrames: TOTAL_FRAMES,
            },
            "is not an H.264/AVC sample entry",
          ),
      ],
      [
        "aSingleChunkShortOfTheFilmIsRefused",
        () =>
          refuses(
            { chunks: [whole], frameFormat, totalFrames: TOTAL_FRAMES + 1 },
            `Chunked video assembly covers ${TOTAL_FRAMES} frames; expected ${TOTAL_FRAMES + 1}.`,
          ),
      ],
      [
        "manyChunksShortOfTheFilmAreRefused",
        () =>
          refuses(
            { chunks, frameFormat, totalFrames: TOTAL_FRAMES - 1 },
            "Assembled chunk video parses as",
          ),
      ],
      [
        "aRuntimePastTheExactClockIsRefused",
        () =>
          refuses(
            { chunks, frameFormat, totalFrames: Number.MAX_SAFE_INTEGER },
            "exceeds the exact MP4 clock range",
          ),
      ],
    ]),
    {
      noChunksIsRefused: true,
      aChangedRasterIsRefusedByIndex: true,
      aNonH264ChunkIsRefused: true,
      aSingleChunkShortOfTheFilmIsRefused: true,
      manyChunksShortOfTheFilmAreRefused: true,
      aRuntimePastTheExactClockIsRefused: true,
    },
  );
};
